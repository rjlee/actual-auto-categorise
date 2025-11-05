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

jest.mock('cookie-session', () =>
  jest.fn(() => (req, _res, next) => {
    req.session = req.session || {};
    next && next();
  }),
);

const fs = require('fs');
const https = require('https');
const express = require('express');
const cookieSession = require('cookie-session');

jest.mock('../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../src/logger');
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

afterEach(() => {
  jest.clearAllMocks();
  express.__reset();
  delete process.env.UI_AUTH_ENABLED;
  if (typeof ORIGINAL_ACTUAL_PASSWORD === 'undefined') {
    delete process.env.ACTUAL_PASSWORD;
  } else {
    process.env.ACTUAL_PASSWORD = ORIGINAL_ACTUAL_PASSWORD;
  }
  delete process.env.SESSION_SECRET;
  delete process.env.SSL_KEY;
  delete process.env.SSL_CERT;
});

describe('Web UI authentication', () => {
  test('exits when auth enabled without ACTUAL_PASSWORD', () => {
    process.env.UI_AUTH_ENABLED = 'true';
    delete process.env.ACTUAL_PASSWORD;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    jest.isolateModules(() => {
      const { startWebUi: isolatedStart } = require('../src/web-ui');
      delete process.env.ACTUAL_PASSWORD;
      isolatedStart(0, false);
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  test('middleware gate serves login form when unauthenticated', async () => {
    process.env.UI_AUTH_ENABLED = 'true';
    process.env.ACTUAL_PASSWORD = 'secret';
    process.env.SESSION_SECRET = 'secret2';

    startWebUi(0, false);
    const app = express.__getLastApp();

    // Last middleware is the auth gate.
    const authGate = app.middlewares[app.middlewares.length - 1];
    const req = createReq({ session: {} });
    const res = createRes();
    const next = jest.fn();

    await authGate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const [html] = res.send.mock.calls[0];
    expect(html).toMatch(/name="password"/);
  });

  test('login success sets session and logout clears it', async () => {
    process.env.UI_AUTH_ENABLED = 'true';
    process.env.ACTUAL_PASSWORD = 'secret';
    process.env.SESSION_SECRET = 'secret2';

    startWebUi(0, false);
    const app = express.__getLastApp();

    const loginHandler = getHandler(app, 'post', '/login');

    // Failed login
    const badReq = createReq({ body: { password: 'wrong' }, session: {} });
    const badRes = createRes();
    await loginHandler(badReq, badRes);
    expect(badRes.status).toHaveBeenCalledWith(401);
    expect(badRes.send.mock.calls[0][0]).toMatch(/Invalid password/);

    // Successful login
    const goodReq = createReq({ body: { password: 'secret' }, session: {} });
    const goodRes = createRes();
    await loginHandler(goodReq, goodRes);
    expect(goodReq.session.authenticated).toBe(true);
    expect(goodRes.redirect).toHaveBeenCalledWith('/');

    // Auth gate now allows access
    const authGate = app.middlewares[app.middlewares.length - 1];
    const next = jest.fn();
    const gateReq = createReq({ session: goodReq.session });
    const gateRes = createRes();
    await authGate(gateReq, gateRes, next);
    expect(next).toHaveBeenCalled();

    // Logout clears session
    const logoutHandler = getHandler(app, 'post', '/logout');
    const logoutRes = createRes();
    await logoutHandler(gateReq, logoutRes);
    expect(gateReq.session).toBeNull();
    expect(logoutRes.redirect).toHaveBeenCalledWith('/login');
  });

  test('creates HTTPS server when certificates provided', () => {
    process.env.SSL_KEY = '/tmp/test.key';
    process.env.SSL_CERT = '/tmp/test.cert';
    const fsSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('file');
    const mockServerInstance = { close: jest.fn() };
    const listenMock = jest.fn((_port, cb) => {
      cb();
      return mockServerInstance;
    });
    const createServerSpy = jest
      .spyOn(https, 'createServer')
      .mockReturnValue({ listen: listenMock });

    const server = startWebUi(3443, false);

    expect(fsSpy).toHaveBeenCalledWith('/tmp/test.key');
    expect(fsSpy).toHaveBeenCalledWith('/tmp/test.cert');
    expect(createServerSpy).toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledWith(3443, expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith(
      { port: 3443 },
      'Web UI HTTPS server listening',
    );
    expect(server).toBe(mockServerInstance);

    fsSpy.mockRestore();
    createServerSpy.mockRestore();
  });

  test('cookie-session middleware is configured', () => {
    process.env.UI_AUTH_ENABLED = 'true';
    process.env.ACTUAL_PASSWORD = 'secret';
    process.env.SESSION_SECRET = 'secret2';

    startWebUi(0, false);

    expect(cookieSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'session',
        keys: expect.any(Array),
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'strict',
      }),
    );
  });
});
const ORIGINAL_ACTUAL_PASSWORD = process.env.ACTUAL_PASSWORD;
