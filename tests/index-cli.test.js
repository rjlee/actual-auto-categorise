/**
 * @jest-environment node
 */
jest.mock('yargs/yargs', () => {
  const toCamel = (name) =>
    name.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());

  return (args = []) => {
    const parsed = {};
    const positional = [];
    for (let i = 0; i < args.length; i += 1) {
      const token = args[i];
      if (token.startsWith('--')) {
        const key = token.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          parsed[key] = next;
          i += 1;
        } else {
          parsed[key] = true;
        }
      } else {
        positional.push(token);
      }
    }
    parsed._ = positional;

    const defaults = {};
    const builder = {
      option(optionName, options = {}) {
        if (Object.prototype.hasOwnProperty.call(options, 'default')) {
          defaults[optionName] = options.default;
        }
        return builder;
      },
      help() {
        return builder;
      },
    };

    Object.defineProperty(builder, 'argv', {
      get() {
        const merged = { ...defaults, ...parsed };
        const result = {};
        for (const [key, value] of Object.entries(merged)) {
          if (key === '_') continue;
          let finalValue = value;
          if (typeof finalValue === 'string') {
            if (finalValue === 'true' || finalValue === 'false') {
              finalValue = finalValue === 'true';
            } else if (!Number.isNaN(Number(finalValue))) {
              finalValue = Number(finalValue);
            }
          }
          result[toCamel(key)] = finalValue;
        }
        result._ = merged._ ?? [];
        return result;
      },
    });

    return builder;
  };
});

const fs = require('fs');
const path = require('path');
const { main } = require('../src/index');

jest.mock('../src/train', () => ({
  runTraining: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/classifier', () => ({
  runClassification: jest.fn().mockResolvedValue(0),
}));
jest.mock('../src/daemon', () => ({
  runDaemon: jest.fn().mockResolvedValue(),
}));

describe('Unified CLI dispatcher (src/index.js)', () => {
  const tmpDir = path.join(__dirname, 'tmp-cli');
  const originalCwd = process.cwd();
  beforeAll(() => {
    if (fs.existsSync(tmpDir))
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
      expect.objectContaining({
        dryRun: false,
        verbose: false,
        useLogger: false,
      }),
    );
  });

  test('dispatches to daemon mode', async () => {
    process.chdir(tmpDir);
    await main(['--mode', 'daemon']);
    const { runDaemon } = require('../src/daemon');
    expect(runDaemon).toHaveBeenCalled();
  });
});
