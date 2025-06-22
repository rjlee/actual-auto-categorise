const trainModule = require('../src/train');
const { main } = trainModule;
const logger = require('../src/logger');

describe('CLI train (train.js)', () => {
  let runTrainingSpy;
  beforeEach(() => {
    jest.resetAllMocks();
    runTrainingSpy = jest.spyOn(trainModule, 'runTraining');
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  test('calls runTraining with verbose flag', async () => {
    runTrainingSpy.mockResolvedValue();
    await main(['--verbose'], runTrainingSpy);
    expect(runTrainingSpy).toHaveBeenCalledWith({
      verbose: true,
      useLogger: false,
    });
  });

  test('defaults to non-verbose run', async () => {
    runTrainingSpy.mockResolvedValue();
    await main([], runTrainingSpy);
    expect(runTrainingSpy).toHaveBeenCalledWith({
      verbose: false,
      useLogger: false,
    });
  });

  test('propagates errors from runTraining without exiting', async () => {
    const error = new Error('fail');
    runTrainingSpy.mockRejectedValue(error);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    await expect(main([], runTrainingSpy)).rejects.toThrow(error);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
