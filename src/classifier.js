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

async function runClassification({
  dryRun = false,
  verbose = false,
  useLogger = false,
}) {
  const log = useLogger
    ? logger
    : { info: () => {}, debug: () => {}, error: () => {} };
  const outDir = config.dataDir
    ? path.resolve(config.dataDir)
    : process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : process.env.BUDGET_CACHE_DIR
        ? path.resolve(process.env.BUDGET_CACHE_DIR)
        : path.resolve(__dirname, '../data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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
      rawTxns.push(...txns.filter((tx) => !tx.reconciled && !tx.category));
    }

    // Prepare descriptions
    const payees = await getPayees();
    const payeeMap = Object.fromEntries(payees.map((p) => [p.id, p.name]));
    let toClassify = rawTxns.map((tx) => ({
      id: tx.id,
      // Combine payee name, memo/notes, and transaction amount
      description: [
        payeeMap[tx.payee],
        tx.notes,
        tx.amount != null ? (tx.amount / 100).toFixed(2) : undefined,
      ]
        .filter((s) => typeof s === 'string' && s.trim())
        .join(' – '),
    }));
    // Skip records with empty combined description
    toClassify = toClassify.filter((row) => row.description.trim() !== '');
    if (verbose) {
      log.debug({ toClassify }, 'Prepared records to classify');
    }

    // Choose and run classification backend (ml or tf)
    const classifierType =
      config.classifierType ||
      config.CLASSIFIER_TYPE ||
      process.env.CLASSIFIER_TYPE ||
      'ml';
    const modelDir = path.join(
      outDir,
      classifierType === 'tf' ? 'tx-classifier-tf' : 'tx-classifier-knn',
    );
    const classified =
      classifierType === 'tf'
        ? await classifyWithTF(toClassify, modelDir)
        : await classifyWithML(toClassify, modelDir);

    // Apply predicted categories (and optionally mark reconciled)
    const categories = await getCategories();
    // AUTO_RECONCILE: default to true, disable only if explicitly set to 'false'
    const reconcileSetting =
      config.autoReconcile ??
      config.AUTO_RECONCILE ??
      process.env.AUTO_RECONCILE;
    const autoReconcile =
      reconcileSetting === undefined ||
      String(reconcileSetting).toLowerCase() !== 'false';
    let appliedCount = 0;
    for (const tx of classified) {
      if (!tx.category) continue;
      log.debug(
        { txId: tx.id, category: tx.category },
        'Applying classification',
      );
      const catObj = categories.find((c) => c.name === tx.category);
      if (!catObj) {
        log.error({ category: tx.category }, 'Category not found');
        process.exit(1);
      }
      if (!dryRun) {
        const update = { category: catObj.id };
        if (autoReconcile) update.reconciled = true;
        await updateTransaction(tx.id, update);
      } else {
        log.info(
          { txId: tx.id, category: tx.category },
          'Dry-run; skip updateTransaction',
        );
      }
      appliedCount++;
    }
    const durationMs = Date.now() - start;
    log.info({ appliedCount, durationMs }, 'Classification run complete');
    return appliedCount;
  } finally {
    await closeBudget();
  }
}

module.exports = { runClassification };
