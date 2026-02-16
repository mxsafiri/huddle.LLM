module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/db/migrate.js'],
  coverageDirectory: 'coverage',
  setupFiles: ['./tests/setup.js'],
};
