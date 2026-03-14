/**
 * Seed initial cities, communities, and default settings. Step 23 Task 2.
 * Run: npx tsx scripts/seed.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
 *
 * For local usage we also try to read `.env.local` so you don't have to export
 * variables manually when running this script from the command line.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Best effort: load NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local if not already set.
try {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf8')
    for (const line of contents.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [rawKey, ...rest] = trimmed.split('=')
      const value = rest.join('=').trim()
      if (!rawKey || !value) continue
      if (!process.env[rawKey]) {
        process.env[rawKey] = value
      }
    }
  }
} catch {
  // If .env.local can't be read, we'll fall back to whatever is already in process.env.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const CITIES = [
  { name: 'Bend', slug: 'bend', state: 'OR' },
  { name: 'Redmond', slug: 'redmond', state: 'OR' },
  { name: 'Sisters', slug: 'sisters', state: 'OR' },
  { name: 'Sunriver', slug: 'sunriver', state: 'OR' },
  { name: 'La Pine', slug: 'la-pine', state: 'OR' },
  { name: 'Prineville', slug: 'prineville', state: 'OR' },
  { name: 'Madras', slug: 'madras', state: 'OR' },
  { name: 'Crooked River Ranch', slug: 'crooked-river-ranch', state: 'OR' },
  { name: 'Terrebonne', slug: 'terrebonne', state: 'OR' },
  { name: 'Powell Butte', slug: 'powell-butte', state: 'OR' },
  { name: 'Tumalo', slug: 'tumalo', state: 'OR' },
]

const COMMUNITIES = [
  { name: 'Tetherow', slug: 'tetherow', is_resort: true },
  { name: 'Broken Top', slug: 'broken-top', is_resort: false },
  { name: 'Black Butte Ranch', slug: 'black-butte-ranch', is_resort: true },
  { name: 'Brasada Ranch', slug: 'brasada-ranch', is_resort: true },
  { name: 'Eagle Crest', slug: 'eagle-crest', is_resort: true },
  { name: 'Pronghorn', slug: 'pronghorn', is_resort: true },
  { name: 'Sunriver', slug: 'sunriver', is_resort: true },
  { name: 'Caldera Springs', slug: 'caldera-springs', is_resort: true },
  { name: 'Crosswater', slug: 'crosswater', is_resort: true },
  { name: 'Vandevert Ranch', slug: 'vandevert-ranch', is_resort: false },
  { name: 'Northwest Crossing', slug: 'northwest-crossing', is_resort: false },
  { name: 'Old Bend', slug: 'old-bend', is_resort: false },
  { name: 'Awbrey Butte', slug: 'awbrey-butte', is_resort: false },
  { name: 'Awbrey Glen', slug: 'awbrey-glen', is_resort: false },
  { name: 'Shevlin Commons', slug: 'shevlin-commons', is_resort: false },
  { name: 'Discovery West', slug: 'discovery-west', is_resort: false },
  { name: 'Petrosa', slug: 'petrosa', is_resort: false },
  { name: 'River Rim', slug: 'river-rim', is_resort: false },
  { name: 'Three Pines', slug: 'three-pines', is_resort: false },
  { name: 'Mountain High', slug: 'mountain-high', is_resort: false },
]

async function main() {
  for (const row of CITIES) {
    const { error } = await supabase.from('cities').insert(
      { name: row.name, slug: row.slug, state: row.state, description: null }
    )
    if (error && error.code !== '23505') console.warn('City', row.slug, error.message)
  }
  console.log('Cities:', CITIES.length)

  for (const row of COMMUNITIES) {
    const { error } = await supabase.from('communities').insert(
      { name: row.name, slug: row.slug, is_resort: row.is_resort, description: null }
    )
    if (error && error.code !== '23505') console.warn('Community', row.slug, error.message)
  }
  console.log('Communities:', COMMUNITIES.length)

  for (const { key, value } of [
    { key: 'site_name', value: 'Ryan Realty' },
    { key: 'primary_color', value: '#102742' },
  ]) {
    const { error } = await supabase.from('settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) console.warn('Settings', key, error.message)
  }
  console.log('Default settings upserted')

  console.log('Seed done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
