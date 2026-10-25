import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

// NFR-ARC-01 / NFR-CODE-02: pure layers never import UI, storage or DOM code.
const pureLayerImports = {
  paths: ['react', 'react-dom', 'dexie', 'dexie-react-hooks', 'zustand', 'zundo', 'comlink'].map((name) => ({
    name,
    message: 'domain/engine/suggest must stay pure (NFR-ARC-01).',
  })),
  patterns: [
    {
      group: ['@/db/*', '@/store/*', '@/features/*', '@/components/*', '@/app/*', '@/workers/*', '@/lib/*'],
      message: 'domain/engine/suggest must stay pure (NFR-ARC-01).',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'flagbook-kit', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/engine/**/*.ts', 'src/suggest/**/*.ts'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      'no-restricted-imports': ['error', pureLayerImports],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'No DOM in pure layers (NFR-ARC-01).' },
        { name: 'document', message: 'No DOM in pure layers (NFR-ARC-01).' },
        { name: 'navigator', message: 'No DOM in pure layers (NFR-ARC-01).' },
        { name: 'localStorage', message: 'No DOM in pure layers (NFR-ARC-01).' },
      ],
    },
  },
  {
    // NFR-ARC-04: components reach data only through src/db repositories / hooks.
    files: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/store/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'dexie', message: 'Use repositories in src/db (NFR-ARC-04).' }],
          patterns: [{ group: ['@/db/schema'], message: 'Use repositories in src/db (NFR-ARC-04).' }],
        },
      ],
    },
  },
  prettier,
);
