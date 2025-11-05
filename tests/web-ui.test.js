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

jest.mock('../src/train', () => ({ runTraining: jest.fn(async () => {}) }));
jest.mock('../src/classifier', () => ({
  runClassification: jest.fn(async () => 0),
}));
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(async () => {}),
  closeBudget: jest.fn(async () => {}),
}));

const express = require('express');
const { runTraining } = require('../src/train');
const { runClassification } = require('../src/classifier');
const { startWebUi } = require('../src/web-ui');

function createReq(overrides = {}) {
  return {
    body: {},
    session: {},
    query: {},
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
    process.env.UI_AUTH_ENABLED = 'false';
    express.__reset();
    startWebUi(0, false);
    app = express.__getLastApp();
  });

  afterEach(() => {
    delete process.env.UI_AUTH_ENABLED;
  });

  test('GET / renders HTML with action buttons', async () => {
    const res = createRes();
    await getHandler(app, 'get', '/')({}, res);
    const [html] = res.send.mock.calls[0];
    expect(html).toMatch(/id="trainBtn"/);
    expect(html).toMatch(/id="classifyBtn"/);
  });

  test('POST /train runs training and returns success message', async () => {
    const res = createRes();
    await getHandler(app, 'post', '/train')(createReq(), res);

    expect(runTraining).toHaveBeenCalledWith({
      verbose: false,
      useLogger: true,
    });
    expect(res.json).toHaveBeenCalledWith({ message: 'Training complete' });
  });

  test('POST /train responds 409 when training already running', async () => {
    let resolveTraining;
    runTraining.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTraining = resolve;
        }),
    );

    const handler = getHandler(app, 'post', '/train');
    const res1 = createRes();
    const firstCall = handler(createReq(), res1);

    const res2 = createRes();
    await handler(createReq(), res2);

    expect(res2.status).toHaveBeenCalledWith(409);
    expect(res2.json).toHaveBeenCalledWith({
      message: 'Training already in progress',
    });

    resolveTraining();
    await firstCall;
    expect(res1.json).toHaveBeenCalledWith({ message: 'Training complete' });
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
