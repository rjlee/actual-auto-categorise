/**
 * Ensure training skips entries with empty descriptions
 */
const fs = require('fs');
const path = require('path');

jest.mock('@actual-app/api', () => ({
  getAccounts: jest.fn(async () => [{ id: 'acct1' }]),
  getTransactions: jest.fn(async () => [
    { id: 'a', reconciled: true, category: 'c', payee: null, description: '' },
    { id: 'b', reconciled: true, category: 'c', payee: 'p', description: 'd' },
  ]),
  getPayees: jest.fn(async () => [{ id: 'p', name: 'payee' }]),
  getCategories: jest.fn(async () => [{ id: 'c', name: 'cat' }]),
}));
jest.mock('@xenova/transformers', () => ({ __esModule: true, pipeline: async () => async () => [0] }));
jest.mock('../src/utils', () => ({ openBudget: jest.fn(), closeBudget: jest.fn() }));

const { runTraining } = require('../src/train');

describe('Training description filter', () => {
  const dataDir = path.resolve(__dirname, '../data');

  beforeEach(() => {
    if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  afterEach(() => {
    if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('skips entries with empty description', async () => {
    await runTraining({ verbose: false, useLogger: false });
    const tx = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'categorised_transactions.json'), 'utf8')
    );
    expect(tx.map((r) => r.id)).toEqual(['b']);
  });
});