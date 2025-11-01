const path = require('path');
const fs = require('fs');
// Point output to tests/.data like the tests do
process.env.BUDGET_CACHE_DIR = path.resolve(__dirname, '.data');

// Monkey-patch the required modules before requiring train.js
const actualApiPath = require.resolve('@actual-app/api');
require.cache[actualApiPath] = {
  id: actualApiPath,
  filename: actualApiPath,
  loaded: true,
  exports: {
    getAccounts: async () => [{ id: 'acct1' }],
    getTransactions: async () => [
      {
        id: 'tx1',
        reconciled: true,
        category: 'cat1',
        payee: 'p1',
        amount: 123,
      },
    ],
    getPayees: async () => [{ id: 'p1', name: 'Payee 1' }],
    getCategories: async () => [{ id: 'cat1', name: 'Category 1' }],
  },
};

const utilsPath = require.resolve('../src/utils');
require.cache[utilsPath] = {
  id: utilsPath,
  filename: utilsPath,
  loaded: true,
  exports: {
    openBudget: async () => {},
    closeBudget: async () => {},
  },
};

const tfxPath = require.resolve('@xenova/transformers');
require.cache[tfxPath] = {
  id: tfxPath,
  filename: tfxPath,
  loaded: true,
  exports: {
    __esModule: true,
    pipeline: async () => async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
  },
};

async function main() {
  const { runTraining } = require('../src/train');
  await runTraining({ verbose: true, useLogger: true });
  const dataDir = process.env.BUDGET_CACHE_DIR;
  console.log('Wrote to dataDir:', dataDir);
  console.log('Contents:', fs.readdirSync(dataDir));
}

main().catch((e) => {
  console.error('debug-train failed', e);
  process.exit(1);
});
