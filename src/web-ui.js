const express = require('express');
const logger = require('./logger');
const { runTraining } = require('./train');
const { runClassification } = require('./classifier');

// Generate the HTML for the UI page
function uiPageHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actual Auto Categorise</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-5">
    <h1 class="mb-4 text-center">Actual Auto Categorise</h1>
    <div class="d-flex justify-content-center gap-3">
      <button id="trainBtn" class="btn btn-primary btn-lg">Train</button>
      <button id="classifyBtn" class="btn btn-success btn-lg">Classify</button>
    </div>
    <div id="status" class="mt-4 text-center"></div>
  </div>
  <script>
    const statusEl = document.getElementById('status');
    document.getElementById('trainBtn').onclick = () => {
      statusEl.textContent = 'Training started...';
      fetch('/train', { method: 'POST' })
        .then(r => r.json())
        .then(j => statusEl.textContent = j.message || JSON.stringify(j))
        .catch(e => statusEl.textContent = 'Error: ' + e);
    };
    document.getElementById('classifyBtn').onclick = () => {
      statusEl.textContent = 'Classification started...';
      fetch('/classify', { method: 'POST' })
        .then(r => r.json())
        .then(j => statusEl.textContent = j.message || JSON.stringify(j))
        .catch(e => statusEl.textContent = 'Error: ' + e);
    };
  </script>
</body>
</html>`;
}

// Launch the Express-based UI server
function startWebUi(httpPort, verbose) {
  const app = express();
  app.use(express.json());
  let trainLock = false;
  let classifyLock = false;

  app.get('/', (_req, res) => res.send(uiPageHtml()));
  app.post('/train', async (_req, res) => {
    if (trainLock)
      return res.status(409).json({ message: 'Training already in progress' });
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
    if (classifyLock)
      return res
        .status(409)
        .json({ message: 'Classification already in progress' });
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

  // Listen and return the server instance so tests (and index.js) can close it
  const server = app.listen(httpPort, () => {
    const realPort = server.address().port;
    logger.info({ port: realPort }, 'Web UI server listening');
  });
  return server;
}

module.exports = { startWebUi };
