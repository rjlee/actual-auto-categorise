const path = require('path');

// Mock budget utils
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(),
  closeBudget: jest.fn(),
}));
const { openBudget } = require('../src/utils');

// Mock Actual API
jest.mock('@actual-app/api', () => ({
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
  getPayees: jest.fn(),
  getCategories: jest.fn(),
  updateTransaction: jest.fn(),
}));
const { getAccounts, getTransactions, getPayees, getCategories } = require('@actual-app/api');

// Mock ML classifier
jest.mock('../src/services/mlClassifier', () => ({
  classifyWithML: jest.fn(),
}));
const { classifyWithML } = require('../src/services/mlClassifier');

const { runClassification } = require('../src/classifier');

describe('classification filter for empty descriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPayees.mockResolvedValue([]);
    getCategories.mockResolvedValue([]);
    classifyWithML.mockResolvedValue([]);
  });

  it('excludes transactions with empty or whitespace descriptions from classification', async () => {
    openBudget.mockResolvedValue();
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
    getTransactions.mockResolvedValue([
      { id: 'tx1', reconciled: false, category: null, payee: 'p1', description: 'foo' },
      { id: 'tx2', reconciled: false, category: null, payee: null, description: '' },
      { id: 'tx3', reconciled: false, category: null, payee: null, description: '   ' },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'Payee One' }]);
    await runClassification({ dryRun: true, verbose: false, useLogger: true });
    expect(classifyWithML).toHaveBeenCalledWith(
      [{ id: 'tx1', description: 'Payee One' }],
      expect.any(String)
    );
  });
});