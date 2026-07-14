/**
 * Backfill listings.PhotoURL from Spark for every listing that has NO cached
 * cover photo but DOES have photos on Spark (photos_count > 0).
 *
 * WHY: the Spark sync keeps Active/Pending photos fresh but never backfilled
 * the historical closed/expired/canceled/withdrawn set, so ~7k older listings
 * carry PhotoURL=null while Spark still holds their full photo set. That drew
 * blank comp flyers in CMAs and blank cards anywhere the cover photo is shown.
 * This is the SOURCE fix — correct once, correct everywhere. Re-runnable: it
 * only touches rows still missing a cover, so a second run is a fast no-op.
 *
 *   node --env-file=.env.local scripts/backfill-listing-photos.mjs [--limit N] [--dry]
 */
import { createClient } from '@supabase/supabase-js'

const SPARK_BASE = process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1'
const SPARK_SCHEME = (process.env.SPARK_AUTH_SCHEME || 'Bearer').trim()
const SPARK_KEY = process.env.SPARK_API_KEY?.trim()
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const DRY = process.argv.includes('--dry')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity
})()
const CONCURRENCY = 6
const PAGE = 500

if (!SPARK_KEY) {
  console.error('SPARK_API_KEY not set')
  process.exit(1)
}

function bestUri(p) {
  return p.Uri1024 ?? p.Uri1280 ?? p.Uri1600 ?? p.Uri800 ?? p.Uri640 ?? p.Uri300 ?? p.UriThumb ?? null
}

async function primaryPhotoUrl(listingKey) {
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(listingKey)}?_expand=Photos`
  const res = await fetch(url, {
    headers: { Authorization: `${SPARK_SCHEME} ${SPARK_KEY}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(25000),
  })
  if (res.status === 404) return { url: null, gone: true }
  if (!res.ok) throw new Error(`Spark ${res.status}`)
  const data = await res.json()
  const fields = data?.D?.Results?.[0]?.StandardFields ?? {}
  const photos = Array.isArray(fields.Photos) ? fields.Photos : []
  if (photos.length === 0) return { url: null, gone: true }
  const primary = photos.find((p) => p.Primary) ?? photos[0]
  return { url: bestUri(primary), gone: false }
}

async function mapPool(items, fn) {
  const out = []
  let idx = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < items.length) {
      const i = idx++
      out[i] = await fn(items[i]).catch((e) => ({ error: e.message }))
    }
  })
  await workers.length ? await Promise.all(workers) : null
  return out
}

let cursor = ''
let scanned = 0,
  updated = 0,
  gone = 0,
  errors = 0
const started = Date.now()

// eslint-disable-next-line no-constant-condition
while (scanned < LIMIT) {
  const { data: rows, error } = await sb
    .from('listings')
    .select('ListingKey')
    .is('PhotoURL', null)
    .gt('photos_count', 0)
    .gt('ListingKey', cursor)
    .order('ListingKey', { ascending: true })
    .limit(PAGE)
  if (error) {
    console.error('select failed:', error.message)
    break
  }
  if (!rows || rows.length === 0) break

  const results = await mapPool(rows, async (r) => {
    const { url, gone: isGone } = await primaryPhotoUrl(r.ListingKey)
    if (url && !DRY) {
      const { error: uErr } = await sb.from('listings').update({ PhotoURL: url }).eq('ListingKey', r.ListingKey)
      if (uErr) return { error: uErr.message }
    }
    return { url, gone: isGone }
  })

  for (const res of results) {
    scanned++
    if (res?.error) errors++
    else if (res?.gone) gone++
    else if (res?.url) updated++
  }
  cursor = rows[rows.length - 1].ListingKey
  const rate = Math.round(scanned / ((Date.now() - started) / 1000))
  console.log(`scanned=${scanned} updated=${updated} gone=${gone} errors=${errors} (~${rate}/s) cursor=${cursor}`)
  if (rows.length < PAGE) break
}

console.log(`\nDONE${DRY ? ' (dry)' : ''}: scanned=${scanned} updated=${updated} photos-gone=${gone} errors=${errors} in ${Math.round((Date.now() - started) / 1000)}s`)
