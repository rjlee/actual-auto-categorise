const pino = require('pino');

// Create a JSON-structured logger with timestamp
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
