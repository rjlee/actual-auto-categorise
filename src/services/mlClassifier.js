const fs = require('fs');
const path = require('path');
// Brute-force Embed+KNN classification without external kd-tree
// Dynamically import the pipeline function from @xenova/transformers (ESM-only module)
const { HierarchicalNSW } = require('hnswlib-node');
const logger = require('../logger');

/**
 * Embed+KNN classification using a WASM-backed transformer embedder
 * @param {Array} transactions
 * @param {string} modelDir - filesystem path to the saved KNN model directory
 * @returns {Array} categorized transactions
 */
async function classifyWithML(transactions, modelDir) {
  const metaPath = path.join(modelDir, 'meta.json');
  const embPath = path.join(modelDir, 'embeddings.bin');
  if (!fs.existsSync(metaPath) || !fs.existsSync(embPath)) {
    throw new Error(`Embed+KNN model files not found in ${modelDir}`);
  }
  const {
    k,
    labels: trainLabels,
    dim: expectedDim,
  } = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (expectedDim == null) {
    throw new Error(
      `Missing 'dim' in meta.json at ${metaPath}. Please re-run 'npm run train' to regenerate the model files.`,
    );
  }
  const buf = fs.readFileSync(embPath);
  let raw = new Float32Array(
    buf.buffer,
    buf.byteOffset,
    buf.length / Float32Array.BYTES_PER_ELEMENT,
  );
  const trainCount = trainLabels.length;
  const searchK = Math.min(k, trainCount);
  if (trainCount === 0)
    throw new Error('No training labels found in meta.json');
  if (raw.length % trainCount !== 0) {
    logger.warn(
      `Warning: embeddings array length ${raw.length} is not a multiple of trainCount=${trainCount}; will truncate extra values or pad with zeros.`,
    );
  }
  // Ensure each vector has expectedDim components; pad/truncate so raw.length == expectedDim*trainCount
  const needed = expectedDim * trainCount;
  if (raw.length < needed) {
    logger.warn(
      `Padding embeddings from ${raw.length} → ${needed} floats (expectedDim * trainCount).`,
    );
    const padded = new Float32Array(needed);
    padded.set(raw);
    raw = padded;
  } else if (raw.length > needed) {
    logger.warn(
      `Truncating embeddings from ${raw.length} → ${needed} floats (expectedDim * trainCount).`,
    );
    raw = raw.subarray(0, needed);
  }
  const dim = expectedDim;
  // Convert raw Float32Array into array of normalized JS arrays (L2 = 1)

  const trainEmb = [];
  for (let i = 0; i < raw.length; i += dim) {
    // Extract subarray and convert to plain JS array
    const arr = Array.from(raw.subarray(i, i + dim));
    // Normalize to unit length
    let sumSq = 0;
    for (let j = 0; j < dim; j++) sumSq += arr[j] * arr[j];
    const invNorm = 1 / (Math.sqrt(sumSq) + 1e-8);
    for (let j = 0; j < dim; j++) arr[j] *= invNorm;
    trainEmb.push(arr);
  }

  const index = new HierarchicalNSW('cosine', dim);
  index.initIndex(trainEmb.length);
  // Insert every normalized train vector
  for (let i = 0; i < trainEmb.length; i++) {
    index.addPoint(trainEmb[i], i);
  }
  // ef should be set >= trainEmb.length for exact search
  index.setEf(trainEmb.length);

  // Require the transformers pipeline for ESM interop and Jest mocking
  const { pipeline } = require('@xenova/transformers');
  // Load feature extractor and apply mean-pooling per query
  const embedder = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
  );
  const texts = transactions.map((tx) => tx.description || '');
  const BATCH_SIZE = parseInt(process.env.EMBED_BATCH_SIZE || '512', 10);
  const results = [];
  logger.info(
    { count: transactions.length, batchSize: BATCH_SIZE },
    'Embedding & classifying transactions in batches',
  );
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batchTexts = texts.slice(start, start + BATCH_SIZE);
    logger.info(
      { start, end: Math.min(start + batchTexts.length, texts.length) - 1 },
      'Embedding batch',
    );
    const rawEmb = await embedder(batchTexts, { pooling: 'mean' });
    for (const vecTA of rawEmb) {
      // normalize query vector
      const vec = Array.from(vecTA);
      let sumSq = 0;
      for (let j = 0; j < vec.length; j++) sumSq += vec[j] * vec[j];
      const invNorm = 1 / (Math.sqrt(sumSq) + 1e-8);
      for (let j = 0; j < vec.length; j++) vec[j] *= invNorm;
      // search HNSW
      const { neighbors } = index.searchKnn(vec, searchK);
      // majority vote
      const counts = {};
      for (const idx of neighbors) {
        const lbl = trainLabels[idx];
        counts[lbl] = (counts[lbl] || 0) + 1;
      }
      results.push(
        Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || 'other',
      );
    }
  }
  return transactions.map((tx, i) => ({
    ...tx,
    category: results[i] || 'other',
  }));
}

module.exports = { classifyWithML };
