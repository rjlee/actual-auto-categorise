/**
 * Basic E2E pipeline test: train followed by classification using mocked API and ML.
 */
// Ensure no CLASSIFIER_TYPE env var influences training branch
delete process.env.CLASSIFIER_TYPE;
// Stub Actual API
jest.mock('@actual-app/api', () => {
  const getTransactions = jest
    .fn()
    .mockImplementationOnce(async () => [
      {
        id: 't1',
        reconciled: true,
        category: 'c1',
        payee: 'p1',
        description: 'd',
      },
    ])
    .mockImplementationOnce(async () => [
      { id: 't1', reconciled: false, payee: 'p1', description: 'd' },
    ]);
  return {
    init: jest.fn(),
    runImport: jest.fn(async (_tag, fn) => fn()),
    downloadBudget: jest.fn(),
    getAccounts: jest.fn(async () => [{ id: 'acct1' }]),
    getTransactions,
    getPayees: jest.fn(async () => [{ id: 'p1', name: 'P1' }]),
    getCategories: jest.fn(async () => [{ id: 'c1', name: 'C1' }]),
    updateTransaction: jest.fn(),
    shutdown: jest.fn(),
  };
});

jest.mock('@xenova/transformers', () => ({
  __esModule: true,
  pipeline: async () => async (texts) => texts.map(() => new Float32Array([1])),
}));

// Prevent process.exit in utils
jest.mock('../src/utils', () => {
  const api = require('@actual-app/api');
  return {
    openBudget: jest.fn(async () => {
      await api.downloadBudget();
    }),
    closeBudget: jest.fn(async () => {}),
  };
});

const { runTraining } = require('../src/train');
const { runClassification } = require('../src/classifier');
const api = require('@actual-app/api');

describe('Pipeline E2E (train→classify)', () => {
  it('executes training then classification without errors', async () => {
    await runTraining({ verbose: false, useLogger: false });
    expect(api.downloadBudget).toHaveBeenCalled();

    // Next classification phase
    await runClassification({
      dryRun: false,
      verbose: false,
      useLogger: false,
    });
    expect(api.updateTransaction).toHaveBeenCalledWith('t1', {
      category: 'c1',
      reconciled: true,
      cleared: true,
    });
  });
});
