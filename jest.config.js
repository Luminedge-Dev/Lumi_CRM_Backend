/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/__tests__/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setupDb.ts'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  testTimeout: 30000,
};
