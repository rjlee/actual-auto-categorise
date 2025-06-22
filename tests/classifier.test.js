// Mock budget utils
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(),
  closeBudget: jest.fn(),
}));
const { openBudget, closeBudget } = require('../src/utils');

// Mock Actual API
jest.mock('@actual-app/api', () => {
  return {
    getAccounts: jest.fn(),
    getTransactions: jest.fn(),
    getPayees: jest.fn(),
    getCategories: jest.fn(),
    updateTransaction: jest.fn(),
  };
});
const {
  getAccounts,
  getTransactions,
  getPayees,
  getCategories,
  updateTransaction,
} = require('@actual-app/api');

// Mock ML classifier
jest.mock('../src/services/mlClassifier', () => ({
  classifyWithML: jest.fn(),
}));
const { classifyWithML } = require('../src/services/mlClassifier');

const { runClassification } = require('../src/classifier');

describe('runClassification', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Provide defaults for payees/categories and ML classifier
    getPayees.mockResolvedValue([]);
    getCategories.mockResolvedValue([]);
    classifyWithML.mockResolvedValue([]);
  });

  test('returns 0 when opening budget fails', async () => {
    openBudget.mockRejectedValue(new Error('no budget'));
    const count = await runClassification({ dryRun: false, verbose: false });
    expect(count).toBe(0);
    expect(closeBudget).not.toHaveBeenCalled();
  });

  test('propagates error from getAccounts', async () => {
    openBudget.mockResolvedValue();
    getAccounts.mockRejectedValue(new Error('no accounts'));
    await expect(
      runClassification({ dryRun: false, verbose: false, useLogger: true }),
    ).rejects.toThrow('no accounts');
    expect(closeBudget).toHaveBeenCalled();
  });

  test('propagates error from updateTransaction', async () => {
    openBudget.mockResolvedValue();
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        description: 'desc',
      },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'PayeeName' }]);
    classifyWithML.mockResolvedValue([{ id: 'tx1', category: 'CatName' }]);
    getCategories.mockResolvedValue([{ id: 'c1', name: 'CatName' }]);
    updateTransaction.mockRejectedValue(new Error('update failed'));
    await expect(
      runClassification({ dryRun: false, verbose: false, useLogger: true }),
    ).rejects.toThrow('update failed');
    expect(closeBudget).toHaveBeenCalled();
  });

  test('returns 0 when there are no new transactions', async () => {
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
    getTransactions.mockResolvedValue([]);

    const count = await runClassification({ dryRun: false, verbose: false });
    expect(count).toBe(0);
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  test('applies updates for classified transactions (live run)', async () => {
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        description: 'desc',
      },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'PayeeName' }]);
    classifyWithML.mockResolvedValue([{ id: 'tx1', category: 'CatName' }]);
    getCategories.mockResolvedValue([{ id: 'c1', name: 'CatName' }]);

    const count = await runClassification({ dryRun: false, verbose: false });
    expect(count).toBe(1);
    expect(updateTransaction).toHaveBeenCalledWith('tx1', { category: 'c1' });
  });

  test('does not call updateTransaction in dry-run mode', async () => {
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        description: 'desc',
      },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'PayeeName' }]);
    classifyWithML.mockResolvedValue([{ id: 'tx1', category: 'CatName' }]);
    getCategories.mockResolvedValue([{ id: 'c1', name: 'CatName' }]);

    const count = await runClassification({ dryRun: true, verbose: false });
    expect(count).toBe(1);
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  test('skips transactions with empty descriptions before classification', async () => {
    openBudget.mockResolvedValue();
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        notes: 'note',
        amount: 345,
      },
      {
        id: 'tx2',
        reconciled: false,
        category: null,
        payee: null,
        notes: '',
        amount: 100,
      },
      {
        id: 'tx3',
        reconciled: false,
        category: null,
        payee: null,
        notes: '   ',
        amount: 50,
      },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'Payee 1' }]);
    classifyWithML.mockResolvedValue([{ id: 'tx1', category: 'CatName' }]);
    getCategories.mockResolvedValue([{ id: 'c1', name: 'CatName' }]);
    const count = await runClassification({
      dryRun: false,
      verbose: false,
      useLogger: true,
    });
    expect(classifyWithML).toHaveBeenCalledWith(
      [
        { id: 'tx1', description: 'Payee 1 – note – 3.45' },
        { id: 'tx2', description: '1.00' },
        { id: 'tx3', description: '0.50' },
      ],
      expect.any(String),
    );
    expect(updateTransaction).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });
});
