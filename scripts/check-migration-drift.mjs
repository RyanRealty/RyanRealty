#!/usr/bin/env node
/**
 * check-migration-drift.mjs — every repo migration's tables must exist in prod.
 *
 * Escape 2026-06-10: supabase/migrations/20260326120000_guides_table.sql sat in
 * the repo since March but was never applied to hosted Supabase. The /guides
 * family rendered EMPTY in production for months — the 42P01 throw was
 * swallowed into [] by the resilient cache, and G16 could not catch it because
 * the schema snapshot is generated FROM prod (it reflects what exists, not
 * what is missing).
 *
 * This gate closes the loop from the other side: parse every
 * `create table [if not exists] public.<name>` in supabase/migrations/ and
 * assert the table appears in docs/DATABASE_SCHEMA_SNAPSHOT.md. A migration
 * that lands without being applied (and the snapshot refreshed) fails CI.
 *
 * Known-dropped tables that legitimately no longer exist go in DROPPED below
 * with the migration or reason that removed them.
 *
 * Usage: node scripts/check-migration-drift.mjs   (wired into ci:gates)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'
const SNAPSHOT = 'docs/DATABASE_SCHEMA_SNAPSHOT.md'

// Tables intentionally dropped or renamed after their create migration.
const DROPPED = new Set([
  'sync_jobs', // replication-era (20250308120000); zero code consumers, superseded by sync_state
  'sync_state_by_resource', // replication-era (20250308120000); zero code consumers, superseded by sync_state
])

const snapshot = readFileSync(SNAPSHOT, 'utf8')
const snapshotTables = new Set(
  [...snapshot.matchAll(/^### `([a-z0-9_]+)`/gm)].map((m) => m[1])
)

const created = new Map() // table -> first migration file
for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').replace(/--[^\n]*/g, '')
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z0-9_]+)"?/gi
  for (const m of sql.matchAll(re)) {
    const t = m[1].toLowerCase()
    if (!created.has(t)) created.set(t, file)
  }
  // tables later dropped inside migrations are fine
  const dropRe = /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi
  for (const m of sql.matchAll(dropRe)) {
    created.delete(m[1].toLowerCase())
  }
}

const missing = [...created.entries()].filter(
  ([t]) => !snapshotTables.has(t) && !DROPPED.has(t)
)

console.log('Migration drift gate')
console.log('====================')
console.log(`migrations create ${created.size} tables · snapshot has ${snapshotTables.size} tables`)
if (missing.length) {
  for (const [t, file] of missing) {
    console.error(`FAIL: table "${t}" (created in ${file}) is NOT in the prod schema snapshot — the migration was never applied to hosted Supabase, or the snapshot needs a refresh (npm run ci:data-access -- --refresh). If the table was intentionally dropped, add it to DROPPED in this script with the reason.`)
  }
  process.exit(1)
}
console.log('Every migration-created table exists in the prod schema snapshot.')
