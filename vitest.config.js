import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['core/**/*.test.js', 'extension/**/*.test.js'] },
});
