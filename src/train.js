#!/usr/bin/env node
// Combined download and training script for Cashivo Embed+KNN classifier
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
} = require('@actual-app/api');
const logger = require('./logger');
const config = require('./config');

/**
 * Download reconciled, categorized transactions, embed, and save an Embed+KNN model.
 * @param {{ verbose?: boolean }} options
 */
async function runTraining({ verbose = false } = {}) {
  const log = logger;
  const outDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Open budget (abort this run on failure)
  // Capture training cache directory (budget/train)
  const cacheDir = process.env.BUDGET_CACHE_DIR;
  try {
    log.info('Opening budget');
    await openBudget();
  } catch (err) {
    log.error({ err }, 'Failed to open budget; skipping training run');
    return;
  }
  // Branch training based on classifierType
  const classifierType =
    config.classifierType ||
    config.CLASSIFIER_TYPE ||
    process.env.CLASSIFIER_TYPE;
  if (classifierType === 'tf') {
    // Delegate to TF trainer service
    const { trainTF } = require('./services/tfTrainer');
    // Collect the same trainingData as for the KNN branch
    const accounts = await getAccounts();
    let rawTxns = [];
    for (const acct of accounts) {
      const txns = await getTransactions(acct.id);
      rawTxns.push(...txns.filter((tx) => tx.reconciled && tx.category));
    }
    const payees = await getPayees();
    const payeeMap = Object.fromEntries(payees.map((p) => [p.id, p.name]));
    const categories = await getCategories();
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    let trainingData = rawTxns
      .filter((tx) => catMap[tx.category])
      .map((tx) => ({
        id: tx.id,
        description: [
          payeeMap[tx.payee],
          tx.notes,
          tx.amount != null ? (tx.amount / 100).toFixed(2) : undefined,
        ]
          .filter((s) => typeof s === 'string' && s.trim())
          .join(' – '),
        category: catMap[tx.category],
      }))
      .filter((row) => row.description.trim() !== '');
    const modelDir = path.join(outDir, 'tx-classifier-tf');
    await trainTF(trainingData, modelDir);
    await closeBudget();
    // Clean up training cache directory
    if (cacheDir && fs.existsSync(cacheDir)) {
      for (const item of fs.readdirSync(cacheDir)) {
        try {
          fs.rmSync(path.join(cacheDir, item), {
            recursive: true,
            force: true,
          });
        } catch (_) {}
      }
    }
    return;
  }
  try {
    const accounts = await getAccounts();
    let rawTxns = [];
    for (const acct of accounts) {
      const txns = await getTransactions(acct.id);
      rawTxns.push(...txns.filter((tx) => tx.reconciled && tx.category));
    }

    const payees = await getPayees();
    const payeeMap = Object.fromEntries(payees.map((p) => [p.id, p.name]));
    const categories = await getCategories();
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    const unknownCount = rawTxns.filter((tx) => !catMap[tx.category]).length;
    if (unknownCount) {
      log.warn(
        `Skipping ${unknownCount} transactions with unknown category IDs`,
      );
    }
    rawTxns = rawTxns.filter((tx) => catMap[tx.category]);

    let trainingData = rawTxns
      .map((tx) => ({
        id: tx.id,
        description: [
          payeeMap[tx.payee],
          tx.notes,
          tx.amount != null ? (tx.amount / 100).toFixed(2) : undefined,
        ]
          .filter((s) => typeof s === 'string' && s.trim())
          .join(' – '),
        category: catMap[tx.category],
      }))
      .filter((row) => row.description.trim() !== '');
    if (verbose) {
      log.debug(`Verbose: prepared training rows (${trainingData.length}):`);
      for (const row of trainingData) log.debug(JSON.stringify(row));
    }

    const dataFile = path.join(outDir, 'categorised_transactions.json');
    fs.writeFileSync(dataFile, JSON.stringify(trainingData, null, 2));
    log.info(
      `Saved ${trainingData.length} labeled transactions to ${dataFile}`,
    );

    log.info('Loading embedder (WASM BERT model)...');
    const { pipeline: loadPipeline } = require('@xenova/transformers');
    const embedder = await loadPipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
    const texts = trainingData.map((tx) => tx.description);
    const BATCH = parseInt(process.env.EMBED_BATCH_SIZE || '512', 10);
    const embeddings = [];
    for (let start = 0; start < texts.length; start += BATCH) {
      log.info(
        `Embedding batch ${start}-${Math.min(start + BATCH, texts.length) - 1}`,
      );
      const batchEmb = await embedder(texts.slice(start, start + BATCH), {
        pooling: 'mean',
      });
      for (const v of batchEmb) embeddings.push(Array.from(v));
    }

    log.info('Saving Embed+KNN model to disk...');
    const modelDir = path.join(outDir, 'tx-classifier-knn');
    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
    const k = 5;
    const dim = embeddings[0]?.length || 0;
    fs.writeFileSync(
      path.join(modelDir, 'meta.json'),
      JSON.stringify(
        { k, labels: trainingData.map((tx) => tx.category), dim },
        null,
        2,
      ),
    );
    const buf = Buffer.allocUnsafe(
      embeddings.length * dim * Float32Array.BYTES_PER_ELEMENT,
    );
    embeddings.forEach((vec, i) =>
      vec.forEach((val, j) =>
        buf.writeFloatLE(val, Float32Array.BYTES_PER_ELEMENT * (i * dim + j)),
      ),
    );
    fs.writeFileSync(path.join(modelDir, 'embeddings.bin'), buf);
    log.info(`✅ Embed+KNN model saved to ${modelDir}`);
    const uniqueCats = Array.from(
      new Set(trainingData.map((tx) => tx.category)),
    );
    fs.writeFileSync(
      path.join(modelDir, 'classes.json'),
      JSON.stringify(uniqueCats, null, 2),
    );
    log.info(`Saved classes.json to ${modelDir}`);
  } catch (err) {
    log.error('Training failed:', err);
    return;
  } finally {
    await closeBudget();
    // Clean up only this training run's cache files
    if (cacheDir && fs.existsSync(cacheDir)) {
      for (const item of fs.readdirSync(cacheDir)) {
        try {
          fs.rmSync(path.join(cacheDir, item), {
            recursive: true,
            force: true,
          });
        } catch (_) {}
      }
    }
  }
}

// CLI invocation
async function main(args = process.argv.slice(2), executor = runTraining) {
  const verbose = args.includes('--verbose');
  await executor({ verbose, useLogger: false });
}

if (require.main === module) {
  main();
}

module.exports = { runTraining, main };
