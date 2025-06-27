require('dotenv').config();
const i18next = require('i18next');

// Ensure all translation keys fall through to their literal English text
i18next
  .init({
    // Initialize synchronously so missing-key handler is in effect immediately
    initImmediate: false,
    lng: process.env.LANG || 'en',
    fallbackLng: 'en',
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => key,
  })
  .catch((err) => {
    console.error('i18next initialization failed:', err);
    process.exit(1);
  });

// Also initialize the copy of i18next inside the Actual API bundle (ESM build)
// so that its t() calls fall through to the literal English string.
let esmI18next;
try {
  esmI18next = require('i18next/dist/esm/i18next.js');
  esmI18next.init({
    initImmediate: false,
    lng: process.env.LANG || 'en',
    fallbackLng: 'en',
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => key,
  });
} catch {
  // ignore if esm entry is unavailable (e.g. under Jest)
}
// Monkey-patch the API bundle so the raw error is logged via console.error
// instead of being swallowed by console.log in the throw expression.
try {
  const fs = require('fs');
  const bundlePath = require.resolve('@actual-app/api/dist/app/bundle.api.js');
  let bundleCode = fs.readFileSync(bundlePath, 'utf8');
  const beforeRegex =
    /throw console\.log\(["']Full error details["'], result\.error\),\s*Error\(\(0, _shared_errors__WEBPACK_IMPORTED_MODULE_2__\.getDownloadError\)\(result\.error\)\);/g;
  const after =
    'console.error("Full error details", result.error);\n throw Error((0, _shared_errors__WEBPACK_IMPORTED_MODULE_2__.getDownloadError)(result.error));';
  bundleCode = bundleCode.replace(beforeRegex, after);
  fs.writeFileSync(bundlePath, bundleCode, 'utf8');
} catch {
  // best-effort; skip if unable to patch
}
const api = require('@actual-app/api');
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
