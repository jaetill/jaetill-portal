// ESLint flat config per platform ADR-0005 - pragmatic strict, JS variant.
// Targets src/ (frontend, ESM) and lambda/ (backend, CommonJS).
// This project does NOT use TypeScript; skip typescript-eslint plugins.

import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import promise from 'eslint-plugin-promise';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'site/',
      'coverage/',
      'lambda/node_modules/',
      '.claude/worktrees/',
      'public/',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
      promise,
    },
    rules: {
      'unused-imports/no-unused-imports': 'warn',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'promise/always-return': 'warn',
      'promise/no-nesting': 'warn',
      complexity: ['warn', 10],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['lambda/**/*.js', 'lambda/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.es2022 },
    },
    plugins: { promise },
    rules: {
      'promise/always-return': 'warn',
      'no-console': 'off',
      complexity: ['warn', 10],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...globals.es2022 },
    },
    rules: {
      'no-console': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
  },
];
