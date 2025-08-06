import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', 'patches/**', 'logs/**'],
  },
  // Base JavaScript configuration
  eslint.configs.recommended,
  // TypeScript recommended configurations
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  // Global configuration
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  // TypeScript files configuration
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript specific rules - 厳格化設定
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      }],
      '@typescript-eslint/no-explicit-any': 'warn', // 段階的に厳格化予定
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      // '@typescript-eslint/strict-boolean-expressions': 'off', // TypeScriptの型チェックで十分
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'method',
          format: ['camelCase'],
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
      ],

      // Code Quality Rules
      'complexity': ['warn', { max: 15 }], // 実用的な複雑度に緩和
      'max-depth': ['error', 4],
      'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }], // 実用的なサイズに緩和
      'max-params': ['error', 4],
      'no-magic-numbers': 'off', // HTTPステータスコードなどの定数は明確なので無効化
      'no-duplicate-imports': 'error',
      'no-return-await': 'error',
      'require-await': 'warn',

      // Security Rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // General rules - より厳格に
      'no-console': ['warn', { allow: ['warn', 'error'] }], // Logger使用を推奨
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-else-return': 'error',
      'no-empty-function': 'error',
      'no-lonely-if': 'error',
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'prefer-destructuring': 'off', // 単一プロパティアクセスでの分割代入は不要
      'prefer-arrow-callback': 'error',
      'arrow-body-style': 'off', // デバッグ時の利便性を優先
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'default-case': 'error',
      'no-fallthrough': 'error',
      
      // Import Rules
      'sort-imports': 'off', // インポート順序は開発者の判断に委ねる
      
      // Prettier integration
      'prettier/prettier': 'error',
    },
  },
  // Test files configuration
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.test.json',
      },
    },
  },
  // Prettier config to disable conflicting rules
  prettierConfig,
);