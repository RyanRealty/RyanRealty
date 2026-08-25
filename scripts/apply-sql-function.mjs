#!/usr/bin/env node
/**
 * Apply a CREATE OR REPLACE FUNCTION file from scripts/sql/ to the hosted DB.
 *
 * WHY THIS EXISTS. The compute functions live under two conventions: three in
 * supabase/migrations, four in scripts/sql. The scripts/sql four are
 * CREATE OR REPLACE bodies that are re-applied in place rather than migrated
 * forward, and until now they had no applier — extending one meant pasting ~180
 * lines of DDL through whatever channel was to hand, by eye. That is a
 * transcription risk on functions that write published market figures (§0).
 *
 * Reads the file, applies it in a transaction, and re-reads the deployed
 * definition back to prove what landed is what was sent.
 *
 *   node scripts/apply-sql-function.mjs compute_market_metrics_hud_windows_shadow
 *   node scripts/apply-sql-function.mjs --all --dry-run
 *
 * --dry-run prints what would be applied and exits without writing.
 *
 * Credentials: SUPABASE_DB_HOST / SUPABASE_DB_USER / SUPABASE_DB_PASSWORD from
 * .env.local. It never takes a connection string on the command line, so a
 * password cannot end up in shell history.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { config as loadEnv } from 'dotenv'
import pg from 'pg'

loadEnv({ path: '.env.local' })
loadEnv()

const SQL_DIR = 'scripts/sql'
const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const all = argv.includes('--all')
const names = argv.filter((a) => !a.startsWith('--'))

function fileFor(name) {
  const bare = basename(name).replace(/\.sql$/, '')
  return join(SQL_DIR, `${bare}.sql`)
}

function targets() {
  if (all) return readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).map((f) => join(SQL_DIR, f))
  if (names.length) return names.map(fileFor)
  console.error(`usage: node scripts/apply-sql-function.mjs <name...> | --all   [--dry-run]`)
  console.error(`available: ${readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).join(', ')}`)
  process.exit(1)
}

const files = targets()

if (dryRun) {
  for (const f of files) {
    const sql = readFileSync(f, 'utf8')
    const fn = sql.match(/CREATE OR REPLACE FUNCTION\s+([\w.]+)/i)?.[1] ?? '(no function found)'
    console.log(`would apply ${f} -> ${fn} (${sql.length} chars)`)
  }
  process.exit(0)
}

const host = process.env.SUPABASE_DB_HOST
const user = process.env.SUPABASE_DB_USER
const password = process.env.SUPABASE_DB_PASSWORD
if (!host || !user || !password) {
  console.error('[apply-sql] missing SUPABASE_DB_HOST / SUPABASE_DB_USER / SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const client = new pg.Client({ host, user, password, database: 'postgres', port: 5432, ssl: { rejectUnauthorized: false } })
let failed = false
try {
  await client.connect()
  for (const f of files) {
    const sql = readFileSync(f, 'utf8')
    const fn = sql.match(/CREATE OR REPLACE FUNCTION\s+([\w.]+)/i)?.[1]
    if (!fn) {
      console.error(`✗ ${f}: no CREATE OR REPLACE FUNCTION found — refusing to apply`)
      failed = true
      continue
    }
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`✗ ${fn}: ${err.message}`)
      failed = true
      continue
    }
    // Read the deployed definition back, so "applied" means verified, not assumed.
    const { rows } = await client.query(
      `select pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = split_part($1, '.', 1) and p.proname = split_part($1, '.', 2)`,
      [fn.includes('.') ? fn : `public.${fn}`],
    )
    if (!rows.length) {
      console.error(`✗ ${fn}: applied without error but is not present on the server`)
      failed = true
      continue
    }
    console.log(`✓ ${fn} applied and read back (${rows[0].def.length} chars deployed)`)
  }
} finally {
  await client.end()
}
process.exit(failed ? 1 : 0)
