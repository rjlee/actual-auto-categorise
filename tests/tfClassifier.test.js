const fs = require('fs');
const path = require('path');
const os = require('os');

describe('classifyWithTF', () => {
  let modelDir;

  beforeEach(() => {
    modelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfmodel-'));
    jest.resetModules();
  });

  afterEach(() => {
    fs.rmSync(modelDir, { recursive: true, force: true });
    delete process.env.CLASSIFIER_TYPE;
  });

  it('falls back to empty array when TF deps are missing', async () => {
    jest.doMock('@tensorflow/tfjs-node', () => { throw new Error('no tf'); });
    jest.doMock(
      '@tensorflow-models/universal-sentence-encoder',
      () => { throw new Error('no use'); }
    );
    const logger = require('../src/logger');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const { classifyWithTF } = require('../src/services/tfClassifier');
    const res = await classifyWithTF([{ id: 'tx', description: 'x' }], modelDir);
    expect(res).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'TF classifier not available on this platform:',
      expect.any(String)
    );
    warn.mockRestore();
  });

  it('throws if classes.json is missing', async () => {
    jest.doMock('@tensorflow/tfjs-node', () => ({ loadLayersModel: jest.fn() }));
    jest.doMock(
      '@tensorflow-models/universal-sentence-encoder',
      () => ({ load: async () => ({ embed: async () => ({ dispose: jest.fn() }) }) })
    );
    const { classifyWithTF } = require('../src/services/tfClassifier');
    await expect(classifyWithTF([], modelDir)).rejects.toThrow(/classes\.json not found/);
  });

  it('correctly classifies transactions with a fake TF model', async () => {
    const classes = ['X', 'Y'];
    fs.writeFileSync(
      path.join(modelDir, 'classes.json'),
      JSON.stringify(classes)
    );
    jest.doMock('@tensorflow/tfjs-node', () => ({
      loadLayersModel: async () => ({
        predict: () => ({
          array: async () => [[0.3, 0.7], [0.8, 0.2]],
          dispose: jest.fn(),
        }),
      }),
    }));
    jest.doMock(
      '@tensorflow-models/universal-sentence-encoder',
      () => ({
        load: async () => ({
          embed: async () => ({ dispose: jest.fn() }),
        }),
      })
    );
    const { classifyWithTF } = require('../src/services/tfClassifier');
    const txns = [
      { id: 't1', description: 'foo' },
      { id: 't2', description: 'bar' },
    ];
    const results = await classifyWithTF(txns, modelDir);
    expect(results).toEqual([
      { id: 't1', description: 'foo', category: 'Y' },
      { id: 't2', description: 'bar', category: 'X' },
    ]);
  });
});