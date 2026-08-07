import { defineConfig } from 'vitest/config'
import path from 'path'

// Integration tests (*.int.test.ts) hit live Supabase. Run fully parallel they
// saturate the connection pool and die on 10s hook timeouts even though each
// test passes in isolation (observed 2026-07-28: 12 int files, ~20 spurious
// fails per pre-commit run). They get their own project: capped workers +
// timeouts sized to real DB latency. Unit tests keep full parallelism.
const INT_INCLUDE = ['lib/**/*.int.test.ts']

// Int tests write to the PRODUCTION Supabase project, and a killed run strands
// rows there (2026-07-30: 17 `cmas` rows archived by hand, five of them sitting
// in `delivered` and inflating the delivered-document count). Every int run
// therefore shares ONE id, so concurrent sibling runs cannot collide, and
// test/int-global-setup.ts sweeps marker rows before AND after the run. See
// test/int-scope.ts for the full contract; ci:int-test-residue enforces it.
const INT_RUN_ID =
  process.env.RR_INT_RUN_ID?.trim() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
// Set on the parent so globalSetup (main process) and forked workers agree.
process.env.RR_INT_RUN_ID = INT_RUN_ID

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: ['**/node_modules/**', '**/dist/**', ...INT_INCLUDE],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'int',
          include: INT_INCLUDE,
          // The residue net. Removing this line is a gate failure
          // (scripts/check-int-test-residue.mjs), not a silent regression.
          globalSetup: ['./test/int-global-setup.ts'],
          env: { RR_INT_RUN_ID: INT_RUN_ID },
          // Serial: even 3 concurrent int files contend enough to flake
          // (cma-kickoff passes in 10s alone, fails at 74s under load).
          maxWorkers: 1,
          hookTimeout: 30_000,
          testTimeout: 120_000,
          sequence: { groupOrder: 1 },
        },
      },
    ],
    include: [
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
      'video/**/*.test.ts',
      'video/**/*.test.tsx',
      'scripts/skyslope-pdf-advisory-agent.test.mjs',
      'scripts/lib/**/*.test.mjs',
      'scripts/__tests__/**/*.test.mjs',
      // Gate break-tests written in TS next to their gate (scripts/ is excluded
      // from tsconfig, so these are transpiled here and never type-checked).
      'scripts/*.test.ts',
      'eslint-rules/**/*.test.mjs',
      'components/site/__tests__/**/*.test.ts',
      'components/site/__tests__/**/*.test.tsx',
      'components/search/__tests__/**/*.test.ts',
      'components/search/__tests__/**/*.test.tsx',
      // Tabbed core-chart module logic (MarketCoreCharts).
      'components/market/**/*.test.ts',
      'components/admin/crm/**/*.test.ts',
      'components/admin/crm/**/*.test.tsx',
      // Route-handler tests (e.g. the Twilio conversations-events webhook
      // regression locks) live next to their route.ts.
      'app/api/**/*.test.ts',
      // LP form/filter logic tests colocate with their actions.
      'app/lp/**/*.test.ts',
      // Server-action contract tests (authz + refusal locks) colocate with the
      // action they guard, e.g. app/actions/cma-publish.test.ts.
      'app/actions/**/*.test.ts',
      'components/admin/prospecting/**/*.test.ts',
      'components/admin/prospecting/**/*.test.tsx',
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
