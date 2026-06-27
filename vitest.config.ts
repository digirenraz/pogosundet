import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: ['node_modules', 'e2e', '.next'],
    coverage: {
      provider: 'v8',
      // Scope to pure-logic modules only — components and pages rely on
      // React/Next.js rendering which unit tests don't exercise usefully.
      include: ['src/lib/**'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/**/*.d.ts'],
      reporter: ['text', 'json-summary'],
      // No hard thresholds — this is a visibility tool, not a gate.
      // Run locally with: npm run test:coverage
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
