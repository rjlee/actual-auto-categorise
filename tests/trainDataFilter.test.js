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

// Mock the embedder pipeline to avoid heavy model calls
jest.mock('@xenova/transformers', () => ({
  __esModule: true,
  pipeline: async () => async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
}));

const { runTraining } = require('../src/train');
const { getAccounts, getTransactions, getPayees, getCategories } = require('@actual-app/api');

describe('trainData filter for empty descriptions', () => {
  const dataDir = path.resolve(__dirname, '../data');

  beforeEach(() => {
    jest.clearAllMocks();
    if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
    getAccounts.mockResolvedValue([{ id: 'acct1' }]);
  });

  it('drops transactions with empty or whitespace descriptions', async () => {
    getTransactions.mockResolvedValue([
      { id: 'tx1', reconciled: true, category: 'cat1', payee: 'p1', description: 'valid' },
      { id: 'tx2', reconciled: true, category: 'cat1', payee: null, description: '' },
      { id: 'tx3', reconciled: true, category: 'cat1', payee: null, description: '   ' },
    ]);
    getPayees.mockResolvedValue([{ id: 'p1', name: 'Payee One' }]);
    getCategories.mockResolvedValue([{ id: 'cat1', name: 'Category One' }]);
    await runTraining({ verbose: false, useLogger: false });
    const rows = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'categorised_transactions.json'), 'utf8')
    );
    expect(rows).toEqual([
      { id: 'tx1', description: 'Payee One', category: 'Category One' },
    ]);
  });
});