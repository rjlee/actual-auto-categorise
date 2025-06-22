/**
 * @jest-environment node
 */
// Stub training/classification and budget utils to avoid DB calls and logs
jest.mock('../src/train', () => ({ runTraining: jest.fn(async () => {}) }));
jest.mock('../src/classifier', () => ({
  runClassification: jest.fn(async () => 0),
}));
jest.mock('../src/utils', () => ({
  openBudget: jest.fn(async () => {}),
  closeBudget: jest.fn(async () => {}),
}));
const { startWebUi } = require('../src/web-ui');

describe('Web UI server (E2E)', () => {
  let server;
  let url;
  beforeAll(() => {
    server = startWebUi(0, false);
    const port = server.address().port;
    url = `http://127.0.0.1:${port}`;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  test('GET / serves HTML with buttons', async () => {
    const res = await fetch(url + '/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/id="trainBtn"/);
    expect(html).toMatch(/id="classifyBtn"/);
  });

  test('POST /train returns JSON message', async () => {
    const res = await fetch(url + '/train', { method: 'POST' });
    expect([200, 409]).toContain(res.status);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('POST /classify returns JSON message', async () => {
    const res = await fetch(url + '/classify', { method: 'POST' });
    expect([200, 409]).toContain(res.status);
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });
});
