import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setupTests.js'],
    css: true,
    coverage: {
      enabled: true,
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/__tests__/**',
        'node_modules/**',
      ],
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },
  },
});

