/** @type {import('jest').Config} */
const testPathIgnorePatterns = ['/node_modules/', '/dist/', '/resources/'];
if (process.env.SKIP_WEB_UI_TESTS === 'true') {
  // Skip Web UI E2E tests in restricted environments
  testPathIgnorePatterns.push('/tests/web-ui.test.js$');
}

/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  verbose: true,
  // Disable automatic coverage collection in local tests
  collectCoverage: false,
  testPathIgnorePatterns,
  modulePathIgnorePatterns: ['/resources/'],
  moduleNameMapper: {
    '^@tensorflow/tfjs-node$': '<rootDir>/tests/mocks/tfjs-node.js',
    '^@tensorflow-models/universal-sentence-encoder$':
      '<rootDir>/tests/mocks/universal-sentence-encoder.js',
  },
};
