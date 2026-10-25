/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/features/**', 'jsdom'],
      ['src/app/**', 'jsdom'],
      ['src/lib/**', 'jsdom'],
      ['src/store/**', 'jsdom'],
      ['src/db/**', 'jsdom'],
    ],
    setupFiles: ['src/test/setup.ts'],
    benchmark: { include: ['src/**/*.bench.ts'] },
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/engine/**', 'src/suggest/**', 'src/db/**', 'src/lib/**'],
      exclude: ['**/__tests__/**', '**/__bench__/**', 'src/domain/types.ts', 'src/engine/types.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
