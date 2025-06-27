const api = require('@actual-app/api');
require('dotenv').config();
// Track whether budget has been downloaded in this process
let hasDownloadedBudget = false;
const fs = require('fs');
const logger = require('./logger');

const Utils = {
  openBudget: async function () {
    const url = process.env.ACTUAL_SERVER_URL;
    const password = process.env.ACTUAL_PASSWORD;
    const syncId = process.env.ACTUAL_SYNC_ID;
    if (!url || !password || !syncId) {
      throw new Error(
        'Please set ACTUAL_SERVER_URL, ACTUAL_PASSWORD, and ACTUAL_SYNC_ID environment variables',
      );
    }
    const dataDir = process.env.BUDGET_CACHE_DIR || './data/budget';
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    logger.info('Connecting to Actual API...');
    await api.init({ dataDir, serverURL: url, password });

    const budgetPassword = process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
    const dlOpts = {};
    if (budgetPassword) dlOpts.password = budgetPassword;

    if (!hasDownloadedBudget) {
      logger.info('Downloading budget...');
      if (process.env.DISABLE_IMPORT_BACKUPS !== 'false') {
        logger.info('Skipping import backup (DISABLE_IMPORT_BACKUPS=true)');
        await api.downloadBudget(syncId, dlOpts);
      } else {
        try {
          await api.runImport('open-budget', async () => {
            await api.downloadBudget(syncId, dlOpts);
          });
        } catch (err) {
          logger.warn(
            'Warning: runImport failed, falling back to direct downloadBudget:',
            err.message,
          );
          await api.downloadBudget(syncId, dlOpts);
        }
      }
      logger.info('Budget downloaded');
      hasDownloadedBudget = true;
    }

    logger.info('Syncing budget changes...');
    try {
      await api.sync();
      logger.info('Budget synced');
    } catch (err) {
      logger.warn({ err }, 'Failed to sync budget');
    }
  },

  closeBudget: async function () {
    hasDownloadedBudget = false;
    try {
      await api.shutdown();
      if (typeof api.resetBudgetCache === 'function') {
        await api.resetBudgetCache();
      }
    } catch (e) {
      logger.error(e);
      process.exit(1);
    }
  },
  /**
   * (Test helper) Reset the internal download flag so openBudget will re-fetch.
   */
  __resetBudgetDownloadFlag: function () {
    hasDownloadedBudget = false;
  },
};
module.exports = Utils;
