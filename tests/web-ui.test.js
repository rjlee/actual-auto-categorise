/**
 * @jest-environment node
 */
jest.mock('express', () => {
  const apps = [];
  const express = jest.fn(() => {
    const app = {
      middlewares: [],
      routes: {
        get: new Map(),
        post: new Map(),
      },
      use(fn) {
        this.middlewares.push(fn);
        return this;
      },
      get(path, handler) {
        this.routes.get.set(path, handler);
        return this;
      },
      post(path, handler) {
        this.routes.post.set(path, handler);
        return this;
      },
      listen: jest.fn((port, cb) => {
        const server = {
          close: jest.fn((done) => done && done()),
          address: () => ({ port }),
        };
        if (cb) {
          process.nextTick(() => cb());
        }
        return server;
      }),
    };
    apps.push(app);
    return app;
  });
  express.json = jest.fn(() => (req, _res, next) => next && next());
  express.urlencoded = jest.fn(() => (req, _res, next) => next && next());
  express.__getLastApp = () => apps[apps.length - 1];
  express.__reset = () => {
    apps.length = 0;
  };
  return express;
});

jest.mock('worker_threads', () => {
  const { EventEmitter } = require('events');
  const instances = [];
  class FakeWorker extends EventEmitter {
    constructor(filename, options) {
      super();
      this.filename = filename;
      this.options = options;
      instances.push(this);
    }
    terminate = jest.fn(() => Promise.resolve());
    static __getInstances() {
      return instances;
    }
    static __getLastInstance() {
      return instances[instances.length - 1] || null;
    }
    static __reset() {
      instances.length = 0;
    }
  }
  return { Worker: FakeWorker };
});
jest.mock('../src/classifier', () => ({
  runClassification: jest.fn(async () => 0),
}));
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(async () => {}),
  closeBudget: jest.fn(async () => {}),
}));

const express = require('express');
const { Worker } = require('worker_threads');
const { runClassification } = require('../src/classifier');
const { startWebUi } = require('../src/web-ui');

function createReq(overrides = {}) {
  return {
    body: {},
    session: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  return res;
}

function getHandler(app, method, path) {
  const handler = app.routes[method].get(path);
  if (!handler) {
    throw new Error(
      `Handler for ${method.toUpperCase()} ${path} not registered`,
    );
  }
  return handler;
}

describe('Web UI server', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    express.__reset();
    Worker.__reset();
    startWebUi(0, false);
    app = express.__getLastApp();
  });

  afterEach(() => {});

  test('GET / renders HTML with action buttons and logout when authenticated', async () => {
    const res = createRes();
    const req = createReq({ headers: { cookie: 'actual-auth=token' } });
    await getHandler(app, 'get', '/')(req, res);
    const [html] = res.send.mock.calls[0];
    expect(html).toMatch(/id="trainBtn"/);
    expect(html).toMatch(/id="classifyBtn"/);
    expect(html).toMatch(/action="\/auth\/logout"/);
  });

  test('GET / hides logout button when no auth cookie present', async () => {
    const res = createRes();
    await getHandler(app, 'get', '/')(createReq(), res);
    const [html] = res.send.mock.calls[0];
    expect(html).not.toMatch(/action="\/auth\/logout"/);
  });

  test('POST /train triggers training asynchronously and returns acknowledgment', async () => {
    const res = createRes();
    await getHandler(app, 'post', '/train')(createReq(), res);

    const worker = Worker.__getLastInstance();
    expect(worker).toBeTruthy();
    expect(worker.filename).toMatch(/training-worker\.js$/);
    expect(worker.options.workerData).toEqual({
      verbose: false,
      useLogger: true,
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Training started',
      status: expect.objectContaining({
        state: 'running',
        message: 'Training in progress',
      }),
    });
  });

  test('GET /train/status reflects running and completed states', async () => {
    const handler = getHandler(app, 'post', '/train');
    handler(createReq(), createRes());

    const runningRes = createRes();
    await getHandler(app, 'get', '/train/status')(createReq(), runningRes);
    expect(runningRes.json).toHaveBeenCalledWith({
      status: expect.objectContaining({ state: 'running' }),
    });

    const worker = Worker.__getLastInstance();
    worker.emit('message', { status: 'success' });
    await new Promise((resolve) => setImmediate(resolve));

    const doneRes = createRes();
    await getHandler(app, 'get', '/train/status')(createReq(), doneRes);
    expect(doneRes.json).toHaveBeenCalledWith({
      status: expect.objectContaining({
        state: 'completed',
        message: 'Training complete',
      }),
    });
  });

  test('POST /train responds 409 when training already running', async () => {
    const handler = getHandler(app, 'post', '/train');
    const res1 = createRes();
    handler(createReq(), res1);

    const res2 = createRes();
    await handler(createReq(), res2);

    expect(res2.status).toHaveBeenCalledWith(409);
    expect(res2.json).toHaveBeenCalledWith({
      message: 'Training already in progress',
      status: expect.objectContaining({ state: 'running' }),
    });

    const worker = Worker.__getLastInstance();
    worker.emit('message', { status: 'success' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(res1.status).toHaveBeenCalledWith(202);
    expect(res1.json).toHaveBeenCalledWith({
      message: 'Training started',
      status: expect.objectContaining({ state: 'running' }),
    });
  });

  test('POST /classify returns applied updates count', async () => {
    runClassification.mockResolvedValueOnce(7);
    const res = createRes();

    await getHandler(app, 'post', '/classify')(createReq(), res);

    expect(runClassification).toHaveBeenCalledWith({
      dryRun: false,
      verbose: false,
      useLogger: true,
    });
    expect(res.json).toHaveBeenCalledWith({
      message: 'Classification complete: applied 7 update(s)',
    });
  });

  test('POST /classify responds 409 when classification already running', async () => {
    let resolveJob;
    runClassification.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJob = resolve;
        }),
    );

    const handler = getHandler(app, 'post', '/classify');
    const res1 = createRes();
    const firstJob = handler(createReq(), res1);

    const res2 = createRes();
    await handler(createReq(), res2);

    expect(res2.status).toHaveBeenCalledWith(409);
    expect(res2.json).toHaveBeenCalledWith({
      message: 'Classification already in progress',
    });

    resolveJob(4);
    await firstJob;
    expect(res1.json).toHaveBeenCalledWith({
      message: 'Classification complete: applied 4 update(s)',
    });
  });
});
