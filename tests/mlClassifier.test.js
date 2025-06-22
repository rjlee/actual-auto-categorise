const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock transformer pipeline for predictable embeddings
jest.mock('@xenova/transformers', () => ({
  __esModule: true,
  pipeline: async () => async (texts) =>
    texts.map((_, idx) => new Float32Array(idx % 2 === 0 ? [1, 0] : [0, 1])),
}));

const { classifyWithML } = require('../src/services/mlClassifier');

describe('classifyWithML', () => {
  let modelDir;

  beforeEach(() => {
    modelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-'));
  });
  afterEach(() => {
    fs.rmSync(modelDir, { recursive: true, force: true });
  });

  test('throws if model files not found', async () => {
    await expect(classifyWithML([], modelDir)).rejects.toThrow(
      /Embed\+KNN model files not found/,
    );
  });

  test('throws on missing dim in meta.json', async () => {
    fs.writeFileSync(
      path.join(modelDir, 'meta.json'),
      JSON.stringify({ k: 1, labels: ['A'] }),
    );
    fs.writeFileSync(path.join(modelDir, 'embeddings.bin'), Buffer.alloc(4));
    await expect(classifyWithML([], modelDir)).rejects.toThrow(/Missing 'dim'/);
  });

  test('throws on empty training labels', async () => {
    fs.writeFileSync(
      path.join(modelDir, 'meta.json'),
      JSON.stringify({ k: 1, labels: [], dim: 2 }),
    );
    fs.writeFileSync(
      path.join(modelDir, 'embeddings.bin'),
      Buffer.alloc(2 * Float32Array.BYTES_PER_ELEMENT),
    );
    await expect(classifyWithML([{ id: 'tx' }], modelDir)).rejects.toThrow(
      /No training labels found/,
    );
  });

  test('classifies transactions based on nearest neighbor', async () => {
    // Prepare two training embeddings of dimension 2
    const trainCount = 2;
    const dim = 2;
    fs.writeFileSync(
      path.join(modelDir, 'meta.json'),
      JSON.stringify({ k: 1, labels: ['A', 'B'], dim }, null, 2),
    );
    const embBuf = Buffer.alloc(
      trainCount * dim * Float32Array.BYTES_PER_ELEMENT,
    );
    // Raw train embeddings: [1,0] and [0,1]
    const rawArr = new Float32Array([1, 0, 0, 1]);
    const view = new Float32Array(
      embBuf.buffer,
      embBuf.byteOffset,
      rawArr.length,
    );
    view.set(rawArr);
    fs.writeFileSync(path.join(modelDir, 'embeddings.bin'), embBuf);

    const txns = [
      { id: 'tx1', description: 'foo' },
      { id: 'tx2', description: 'bar' },
    ];
    const classified = await classifyWithML(txns, modelDir);
    expect(classified).toEqual([
      { id: 'tx1', description: 'foo', category: 'A' },
      { id: 'tx2', description: 'bar', category: 'B' },
    ]);
  });
});
