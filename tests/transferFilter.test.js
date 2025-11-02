const path = require('path');
// Redirect outputs
process.env.BUDGET_CACHE_DIR = path.resolve(__dirname, '.data');

// Mock budget utils
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(),
  closeBudget: jest.fn(),
}));

// Mock Actual API
jest.mock('@actual-app/api', () => ({
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
  getPayees: jest.fn(),
  getCategories: jest.fn(),
  updateTransaction: jest.fn(),
}));
const {
  getAccounts,
  getTransactions,
  getPayees,
  getCategories,
  updateTransaction,
} = require('@actual-app/api');

// Mock classifier
jest.mock('../src/services/mlClassifier', () => ({
  classifyWithML: jest.fn(),
}));
const { classifyWithML } = require('../src/services/mlClassifier');

const { runClassification } = require('../src/classifier');

describe('transfer transaction filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CLASSIFIER_TYPE;
    getAccounts.mockResolvedValue([{ id: 'acct1', offbudget: false }]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'P1' }]);
    getCategories.mockResolvedValue([{ id: 'c1', name: 'Cat' }]);
    classifyWithML.mockResolvedValue([]);
  });
  it('skips transactions marked as transfer via transferId', async () => {
    getTransactions.mockResolvedValue([
      {
        id: 't1',
        reconciled: false,
        category: null,
        payee: 'p1',
        amount: 100,
        transferId: 'x',
      },
      {
        id: 't2',
        reconciled: false,
        category: null,
        payee: 'p1',
        amount: 200,
      },
    ]);
    classifyWithML.mockResolvedValue([{ id: 't2', category: 'Cat' }]);
    await runClassification({ dryRun: false, verbose: false, useLogger: true });
    // Ensure only the non-transfer one was sent
    expect(classifyWithML).toHaveBeenCalledWith(
      [{ id: 't2', description: 'P1 – 2.00' }],
      expect.any(String),
    );
    expect(updateTransaction).toHaveBeenCalledWith('t2', { category: 'c1' });
    // No updates for the transfer one
    expect(updateTransaction).toHaveBeenCalledTimes(1);
  });

  it('skips transactions marked as is_transfer', async () => {
    getTransactions.mockResolvedValue([
      {
        id: 't1',
        reconciled: false,
        category: null,
        payee: 'p1',
        amount: 100,
        is_transfer: true,
      },
    ]);
    await runClassification({ dryRun: false, verbose: false, useLogger: true });
    expect(classifyWithML).toHaveBeenCalledWith([], expect.any(String));
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  // Reconciliation behavior for transfers has been removed
});
