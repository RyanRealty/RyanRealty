#!/usr/bin/env node
/**
 * Merge ~/Downloads/textexport.csv into the existing master. Filters to
 * Status in (E,W) = Expired / Withdrawn — skipping L (currently listed) and
 * any other status. Key advantage over Spark API: textexport has Owner Name
 * populated for most rows, so we resolve owner-lookup:pending automatically.
 *
 * Reads:  out/westside-bend-merge/04-master-with-expireds.csv
 *         ~/Downloads/textexport.csv
 *
 * Writes: out/westside-bend-merge/04-master-with-textexport.csv
 *         out/westside-bend-merge/summary-textexport-merge.json
 *
 * Dedup rules:
 *   1. If row matches by normalized address → augment existing master row
 *      with expired fields + owner name (do NOT overwrite if already set).
 *   2. If row's List Number matches an existing pure-expired row (from
 *      Spark) → upgrade that row with owner name + better metadata, DO NOT
 *      duplicate.
 *   3. Otherwise → append new row.
 *
 * Active listings ("L") are SKIPPED — they belong to other brokers' active
 * contracts. Listing them as seller-prospect would be unethical + violate
 * compliance gates.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.cwd()
const MASTER_PATH = path.join(ROOT, 'out/westside-bend-merge/04-master-with-expireds.csv')
const TEXTEXPORT_PATH = path.join(os.homedir(), 'Downloads/textexport.csv')
const OUT_PATH = path.join(ROOT, 'out/westside-bend-merge/04-master-with-textexport.csv')
const SUMMARY_PATH = path.join(ROOT, 'out/westside-bend-merge/summary-textexport-merge.json')

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

function normAddr(num, street, city) {
  let s = `${num || ''} ${street || ''}`.toLowerCase().trim()
  s = s.replace(/[.,#]/g, ' ')
    .replace(/\b(north|south|east|west|nw|ne|sw|se|n|s|e|w)\b/g, '')
    .replace(/\b(street|st|avenue|ave|drive|dr|road|rd|lane|ln|court|ct|boulevard|blvd|place|pl|highway|hwy|circle|cir|terrace|ter|parkway|pkwy|way|trail|tr|loop|alley)\b/g, '')
    .replace(/\b(apt|unit|suite|ste|#)\s*\S+/g, '')
    .replace(/\bmount\b/g, 'mt')
    .replace(/\s+/g, ' ').trim()
  const c = (city || '').toLowerCase().trim()
  return c ? `${s}|${c}` : s
}

function statusFullName(s) {
  return { E: 'Expired', W: 'Withdrawn', L: 'Active', C: 'Canceled' }[s] || s
}

function daysBetween(iso, refMs = Date.now()) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.round((refMs - t) / 86400000)
}

function splitOwnerName(full) {
  if (!full) return { first: '', last: '', full: '' }
  const s = String(full).trim()
  if (!s) return { first: '', last: '', full: '' }
  // Detect entity patterns
  if (/\b(LLC|trust|estate|corp|inc|partners|properties|holdings|llp)\b/i.test(s)) {
    return { first: '', last: '', full: s, isEntity: true }
  }
  const parts = s.split(/\s+/)
  if (parts.length === 1) return { first: '', last: parts[0], full: s }
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return { first, last, full: s }
}

// ---- main ----

const masterText = await fs.readFile(MASTER_PATH, 'utf8')
const masterRows = parseCsv(masterText)
const headers = masterRows[0]
const masterObjs = masterRows.slice(1).map((r) => rowToObj(headers, r))
console.log(`[textexport] Master loaded: ${masterObjs.length} rows`)

// Build two indexes: by normalized address, by expired MLS key (List Number)
const addrIndex = new Map()
const mlsIndex = new Map()
for (let i = 0; i < masterObjs.length; i += 1) {
  const r = masterObjs[i]
  const addr = (r.site_address || '').trim()
  const firstSpace = addr.indexOf(' ')
  const num = firstSpace > 0 ? addr.slice(0, firstSpace) : ''
  const street = firstSpace > 0 ? addr.slice(firstSpace + 1) : addr
  const key = normAddr(num, street, r.site_city)
  if (key && !addrIndex.has(key)) addrIndex.set(key, i)
  // Spark MLS numbers were stored as expired_mls_number — but the field is
  // actually expired_listing_key (Spark's ListingKey). textexport "List Number"
  // maps to MLS Number / ListNumber. Both should match somewhere.
  if (r.expired_listing_key) mlsIndex.set(String(r.expired_listing_key), i)
  if (r.expired_mls_number) mlsIndex.set(String(r.expired_mls_number), i)
}
console.log(`[textexport] Address index: ${addrIndex.size}, MLS-key index: ${mlsIndex.size}`)

// Parse textexport.csv
const txText = await fs.readFile(TEXTEXPORT_PATH, 'utf8')
const txRows = parseCsv(txText)
const txHeaders = txRows[0]
const txObjs = txRows.slice(1).map((r) => rowToObj(txHeaders, r))
console.log(`[textexport] textexport.csv: ${txObjs.length} rows`)

// Filter to E or W status (skip L = Active, anything else)
const expiredOrWithdrawn = txObjs.filter((r) => ['E', 'W'].includes((r.Status || '').trim()))
console.log(`[textexport] Filtered to E/W: ${expiredOrWithdrawn.length}`)

let augmentedExistingExpired = 0
let augmentedWestside = 0
let appended = 0
let skippedActive = txObjs.length - expiredOrWithdrawn.length
const byCity = {}
const byStatus = {}
const sampleAppended = []
const sampleAugmented = []

for (const tx of expiredOrWithdrawn) {
  const status = (tx.Status || '').trim()
  const statusFull = statusFullName(status)
  const changeDate = (tx['Status Change Timestamp'] || tx['Withdrawn Date'] || tx['Cancellation Date'] || '').slice(0, 10)
  const streetParts = [tx['Street Number'], tx['Street Name'], tx['Street Suffix']].filter(Boolean).join(' ').trim()
  const addrKey = normAddr(tx['Street Number'], `${tx['Street Name'] || ''} ${tx['Street Suffix'] || ''}`.trim(), tx.City)
  const ownerInfo = splitOwnerName(tx['Owner Name'])
  const newCols = {
    expired_status: statusFull,
    expired_status_change_date: changeDate,
    expired_days_ago: daysBetween(changeDate),
    expired_list_price: tx['List Price'] || '',
    expired_original_list_price: tx['Original List Price'] || '',
    expired_dom: tx['Days on Market'] || '',
    expired_list_agent_name: tx['Listing Agent'] || '',
    expired_list_agent_email: '',
    expired_list_office_name: tx['Agency Name'] || '',
    expired_listing_key: '',
    expired_mls_number: tx['List Number'] || '',
  }

  byCity[tx.City || 'unknown'] = (byCity[tx.City || 'unknown'] || 0) + 1
  byStatus[statusFull] = (byStatus[statusFull] || 0) + 1

  // 1. Try MLS-key match against existing pure-expired (Spark-sourced) row
  const mlsKey = String(tx['List Number'] || '')
  let idx = mlsKey ? mlsIndex.get(mlsKey) : null

  // 2. If no MLS match, try address match
  if (idx == null) idx = addrIndex.get(addrKey) ?? null

  if (idx != null) {
    const row = masterObjs[idx]
    // Augment existing row — set expired fields ONLY if not already set, but
    // always upgrade owner name if textexport has one and master is blank.
    for (const [k, v] of Object.entries(newCols)) {
      if (v && (!row[k] || row[k] === '')) row[k] = v
    }
    if (ownerInfo.full && !row.owner_first && !row.owner_last) {
      row.owner_first = ownerInfo.first
      row.owner_last = ownerInfo.last
      row.owner_full = ownerInfo.full
      row.owner_lookup_status = ownerInfo.isEntity ? 'resolved-entity-mls' : 'resolved-textexport-owner'
    }
    if (row.classification === 'EXPIRED') {
      augmentedExistingExpired += 1
      if (sampleAugmented.length < 3) sampleAugmented.push({
        match: 'existing-expired',
        address: row.site_address + ', ' + row.site_city,
        owner_added: ownerInfo.full,
        mls: mlsKey,
      })
    } else {
      augmentedWestside += 1
    }
  } else {
    // New row
    const newRow = {}
    for (const h of headers) newRow[h] = ''
    newRow.classification = 'EXPIRED'
    newRow.owner_first = ownerInfo.first
    newRow.owner_last = ownerInfo.last
    newRow.owner_full = ownerInfo.full || `Owner of ${streetParts}`
    newRow.site_address = streetParts
    newRow.site_city = tx.City || ''
    newRow.site_state = tx.State || 'OR'
    newRow.site_zip = tx['Postal Code'] || ''
    newRow.bedrooms = tx['Bedrooms Total'] || ''
    newRow.baths = tx['Bathrooms Total'] || ''
    newRow.building_sqft = tx['Total Living Area SqFt'] || ''
    newRow.year_built = tx['Year Built'] || ''
    newRow.acreage = tx['Lot Size Acres'] || ''
    newRow.county = tx.County || 'Deschutes'
    newRow.subdivision = tx['Subdivision Name'] || ''
    newRow.apn = tx['Parcel Number'] || ''
    newRow.city_slug = (tx.City || '').toLowerCase().replace(/\s+/g, '-')
    newRow.fub_tags = ''
    newRow.is_realtor_any = 'FALSE'
    newRow.is_entity = ownerInfo.isEntity ? 'TRUE' : 'FALSE'
    newRow.included_in_outreach = 'TRUE'
    newRow.include_in_outreach = 'TRUE'
    newRow.enrich_email = 'TRUE'
    newRow.enrich_phone = 'TRUE'
    newRow.expired_match_method = 'textexport-no-westside-match'
    newRow.owner_lookup_status = ownerInfo.full
      ? (ownerInfo.isEntity ? 'resolved-entity-mls' : 'resolved-textexport-owner')
      : 'pending-fub-or-paid'
    for (const [k, v] of Object.entries(newCols)) newRow[k] = v
    masterObjs.push(newRow)
    appended += 1
    if (sampleAppended.length < 3) sampleAppended.push({
      address: newRow.site_address + ', ' + newRow.site_city,
      owner: newRow.owner_full,
      status: statusFull,
      list_price: tx['List Price'],
      changed: changeDate,
    })
  }
}

// Write merged CSV
const outLines = [headers.map(csvEscape).join(',')]
for (const r of masterObjs) outLines.push(headers.map((h) => csvEscape(r[h])).join(','))
await fs.writeFile(OUT_PATH, outLines.join('\n') + '\n')

const summary = {
  generatedAt: new Date().toISOString(),
  textexportTotalRows: txObjs.length,
  filteredEorW: expiredOrWithdrawn.length,
  skippedActive,
  augmentedExistingExpired,
  augmentedWestside,
  appendedNew: appended,
  finalRowCount: masterObjs.length,
  byCity,
  byStatus,
  sampleAugmented,
  sampleAppended,
  outputCsv: path.relative(ROOT, OUT_PATH),
}
await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2))

console.log('\n[textexport] === Done ===')
console.log(`Augmented existing pure-expired rows (Spark dupes): ${augmentedExistingExpired}`)
console.log(`Augmented westside rows: ${augmentedWestside}`)
console.log(`Appended new expired/withdrawn rows: ${appended}`)
console.log(`Skipped active (L): ${skippedActive}`)
console.log(`Final master row count: ${masterObjs.length}`)
console.log(`Output: ${path.relative(ROOT, OUT_PATH)}`)
