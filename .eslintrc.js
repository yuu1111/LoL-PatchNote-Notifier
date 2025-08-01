module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es2022: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist/', 'node_modules/', '*.js', 'tests/'],
  rules: {
    // TypeScript specific rules - v1.0.0用設定（段階的改善）
    '@typescript-eslint/no-explicit-any': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true
    }],
    '@typescript-eslint/explicit-function-return-type': 'warn', // TODO: errorに戻す
    '@typescript-eslint/explicit-module-boundary-types': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-inferrable-types': 'error',
    // prefer-constはESLintのビルトインルールを使用
    '@typescript-eslint/no-var-requires': 'warn', // TODO: errorに戻す
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off', // 厳しすぎるため無効
    '@typescript-eslint/no-floating-promises': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-misused-promises': 'warn', // TODO: errorに戻す
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn', // TODO: errorに戻す
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    
    // 型安全性 - 段階的改善用
    '@typescript-eslint/no-unsafe-assignment': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-unsafe-member-access': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-unsafe-call': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-unsafe-return': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-unsafe-argument': 'warn', // TODO: errorに戻す
    '@typescript-eslint/restrict-template-expressions': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-base-to-string': 'warn', // TODO: errorに戻す
    '@typescript-eslint/restrict-plus-operands': 'warn', // TODO: errorに戻す
    '@typescript-eslint/no-redundant-type-constituents': 'warn', // TODO: errorに戻す
    
    // JavaScript/General rules - より厳格な設定
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-unused-expressions': 'error',
    'no-duplicate-imports': 'error',
    'no-unreachable': 'error',
    'no-unreachable-loop': 'error',
    'require-atomic-updates': 'error',
    
    // Security & Quality
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'radix': 'error',
    'yoda': 'error',
    
    // Code style
    'prefer-template': 'error',
    'prefer-spread': 'error',
    'prefer-rest-params': 'error',
    'object-shorthand': 'error',
    'one-var': ['error', 'never'],
  },
};