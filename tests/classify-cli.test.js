const { main } = require('../src/classify');
const { runClassification } = require('../src/classifier');
const logger = require('../src/logger');

jest.mock('../src/classifier');
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('CLI classify (classify.js)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('live run logs uploading message', async () => {
    runClassification.mockResolvedValue(5);
    await main([]);
    expect(logger.info).toHaveBeenCalledWith(
      { appliedCount: 5 },
      'Uploading updated budget',
    );
  });

  test('dry-run logs dry-run message', async () => {
    runClassification.mockResolvedValue(2);
    await main(['--dry-run']);
    expect(logger.info).toHaveBeenCalledWith(
      { appliedCount: 2 },
      'Dry-run complete; no updates applied',
    );
  });

  test('error during runClassification causes exit', async () => {
    const err = new Error('boom');
    runClassification.mockRejectedValue(err);
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    await main([]);
    expect(logger.error).toHaveBeenCalledWith(
      { err },
      'Error during classification',
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
