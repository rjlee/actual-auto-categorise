#!/usr/bin/env node
// Core classification logic extracted for reuse (CLI + cron)
require('./suppress');
// Load environment variables when invoked as CLI, not on import
if (require.main === module) {
  require('dotenv').config();
}

const fs = require('fs');
const path = require('path');
const { openBudget, closeBudget } = require('./utils');
const {
  getAccounts,
  getTransactions,
  getPayees,
  getCategories,
  updateTransaction,
} = require('@actual-app/api');
const config = require('./config');
const { classifyWithML } = require('./services/mlClassifier');
const { classifyWithTF } = require('./services/tfClassifier');

/**
 * Download new transactions, classify them, and apply updates.
 * @param {{dryRun: boolean, verbose: boolean}} options
 * @returns {Promise<number>} number of transactions applied (or to apply)
 */
const logger = require('./logger');

async function runClassification({ dryRun = false, verbose = false, useLogger = false }) {
  const log = useLogger
    ? logger
    : { info: () => {}, debug: () => {}, error: () => {} };
  const outDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // Capture classification cache directory (budget/classify)
  const cacheDir = process.env.BUDGET_CACHE_DIR;

  // Open budget (abort this run on failure)
  try {
    log.info({ dryRun, verbose }, 'Opening budget');
    await openBudget();
  } catch (err) {
    log.error({ err }, 'Failed to open budget; skipping classification run');
    return 0;
  }
  const start = Date.now();
  try {
    // Fetch unreconciled, uncategorized transactions
    const accounts = await getAccounts();
    let rawTxns = [];
    for (const acct of accounts) {
      const txns = await getTransactions(acct.id);
      rawTxns.push(...txns.filter(tx => !tx.reconciled && !tx.category));
    }

    // Prepare descriptions
    const payees = await getPayees();
    const payeeMap = Object.fromEntries(payees.map(p => [p.id, p.name]));
    let toClassify = rawTxns.map(tx => ({
      id:          tx.id,
      description: payeeMap[tx.payee] || tx.description || ''
    }));
    // Skip records with empty description
    toClassify = toClassify.filter((row) => row.description.trim() !== '');
    if (verbose) {
      log.debug({ toClassify }, 'Prepared records to classify');
    }

    // Choose and run classification backend (ml or tf)
    const classifierType =
      config.classifierType || config.CLASSIFIER_TYPE || process.env.CLASSIFIER_TYPE || 'ml';
    const modelDir = path.join(
      outDir,
      classifierType === 'tf' ? 'tx-classifier-tf' : 'tx-classifier-knn'
    );
    const classified =
      classifierType === 'tf'
        ? await classifyWithTF(toClassify, modelDir)
        : await classifyWithML(toClassify, modelDir);

    // Apply predicted categories
    const categories = await getCategories();
    let appliedCount = 0;
    for (const tx of classified) {
      if (!tx.category) continue;
      log.debug({ txId: tx.id, category: tx.category }, 'Applying classification');
      const catObj = categories.find(c => c.name === tx.category);
      if (!catObj) {
        log.error({ category: tx.category }, 'Category not found');
        process.exit(1);
      }
      if (!dryRun) {
        await updateTransaction(tx.id, { category: catObj.id });
      } else {
        log.info({ txId: tx.id, category: tx.category }, 'Dry-run; skip updateTransaction');
      }
      appliedCount++;
    }
    const durationMs = Date.now() - start;
    log.info({ appliedCount, durationMs }, 'Classification run complete');
    return appliedCount;
  } finally {
    await closeBudget();
    // Clean up only this classification run's cache files
    if (cacheDir && fs.existsSync(cacheDir)) {
      for (const item of fs.readdirSync(cacheDir)) {
        try {
          fs.rmSync(path.join(cacheDir, item), { recursive: true, force: true });
        } catch (_) {}
      }
    }
  }
}

module.exports = { runClassification };