/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { main } = require('../src/index');

jest.mock('../src/train', () => ({ runTraining: jest.fn().mockResolvedValue() }));
jest.mock('../src/classifier', () => ({ runClassification: jest.fn().mockResolvedValue(0) }));
jest.mock('../src/daemon', () => ({ runDaemon: jest.fn().mockResolvedValue() }));

describe('Unified CLI dispatcher (src/index.js)', () => {
  const tmpDir = path.join(__dirname, 'tmp-cli');
  const originalCwd = process.cwd();
  beforeAll(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
  });
  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('dispatches to train mode', async () => {
    process.chdir(tmpDir);
    await main(['--mode', 'train']);
    const { runTraining } = require('../src/train');
    expect(runTraining).toHaveBeenCalled();
  });

  test('dispatches to classify mode', async () => {
    process.chdir(tmpDir);
    await main(['--mode', 'classify']);
    const { runClassification } = require('../src/classifier');
    expect(runClassification).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: false, verbose: false, useLogger: false })
    );
  });

  test('dispatches to daemon mode', async () => {
    process.chdir(tmpDir);
    await main(['--mode', 'daemon']);
    const { runDaemon } = require('../src/daemon');
    expect(runDaemon).toHaveBeenCalled();
  });
});