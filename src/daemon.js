const cron = require('node-cron');
// Express UI moved to web-ui.js
const config = require('./config');
const logger = require('./logger');
const { runTraining } = require('./train');
const { runClassificationJob, triggerDebounced } = require('./runner');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const { startWebUi } = require('./web-ui');
const { openBudget, closeBudget } = require('./utils');

let currentBudgetOpen = false;
let cronJobs = [];
let uiServerPromise = null;
let eventsCleanup = null;

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
  const job = cron.schedule(
    schedule,
    async () => {
      const ts = new Date().toISOString();
      logger.info({ ts }, 'Daemon classification run start');
      try {
        const count = await runClassificationJob({ verbose });
        logger.info({ ts, count }, 'Daemon classification run complete');
      } catch (err) {
        logger.error({ err, ts }, 'Daemon run failed');
      }
    },
    timezone ? { timezone } : {},
  );
  cronJobs.push(job);
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
  const job = cron.schedule(
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
  cronJobs.push(job);
}

async function runDaemon({ verbose, ui, httpPort }) {
  cronJobs.forEach((job) => job?.stop?.());
  cronJobs = [];
  eventsCleanup = null;
  uiServerPromise = null;
  currentBudgetOpen = false;

  // Perform an initial budget download & sync when the daemon starts
  logger.info('Performing initial budget sync');
  try {
    await openBudget();
    currentBudgetOpen = true;
    logger.info('Initial budget sync complete');
  } catch (err) {
    logger.error({ err }, 'Initial budget sync failed');
  } finally {
    try {
      await closeBudget({ dirty: false });
    } catch (closeErr) {
      logger.warn(
        { err: closeErr },
        'Failed to close budget after initial sync',
      );
    } finally {
      currentBudgetOpen = false;
    }
  }

  const explicitPort =
    typeof config.httpPort !== 'undefined' ||
    typeof config.HTTP_PORT !== 'undefined' ||
    typeof process.env.HTTP_PORT !== 'undefined';
  if (ui || explicitPort) {
    uiServerPromise = Promise.resolve(startWebUi(httpPort, verbose)).catch(
      (err) => {
        logger.error({ err }, 'Web UI server failed');
        return null;
      },
    );
  }
  scheduleClassification(verbose);
  scheduleTraining(verbose);

  // Optional: integrate with actual-events SSE to trigger classification on changes
  const enableEvents =
    config.enableEvents === true ||
    config.ENABLE_EVENTS === true ||
    /^true$/i.test(process.env.ENABLE_EVENTS || '');
  const eventsUrl =
    config.eventsUrl || config.EVENTS_URL || process.env.EVENTS_URL || '';
  const authToken =
    config.eventsAuthToken ||
    config.EVENTS_AUTH_TOKEN ||
    process.env.EVENTS_AUTH_TOKEN ||
    '';
  if (enableEvents && eventsUrl) {
    eventsCleanup = startEventsListener({ eventsUrl, authToken, verbose });
  } else if (enableEvents && !eventsUrl) {
    logger.warn(
      'ENABLE_EVENTS set but EVENTS_URL missing; skipping event listener',
    );
  }

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down daemon');
    try {
      cronJobs.forEach((job) => job.stop?.());
      cronJobs = [];
      if (eventsCleanup) {
        try {
          await eventsCleanup();
        } catch (err) {
          logger.warn({ err }, 'Error during event listener cleanup');
        }
      }
      if (uiServerPromise) {
        const server = await uiServerPromise.catch(() => null);
        if (server?.close) {
          await new Promise((resolve) => server.close(resolve));
        }
        uiServerPromise = null;
      }
      if (currentBudgetOpen) {
        await closeBudget();
        currentBudgetOpen = false;
      }
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

module.exports = { runDaemon, scheduleClassification, scheduleTraining };

// Lightweight SSE client to subscribe to actual-events
function startEventsListener({ eventsUrl, authToken, verbose }) {
  try {
    const base = new URL(eventsUrl);
    // Apply default filters if none provided in URL
    if (!base.searchParams.get('events')) {
      base.searchParams.set('events', '^transaction\\.(created|updated)$');
      base.searchParams.set('entities', 'transaction');
      base.searchParams.set('useRegex', 'true');
    }
    const isHttps = base.protocol === 'https:';
    const agent = isHttps ? https : http;
    let lastId = undefined;
    let retryMs = 2000;

    const connect = () => {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      if (lastId) headers['Last-Event-ID'] = lastId;
      headers['Accept'] = 'text/event-stream';
      const req = agent.request(
        base,
        {
          method: 'GET',
          headers,
        },
        (res) => {
          if (res.statusCode !== 200) {
            logger.warn(
              { status: res.statusCode },
              'Event stream returned non-200; will retry',
            );
            res.resume();
            setTimeout(connect, retryMs);
            retryMs = Math.min(30000, retryMs * 2);
            return;
          }
          logger.info({ url: base.toString() }, 'Connected to event stream');
          retryMs = 2000;
          let buf = '';
          res.on('data', (chunk) => {
            buf += chunk.toString('utf8');
            let idx;
            while ((idx = buf.indexOf('\n\n')) !== -1) {
              const raw = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              handleEvent(raw);
            }
          });
          res.on('end', () => {
            logger.warn('Event stream ended; reconnecting');
            setTimeout(connect, retryMs);
            retryMs = Math.min(30000, retryMs * 2);
          });
        },
      );
      req.on('error', (err) => {
        logger.warn({ err }, 'Event stream error; reconnecting');
        setTimeout(connect, retryMs);
        retryMs = Math.min(30000, retryMs * 2);
      });
      req.end();
    };

    const handleEvent = (raw) => {
      try {
        const lines = raw.split(/\r?\n/);
        let id = null;
        let event = 'message';
        let data = '';
        for (const line of lines) {
          if (!line) continue;
          if (line.startsWith('id:')) id = line.slice(3).trim();
          else if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (id) lastId = id;
        if (!data) return;
        const payload = JSON.parse(data);
        if (
          event === 'transaction.created' ||
          event === 'transaction.updated'
        ) {
          // Debounce multiple events; queue a classification job soon
          if (verbose) {
            logger.info(
              { event, txId: payload?.after?.id || payload?.before?.id },
              'Event received; scheduling classification',
            );
          }
          triggerDebounced({ verbose, delayMs: 1500 });
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    connect();
    return async () => {
      try {
        logger.info('Stopping event listener');
      } catch (e) {
        /* ignore */
      }
    };
  } catch (err) {
    logger.warn({ err }, 'Failed to start event listener');
    return null;
  }
}
