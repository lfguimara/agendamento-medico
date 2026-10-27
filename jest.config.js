/** @type {import('jest').Config} */
const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Rápidos e sem banco: services com Prisma mockado + /health
      ...base,
      displayName: 'unit',
      testMatch: ['**/*.test.ts'],
      testPathIgnorePatterns: ['\\.int\\.test\\.ts$'],
    },
    {
      // Rotas de ponta a ponta (supertest) contra um PostgreSQL de teste real
      ...base,
      displayName: 'integration',
      testMatch: ['**/*.int.test.ts'],
      globalSetup: '<rootDir>/src/tests/setup/globalSetup.ts',
      setupFiles: ['<rootDir>/src/tests/setup/env.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup/integration.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/tests/**',
    '!src/generated/**',
    '!src/server.ts',
  ],
};
