const fs = require('fs');
const path = require('path');

// Prevent Actual API calls and budget downloads
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(),
  closeBudget: jest.fn(),
}));
jest.mock('@actual-app/api', () => ({
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
  getPayees: jest.fn(),
  getCategories: jest.fn(),
}));

// Mock the embedder pipeline so no real WASM model runs
jest.mock('@xenova/transformers', () => ({
  __esModule: true,
  pipeline: async () => async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
}));

const { runTraining } = require('../src/train');
const { getAccounts, getTransactions, getPayees, getCategories } = require('@actual-app/api');

describe('runTraining pipeline', () => {
  const dataDir = path.resolve(__dirname, '../data');

  beforeEach(() => {
    // Clean up any prior output
    if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
    // Stub API methods
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1', reconciled: true, category: 'cat1', payee: 'p1',
        amount: 123, description: 'desc'
      },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'Payee 1' }]);
    getCategories.mockResolvedValue([{ id: 'cat1', name: 'Category 1' }]);
  });

  it('writes training data and embeddings to disk', async () => {
    await runTraining({ verbose: false, useLogger: false });
    // Training JSON
    const txFile = path.join(dataDir, 'categorised_transactions.json');
    expect(fs.existsSync(txFile)).toBe(true);
    const txJson = JSON.parse(fs.readFileSync(txFile, 'utf8'));
    expect(txJson).toEqual([
      { id: 'tx1', description: 'Payee 1 – 1.23', category: 'Category 1' },
    ]);
    // Model files
    const modelDir = path.join(dataDir, 'tx-classifier-knn');
    expect(fs.existsSync(modelDir)).toBe(true);
    const meta = JSON.parse(
      fs.readFileSync(path.join(modelDir, 'meta.json'), 'utf8')
    );
    expect(meta).toMatchObject({ k: 5, labels: ['Category 1'], dim: 3 });
    const bin = fs.readFileSync(path.join(modelDir, 'embeddings.bin'));
    expect(bin.length).toBe(3 * Float32Array.BYTES_PER_ELEMENT);
    // classes.json should be generated for TF classifier
    const clsPath = path.join(modelDir, 'classes.json');
    expect(fs.existsSync(clsPath)).toBe(true);
    const classes = JSON.parse(fs.readFileSync(clsPath, 'utf8'));
    expect(classes).toEqual(['Category 1']);
  });

  it('filters out transactions with empty description', async () => {
    // Transactions without payee or with blank description should be dropped
    getTransactions.mockResolvedValue([
      { id: 'tx1', reconciled: true, category: 'cat1', payee: 'p1', description: 'desc1' },
      { id: 'tx2', reconciled: true, category: 'cat1', payee: null, description: '' },
      { id: 'tx3', reconciled: true, category: 'cat1', payee: 'p2', description: '   ' },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'Payee 1' }]);
    getCategories.mockResolvedValue([{ id: 'cat1', name: 'Category 1' }]);
    await runTraining({ verbose: false, useLogger: false });
    const txFile = path.join(dataDir, 'categorised_transactions.json');
    const txJson = JSON.parse(fs.readFileSync(txFile, 'utf8'));
    expect(txJson).toEqual([
      { id: 'tx1', description: 'Payee 1', category: 'Category 1' },
    ]);
  });
});