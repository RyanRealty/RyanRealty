#!/usr/bin/env node
/**
 * Apply the likely-seller score (0-100) to every west side Bend property
 * using the formula from research-02-seller-scoring.md. Inputs are entirely
 * derived from the local-enriched CSV; no external API calls.
 *
 * Formula:
 *   Score = Tenure (0-30) + Equity (0-25) + Absentee (0-20)
 *         + Property Age (0-10) + Lot Size (0-5)
 *   (Subdivision activity component, +0-10, is deferred — needs MLS overlay)
 *
 * Rate-lock penalty: -5 pts for purchase_year in 2020 or 2021.
 *
 * Outputs: out/westside-bend-merge/03-master-scored.csv
 *          out/westside-bend-merge/summary-seller-score.json
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-seller-score.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, 'out/westside-bend-merge/02-master-geo-enriched.csv')
const OUTPUT = resolve(ROOT, 'out/westside-bend-merge/03-master-scored.csv')
const SUMMARY = resolve(ROOT, 'out/westside-bend-merge/summary-seller-score.json')

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i += 1; continue
      }
      field += c; i += 1; continue
    }
    if (c === '"') { inQuotes = true; i += 1; continue }
    if (c === ',') { row.push(field); field = ''; i += 1; continue }
    if (c === '\r') { i += 1; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue }
    field += c; i += 1
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers, rows) {
  const out = [headers.map(csvEscape).join(',')]
  for (const r of rows) out.push(headers.map((h) => csvEscape(r[h])).join(','))
  return out.join('\n') + '\n'
}

function toNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// -------- Component scorers --------

function tenureScore(yearsOwned, purchaseYear) {
  if (yearsOwned == null) return { pts: 0, bucket: 'unknown', penalty: 0 }
  let pts = 0
  let bucket = ''
  if (yearsOwned < 3) { pts = 0; bucket = '0-2yr' }
  else if (yearsOwned < 6) { pts = 5; bucket = '3-5yr' }
  else if (yearsOwned < 9) { pts = 15; bucket = '6-8yr' }
  else if (yearsOwned < 13) { pts = 30; bucket = '9-12yr' }
  else if (yearsOwned < 18) { pts = 25; bucket = '13-17yr' }
  else if (yearsOwned < 25) { pts = 18; bucket = '18-24yr' }
  else { pts = 10; bucket = '25plus' }

  let penalty = 0
  if (purchaseYear === 2020 || purchaseYear === 2021) penalty = -5
  return { pts: pts + penalty, bucket, penalty }
}

function equityScore(marketValue, purchasePrice) {
  if (!marketValue || !purchasePrice || marketValue <= 0 || purchasePrice <= 0) {
    return { pts: 0, bucket: 'unknown', ratio: null, equityPct: null }
  }
  const ratio = marketValue / purchasePrice
  const equityPct = Number((((marketValue - purchasePrice) / marketValue) * 100).toFixed(1))
  let pts = 0
  let bucket = ''
  if (ratio < 1.0) { pts = 0; bucket = 'underwater' }
  else if (ratio < 1.2) { pts = 3; bucket = 'low' }
  else if (ratio < 1.5) { pts = 10; bucket = 'medium' }
  else if (ratio < 2.0) { pts = 18; bucket = 'high' }
  else { pts = 25; bucket = 'very-high' }
  return { pts, bucket, ratio: Number(ratio.toFixed(2)), equityPct }
}

function absenteeScore({ isOutOfState, isAbsentee, isOwnerOccupied }) {
  if (isOutOfState) return { pts: 20, type: 'absentee-outofstate' }
  if (isAbsentee && !isOwnerOccupied) return { pts: 15, type: 'absentee-local' }
  if (isAbsentee && isOwnerOccupied) return { pts: 10, type: 'mailing-mismatch' } // mailing different but flagged occupied — possible data conflict
  return { pts: 0, type: 'owner-occupied' }
}

function propertyAgeScore(yearBuilt) {
  if (!yearBuilt) return { pts: 0, bucket: 'unknown' }
  if (yearBuilt <= 1979) return { pts: 10, bucket: 'pre-1980' }
  if (yearBuilt <= 1989) return { pts: 8, bucket: '1980s' }
  if (yearBuilt <= 1999) return { pts: 6, bucket: '1990s' }
  if (yearBuilt <= 2009) return { pts: 4, bucket: '2000s' }
  if (yearBuilt <= 2018) return { pts: 2, bucket: '2010s' }
  return { pts: 0, bucket: 'newer' }
}

function lotSizeScore(acreage) {
  if (!acreage) return { pts: 0, bucket: 'unknown' }
  if (acreage >= 1.0) return { pts: 5, bucket: '1plus-ac' }
  if (acreage >= 0.25) return { pts: 3, bucket: '0.25-1ac' }
  return { pts: 1, bucket: 'under-quarter' }
}

function lifecycleTag(purchaseYear, yearsOwned) {
  const tags = []
  if (purchaseYear && purchaseYear <= 1999 && yearsOwned && yearsOwned >= 17) {
    tags.push('lifecycle:likely-retirement-age')
  }
  if (purchaseYear === 2020 || purchaseYear === 2021) {
    tags.push('lifecycle:rate-locked')
  }
  return tags
}

function scoreBand(total) {
  if (total >= 75) return 'hot'
  if (total >= 50) return 'warm'
  if (total >= 25) return 'cool'
  return 'cold'
}

async function main() {
  const csvText = await readFile(INPUT, 'utf8')
  const allRows = parseCsv(csvText)
  const headers = allRows.shift() || []
  const headerIdx = new Map(headers.map((h, i) => [h, i]))
  const get = (row, name) => {
    const i = headerIdx.get(name)
    return i == null ? '' : String(row[i] ?? '').trim()
  }

  const newCols = [
    'score_tenure',
    'score_tenure_bucket',
    'score_tenure_penalty',
    'score_equity',
    'score_equity_bucket',
    'score_equity_ratio',
    'score_equity_pct',
    'score_absentee',
    'score_absentee_type',
    'score_property_age',
    'score_property_age_bucket',
    'score_lot_size',
    'score_lot_size_bucket',
    'score_total',
    'score_band',
    'score_lifecycle_tags',
  ]
  const outHeaders = [...headers, ...newCols]
  const outRows = []

  const stats = {
    total: 0,
    by_band: { hot: 0, warm: 0, cool: 0, cold: 0 },
    by_tenure_bucket: {},
    by_equity_bucket: {},
    by_absentee_type: {},
    rate_locked: 0,
    likely_retirement_age: 0,
    no_purchase_date: 0,
    no_purchase_price: 0,
    no_market_value: 0,
    score_distribution: { '0-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90-100': 0 },
    score_average: 0,
    score_median: 0,
  }

  const allScores = []

  for (const r of allRows) {
    if (r.length < 5) continue
    const row = Object.fromEntries(headers.map((h, j) => [h, r[j] ?? '']))
    stats.total += 1

    const yearsOwned = toNumber(get(r, 'years_owned'))
    let purchaseYear = null
    const purchaseDate = get(r, 'purchase_date')
    if (purchaseDate) {
      const m = purchaseDate.match(/^(\d{4})/)
      if (m) purchaseYear = Number(m[1])
    }
    const marketValue = toNumber(get(r, 'market_value'))
    const purchasePrice = toNumber(get(r, 'purchase_price'))
    const yearBuilt = toNumber(get(r, 'year_built'))
    const acreage = toNumber(get(r, 'acreage'))
    const isOutOfState = get(r, 'is_out_of_state') === 'TRUE'
    const isAbsentee = get(r, 'is_absentee') === 'TRUE'
    const isOwnerOccupied = get(r, 'owner_occupied').toUpperCase() === 'Y'

    if (!purchaseDate) stats.no_purchase_date += 1
    if (!purchasePrice) stats.no_purchase_price += 1
    if (!marketValue) stats.no_market_value += 1

    const tenure = tenureScore(yearsOwned, purchaseYear)
    const equity = equityScore(marketValue, purchasePrice)
    const absentee = absenteeScore({ isOutOfState, isAbsentee, isOwnerOccupied })
    const propAge = propertyAgeScore(yearBuilt)
    const lot = lotSizeScore(acreage)
    const lifecycle = lifecycleTag(purchaseYear, yearsOwned)

    const total = Math.max(0, tenure.pts + equity.pts + absentee.pts + propAge.pts + lot.pts)
    const band = scoreBand(total)

    allScores.push(total)
    stats.by_band[band] += 1
    stats.by_tenure_bucket[tenure.bucket] = (stats.by_tenure_bucket[tenure.bucket] || 0) + 1
    stats.by_equity_bucket[equity.bucket] = (stats.by_equity_bucket[equity.bucket] || 0) + 1
    stats.by_absentee_type[absentee.type] = (stats.by_absentee_type[absentee.type] || 0) + 1
    if (lifecycle.includes('lifecycle:rate-locked')) stats.rate_locked += 1
    if (lifecycle.includes('lifecycle:likely-retirement-age')) stats.likely_retirement_age += 1

    const bucket = Math.min(9, Math.floor(total / 10))
    const bucketKey = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'][bucket]
    stats.score_distribution[bucketKey] += 1

    outRows.push({
      ...row,
      score_tenure: tenure.pts,
      score_tenure_bucket: tenure.bucket,
      score_tenure_penalty: tenure.penalty,
      score_equity: equity.pts,
      score_equity_bucket: equity.bucket,
      score_equity_ratio: equity.ratio ?? '',
      score_equity_pct: equity.equityPct ?? '',
      score_absentee: absentee.pts,
      score_absentee_type: absentee.type,
      score_property_age: propAge.pts,
      score_property_age_bucket: propAge.bucket,
      score_lot_size: lot.pts,
      score_lot_size_bucket: lot.bucket,
      score_total: total,
      score_band: band,
      score_lifecycle_tags: lifecycle.join('; '),
    })
  }

  if (allScores.length > 0) {
    const sum = allScores.reduce((a, b) => a + b, 0)
    stats.score_average = Number((sum / allScores.length).toFixed(1))
    const sorted = [...allScores].sort((a, b) => a - b)
    stats.score_median = sorted[Math.floor(sorted.length / 2)]
  }

  await writeFile(OUTPUT, rowsToCsv(outHeaders, outRows), 'utf8')
  await writeFile(SUMMARY, JSON.stringify(stats, null, 2), 'utf8')

  console.log('[seller-score] === Summary ===')
  console.log(`  Total            : ${stats.total}`)
  console.log(`  Average score    : ${stats.score_average}`)
  console.log(`  Median score     : ${stats.score_median}`)
  console.log(`  Score bands:`)
  for (const [k, v] of Object.entries(stats.by_band)) {
    const pct = ((v / stats.total) * 100).toFixed(1)
    console.log(`    ${k.padEnd(12)} ${v.toString().padStart(5)} (${pct}%)`)
  }
  console.log(`  Score distribution (10-pt buckets):`)
  for (const [k, v] of Object.entries(stats.score_distribution)) {
    const pct = ((v / stats.total) * 100).toFixed(1)
    const bar = '█'.repeat(Math.floor(v / 80))
    console.log(`    ${k.padEnd(8)} ${v.toString().padStart(5)} (${pct}%) ${bar}`)
  }
  console.log(`  Tenure buckets:`)
  for (const [k, v] of Object.entries(stats.by_tenure_bucket).sort()) {
    console.log(`    ${k.padEnd(12)} ${v}`)
  }
  console.log(`  Equity buckets:`)
  for (const [k, v] of Object.entries(stats.by_equity_bucket).sort()) {
    console.log(`    ${k.padEnd(14)} ${v}`)
  }
  console.log(`  Absentee types:`)
  for (const [k, v] of Object.entries(stats.by_absentee_type).sort()) {
    console.log(`    ${k.padEnd(22)} ${v}`)
  }
  console.log(`  Rate-locked (2020-21)     : ${stats.rate_locked}`)
  console.log(`  Likely retirement-age     : ${stats.likely_retirement_age}`)
  console.log(`  Data gaps:`)
  console.log(`    No purchase date  : ${stats.no_purchase_date}`)
  console.log(`    No purchase price : ${stats.no_purchase_price}`)
  console.log(`    No market value   : ${stats.no_market_value}`)
  console.log(`[seller-score] Output: ${OUTPUT}`)
}

main().catch((err) => {
  console.error('[seller-score] FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
