const { parentPort, workerData } = require('worker_threads');
const { runTraining } = require('../train');

(async () => {
  try {
    await runTraining(workerData || {});
    parentPort?.postMessage({ status: 'success' });
  } catch (err) {
    parentPort?.postMessage({
      status: 'error',
      error: err?.message || String(err),
    });
  }
})();
