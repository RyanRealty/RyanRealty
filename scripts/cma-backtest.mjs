#!/usr/bin/env node
/**
 * cma-backtest — the reproducible pricing ground-truth metric (Matt
 * 2026-08-05: "research homes that expired and then what they sold for later
 * on... build a reproducible metric that gets us to the right list price").
 *
 * Mines the OWN MLS corpus (public.listings, one row per listing cycle) for
 * FAILED→SOLD pairs at the same address: a cycle that ended
 * Expired/Canceled/Withdrawn, followed by a Closed sale at that address whose
 * marketing began after the failure, within RELIST_WINDOW_MONTHS. For each
 * pair it computes what the market ULTIMATELY paid relative to the ask that
 * failed — the calibration constant the pricing engine's expired handling is
 * measured against.
 *
 * Output: a printed distribution + docs/research/cma-backtest-<runstamp>.json
 * (§0: every number traces to listing rows; the JSON carries the keys).
 *
 * Usage: node --env-file=.env.local scripts/cma-backtest.mjs
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const YEARS_BACK = 3
const RELIST_WINDOW_MONTHS = 18
const SINCE = new Date(Date.now() - YEARS_BACK * 365.25 * 24 * 3600e3).toISOString().slice(0, 10)

const FAILED = ['Expired', 'Canceled', 'Withdrawn']
const COLS =
  'ListingKey, StreetNumber, StreetName, City, "SubdivisionName", "StandardStatus", "ListPrice", "OriginalListPrice", "ClosePrice", "CloseDate", "ListDate", "ModificationTimestamp", off_market_date, status_change_timestamp, "TotalLivingAreaSqFt", "PropertyType"'

/**
 * Keyset-paged pull tuned to the live indexes: build(cursor) returns a query
 * ordered ascending on cursorCol with .gt(cursorCol, cursor) applied. Offset
 * pagination times out on 589K rows; keyset on an indexed column does not.
 */
async function keysetPage(build, cursorCol, label) {
  const out = []
  const seen = new Set()
  const SIZE = 1000
  let cursor = null
  for (;;) {
    const { data, error } = await build(cursor).limit(SIZE)
    if (error) throw new Error(`${label}: ${error.message}`)
    if (!data || data.length === 0) break
    let advanced = false
    for (const r of data) {
      if (seen.has(r.ListingKey)) continue
      seen.add(r.ListingKey)
      out.push(r)
      advanced = true
    }
    const last = data[data.length - 1][cursorCol]
    if (data.length < SIZE) break
    if (last === cursor && !advanced) throw new Error(`${label}: cursor stalled at ${cursor}`)
    cursor = last
  }
  return out
}

function addrKey(r) {
  const n = String(r.StreetNumber ?? '').trim().toLowerCase()
  const s = String(r.StreetName ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  const c = String(r.City ?? '').trim().toLowerCase()
  if (!n || !s || !c) return null
  return `${n}|${s}|${c}`
}

function endOf(r) {
  return r.off_market_date ?? r.status_change_timestamp ?? null
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// Failed cycles ride idx_listings_status_modified ("StandardStatus",
// "ModificationTimestamp"): one keyset walk per status. ModificationTimestamp
// ≥ status change, so gte(SINCE) is a superset; the true recency filter on
// status_change/off_market applies client-side in the pairing loop.
const failed = []
for (const status of FAILED) {
  failed.push(
    ...(await keysetPage(
      (cursor) => {
        let q = sb
          .from('listings')
          .select(COLS)
          .eq('StandardStatus', status)
          .eq('PropertyType', 'A')
          .gte('ModificationTimestamp', SINCE)
          .not('ListPrice', 'is', null)
          .order('ModificationTimestamp', { ascending: true })
        if (cursor) q = q.gt('ModificationTimestamp', cursor)
        return q
      },
      'ModificationTimestamp',
      `failed:${status}`,
    )),
  )
}
// Closed sales ride the partial idx_listings_close_date. CloseDate is
// day-granular so .gt() would skip same-day rows — use gte + the seen-set.
const closed = await keysetPage(
  (cursor) =>
    sb
      .from('listings')
      .select(COLS)
      .eq('StandardStatus', 'Closed')
      .eq('PropertyType', 'A')
      .gte('CloseDate', cursor ?? SINCE)
      .not('ClosePrice', 'is', null)
      .order('CloseDate', { ascending: true }),
  'CloseDate',
  'closed',
)

// True recency filter (the pull used ModificationTimestamp as a superset).
const failedRecent = failed.filter((f) => {
  const e = endOf(f)
  return e && e >= SINCE
})

console.log(`corpus: ${failedRecent.length} failed cycles · ${closed.length} closed sales (PropertyType A, since ${SINCE})`)

const closedByAddr = new Map()
for (const c of closed) {
  const k = addrKey(c)
  if (!k) continue
  const arr = closedByAddr.get(k) ?? []
  arr.push(c)
  closedByAddr.set(k, arr)
}

const pairs = []
for (const f of failedRecent) {
  const k = addrKey(f)
  if (!k) continue
  const fEnd = endOf(f)
  if (!fEnd) continue
  const fEndMs = new Date(fEnd).getTime()
  const candidates = (closedByAddr.get(k) ?? [])
    .filter((c) => {
      const listMs = c.ListDate ? new Date(c.ListDate).getTime() : null
      const closeMs = c.CloseDate ? new Date(c.CloseDate).getTime() : null
      // The sale's marketing (or at least its close) begins after the failure…
      const startsAfter = (listMs ?? closeMs) >= fEndMs
      // …within the relist window.
      const withinWindow = closeMs != null && closeMs - fEndMs <= RELIST_WINDOW_MONTHS * 30.44 * 24 * 3600e3
      return startsAfter && withinWindow
    })
    .sort((a, b) => new Date(a.CloseDate).getTime() - new Date(b.CloseDate).getTime())
  const sale = candidates[0]
  if (!sale) continue
  const failedAsk = Number(f.ListPrice)
  const close = Number(sale.ClosePrice)
  if (!Number.isFinite(failedAsk) || failedAsk <= 0 || !Number.isFinite(close) || close <= 0) continue
  pairs.push({
    addr: k,
    failedKey: f.ListingKey,
    failedStatus: f.StandardStatus,
    failedAsk,
    failedOriginalAsk: Number(f.OriginalListPrice) || null,
    failedEnd: fEnd,
    soldKey: sale.ListingKey,
    relistAsk: Number(sale.ListPrice) || null,
    closePrice: close,
    closeDate: sale.CloseDate,
    monthsToClose: Math.round(((new Date(sale.CloseDate).getTime() - fEndMs) / (30.44 * 24 * 3600e3)) * 10) / 10,
    city: String(f.City ?? ''),
    ratioCloseToFailedAsk: Math.round((close / failedAsk) * 1000) / 1000,
    ratioRelistToFailedAsk: sale.ListPrice ? Math.round((Number(sale.ListPrice) / failedAsk) * 1000) / 1000 : null,
  })
}

const ratios = pairs.map((p) => p.ratioCloseToFailedAsk).sort((a, b) => a - b)
const relistRatios = pairs.map((p) => p.ratioRelistToFailedAsk).filter((r) => r != null).sort((a, b) => a - b)
const aboveAsk = pairs.filter((p) => p.ratioCloseToFailedAsk > 1).length
const monthsMed = quantile(pairs.map((p) => p.monthsToClose).sort((a, b) => a - b), 0.5)

const summary = {
  runstamp: process.argv[2] ?? 'unstamped',
  since: SINCE,
  relistWindowMonths: RELIST_WINDOW_MONTHS,
  failedCycles: failedRecent.length,
  closedSales: closed.length,
  pairs: pairs.length,
  closeVsFailedAsk: {
    p10: quantile(ratios, 0.1),
    p25: quantile(ratios, 0.25),
    median: quantile(ratios, 0.5),
    p75: quantile(ratios, 0.75),
    p90: quantile(ratios, 0.9),
  },
  relistAskVsFailedAsk: { median: quantile(relistRatios, 0.5) },
  shareClosedAboveFailedAsk: pairs.length ? Math.round((aboveAsk / pairs.length) * 1000) / 10 : null,
  medianMonthsFailureToClose: monthsMed,
}

console.log(JSON.stringify(summary, null, 2))

// Per-city medians for the big four.
for (const city of ['Bend', 'Redmond', 'Sisters', 'La Pine']) {
  const cr = pairs.filter((p) => p.city === city).map((p) => p.ratioCloseToFailedAsk).sort((a, b) => a - b)
  if (cr.length >= 10) console.log(`${city}: n=${cr.length} median close/failed-ask = ${quantile(cr, 0.5)?.toFixed(3)}`)
}

import { writeFileSync, mkdirSync } from 'node:fs'
mkdirSync('docs/research', { recursive: true })
const stamp = (process.argv[2] ?? new Date().toISOString().slice(0, 10))
writeFileSync(`docs/research/cma-backtest-${stamp}.json`, JSON.stringify({ summary, pairs }, null, 1))
console.log(`wrote docs/research/cma-backtest-${stamp}.json (${pairs.length} pairs, full keys for audit)`)
