import { defineConfig } from 'vitest/config';

// Vitest configuration per platform ADR-0004.
// Portal has no tests yet; scaffolding is in place so Phase 4 CI passes
// (vitest run --passWithNoTests) and future tests have a tiered-coverage home.

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,mjs}', 'src/**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules/**', '.claude/worktrees/**', 'lambda/node_modules/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      include: ['src/**/*.js', 'lambda/**/*.{js,mjs}'],
      exclude: ['src/**/*.test.js', 'lambda/**/*.test.js', 'lambda/node_modules/**', 'public/**'],
      // Thresholds intentionally omitted until tests exist. Add per-tier
      // thresholds (default 80/70, critical 90/80, utility 60/50) once
      // coverage is meaningful. See ADR-0004 for the tier definitions.
    },
  },
});
