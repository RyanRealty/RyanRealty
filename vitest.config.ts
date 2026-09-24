import { defineConfig } from 'vitest/config'
import path from 'path'

// Integration tests (*.int.test.ts) hit live Supabase. Run fully parallel they
// saturate the connection pool and die on 10s hook timeouts even though each
// test passes in isolation (observed 2026-07-28: 12 int files, ~20 spurious
// fails per pre-commit run). They get their own project: capped workers +
// timeouts sized to real DB latency. Unit tests keep full parallelism.
const INT_INCLUDE = ['lib/**/*.int.test.ts']

// EVERY PROJECT OWNS ITS INCLUDE LIST, AND THE ROOT HAS NONE. With
// `extends: true` a project's `include` is CONCATENATED onto the root's (vite
// mergeConfig), so the old root list ran every unit test inside the int project
// as well: 1,283 files, serially, on every `npm run test:int`. And a list built
// one sub-folder at a time (`components/market/**`, `app/lp/**`, ...) left 18
// test files matching no project at all: they never ran, and one had been
// failing since the commit that wrote it. So unit takes whole source trees, and
// ci:tests-wired (scripts/check-tests-wired.mjs, G78) fails any test file no
// project runs and any test file two projects run.
const UNIT_INCLUDE = [
  'lib/**/*.test.ts',
  'lib/**/*.test.tsx',
  'app/**/*.test.ts',
  'app/**/*.test.tsx',
  'components/**/*.test.ts',
  'components/**/*.test.tsx',
  'data/**/*.test.ts',
  'scripts/skyslope-pdf-advisory-agent.test.mjs',
  'scripts/lib/**/*.test.mjs',
  'eslint-rules/**/*.test.mjs',
]

// Gate self-tests (the break-tests that prove a gate FIRES) each materialize a
// copy of the tree and run the checker as a node subprocess, sometimes three per
// case. Run fully parallel they starve each other and fail in ways that read as
// real gate regressions: on 2026-08-11 this blocked three separate commits with
// three different false failures (an entity-scope 5s timeout, a toast-discipline
// pragma case, and a view-preset run claiming lib/search-presets.ts had stopped
// exporting a function it still exports). Each suite passes alone. Same class as
// the int project below, same fix: their own project with capped workers.
// `scripts/*.test.ts` are gate break-tests written in TS next to their gate
// (scripts/ is excluded from tsconfig, so vitest transpiles them and nothing
// type-checks them); check-entity-scope.test.ts is the entity-scope suite above.
const GATE_INCLUDE = ['scripts/__tests__/**/*.test.mjs', 'scripts/__tests__/**/*.test.ts', 'scripts/*.test.ts']

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
          include: UNIT_INCLUDE,
          // lib/**/*.test.ts also matches lib/**/*.int.test.ts.
          exclude: ['**/node_modules/**', '**/dist/**', ...INT_INCLUDE, ...GATE_INCLUDE],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'gates',
          include: GATE_INCLUDE,
          exclude: ['**/node_modules/**', '**/dist/**'],
          // Two at a time: enough parallelism to stay fast, few enough that the
          // subprocess-per-case suites are not competing for the whole machine.
          maxWorkers: 2,
          hookTimeout: 30_000,
          testTimeout: 60_000,
          // Vitest refuses two projects with different maxWorkers in the same
          // group, so the gate suite runs in its own group after the unit set.
          sequence: { groupOrder: 1 },
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
          sequence: { groupOrder: 2 },
        },
      },
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
