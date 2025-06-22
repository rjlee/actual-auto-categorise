/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  verbose: true,
  // Disable automatic coverage collection in local tests
  collectCoverage: false,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/resources/'],
  modulePathIgnorePatterns: ['/resources/'],
  moduleNameMapper: {
    '^@tensorflow/tfjs-node$': '<rootDir>/tests/mocks/tfjs-node.js',
    '^@tensorflow-models/universal-sentence-encoder$':
      '<rootDir>/tests/mocks/universal-sentence-encoder.js',
  },
};
