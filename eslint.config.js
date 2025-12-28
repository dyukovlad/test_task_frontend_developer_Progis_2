import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        btoa: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        DOMParser: 'readonly',
        GeoJSON: 'readonly',
        Element: 'readonly',
        Document: 'readonly',
        HTMLCollectionOf: 'readonly',
        // Node.js globals for server-side code
        process: 'readonly',
        Buffer: 'readonly',
        RequestInit: 'readonly',
        // React JSX
        JSX: 'readonly',
        React: 'readonly',
        // Timer functions
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off', // Разрешить console для отладки
      'no-empty': 'warn', // Предупреждение вместо ошибки для пустых блоков
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'vite.config.ts'],
  },
];