#!/usr/bin/env node
// CLI entrypoint: download, classify, and apply updates once
require('./suppress');
require('dotenv').config();

const { runClassification } = require('./classifier');

const logger = require('./logger');

async function main(args = process.argv.slice(2), executor = runClassification) {
  const DRY_RUN = args.includes('--dry-run');
  const VERBOSE = args.includes('--verbose');

  try {
    const appliedCount = await executor({ dryRun: DRY_RUN, verbose: VERBOSE });
    if (!DRY_RUN) {
      logger.info({ appliedCount }, 'Uploading updated budget');
    } else {
      logger.info({ appliedCount }, 'Dry-run complete; no updates applied');
    }
  } catch (err) {
    logger.error({ err }, 'Error during classification');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };