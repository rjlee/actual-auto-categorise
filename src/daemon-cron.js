#!/usr/bin/env node
// Daemon using cron schedule to periodically classify new transactions
require('./suppress');
require('dotenv').config();

const cron = require('node-cron');
const { runClassification } = require('./classifier');

// Cron schedule (default: every hour on the hour)
const SCHEDULE = process.env.CLASSIFY_CRON || '0 * * * *';
const TIMEZONE = process.env.CLASSIFY_CRON_TIMEZONE || 'UTC';

const logger = require('./logger');
logger.info({ schedule: SCHEDULE, timezone: TIMEZONE }, 'Cron daemon starting');

cron.schedule(
  SCHEDULE,
  async () => {
    const startTs = new Date().toISOString();
    logger.info({ ts: startTs }, 'Starting classification run');
    try {
      const applied = await runClassification({ dryRun: false, verbose: false });
      logger.info({ ts: startTs, applied }, 'Classification run complete');
    } catch (err) {
      logger.error({ err, ts: startTs }, 'Classification error');
    }
  },
  { timezone: TIMEZONE }
);