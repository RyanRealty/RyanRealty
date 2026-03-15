#!/usr/bin/env node
/**
 * One-time: add team_image_url column to brokerage_settings.
 * Run: DATABASE_URL='postgresql://...' node scripts/add-team-image-column.mjs
 * Or add DATABASE_URL to .env.local and run: node scripts/add-team-image-column.mjs
 *
 * Get the connection string: Supabase Dashboard → Project Settings → Database → Connection string (URI).
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const path = resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(path, 'utf8')
    const env = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      env[key] = val
    }
    return env
  } catch {
    return {}
  }
}

const env = { ...process.env, ...loadEnv() }
const databaseUrl = env.DATABASE_URL || env.SUPABASE_DATABASE_URL

if (!databaseUrl?.trim()) {
  console.error(
    'Missing DATABASE_URL. Add it to .env.local (Supabase Dashboard → Project Settings → Database → Connection string, URI).'
  )
  process.exit(1)
}

const sql = `
ALTER TABLE brokerage_settings
  ADD COLUMN IF NOT EXISTS team_image_url text;
COMMENT ON COLUMN brokerage_settings.team_image_url IS 'Homepage social proof section team photo.';
`

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    await client.query(sql)
    console.log('Added team_image_url column to brokerage_settings.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
