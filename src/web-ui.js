const fs = require('fs');
const https = require('https');
const path = require('path');

const ejs = require('ejs');
const express = require('express');

const logger = require('./logger');
const { runClassification } = require('./classifier');
const { runTraining } = require('./train');

const DEFAULT_COOKIE_NAME = 'actual-auth';

function hasAuthCookie(req) {
  const cookieName =
    process.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;
  const cookieHeader = req.headers?.cookie || '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${cookieName}=`));
}

function uiPageHtml({ showLogoutButton }) {
  const templatePath = path.join(__dirname, 'views', 'index.ejs');
  const template = fs.readFileSync(templatePath, 'utf8');
  return ejs.render(template, { showLogoutButton }, { filename: templatePath });
}

function startWebUi(httpPort, verbose) {
  const app = express();
  app.use(express.json());

  if (process.env.SSL_KEY && process.env.SSL_CERT) {
    const sslOpts = {
      key: fs.readFileSync(process.env.SSL_KEY),
      cert: fs.readFileSync(process.env.SSL_CERT),
    };
    const server = https.createServer(sslOpts, app).listen(httpPort, () => {
      logger.info({ port: httpPort }, 'Web UI HTTPS server listening');
    });
    return server;
  }

  let trainLock = false;
  let classifyLock = false;
  let trainStatus = {
    state: 'idle',
    message: 'Training idle',
    startedAt: null,
    finishedAt: null,
    error: null,
  };

  const updateTrainStatus = (changes = {}) => {
    trainStatus = {
      ...trainStatus,
      ...changes,
    };
  };

  app.get('/', (req, res) =>
    res.send(uiPageHtml({ showLogoutButton: hasAuthCookie(req) })),
  );
  app.get('/train/status', (_req, res) => res.json({ status: trainStatus }));

  app.post('/train', (_req, res) => {
    if (trainLock) {
      return res
        .status(409)
        .json({ message: 'Training already in progress', status: trainStatus });
    }
    trainLock = true;
    const startedAt = new Date().toISOString();
    updateTrainStatus({
      state: 'running',
      message: 'Training in progress',
      startedAt,
      finishedAt: null,
      error: null,
    });
    res.status(202).json({ message: 'Training started', status: trainStatus });
    (async () => {
      try {
        await runTraining({ verbose, useLogger: true });
        updateTrainStatus({
          state: 'completed',
          message: 'Training complete',
          finishedAt: new Date().toISOString(),
          error: null,
        });
      } catch (err) {
        logger.error({ err }, 'Training failed');
        updateTrainStatus({
          state: 'failed',
          message: 'Training failed',
          finishedAt: new Date().toISOString(),
          error: err.message,
        });
      } finally {
        trainLock = false;
      }
    })();
  });
  app.post('/classify', async (_req, res) => {
    if (classifyLock) {
      return res
        .status(409)
        .json({ message: 'Classification already in progress' });
    }
    classifyLock = true;
    try {
      const count = await runClassification({
        dryRun: false,
        verbose,
        useLogger: true,
      });
      res.json({
        message: `Classification complete: applied ${count} update(s)`,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: 'Classification failed', error: err.message });
    } finally {
      classifyLock = false;
    }
  });

  const server = app.listen(httpPort, () => {
    const realPort = server.address().port;
    logger.info({ port: realPort }, 'Web UI server listening');
  });
  return server;
}

module.exports = { startWebUi };
