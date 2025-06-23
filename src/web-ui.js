const fs = require('fs');
const https = require('https');
const path = require('path');

const cookieSession = require('cookie-session');
const ejs = require('ejs');
const express = require('express');

const logger = require('./logger');
const { runClassification } = require('./classifier');
const { runTraining } = require('./train');

function uiPageHtml(uiAuthEnabled) {
  const templatePath = path.join(__dirname, 'views', 'index.ejs');
  const template = fs.readFileSync(templatePath, 'utf8');
  return ejs.render(template, { uiAuthEnabled }, { filename: templatePath });
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

  const UI_AUTH_ENABLED = process.env.UI_AUTH_ENABLED !== 'false';
  if (UI_AUTH_ENABLED) {
    const SECRET = process.env.ACTUAL_PASSWORD;
    if (!SECRET) {
      logger.error('ACTUAL_PASSWORD must be set to enable UI authentication');
      process.exit(1);
    }
    app.use(express.urlencoded({ extended: false }));

    app.use(
      cookieSession({
        name: 'session',
        keys: [process.env.SESSION_SECRET || SECRET],
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        httpOnly: true,
        secure: Boolean(process.env.SSL_KEY && process.env.SSL_CERT),
        sameSite: 'strict',
      }),
    );

    const LOGIN_PATH = '/login';
    /* eslint-disable no-inner-declarations */
    function loginForm(error) {
      const templatePath = path.join(__dirname, 'views', 'login.ejs');
      const template = fs.readFileSync(templatePath, 'utf8');
      return ejs.render(
        template,
        { error, LOGIN_PATH },
        { filename: templatePath },
      );
    }

    app.get(LOGIN_PATH, (_req, res) => res.send(loginForm()));
    app.post(LOGIN_PATH, (req, res) => {
      if (req.body.password === SECRET) {
        req.session.authenticated = true;
        return res.redirect(req.query.next || '/');
      }
      return res.status(401).send(loginForm('Invalid password'));
    });

    app.use((req, res, next) => {
      if (req.session.authenticated) {
        return next();
      }
      return res.send(loginForm());
    });

    app.post('/logout', (req, res) => {
      req.session = null;
      res.redirect(LOGIN_PATH);
    });
  }

  let trainLock = false;
  let classifyLock = false;

  app.get('/', (_req, res) => res.send(uiPageHtml(UI_AUTH_ENABLED)));
  app.post('/train', async (_req, res) => {
    if (trainLock) {
      return res.status(409).json({ message: 'Training already in progress' });
    }
    trainLock = true;
    try {
      await runTraining({ verbose, useLogger: true });
      res.json({ message: 'Training complete' });
    } catch (err) {
      res.status(500).json({ message: 'Training failed', error: err.message });
    } finally {
      trainLock = false;
    }
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
