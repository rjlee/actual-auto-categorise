const fs = require('fs');
const path = require('path');
const os = require('os');

// Stub Actual API and budget utils to avoid real DB operations
jest.mock('@actual-app/api', () => ({
  getAccounts: jest.fn(async () => []),
  getTransactions: jest.fn(async () => []),
  getPayees: jest.fn(async () => []),
  getCategories: jest.fn(async () => []),
  updateTransaction: jest.fn(),
}));
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(async () => {}),
  closeBudget: jest.fn(async () => {}),
}));

// Stub classifiers for quick execution
jest.mock('../src/services/mlClassifier', () => ({ classifyWithML: jest.fn(async () => []) }));
jest.mock('../src/services/tfClassifier', () => ({ classifyWithTF: jest.fn(async () => []) }));
// Stub embedder pipeline to avoid importing ESM modules
jest.mock('@xenova/transformers', () => ({
  __esModule: true,
  pipeline: async () => async () => [],
}));

const { runClassification } = require('../src/classifier');
const { runTraining } = require('../src/train');

describe('Budget cache cleanup', () => {
  let tmpDir;

  beforeEach(() => {
    // Point runs to a fresh temp directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-'));
    process.env.BUDGET_CACHE_DIR = tmpDir;
    fs.mkdirSync(tmpDir, { recursive: true });
    // Populate with dummy files
    fs.writeFileSync(path.join(tmpDir, 'dummy.txt'), 'x');
    fs.mkdirSync(path.join(tmpDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'nested', 'd2.txt'), 'y');
  });

  afterEach(() => {
    delete process.env.BUDGET_CACHE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runClassification clears the classify cache directory', async () => {
    await runClassification({ dryRun: true, verbose: false, useLogger: false });
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });

  test('runTraining clears the train cache directory', async () => {
    await runTraining({ verbose: false, useLogger: false });
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });
});