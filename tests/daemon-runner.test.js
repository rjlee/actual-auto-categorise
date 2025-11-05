/**
 * @jest-environment node
 */
const { EventEmitter } = require('events');

const mockHttpRequest = jest.fn();
const mockHttpsRequest = jest.fn();

jest.mock('node-cron', () => ({
  validate: jest.fn().mockReturnValue(true),
  schedule: jest.fn(),
}));

jest.mock('http', () => ({
  request: (...args) => mockHttpRequest(...args),
}));

jest.mock('https', () => ({
  request: (...args) => mockHttpsRequest(...args),
}));

jest.mock('../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../src/utils', () => ({
  openBudget: jest.fn().mockResolvedValue(),
  closeBudget: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/web-ui', () => ({
  startWebUi: jest.fn(),
}));

jest.mock('../src/runner', () => ({
  runClassificationJob: jest.fn().mockResolvedValue(3),
  triggerDebounced: jest.fn(),
}));

jest.mock('../src/train', () => ({
  runTraining: jest.fn().mockResolvedValue(),
}));

const cron = require('node-cron');
const logger = require('../src/logger');
const { openBudget, closeBudget } = require('../src/utils');
const { startWebUi } = require('../src/web-ui');
const { runClassificationJob, triggerDebounced } = require('../src/runner');
const config = require('../src/config');
const { runDaemon } = require('../src/daemon');

const touchedConfigKeys = new Set();
function setConfig(key, value) {
  config[key] = value;
  touchedConfigKeys.add(key);
}

afterEach(() => {
  jest.clearAllMocks();
  mockHttpRequest.mockReset();
  mockHttpsRequest.mockReset();
  for (const key of touchedConfigKeys) {
    if (key !== 'loadConfig') {
      delete config[key];
    }
  }
  touchedConfigKeys.clear();
  delete process.env.DISABLE_CRON_SCHEDULING;
  delete process.env.ENABLE_EVENTS;
});

describe('runDaemon()', () => {
  test('performs initial budget sync and starts services', async () => {
    await runDaemon({ verbose: true, ui: true, httpPort: 0 });

    expect(openBudget).toHaveBeenCalledTimes(1);
    expect(closeBudget).toHaveBeenCalledWith({ dirty: false });
    expect(startWebUi).toHaveBeenCalledWith(0, true);
    expect(cron.schedule).toHaveBeenCalledTimes(2);
    expect(runClassificationJob).not.toHaveBeenCalled();
  });

  test('logs initial budget sync failure but still closes budget', async () => {
    openBudget.mockRejectedValueOnce(new Error('boom'));

    await runDaemon({ verbose: false, ui: false, httpPort: 0 });

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Initial budget sync failed',
    );
    expect(closeBudget).toHaveBeenCalledWith({ dirty: false });
  });

  test('warns when events enabled but URL missing', async () => {
    setConfig('enableEvents', true);
    setConfig('eventsUrl', '');

    await runDaemon({ verbose: false, ui: false, httpPort: 0 });

    expect(logger.warn).toHaveBeenCalledWith(
      'ENABLE_EVENTS set but EVENTS_URL missing; skipping event listener',
    );
  });

  test('subscribes to HTTP event stream and triggers classification debounce', async () => {
    setConfig('enableEvents', true);
    setConfig('eventsUrl', 'http://events.test/stream');
    setConfig('eventsAuthToken', 'token123');

    let responseEmitter;
    mockHttpRequest.mockImplementation((urlObj, options, cb) => {
      expect(urlObj.href).toContain('events=%5Etransaction');
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer token123',
        Accept: 'text/event-stream',
      });
      responseEmitter = new EventEmitter();
      responseEmitter.statusCode = 200;
      cb(responseEmitter);
      return {
        on: jest.fn(),
        end: jest.fn(),
      };
    });

    await runDaemon({ verbose: true, ui: false, httpPort: 0 });
    expect(mockHttpRequest).toHaveBeenCalled();

    responseEmitter.emit(
      'data',
      'id: 42\nevent: transaction.updated\ndata: {"after":{"id":"tx-1"}}\n\n',
    );

    expect(triggerDebounced).toHaveBeenCalledWith({
      verbose: true,
      delayMs: 1500,
    });
  });

  test('uses HTTPS agent when events URL is secure and retries on non-200 status', async () => {
    setConfig('enableEvents', true);
    setConfig('eventsUrl', 'https://events.test/stream');
    setConfig('eventsAuthToken', '');

    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((fn) => {
        fn();
        return 1;
      });

    mockHttpsRequest.mockImplementation((_urlObj, _options, cb) => {
      const res = new EventEmitter();
      res.statusCode = 500;
      res.resume = jest.fn();
      cb(res);
      return {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('connectfail'));
          }
        }),
        end: jest.fn(),
      };
    });

    await runDaemon({ verbose: false, ui: false, httpPort: 0 });

    expect(mockHttpsRequest).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { status: 500 },
      'Event stream returned non-200; will retry',
    );
    expect(setTimeoutSpy).toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });
});
