import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
      'video/**/*.test.ts',
      'video/**/*.test.tsx',
      'scripts/skyslope-pdf-advisory-agent.test.mjs',
      'eslint-rules/**/*.test.mjs',
      'components/site/__tests__/**/*.test.ts',
      'components/site/__tests__/**/*.test.tsx',
    ],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
