const collectCoverage = process.env.JEST_COVERAGE === 'true';
const testPathIgnorePatterns = ['/node_modules/', '/dist/', '/resources/'];
if (process.env.SKIP_WEB_UI_TESTS === 'true') {
  testPathIgnorePatterns.push('/tests/web-ui.test.js$');
}

const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  passWithNoTests: true,
  verbose: process.env.JEST_VERBOSE === 'true',
  collectCoverage,
  coverageDirectory: 'coverage',
  testPathIgnorePatterns,
  modulePathIgnorePatterns: ['/resources/'],
  moduleNameMapper: {
    '^@tensorflow/tfjs-node$': '<rootDir>/tests/mocks/tfjs-node.js',
    '^@tensorflow-models/universal-sentence-encoder$':
      '<rootDir>/tests/mocks/universal-sentence-encoder.js',
  },
};

if (collectCoverage) {
  config.coverageThreshold = {
    global: {
      branches: 50,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  };
}

module.exports = config;
