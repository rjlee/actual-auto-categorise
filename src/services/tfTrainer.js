const fs = require('fs');
const path = require('path');
// TensorFlow and Universal Sentence Encoder loaded lazily
/**
 * Train a TF.js Layers model on transaction embeddings.
 * trainingData: Array of {id, description, category}
 * modelDir: directory to save the TF.js model and classes.json
 */
async function trainTF(trainingData, modelDir) {
  let tf, use;
  const logger = require('../logger');
  try {
    tf = require('@tensorflow/tfjs-node');
    use = require('@tensorflow-models/universal-sentence-encoder');
  } catch (e) {
    logger.warn('TF training not supported on this platform:', e.message);
    return;
  }
  // Prepare labels
  const categories = Array.from(new Set(trainingData.map((tx) => tx.category)));
  const labelIndex = Object.fromEntries(categories.map((c, i) => [c, i]));
  const texts = trainingData.map((tx) => tx.description || '');
  const ysArr = trainingData.map((tx) => labelIndex[tx.category]);

  logger.info('Loading Universal Sentence Encoder...');
  const encoder = await use.load();
  // Determine embedding dimension
  const emb0 = await encoder.embed([texts[0]]);
  const embeddingDim = emb0.shape[1];
  emb0.dispose();

  // Build model
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [embeddingDim],
      units: 128,
      activation: 'relu',
    }),
  );
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(
    tf.layers.dense({ units: categories.length, activation: 'softmax' }),
  );
  model.compile({
    optimizer: tf.train.adam(),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  // Training parameters
  const epochs = parseInt(process.env.TF_TRAIN_EPOCHS || '20', 10);
  const trainBatch = parseInt(process.env.TF_TRAIN_BATCH_SIZE || '32', 10);
  const embedBatch = parseInt(
    process.env.TF_TRAIN_EMBED_BATCH_SIZE || '512',
    10,
  );

  logger.info(
    `Starting TF classifier training for ${trainingData.length} samples`,
  );
  for (let epoch = 0; epoch < epochs; epoch++) {
    logger.info(`Epoch ${epoch + 1}/${epochs}`);
    // Shuffle indices
    const idxs = trainingData.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    for (let start = 0; start < idxs.length; start += embedBatch) {
      const batchIdx = idxs.slice(start, start + embedBatch);
      const batchTexts = batchIdx.map((i) => texts[i]);
      const embBatch = await encoder.embed(batchTexts);
      for (let j = 0; j < batchIdx.length; j += trainBatch) {
        const subIdx = batchIdx.slice(j, j + trainBatch);
        const x = embBatch.slice([j, 0], [subIdx.length, embeddingDim]);
        const y = tf.oneHot(
          tf.tensor1d(
            subIdx.map((i) => ysArr[i]),
            'int32',
          ),
          categories.length,
        );
        await model.trainOnBatch(x, y);
        x.dispose();
        y.dispose();
      }
      embBatch.dispose();
    }
  }

  // Save model and classes
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
  await model.save('file://' + modelDir);
  fs.writeFileSync(
    path.join(modelDir, 'classes.json'),
    JSON.stringify(categories, null, 2),
  );
  logger.info(`TF classifier model and classes saved to ${modelDir}`);
}

module.exports = { trainTF };
