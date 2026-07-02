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
      'scripts/lib/**/*.test.mjs',
      'scripts/__tests__/**/*.test.mjs',
      'eslint-rules/**/*.test.mjs',
      'components/site/__tests__/**/*.test.ts',
      'components/site/__tests__/**/*.test.tsx',
      'components/search/__tests__/**/*.test.ts',
      'components/search/__tests__/**/*.test.tsx',
      'components/admin/crm/**/*.test.ts',
      'components/admin/crm/**/*.test.tsx',
      // Route-handler tests (e.g. the Twilio conversations-events webhook
      // regression locks) live next to their route.ts.
      'app/api/**/*.test.ts',
    ],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` / `client-only` are Next-bundler packages that throw
      // outside the RSC graph and don't resolve under plain Node/vitest. Tests
      // import server modules directly, so stub the side-effect marker. The real
      // guarantee comes from `next build`, not from tests.
      'server-only': path.resolve(__dirname, 'test/server-only-stub.ts'),
      'client-only': path.resolve(__dirname, 'test/server-only-stub.ts'),
    },
  },
})
