// Mock Actual API methods
jest.mock('@actual-app/api', () => ({
  init: jest.fn(),
  runImport: jest.fn(),
  downloadBudget: jest.fn(),
  shutdown: jest.fn(),
  resetBudgetCache: jest.fn(),
  sync: jest.fn(),
}));
const api = require('@actual-app/api');

const {
  openBudget,
  closeBudget,
  __resetBudgetDownloadFlag,
} = require('../src/utils');
const logger = require('../src/logger');

describe('openBudget utility', () => {
  const envBackup = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    process.env.DISABLE_IMPORT_BACKUPS = 'false';
    __resetBudgetDownloadFlag();
    // Suppress expected logger output during openBudget tests
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'info').mockImplementation(() => {});
  });
  afterAll(() => {
    process.env = envBackup;
  });

  test('throws if required env vars are missing', async () => {
    delete process.env.ACTUAL_SERVER_URL;
    delete process.env.ACTUAL_PASSWORD;
    delete process.env.ACTUAL_SYNC_ID;
    await expect(openBudget()).rejects.toThrow(
      /Please set ACTUAL_SERVER_URL, ACTUAL_PASSWORD, and ACTUAL_SYNC_ID/,
    );
  });

  test('always downloads budget without backup', async () => {
    process.env.ACTUAL_SERVER_URL = 'u';
    process.env.ACTUAL_PASSWORD = 'p';
    process.env.ACTUAL_SYNC_ID = 'b';
    api.init.mockResolvedValue();
    api.downloadBudget.mockResolvedValue();
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {});

    await expect(openBudget()).resolves.toBeUndefined();
    expect(api.init).toHaveBeenCalled();
    expect(api.downloadBudget).toHaveBeenCalledTimes(1);
    expect(api.runImport).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Downloading budget (no backup)...');
  });
});

describe('closeBudget utility', () => {
  afterEach(() => jest.clearAllMocks());

  test('calls shutdown successfully', async () => {
    api.shutdown.mockResolvedValue();
    await expect(closeBudget()).resolves.toBeUndefined();
    expect(api.shutdown).toHaveBeenCalled();
  });

  test('exits on shutdown failure', async () => {
    api.shutdown.mockRejectedValue(new Error('fail'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error('exit ' + code);
    });
    await expect(closeBudget()).rejects.toThrow('exit 1');
  });
});
