/**
 * @jest-environment node
 */
const path = require('path');
const util = require('util');

describe('suppress.js shims', () => {
  const suppressPath = path.join(__dirname, '..', 'src', 'suppress.js');
  const origStdout = process.stdout.write;
  const origStderr = process.stderr.write;
  const origNodeVersion = process.versions.node;
  const origIsNullOrUndefined = util.isNullOrUndefined;
  const origIsArray = util.isArray;

  afterEach(() => {
    jest.resetModules();
    delete process.env.ENABLE_NODE_VERSION_SHIM;
    process.stdout.write = origStdout;
    process.stderr.write = origStderr;
    Object.defineProperty(process.versions, 'node', {
      value: origNodeVersion,
      configurable: true,
    });
    util.isNullOrUndefined = origIsNullOrUndefined;
    util.isArray = origIsArray;
  });

  test('enables node version shim when requested', () => {
    process.env.ENABLE_NODE_VERSION_SHIM = 'true';
    jest.isolateModules(() => {
      // Require inside isolated module to ensure fresh execution of the shim.
      require(suppressPath);
    });
    expect(process.versions.node).toBe('20.0.0');
  });

  test('polyfills util helpers removed in newer Node releases', () => {
    util.isNullOrUndefined = undefined;
    util.isArray = undefined;
    jest.isolateModules(() => {
      require(suppressPath);
    });
    expect(util.isNullOrUndefined(null)).toBe(true);
    expect(util.isNullOrUndefined('value')).toBe(false);
    expect(util.isArray([1, 2, 3])).toBe(true);
    expect(util.isArray({})).toBe(false);
  });

  test('suppresses known noisy stdout/stderr messages', () => {
    const stdoutMock = jest.fn();
    const stderrMock = jest.fn();
    stdoutMock.mockReturnValue(true);
    stderrMock.mockReturnValue(true);
    process.stdout.write = stdoutMock;
    process.stderr.write = stderrMock;

    jest.isolateModules(() => {
      require(suppressPath);
    });

    const quietStdout = process.stdout.write;
    const quietStderr = process.stderr.write;

    expect(quietStdout('Loading fresh spreadsheet now\n')).toBe(true);
    expect(stdoutMock).not.toHaveBeenCalled();

    expect(quietStdout('A different message\n')).toBe(true);
    expect(stdoutMock).toHaveBeenCalledWith('A different message\n');

    expect(quietStderr('PostError: network-failure while syncing\n')).toBe(
      true,
    );
    expect(stderrMock).not.toHaveBeenCalled();

    expect(quietStderr('Important warning\n')).toBe(true);
    expect(stderrMock).toHaveBeenCalledWith('Important warning\n');
  });
});
