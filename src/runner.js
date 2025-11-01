const logger = require('./logger');
const { runClassification } = require('./classifier');

let running = false;
let pending = false;
let debounceTimer = null;

async function runClassificationJob({ verbose = false } = {}) {
  if (running) {
    logger.warn('Classification already running; skipping new run');
    pending = true;
    return 0;
  }
  running = true;
  try {
    const count = await runClassification({
      dryRun: false,
      verbose,
      useLogger: true,
    });
    return count;
  } catch (err) {
    logger.error({ err }, 'Classification run failed');
    return 0;
  } finally {
    running = false;
    if (pending) {
      pending = false;
      // Fire a follow-up run shortly to process any queued changes
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        runClassificationJob({ verbose }).catch(() => {});
      }, 1000);
    }
  }
}

function triggerDebounced({ verbose = false, delayMs = 1500 } = {}) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(
    () => {
      runClassificationJob({ verbose }).catch(() => {});
    },
    Math.max(0, delayMs),
  );
}

module.exports = { runClassificationJob, triggerDebounced };
