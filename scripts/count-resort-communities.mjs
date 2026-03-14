#!/usr/bin/env node
/**
 * Count how many distinct communities (City + SubdivisionName) in the listings table
 * match the resort-communities list (lib/resort-communities.ts).
 * Run: node scripts/count-resort-communities.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
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
  } catch (e) {
    console.error('Could not read .env.local:', e.message)
    process.exit(1)
  }
}

function slugify(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

function entityKey(city, subdivision) {
  return `${slugify(city)}:${slugify(subdivision)}`
}

// Same city/subdivision pairs as lib/resort-communities.ts (RESORT_LIST)
const RESORT_PAIRS = [
  { city: 'Bend', subdivision: 'Tetherow' },
  { city: 'Bend', subdivision: 'Pronghorn' },
  { city: 'Bend', subdivision: 'Juniper Preserve' },
  { city: 'Bend', subdivision: 'Broken Top' },
  { city: 'Bend', subdivision: 'Awbrey Glen' },
  { city: 'Bend', subdivision: 'Widgi Creek' },
  { city: 'Bend', subdivision: "River's Edge" },
  { city: 'Bend', subdivision: 'Lost Tracks' },
  { city: 'Bend', subdivision: 'Sunset View' },
  { city: 'Bend', subdivision: 'Mountain High' },
  { city: 'Bend', subdivision: 'Seventh Mountain' },
  { city: 'Bend', subdivision: 'Mt. Bachelor Village' },
  { city: 'Sunriver', subdivision: 'Sunriver' },
  { city: 'Sunriver', subdivision: 'Sunriver Resort' },
  { city: 'Bend', subdivision: 'Crosswater' },
  { city: 'Sunriver', subdivision: 'Caldera Springs' },
  { city: 'Bend', subdivision: 'Vandevert Ranch' },
  { city: 'Powell Butte', subdivision: 'Brasada Ranch' },
  { city: 'Powell Butte', subdivision: 'Thornburgh' },
  { city: 'Powell Butte', subdivision: 'Tribute' },
  { city: 'Sisters', subdivision: 'Black Butte Ranch' },
  { city: 'Sisters', subdivision: 'Aspen Lakes' },
  { city: 'Sisters', subdivision: 'Suttle Lake Lodge' },
  { city: 'Redmond', subdivision: 'Eagle Crest Resort' },
  { city: 'Redmond', subdivision: 'Greens at Redmond' },
  { city: 'Terrebonne', subdivision: 'Crooked River Ranch' },
  { city: 'Prineville', subdivision: 'Crooked River Ranch' },
  { city: 'Terrebonne', subdivision: 'Three Rivers Recreation Area' },
  { city: 'Warm Springs', subdivision: 'Kah-Nee-Ta Hot Springs Resort' },
  { city: 'Seneca', subdivision: 'Silvies Valley Ranch' },
  { city: 'Pendleton', subdivision: 'Wildhorse Resort' },
  { city: 'Klamath Falls', subdivision: 'Running Y Ranch' },
  { city: 'Medford', subdivision: 'Rogue Valley CC' },
  { city: 'Medford', subdivision: 'Centennial GC' },
  { city: 'Medford', subdivision: 'Quail Point' },
  { city: 'Medford', subdivision: 'Bear Creek' },
  { city: 'Medford', subdivision: 'Stewart Meadows' },
  { city: 'Eagle Point', subdivision: 'Eagle Point GC' },
  { city: 'Medford', subdivision: 'Quail Run' },
  { city: 'Medford', subdivision: 'Stone Ridge' },
  { city: 'Medford', subdivision: 'Poppy Village' },
  { city: 'Grants Pass', subdivision: 'Dutcher Creek' },
  { city: 'Grants Pass', subdivision: 'Grants Pass GC' },
  { city: 'Grants Pass', subdivision: 'Applegate GC' },
  { city: 'Grants Pass', subdivision: 'Shadow Hills' },
  { city: 'Gearhart', subdivision: 'Gearhart Golf Links' },
  { city: 'Highlands', subdivision: 'Highlands GC' },
  { city: 'Manzanita', subdivision: 'Manzanita GC' },
  { city: 'Seaside', subdivision: 'Seaside GC' },
  { city: 'Gleneden Beach', subdivision: 'Salishan Coastal Lodge' },
  { city: 'Lincoln City', subdivision: 'Chinook Winds' },
  { city: 'Waldport', subdivision: 'Crestview' },
  { city: 'Waldport', subdivision: 'Fairway Villas' },
  { city: 'Florence', subdivision: 'Ocean Dunes' },
  { city: 'Florence', subdivision: 'Three Rivers Casino' },
  { city: 'Bandon', subdivision: 'Bandon Dunes' },
  { city: 'Welches', subdivision: 'Mt. Hood Oregon Resort' },
  { city: 'Gresham', subdivision: 'Persimmon CC' },
  { city: 'Hood River', subdivision: 'Cooper Spur' },
  { city: 'Hood River', subdivision: 'Hood River GC' },
  { city: 'Portland', subdivision: 'Rock Creek CC' },
  { city: 'North Plains', subdivision: 'Pumpkin Ridge' },
  { city: 'Portland', subdivision: 'The Reserve' },
  { city: 'Tualatin', subdivision: 'Tualatin CC' },
  { city: 'Lake Oswego', subdivision: 'Lake Oswego CC' },
  { city: 'West Linn', subdivision: 'Oregon GC' },
  { city: 'Lake Oswego', subdivision: 'Claremont' },
  { city: 'Lake Oswego', subdivision: 'Oswego Lake CC' },
  { city: 'Portland', subdivision: 'Heron Lakes' },
  { city: 'Portland', subdivision: 'Portland GC' },
  { city: 'Creswell', subdivision: 'Emerald Valley' },
  { city: 'Junction City', subdivision: 'Shadow Hills CC' },
  { city: 'Corvallis', subdivision: 'Trysting Tree' },
  { city: 'Stayton', subdivision: 'Santiam' },
  { city: 'Keizer', subdivision: 'McNary' },
  { city: 'Salem', subdivision: 'Creekside' },
  { city: 'Salem', subdivision: 'Illahe Hills' },
  { city: 'Salem', subdivision: 'Salem GC' },
]

const RESORT_KEYS = new Set(RESORT_PAIRS.map(({ city, subdivision }) => entityKey(city, subdivision)))

async function main() {
  const env = loadEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data: rows, error } = await supabase
    .from('listings')
    .select('City, SubdivisionName')
    .not('SubdivisionName', 'is', null)

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  const seen = new Set()
  for (const row of rows || []) {
    const city = (row.City ?? '').trim()
    const sub = (row.SubdivisionName ?? '').trim()
    if (!sub) continue
    const k = entityKey(city, sub)
    if (RESORT_KEYS.has(k)) seen.add(k)
  }

  const count = seen.size
  console.log('Resort communities in database (distinct City + SubdivisionName that match the resort list):', count)
  console.log('')
  if (count > 0) {
    const list = [...seen].sort().map((k) => {
      const [c, s] = k.split(':')
      return `${c} / ${s}`
    })
    console.log('Communities:')
    list.forEach((label) => console.log('  -', label))
  }
  console.log('')
  console.log('(Resort list in code has', RESORT_PAIRS.length, 'entries total;', RESORT_PAIRS.length - count, 'have no listings in the DB yet.)')
}

main()
