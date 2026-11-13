export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['<rootDir>/__tests__/helpers/env.js'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/helpers/'],
  testTimeout: 30000,
};
