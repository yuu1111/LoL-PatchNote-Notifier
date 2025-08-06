/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testEnvironmentOptions: {
    // Node.js環境のオプション
    customExportConditions: ['node', 'node-addons'],
  },
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'node',
        target: 'ES2022',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // テストファイルが存在しない場合でも正常終了
  passWithNoTests: true,
  // Setup files
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: [],
  // Module path mapping (if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // undiciの問題を回避するためのマッピング
    '^undici$': '<rootDir>/tests/__mocks__/undici.js',
  },
  // Test timeout
  testTimeout: 10000,
  // Verbose output
  verbose: true,
  // Clear mocks
  clearMocks: true,
  // Collect coverage
  collectCoverage: false,
  // Coverage threshold (uncomment when tests are added)
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80,
  //   },
  // },
};