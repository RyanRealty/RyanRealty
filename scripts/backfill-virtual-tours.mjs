#!/usr/bin/env node
/**
 * backfill-virtual-tours.mjs — ONE-TIME backfill of virtual-tour URLs into
 * listings.details for active listings whose tour was added BEFORE the sync
 * began expanding VirtualTours (2026-06-08). The sync now captures tours going
 * forward (SPARK_EXPAND includes VirtualTours); this clears the historical
 * backlog so the ~1,184 affected listings display their tour now instead of on
 * their next MLS update.
 *
 * For each gap listing it re-pulls the record from Spark (_expand=VirtualTours;
 * the scalar VirtualTourURLUnbranded is a default field) and splices ONLY the
 * tour fields into listings.details + sets virtual_tour_url + has_virtual_tour.
 * No other field is touched. The website reads only Supabase; this is the
 * populate step (the URL only exists in Spark until pulled).
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPARK_API_KEY,
 *           SPARK_API_BASE_URL
 * Usage:
 *   node --env-file=.env.local scripts/backfill-virtual-tours.mjs                       # dry run (counts only)
 *   node --env-file=.env.local scripts/backfill-virtual-tours.mjs --apply --only=220202448
 *   node --env-file=.env.local scripts/backfill-virtual-tours.mjs --apply --limit=10
 *   node --env-file=.env.local scripts/backfill-virtual-tours.mjs --apply              # full run
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SPARK_KEY = process.env.SPARK_API_KEY
const SPARK_BASE = (process.env.SPARK_API_BASE_URL || 'https://replication.sparkapi.com/v1').replace(/\/$/, '')

const APPLY = process.argv.includes('--apply')
const LIMIT = (() => { const a = process.argv.find((x) => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : 0 })()
const ONLY = (() => { const a = process.argv.find((x) => x.startsWith('--only=')); return a ? a.split('=')[1] : null })()

if (!SUPABASE_URL || !SERVICE_KEY || !SPARK_KEY) { console.error('Missing env (SUPABASE_URL / SERVICE_ROLE / SPARK_API_KEY)'); process.exit(1) }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const ACTIVE = ['Active', 'Coming Soon', 'Active Under Contract']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isHttp = (s) => typeof s === 'string' && /^https?:\/\//i.test(s.trim())

async function fetchGapSet() {
  const out = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = sb.from('listings')
      .select('ListingKey,ListNumber,StreetNumber,StreetName,City,details,virtual_tour_url')
      .in('StandardStatus', ACTIVE)
      .not('details->>VirtualToursCount', 'is', null)
      .neq('details->>VirtualToursCount', '0')
      .is('virtual_tour_url', null)
      .range(from, from + PAGE - 1)
    if (ONLY) q = q.eq('ListNumber', ONLY)
    const { data, error } = await q
    if (error) { console.error('gap query error:', error.message); process.exit(1) }
    out.push(...(data || []))
    if (!data || data.length < PAGE || ONLY) break
  }
  // Belt-and-suspenders: drop any that already carry a tour URL in details.
  return out.filter((r) => {
    const d = r.details || {}
    if (isHttp(d.VirtualTourURLUnbranded)) return false
    const arr = Array.isArray(d.VirtualTours) ? d.VirtualTours : []
    return !arr.some((t) => t && isHttp(t.Uri))
  })
}

async function fetchSparkTour(listingKey) {
  try {
    const res = await fetch(`${SPARK_BASE}/listings/${listingKey}?_expand=VirtualTours`, {
      headers: { Authorization: `Bearer ${SPARK_KEY}`, Accept: 'application/json' },
    })
    if (!res.ok) return { error: String(res.status) }
    const f = (await res.json())?.D?.Results?.[0]?.StandardFields
    if (!f) return { error: 'no-fields' }
    return {
      VirtualTourURLUnbranded: f.VirtualTourURLUnbranded ?? null,
      VirtualTourURLBranded: f.VirtualTourURLBranded ?? null,
      VirtualTours: Array.isArray(f.VirtualTours) ? f.VirtualTours : [],
      VirtualToursCount: f.VirtualToursCount ?? null,
    }
  } catch (e) {
    return { error: e.message }
  }
}

function pickUrl(t) {
  if (isHttp(t.VirtualTourURLUnbranded)) return t.VirtualTourURLUnbranded.trim()
  const u = (t.VirtualTours || []).find((x) => x && isHttp(x.Uri))
  if (u) return u.Uri.trim()
  if (isHttp(t.VirtualTourURLBranded)) return t.VirtualTourURLBranded.trim()
  return null
}

async function main() {
  console.log(`Backfill virtual tours — ${APPLY ? 'APPLY' : 'DRY RUN'}${LIMIT ? ` limit=${LIMIT}` : ''}${ONLY ? ` only=${ONLY}` : ''}`)
  const gap = await fetchGapSet()
  console.log(`Gap set: ${gap.length} active listings (tour count > 0, no tour URL in our DB)`)
  const work = LIMIT ? gap.slice(0, LIMIT) : gap
  if (!APPLY) { console.log('(dry run — pass --apply to write. Sample:)'); for (const r of work.slice(0, 5)) console.log(`  ${r.ListNumber} ${r.StreetNumber} ${r.StreetName}, ${r.City}`); return }

  let pulled = 0, updated = 0, noTour = 0, errors = 0
  for (let i = 0; i < work.length; i++) {
    const row = work[i]
    const t = await fetchSparkTour(row.ListingKey)
    if (t.error) { errors++; if (errors <= 25) console.log(`  [${i + 1}/${work.length}] ${row.ListNumber} SPARK ERR ${t.error}`); await sleep(140); continue }
    pulled++
    const url = pickUrl(t)
    if (!url) { noTour++; await sleep(140); continue }
    const newDetails = {
      ...(row.details || {}),
      VirtualTourURLUnbranded: isHttp(t.VirtualTourURLUnbranded) ? t.VirtualTourURLUnbranded : (row.details || {}).VirtualTourURLUnbranded ?? null,
      VirtualTourURLBranded: t.VirtualTourURLBranded ?? (row.details || {}).VirtualTourURLBranded ?? null,
      VirtualTours: t.VirtualTours,
      VirtualToursCount: t.VirtualToursCount ?? (row.details || {}).VirtualToursCount ?? null,
    }
    const { error } = await sb.from('listings')
      .update({ details: newDetails, virtual_tour_url: url, has_virtual_tour: true })
      .eq('ListingKey', row.ListingKey)
    if (error) { errors++; if (errors <= 25) console.log(`  [${i + 1}/${work.length}] ${row.ListNumber} UPDATE ERR ${error.message}`); await sleep(140); continue }
    updated++
    if (updated <= 15 || updated % 100 === 0) console.log(`  [${i + 1}/${work.length}] updated ${row.ListNumber} ${row.StreetNumber} ${row.StreetName} -> ${url.slice(0, 64)}`)
    await sleep(140)
  }
  console.log(`\nDone. pulled=${pulled} updated=${updated} noTourInSpark=${noTour} errors=${errors}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
