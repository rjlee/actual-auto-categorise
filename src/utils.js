const api = require('@actual-app/api');
require("dotenv").config();

const Utils = {
  openBudget: async function () {
    const url = process.env.ACTUAL_SERVER_URL;
    const password = process.env.ACTUAL_PASSWORD;
    const budgetId = process.env.ACTUAL_BUDGET_ID;
    if (!url || !password || !budgetId) {
      throw new Error(
        'Please set ACTUAL_SERVER_URL, ACTUAL_PASSWORD, and ACTUAL_BUDGET_ID environment variables'
      );
    }
    const dataDir = process.env.BUDGET_CACHE_DIR || './budget';

    console.log('Connecting to Actual API...');
    await api.init({ dataDir, serverURL: url, password });

    console.log('Downloading budget...');
    const budgetPassword = process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
    const dlOpts = {};
    if (budgetPassword) dlOpts.password = budgetPassword;
    try {
      await api.runImport('open-budget', async () => {
        await api.downloadBudget(budgetId, dlOpts);
      });
    } catch (err) {
      console.warn(
        'Warning: runImport failed, falling back to direct downloadBudget:',
        err.message
      );
      await api.downloadBudget(budgetId, dlOpts);
    }
    console.log('Budget downloaded');
  },

  closeBudget: async function () {
    // console.log('Closing budget...');
    try {
      await api.shutdown();
      if (typeof api.resetBudgetCache === 'function') {
        await api.resetBudgetCache();
      }
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  },
}
module.exports = Utils;
