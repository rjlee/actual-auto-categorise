#!/usr/bin/env node
// Unified CLI for train, classify, and daemon modes
require('./suppress');
require('dotenv').config();

const fs = require('fs');
const config = require('./config');
const logger = require('./logger');
// Prevent daemon exit on unexpected errors
process.on('uncaughtException', (err) => {
  logger.warn({ err }, 'Uncaught exception, ignoring');
});
process.on('unhandledRejection', (err) => {
  logger.warn({ err }, 'Unhandled promise rejection, ignoring');
});
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
      describe: 'Mode to run',
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Do not update Actual',
    })
    .option('verbose', {
      type: 'boolean',
      default: false,
      describe: 'Verbose logging',
    })
    .option('ui', {
      type: 'boolean',
      default: false,
      describe:
        'Start web UI server (daemon mode only; also enabled by HTTP_PORT)',
    })
    .option('http-port', {
      type: 'number',
      default: parseInt(
        config.httpPort ?? config.HTTP_PORT ?? process.env.HTTP_PORT ?? 3000,
        10,
      ),
      describe: 'Port for web UI server',
    })
    .help().argv;
  const { mode, dryRun, verbose, ui, httpPort } = argv;
  const useStructuredLogging = mode === 'daemon';
  // Use separate directories for data and budget cache
  const budgetDir =
    config.budgetDir ||
    process.env.BUDGET_DIR ||
    process.env.BUDGET_CACHE_DIR ||
    './data/budget';
  if (!fs.existsSync(budgetDir)) fs.mkdirSync(budgetDir, { recursive: true });
  process.env.BUDGET_CACHE_DIR = budgetDir;
  if (useStructuredLogging) {
    logger.info({ budgetDir }, 'Using shared budget cache directory');
  }
  switch (mode) {
    case 'train':
      await runTraining({ verbose });
      break;

    case 'classify': {
      const count = await runClassification({
        dryRun,
        verbose,
        useLogger: false,
      });
      if (!dryRun) {
        logger.info({ appliedCount: count }, 'Uploading updated budget');
      } else {
        logger.info(
          { appliedCount: count },
          'Dry-run complete; no updates applied',
        );
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
