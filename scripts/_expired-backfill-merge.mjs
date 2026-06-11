#!/usr/bin/env node
/**
 * Merge YTD expired listings (from Spark API extract) into the existing
 * westside master CSV. Two paths per expired listing:
 *
 *   1. Address match against 04-master-realtor-flagged.csv (westside batch)
 *      → augment that row's tags/columns with expired data, keep homeowner
 *        classification + brief routing intact.
 *   2. No match → build a new row with classification=EXPIRED so the brief
 *      generator routes to expiredNextSteps.
 *
 * Output: out/westside-bend-merge/04-master-with-expireds.csv
 *
 * Run AFTER:
 *   scripts/_expired-backfill-spark-extract.mjs (produces expired-spark-raw.jsonl)
 *
 * Usage:
 *   node scripts/_expired-backfill-merge.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const MASTER_PATH = path.join(ROOT, 'out/westside-bend-merge/04-master-realtor-flagged.csv')
const EXPIRED_PATH = path.join(ROOT, 'out/westside-bend-merge/expired-spark-raw.jsonl')
const OUT_PATH = path.join(ROOT, 'out/westside-bend-merge/04-master-with-expireds.csv')
const SUMMARY_PATH = path.join(ROOT, 'out/westside-bend-merge/summary-expired-merge.json')

function normAddr(num, street, city) {
  let s = `${num || ''} ${street || ''}`.toLowerCase().trim()
  s = s.replace(/[.,#]/g, ' ')
    // strip directional prefixes — Spark often omits these even when present in county data
    .replace(/\b(north|south|east|west|nw|ne|sw|se|n|s|e|w)\b/g, '')
    // strip street type suffixes — Spark often omits, county has them
    .replace(/\b(street|st|avenue|ave|drive|dr|road|rd|lane|ln|court|ct|boulevard|blvd|place|pl|highway|hwy|circle|cir|terrace|ter|parkway|pkwy|way|trail|tr|loop|alley)\b/g, '')
    // strip apt/unit identifiers
    .replace(/\b(apt|unit|suite|ste|#)\s*\S+/g, '')
    // normalize Mt/Mount
    .replace(/\bmount\b/g, 'mt')
    .replace(/\s+/g, ' ').trim()
  const c = (city || '').toLowerCase().trim()
  return c ? `${s}|${c}` : s
}

function parseCsv(text) {
  const rows = []
  let cur = [], field = '', inQuote = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i], n = text[i + 1]
    if (inQuote) {
      if (c === '"' && n === '"') { field += '"'; i += 1 }
      else if (c === '"') inQuote = false
      else field += c
    } else {
      if (c === '"') inQuote = true
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (c === '\r') {}
      else field += c
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function rowToObj(headers, row) {
  const o = {}
  for (let i = 0; i < headers.length; i += 1) o[headers[i]] = row[i] ?? ''
  return o
}

function objToRow(headers, obj) {
  return headers.map((h) => obj[h] ?? '')
}

function daysBetween(iso, refMs = Date.now()) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.round((refMs - t) / 86400000)
}

function expiredTagsFor(sf) {
  const tags = [
    'intent:expired-listing',
    'source:expired-backfill-2026',
    'import:expired-backfill-2026',
    `expired-status:${(sf.StandardStatus || 'unknown').toLowerCase()}`,
    `expired-mls:${sf.ListingKey || ''}`,
  ]
  const ymd = (sf.StatusChangeTimestamp || '').slice(0, 10)
  if (ymd) tags.push(`expired-detected:${ymd}`)
  if (sf.City) tags.push(`city:${sf.City.toLowerCase().replace(/\s+/g, '-')}`)
  return tags.filter(Boolean)
}

function mergeTagsOnto(existingFubTags, newTags) {
  const have = new Set(
    String(existingFubTags || '')
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean),
  )
  for (const t of newTags) have.add(t)
  return [...have].join(';')
}

// ---- main ----

const masterText = await fs.readFile(MASTER_PATH, 'utf8')
const masterRows = parseCsv(masterText)
const headers = masterRows[0]
console.log(`[merge] Master loaded: ${masterRows.length - 1} rows, ${headers.length} columns`)

// Add new expired-specific columns to headers if missing.
const NEW_COLS = [
  'expired_status', 'expired_status_change_date', 'expired_days_ago',
  'expired_list_price', 'expired_original_list_price', 'expired_dom',
  'expired_list_agent_name', 'expired_list_agent_email', 'expired_list_office_name',
  'expired_listing_key', 'expired_mls_number',
  'expired_match_method', 'owner_lookup_status',
]
for (const c of NEW_COLS) if (!headers.includes(c)) headers.push(c)

// Build address index (normalized) → master row index.
const masterObjs = masterRows.slice(1).map((r) => rowToObj(headers, r))
const addrIndex = new Map()
for (let i = 0; i < masterObjs.length; i += 1) {
  const r = masterObjs[i]
  // site_address in master is the full "123 NW Main St"; split at first space
  // for normalizer. Use city as secondary key.
  const addr = (r.site_address || '').trim()
  const firstSpace = addr.indexOf(' ')
  const num = firstSpace > 0 ? addr.slice(0, firstSpace) : ''
  const street = firstSpace > 0 ? addr.slice(firstSpace + 1) : addr
  const key = normAddr(num, street, r.site_city)
  if (key && !addrIndex.has(key)) addrIndex.set(key, i)
}
console.log(`[merge] Address index: ${addrIndex.size} unique normalized addresses`)

// Load expired Spark rows.
const expiredText = await fs.readFile(EXPIRED_PATH, 'utf8')
const expiredLines = expiredText.split('\n').filter((l) => l.trim())
const expireds = expiredLines.map((l) => JSON.parse(l))
console.log(`[merge] Expired Spark rows: ${expireds.length}`)

let augmented = 0
let appended = 0
const byCity = {}
const byMethod = { westside_match: 0, new_no_match: 0 }
const byStatus = {}
const sampleAugmented = []
const sampleAppended = []

for (const sf of expireds) {
  const key = normAddr(sf.StreetNumber, sf.StreetName, sf.City)
  const newCols = {
    expired_status: sf.StandardStatus || '',
    expired_status_change_date: (sf.StatusChangeTimestamp || '').slice(0, 10),
    expired_days_ago: daysBetween(sf.StatusChangeTimestamp),
    expired_list_price: sf.ListPrice || '',
    expired_original_list_price: sf.OriginalListPrice || '',
    expired_dom: sf.CumulativeDaysOnMarket ?? sf.DaysOnMarket ?? '',
    expired_list_agent_name: sf.ListAgentFullName || '',
    expired_list_agent_email: sf.ListAgentEmail || '',
    expired_list_office_name: sf.ListOfficeName || '',
    expired_listing_key: sf.ListingKey || '',
    expired_mls_number: sf.MlsNumber || '',
  }
  const newTags = expiredTagsFor(sf)
  const ci = sf.City || 'unknown'
  byCity[ci] = (byCity[ci] || 0) + 1
  byStatus[sf.StandardStatus || 'unknown'] = (byStatus[sf.StandardStatus || 'unknown'] || 0) + 1

  const idx = addrIndex.get(key)
  if (idx != null) {
    // Match — augment existing row
    const row = masterObjs[idx]
    for (const [k, v] of Object.entries(newCols)) row[k] = v
    row.expired_match_method = 'westside-address-match'
    row.owner_lookup_status = 'resolved-westside'
    row.fub_tags = mergeTagsOnto(row.fub_tags, newTags)
    augmented += 1
    byMethod.westside_match += 1
    if (sampleAugmented.length < 3) {
      sampleAugmented.push({
        match: 'westside',
        owner: [row.owner_first, row.owner_last].filter(Boolean).join(' '),
        address: row.site_address + ', ' + row.site_city,
        score_band: row.score_band,
        expired_status: sf.StandardStatus,
        expired_list_price: sf.ListPrice,
      })
    }
  } else {
    // No westside match — append placeholder row (owner unknown for now)
    const newRow = {}
    for (const h of headers) newRow[h] = ''
    newRow.classification = 'EXPIRED'
    newRow.owner_first = ''
    newRow.owner_last = ''
    newRow.owner_full = `Owner of ${sf.StreetNumber || ''} ${sf.StreetName || ''}`.trim()
    newRow.site_address = `${sf.StreetNumber || ''} ${sf.StreetName || ''}`.trim()
    newRow.site_city = sf.City || ''
    newRow.site_state = sf.StateOrProvince || 'OR'
    newRow.site_zip = sf.PostalCode || ''
    newRow.bedrooms = sf.BedroomsTotal || ''
    newRow.baths = sf.BathroomsTotalInteger || ''
    newRow.building_sqft = sf.LivingArea || ''
    newRow.year_built = sf.YearBuilt || ''
    newRow.acreage = sf.LotSizeAcres || ''
    newRow.county = sf.CountyOrParish || 'Deschutes'
    newRow.subdivision = sf.SubdivisionName || ''
    newRow.latitude = sf.Latitude || ''
    newRow.longitude = sf.Longitude || ''
    newRow.city_slug = (sf.City || '').toLowerCase().replace(/\s+/g, '-')
    newRow.fub_tags = newTags.join(';')
    newRow.is_realtor_any = 'FALSE'
    newRow.is_entity = 'FALSE'
    newRow.included_in_outreach = 'TRUE'
    newRow.include_in_outreach = 'TRUE'
    newRow.include_in_fb_cas = ''
    newRow.enrich_email = 'TRUE'
    newRow.enrich_phone = 'TRUE'
    newRow.expired_match_method = 'no-westside-match'
    newRow.owner_lookup_status = 'pending-fub-or-paid'
    for (const [k, v] of Object.entries(newCols)) newRow[k] = v
    masterObjs.push(newRow)
    appended += 1
    byMethod.new_no_match += 1
    if (sampleAppended.length < 3) {
      sampleAppended.push({
        match: 'none',
        address: newRow.site_address + ', ' + newRow.site_city,
        expired_status: sf.StandardStatus,
        expired_list_price: sf.ListPrice,
        list_agent: sf.ListAgentFullName,
      })
    }
  }
}

// Write merged CSV.
const outLines = [headers.map(csvEscape).join(',')]
for (const r of masterObjs) outLines.push(objToRow(headers, r).map(csvEscape).join(','))
await fs.writeFile(OUT_PATH, outLines.join('\n') + '\n')

const summary = {
  generatedAt: new Date().toISOString(),
  expiredsProcessed: expireds.length,
  augmentedExistingWestsideRows: augmented,
  appendedNewExpiredRows: appended,
  finalRowCount: masterObjs.length,
  byMethod,
  byStatus,
  byCity,
  sampleAugmented,
  sampleAppended,
  outputCsv: path.relative(ROOT, OUT_PATH),
}
await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2))

console.log('\n[merge] === Done ===')
console.log(`Augmented (westside matches): ${augmented}`)
console.log(`Appended (new expired rows): ${appended}`)
console.log(`Final master row count: ${masterObjs.length}`)
console.log(`By city:`, byCity)
console.log(`Output: ${path.relative(ROOT, OUT_PATH)}`)
console.log(`Summary: ${path.relative(ROOT, SUMMARY_PATH)}`)
