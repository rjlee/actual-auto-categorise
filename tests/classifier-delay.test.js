// Verify reconcile/clear delay behavior without affecting other tests
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

// Mock ML classifier
jest.mock('../src/services/mlClassifier', () => ({
  classifyWithML: jest.fn(),
}));

const {
  getAccounts,
  getTransactions,
  getPayees,
  getCategories,
  updateTransaction,
} = require('@actual-app/api');
const { classifyWithML } = require('../src/services/mlClassifier');
const { runClassification } = require('../src/classifier');

function fmtDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('classification reconcile delay', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AUTO_RECONCILE = '';
    process.env.AUTO_RECONCILE_DELAY_DAYS = '5';
    getPayees.mockResolvedValue([{ id: 'p1', name: 'P1' }]);
    getCategories.mockResolvedValue([{ id: 'c1', name: 'CatName' }]);
    classifyWithML.mockResolvedValue([{ id: 'tx1', category: 'CatName' }]);
  });

  it('on-budget: with 5-day delay, today-dated tx is categorized but not reconciled', async () => {
    getAccounts.mockResolvedValue([{ id: 'acct1', offbudget: false }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        date: fmtDate(0),
      },
    ]);
    await runClassification({
      dryRun: false,
      verbose: false,
      useLogger: false,
    });
    expect(updateTransaction).toHaveBeenCalledWith('tx1', { category: 'c1' });
  });

  it('on-budget: with 5-day delay, 6-days-old tx is categorized and reconciled', async () => {
    getAccounts.mockResolvedValue([{ id: 'acct1', offbudget: false }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        date: fmtDate(-6),
      },
    ]);
    await runClassification({
      dryRun: false,
      verbose: false,
      useLogger: false,
    });
    expect(updateTransaction).toHaveBeenCalledWith('tx1', {
      category: 'c1',
      reconciled: true,
      cleared: true,
    });
  });

  it('off-budget: with 5-day delay, today-dated tx is not reconciled and no category', async () => {
    getAccounts.mockResolvedValue([{ id: 'acct1', offbudget: true }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        date: fmtDate(0),
      },
    ]);
    await runClassification({
      dryRun: false,
      verbose: false,
      useLogger: false,
    });
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('off-budget: with 5-day delay, 6-days-old tx is reconciled (no category)', async () => {
    getAccounts.mockResolvedValue([{ id: 'acct1', offbudget: true }]);
    getTransactions.mockResolvedValue([
      {
        id: 'tx1',
        reconciled: false,
        category: null,
        payee: 'p1',
        date: fmtDate(-6),
      },
    ]);
    await runClassification({
      dryRun: false,
      verbose: false,
      useLogger: false,
    });
    expect(updateTransaction).toHaveBeenCalledWith('tx1', {
      reconciled: true,
      cleared: true,
    });
  });
});
