#!/usr/bin/env node
// scripts/check-data-access.mjs
//
// G16 — Data access discipline gate.
//
// Two-headed check:
//
// 1. **Schema-snapshot drift.** Regenerates docs/DATABASE_SCHEMA_SNAPSHOT.md
//    from the live production Supabase (via the migration-installed
//    `_agent_schema_dump()` RPC) and diffs it against the committed
//    copy in HEAD. Drift = a migration landed without re-running the
//    snapshot, OR the committed snapshot got hand-edited. Either way,
//    the gate fails until the committed file matches reality.
//
// 2. **DAL index drift.** Regenerates docs/DAL_INDEX.md by walking
//    lib/data/**/*.ts and diffs against the committed copy. Drift =
//    a DAL function was added/modified/removed without refreshing
//    the index. Same fail condition.
//
// Usage:
//   npm run ci:data-access            # check mode (CI/local)
//   npm run ci:data-access -- --refresh   # regenerate both files
//                                          # without diffing — use
//                                          # this after intentionally
//                                          # landing a schema or DAL
//                                          # change.
//
// Rationale: the committed snapshot + index are the agent's
// authoritative reference for column names + access patterns. If they
// stay stale, the agent (and CI) think the schema looks one way when
// it actually looks another, which leads to silent failures or
// regressions. The gate keeps them honest.
//
// See:
//   - CLAUDE.md "Data Access Discipline" — what this gate enforces.
//   - feedback memory `no-adhoc-sql.md` — why this matters.
//   - docs/MECHANICAL_GATES.md — catalog entry for G16.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const REFRESH = args.includes('--refresh')

// Repo-relative paths for git operations + absolute paths for filesystem.
const SCHEMA_REL = 'docs/DATABASE_SCHEMA_SNAPSHOT.md'
const DAL_REL = 'docs/DAL_INDEX.md'
const SCHEMA_PATH = resolve(SCHEMA_REL)
const DAL_PATH = resolve(DAL_REL)
const SCHEMA_SCRIPT = resolve('scripts/snapshot-schema.mjs')
const DAL_SCRIPT = resolve('scripts/index-dal.mjs')

function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`\n[${label}] generator failed.`)
    process.exit(r.status ?? 1)
  }
}

function gitTracked(relPath) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relPath], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function snapshotEqualToTracked(absPath, relPath) {
  const fresh = readFileSync(absPath, 'utf8')
  // Strip the `**Generated:** <ISO>` line — it changes every run and
  // a timestamp diff is not a meaningful schema drift.
  const stripTimestamp = (s) =>
    s.replace(/^\*\*Generated:\*\* .*$/m, '**Generated:** <iso>')
  let tracked
  try {
    tracked = execFileSync('git', ['show', `HEAD:${relPath}`], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch {
    return { equal: false, reason: 'file is not in HEAD yet (new file?)' }
  }
  if (stripTimestamp(fresh) === stripTimestamp(tracked)) return { equal: true }
  return { equal: false, reason: 'content differs from committed copy' }
}

console.log('Data access discipline check (G16)')
console.log('==================================')

// Step 1 — regenerate
run('schema', 'node', [SCHEMA_SCRIPT])
run('dal',    'node', [DAL_SCRIPT])

if (REFRESH) {
  console.log('\n--refresh: regenerated docs/DATABASE_SCHEMA_SNAPSHOT.md + docs/DAL_INDEX.md without diffing.')
  console.log('Stage them with `git add docs/DATABASE_SCHEMA_SNAPSHOT.md docs/DAL_INDEX.md` after review.')
  process.exit(0)
}

// Step 2 — diff against committed
let failed = false

for (const [label, absPath, relPath] of [
  ['schema-snapshot', SCHEMA_PATH, SCHEMA_REL],
  ['dal-index', DAL_PATH, DAL_REL],
]) {
  if (!existsSync(absPath)) {
    console.error(`\n[${label}] file missing on disk after regenerate: ${absPath}`)
    failed = true
    continue
  }
  if (!gitTracked(relPath)) {
    console.error(
      `\n[${label}] ${relPath} is not yet tracked in git. Stage + commit it (\`git add ${relPath}\`) to baseline the gate.`,
    )
    failed = true
    continue
  }
  const eq = snapshotEqualToTracked(absPath, relPath)
  if (eq.equal) {
    console.log(`  ${label}: matches HEAD ✓`)
  } else {
    console.error(`\n[${label}] DRIFT — ${eq.reason}`)
    console.error(`  Fix: \`npm run ci:data-access -- --refresh\` then commit ${relPath}.`)
    failed = true
  }
}

if (failed) {
  console.error('\nData access discipline check FAILED.')
  process.exit(1)
}

console.log('\nData access discipline check OK.')
