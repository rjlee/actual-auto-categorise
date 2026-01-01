const fs = require('fs');
const https = require('https');
const path = require('path');

const ejs = require('ejs');
const express = require('express');

const logger = require('./logger');
const { runClassification } = require('./classifier');
const { Worker } = require('worker_threads');

const DEFAULT_COOKIE_NAME = 'actual-auth';
const TRAIN_WORKER_PATH = path.join(__dirname, 'workers', 'training-worker.js');

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

  const finishTrainStatus = (state, details = {}) => {
    updateTrainStatus({
      state,
      finishedAt: new Date().toISOString(),
      ...details,
    });
    trainLock = false;
  };

  const startTrainingWorker = () => {
    const worker = new Worker(TRAIN_WORKER_PATH, {
      workerData: { verbose, useLogger: true },
    });
    worker.on('message', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.status === 'success') {
        finishTrainStatus('completed', {
          message: 'Training complete',
          error: null,
        });
      } else if (msg.status === 'error') {
        finishTrainStatus('failed', {
          message: 'Training failed',
          error: msg.error || 'Unknown worker error',
        });
      }
    });
    worker.on('error', (err) => {
      finishTrainStatus('failed', {
        message: 'Training failed',
        error: err?.message || 'Worker error',
      });
    });
    worker.on('exit', (code) => {
      if (trainStatus.state === 'running') {
        if (code === 0) {
          finishTrainStatus('completed', {
            message: 'Training complete',
            error: null,
          });
        } else {
          finishTrainStatus('failed', {
            message: 'Training failed',
            error: `Worker exited with code ${code}`,
          });
        }
      }
    });
  };

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
    startTrainingWorker();
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
