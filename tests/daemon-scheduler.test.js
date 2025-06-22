/**
 * @jest-environment node
 */
// Mock node-cron to spy on validate/schedule calls
jest.mock('node-cron', () => ({
  validate: jest.fn(),
  schedule: jest.fn(),
}));
// Mock logger so we can spy on info/warn
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
const cron = require('node-cron');
const logger = require('../src/logger');
const config = require('../src/config');

// Stub classifiers and trainers so callback bodies don't run heavy logic
jest.mock('../src/classifier', () => ({
  runClassification: jest.fn().mockResolvedValue(0),
}));
jest.mock('../src/train', () => ({
  runTraining: jest.fn().mockResolvedValue(),
}));

const { scheduleClassification, scheduleTraining } = require('../src/daemon');

describe('scheduleClassification()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure disable flag is cleared and default cron.validate to true
    delete process.env.DISABLE_CRON_SCHEDULING;
    cron.validate.mockReturnValue(true);
  });

  test('exits process on invalid cron', () => {
    cron.validate.mockReturnValue(false);
    logger.error = jest.fn();
    process.exit = jest.fn((code) => {
      throw new Error('exit ' + code);
    });
    config.CLASSIFY_CRON = 'bad';
    expect(() => scheduleClassification(false)).toThrow('exit 1');
    expect(logger.error).toHaveBeenCalledWith(
      { schedule: 'bad' },
      'Invalid CLASSIFY_CRON schedule: bad',
    );
  });

  test('schedules classification with correct args and guards overlap', () => {
    // Set a custom cron and timezone
    config.CLASSIFY_CRON = '*/5 * * * *';
    config.CLASSIFY_CRON_TIMEZONE = 'America/Chicago';
    let scheduleCb;
    cron.schedule.mockImplementation((expr, fn, opts) => {
      scheduleCb = fn;
      expect(expr).toBe('*/5 * * * *');
      expect(opts).toEqual({ timezone: 'America/Chicago' });
    });
    scheduleClassification(true);
    expect(logger.info).toHaveBeenCalledWith(
      {
        job: 'classification',
        schedule: '*/5 * * * *',
        timezone: 'America/Chicago',
      },
      'Starting classification daemon',
    );
    // First run should invoke runClassification
    scheduleCb();
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(Object),
      'Daemon classification run start',
    );
    // Second run overlaps: should log a warning, not start again
    scheduleCb();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(Object),
      'Skipping scheduled classification run: previous run still in progress',
    );
  });
  test('skips scheduling when DISABLE_CRON_SCHEDULING is true', () => {
    process.env.DISABLE_CRON_SCHEDULING = 'true';
    scheduleClassification(false);
    expect(cron.validate).not.toHaveBeenCalled();
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { job: 'classification' },
      'Cron scheduling disabled via DISABLE_CRON_SCHEDULING',
    );
  });
});

describe('scheduleTraining()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure disable flag is cleared and default cron.validate to true
    delete process.env.DISABLE_CRON_SCHEDULING;
    cron.validate.mockReturnValue(true);
  });

  test('exits process on invalid cron', () => {
    cron.validate.mockReturnValue(false);
    logger.error = jest.fn();
    process.exit = jest.fn((code) => {
      throw new Error('exit ' + code);
    });
    config.TRAIN_CRON = 'bad';
    expect(() => scheduleTraining(false)).toThrow('exit 1');
    expect(logger.error).toHaveBeenCalledWith(
      { schedule: 'bad' },
      'Invalid TRAIN_CRON schedule: bad',
    );
  });

  test('schedules training with correct args and guards overlap', () => {
    config.TRAIN_CRON = '15 3 * * *';
    config.TRAIN_CRON_TIMEZONE = 'UTC';
    let scheduleCb;
    cron.schedule.mockImplementation((expr, fn, opts) => {
      scheduleCb = fn;
      expect(expr).toBe('15 3 * * *');
      expect(opts).toEqual({ timezone: 'UTC' });
    });
    scheduleTraining(true);
    expect(logger.info).toHaveBeenCalledWith(
      { job: 'training', schedule: '15 3 * * *', timezone: 'UTC' },
      'Scheduling weekly training',
    );
    // First run
    scheduleCb();
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(Object),
      'Daemon training run start',
    );
    // Overlapping skip
    scheduleCb();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(Object),
      'Skipping scheduled training: previous run still in progress',
    );
  });
  test('skips scheduling when DISABLE_CRON_SCHEDULING is true', () => {
    process.env.DISABLE_CRON_SCHEDULING = 'true';
    scheduleTraining(false);
    expect(cron.validate).not.toHaveBeenCalled();
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { job: 'training' },
      'Cron scheduling disabled via DISABLE_CRON_SCHEDULING',
    );
  });
});
