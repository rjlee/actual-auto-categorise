/**
 * Verify classifier backend selection (ml vs. tf) in runClassification
 */
// Prevent real budget open/close
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(async () => {}),
  closeBudget: jest.fn(async () => {}),
}));
// Stub Actual API
jest.mock('@actual-app/api', () => ({
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
  getPayees: jest.fn(),
  getCategories: jest.fn(),
  updateTransaction: jest.fn(),
}));

// Stub both classifier implementations
jest.mock('../src/services/mlClassifier', () => ({
  classifyWithML: jest.fn(),
}));
jest.mock('../src/services/tfClassifier', () => ({
  classifyWithTF: jest.fn(),
}));

const config = require('../src/config');
const api = require('@actual-app/api');
const { classifyWithML } = require('../src/services/mlClassifier');
const { classifyWithTF } = require('../src/services/tfClassifier');
const { runClassification } = require('../src/classifier');

beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.CLASSIFIER_TYPE;
  api.getAccounts.mockResolvedValue([{ id: 'acct1' }]);
  api.getTransactions.mockResolvedValue([
    { id: 't1', reconciled: false, payee: 'p1', description: 'd' },
  ]);
  api.getPayees.mockResolvedValue([{ id: 'p1', name: 'P1' }]);
  api.getCategories.mockResolvedValue([{ id: 'c1', name: 'P1' }]);
});

test('defaults to mlClassifier when no override', async () => {
  classifyWithML.mockResolvedValue([{ id: 't1', category: 'P1' }]);
  await runClassification({ dryRun: false, verbose: false });
  expect(classifyWithML).toHaveBeenCalled();
  expect(classifyWithTF).not.toHaveBeenCalled();
});

test('uses tfClassifier when CLASSIFIER_TYPE=tf in env', async () => {
  process.env.CLASSIFIER_TYPE = 'tf';
  classifyWithTF.mockResolvedValue([{ id: 't1', category: 'P1' }]);
  await runClassification({ dryRun: false, verbose: false });
  expect(classifyWithTF).toHaveBeenCalled();
  expect(classifyWithML).not.toHaveBeenCalled();
});

test('uses tfClassifier when config.classifierType=tf', async () => {
  config.classifierType = 'tf';
  classifyWithTF.mockResolvedValue([{ id: 't1', category: 'P1' }]);
  await runClassification({ dryRun: false, verbose: false });
  expect(classifyWithTF).toHaveBeenCalled();
  expect(classifyWithML).not.toHaveBeenCalled();
  delete config.classifierType;
});
