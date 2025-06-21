#!/usr/bin/env node
// Unified CLI for train, classify, and daemon modes
require('./suppress');
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
// cron scheduling and UI moved to src/daemon.js

// Core functions
const { runTraining } = require('./train');
const { runClassification } = require('./classifier');
const { runDaemon } = require('./daemon');

/**
 * Main CLI entrypoint: dispatch to train, classify, or daemon.
 * @param {string[]} args  Command-line arguments (e.g. process.argv.slice(2)).
 */
async function main(args = process.argv.slice(2)) {
  const argv = require('yargs/yargs')(args)
    .option('mode', {
      alias: 'm',
      choices: ['train', 'classify', 'daemon'],
      default: config.mode || 'classify',
      describe: 'Mode to run'
    })
    .option('dry-run', { type: 'boolean', default: false, describe: 'Do not update Actual' })
    .option('verbose', { type: 'boolean', default: false, describe: 'Verbose logging' })
    .option('ui',       { type: 'boolean', default: false, describe: 'Start web UI server (daemon mode only; also enabled by HTTP_PORT)' })
    .option('http-port',{ type: 'number', default: parseInt(config.httpPort ?? config.HTTP_PORT ?? process.env.HTTP_PORT ?? 3000, 10), describe: 'Port for web UI server' })
    .help()
    .argv;
  const { mode, dryRun, verbose, ui, httpPort } = argv;
  const useStructuredLogging = mode === 'daemon';
  // Use distinct budget cache directory per mode (train/classify)
  const baseDataDir = config.dataDir || process.env.BUDGET_CACHE_DIR || './budget';
  const modeDataDir = path.join(baseDataDir, mode);
  // Ensure the mode-specific budget cache directory exists
  if (!fs.existsSync(modeDataDir)) fs.mkdirSync(modeDataDir, { recursive: true });
  process.env.BUDGET_CACHE_DIR = modeDataDir;
  if (useStructuredLogging) {
    logger.info({ mode, modeDataDir }, 'Using mode-specific budget data directory');
  }
  switch (mode) {
    case 'train':
      await runTraining({ verbose, useLogger: useStructuredLogging });
      break;

    case 'classify': {
      const count = await runClassification({ dryRun, verbose, useLogger: false });
      if (!dryRun) {
        console.log('Uploading updated budget...');
        console.log(`Applied ${count} update(s)`);
      } else {
        console.log('✅ Dry-run complete');
        console.log(`Dry-run summary: would apply ${count} update(s)`);
      }
      break;
    }

    case 'daemon':
      await runDaemon({ verbose, ui, httpPort });
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };