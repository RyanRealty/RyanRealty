#!/usr/bin/env node
/**
 * One-shot: fetch the primary photo URL from Spark v1 for three Ryan Realty
 * listings whose PhotoURL is null in the Supabase cache. Output hard-codeable
 * ADDRESS_OVERRIDES entries for app/lp/seller-home-value/data.ts.
 */
import { readFileSync } from 'node:fs'

const envText = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
  }),
)

const SPARK_BASE = env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1'
const SPARK_KEY = env.SPARK_API_KEY
const SCHEME = env.SPARK_AUTH_SCHEME || 'Bearer'

if (!SPARK_KEY) {
  console.error('missing SPARK_API_KEY')
  process.exit(1)
}

const LISTINGS = [
  { key: '20250120214617650644000000', label: 'Newport Hills $1.191M Closed (Matt)' },
  { key: '20250502193817025164000000', label: 'Ordway $880K Closed buyer-rep (Matt)' },
  { key: '20250516213626217599000000', label: 'Crowson $1.020M Closed Ashland (Matt)' },
]

for (const l of LISTINGS) {
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(l.key)}?_expand=Photos`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `${SCHEME} ${SPARK_KEY}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      console.error(`${l.label}: ${res.status}`)
      continue
    }
    const data = await res.json()
    const result = data?.D?.Results?.[0]
    const photos = result?.StandardFields?.Photos ?? []
    const primary = photos.find((p) => p.Primary) ?? photos[0]
    if (!primary) {
      console.log(`${l.label}: NO PHOTOS available`)
      continue
    }
    const photoUrl = primary.Uri1600 ?? primary.Uri1280 ?? primary.Uri1024 ?? primary.Uri800 ?? primary.Uri640
    console.log(`# ${l.label}`)
    console.log(`#   ListingKey: ${l.key}`)
    console.log(`#   Caption: ${primary.Caption ?? '(none)'}`)
    console.log(`    photoUrl: '${photoUrl}',`)
    console.log('')
  } catch (e) {
    console.error(`${l.label}: ${e.message}`)
  }
}
