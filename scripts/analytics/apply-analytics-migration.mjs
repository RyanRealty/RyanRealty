#!/usr/bin/env node
/**
 * apply-analytics-migration.mjs — apply analytics SQL without `supabase link`
 *
 * WHAT YOU HAVE TODAY (not enough for DDL):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← PostgREST only; CANNOT CREATE TABLE/INDEX
 *
 * WHAT THIS SCRIPT NEEDS (one of):
 *   DATABASE_URL or DIRECT_URL or SUPABASE_DB_URL
 *     postgres://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres
 *   OR
 *   SUPABASE_DB_PASSWORD  (+ optional SUPABASE_DB_HOST)
 *     password from Supabase Dashboard → Project Settings → Database
 *
 * This is NOT the same as the service_role JWT. GitHub "Supabase linked" and
 * Vercel env with only URL+keys also do not grant Postgres DDL.
 *
 * Usage:
 *   node scripts/analytics/apply-analytics-migration.mjs
 *   node scripts/analytics/apply-analytics-migration.mjs --file supabase/migrations/20260810120000_analytics_closed_foundation.sql
 */
import { config } from 'dotenv'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: join(ROOT, '.env.local') })

const args = process.argv.slice(2)
const fileArg = args.includes('--file')
  ? args[args.indexOf('--file') + 1]
  : 'supabase/migrations/20260810120000_analytics_closed_foundation.sql'
const sqlPath = join(ROOT, fileArg)

function buildConnectionString() {
  const direct =
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL
  if (direct?.trim()) return direct.trim()

  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD
  if (!password?.trim()) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const ref = url.match(/https:\/\/([^.]+)\.supabase/)?.[1]
  if (!ref) {
    console.error('Have SUPABASE_DB_PASSWORD but cannot parse project ref from NEXT_PUBLIC_SUPABASE_URL')
    return null
  }

  // Prefer pooler (IPv4). Project dwvlophlbvvygjfxcrhm is us-west-2.
  // User form for pooler: postgres.<project-ref>
  const host =
    process.env.SUPABASE_DB_HOST ||
    'aws-0-us-west-2.pooler.supabase.com'
  const user =
    process.env.SUPABASE_DB_USER ||
    (host.includes('pooler.supabase.com') ? `postgres.${ref}` : 'postgres')
  const port = process.env.SUPABASE_DB_PORT || '5432'
  const database = process.env.SUPABASE_DB_NAME || 'postgres'
  const enc = encodeURIComponent(password)
  return `postgresql://${user}:${enc}@${host}:${port}/${database}`
}

const conn = buildConnectionString()
if (!conn) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  Cannot apply SQL: no Postgres connection string                 ║
╠══════════════════════════════════════════════════════════════════╣
║  Service role key ≠ database password.                           ║
║                                                                  ║
║  Add ONE of these to .env.local (and Vercel production):         ║
║                                                                  ║
║  1) SUPABASE_DB_PASSWORD=<from Dashboard → Database → password>  ║
║     Project ref is already known from NEXT_PUBLIC_SUPABASE_URL   ║
║                                                                  ║
║  2) DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co  ║
║     :5432/postgres                                               ║
║                                                                  ║
║  Dashboard: https://supabase.com/dashboard/project/<ref>/settings/database
║                                                                  ║
║  Analytics product STILL WORKS without this (live aggregate).    ║
║  Marts/indexes only need this once for faster rebuilds.          ║
╚══════════════════════════════════════════════════════════════════╝
`)
  process.exit(2)
}

if (!existsSync(sqlPath)) {
  console.error('SQL file missing:', sqlPath)
  process.exit(1)
}

const sql = readFileSync(sqlPath, 'utf8')
console.log('Applying', fileArg, '…')

const client = new pg.Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  console.log('OK: migration applied')
  // smoke
  const { rows } = await client.query(`
    SELECT to_regclass('public.analytics_mart_market_annual') AS market_mart,
           to_regclass('public.analytics_v_closed_sale_co') AS closed_view
  `)
  console.log('Smoke:', rows[0])
} catch (e) {
  console.error('FAIL:', e instanceof Error ? e.message : e)
  process.exit(1)
} finally {
  await client.end()
}
