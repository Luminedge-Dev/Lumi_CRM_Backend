/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/tests/helpers/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/helpers/setupDb.ts'],
  testMatch: ['<rootDir>/src/tests/**/*.test.ts'],
  testTimeout: 30000,
  // Every test file boots its own in-memory MongoDB. On many-core machines the default
  // (cores - 1 workers) starts too many mongod processes at once and beforeAll intermittently
  // times out, so cap the parallelism.
  maxWorkers: 4,
};
