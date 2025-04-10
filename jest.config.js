/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    '_src/**/*.ts',
    '!_src/**/*.d.ts',
    '!_src/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // Global setup and teardown scripts for PostgreSQL container
  globalSetup: './_src/db/__tests__/globalSetup.ts',
  globalTeardown: './_src/db/__tests__/globalTeardown.ts',
  // Makes sure each test has access to global variables set in setup
  setupFilesAfterEnv: ['./_src/db/__tests__/setupTests.ts']
};