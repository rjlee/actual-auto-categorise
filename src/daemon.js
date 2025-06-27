const cron = require('node-cron');
// Express UI moved to web-ui.js
const config = require('./config');
const logger = require('./logger');
const { runTraining } = require('./train');
const { runClassification } = require('./classifier');

const { startWebUi } = require('./web-ui');
const { openBudget, closeBudget } = require('./utils');

// Set up the classification cron job
function scheduleClassification(verbose) {
  const disableCron =
    process.env.DISABLE_CRON_SCHEDULING === 'true' ||
    config.DISABLE_CRON_SCHEDULING === true;
  if (disableCron) {
    logger.info(
      { job: 'classification' },
      'Cron scheduling disabled via DISABLE_CRON_SCHEDULING',
    );
    return;
  }
  const schedule =
    config.CLASSIFY_CRON || process.env.CLASSIFY_CRON || '0 * * * *';
  const timezone =
    config.CLASSIFY_CRON_TIMEZONE ||
    process.env.CLASSIFY_CRON_TIMEZONE ||
    'UTC';
  if (!cron.validate(schedule)) {
    logger.error({ schedule }, `Invalid CLASSIFY_CRON schedule: ${schedule}`);
    process.exit(1);
  }
  logger.info(
    { job: 'classification', schedule, timezone },
    'Starting classification daemon',
  );
  let running = false;
  cron.schedule(
    schedule,
    async () => {
      const ts = new Date().toISOString();
      if (running) {
        logger.warn(
          { ts },
          'Skipping scheduled classification run: previous run still in progress',
        );
        return;
      }
      running = true;
      logger.info({ ts }, 'Daemon classification run start');
      try {
        const count = await runClassification({
          dryRun: false,
          verbose,
          useLogger: true,
        });
        logger.info({ ts, count }, 'Daemon classification run complete');
      } catch (err) {
        logger.error({ err, ts }, 'Daemon run failed');
      } finally {
        running = false;
      }
    },
    timezone ? { timezone } : {},
  );
}

// Set up the weekly training cron job
function scheduleTraining(verbose) {
  const disableCron =
    process.env.DISABLE_CRON_SCHEDULING === 'true' ||
    config.DISABLE_CRON_SCHEDULING === true;
  if (disableCron) {
    logger.info(
      { job: 'training' },
      'Cron scheduling disabled via DISABLE_CRON_SCHEDULING',
    );
    return;
  }
  const schedule = config.TRAIN_CRON || process.env.TRAIN_CRON || '30 6 * * 1';
  const timezone =
    config.TRAIN_CRON_TIMEZONE || process.env.TRAIN_CRON_TIMEZONE || 'UTC';
  if (!cron.validate(schedule)) {
    logger.error({ schedule }, `Invalid TRAIN_CRON schedule: ${schedule}`);
    process.exit(1);
  }
  logger.info(
    { job: 'training', schedule, timezone },
    'Scheduling weekly training',
  );
  let running = false;
  cron.schedule(
    schedule,
    async () => {
      const ts = new Date().toISOString();
      if (running) {
        logger.warn(
          { ts },
          'Skipping scheduled training: previous run still in progress',
        );
        return;
      }
      running = true;
      logger.info({ ts }, 'Daemon training run start');
      try {
        await runTraining({ verbose, useLogger: true });
        logger.info({ ts }, 'Daemon training run complete');
      } catch (err) {
        logger.error({ err, ts }, 'Daemon training run failed');
      } finally {
        running = false;
      }
    },
    timezone ? { timezone } : {},
  );
}

async function runDaemon({ verbose, ui, httpPort }) {
  // Perform an initial budget download & sync when the daemon starts
  logger.info('Performing initial budget sync');
  try {
    await openBudget();
    logger.info('Initial budget sync complete');
  } catch (err) {
    logger.error({ err }, 'Initial budget sync failed');
  } finally {
    await closeBudget();
  }

  const explicitPort =
    typeof config.httpPort !== 'undefined' ||
    typeof config.HTTP_PORT !== 'undefined' ||
    typeof process.env.HTTP_PORT !== 'undefined';
  if (ui || explicitPort) startWebUi(httpPort, verbose);
  scheduleClassification(verbose);
  scheduleTraining(verbose);
}

module.exports = { runDaemon, scheduleClassification, scheduleTraining };
