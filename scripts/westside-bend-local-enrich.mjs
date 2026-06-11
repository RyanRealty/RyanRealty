#!/usr/bin/env node
/**
 * Local enrichment pass for the west side Bend homeowner CSV. This adds every
 * derived field we can compute WITHOUT calling any external API:
 *
 *   - years_owned          (today - purchase_date in years)
 *   - tenure_bucket        ('0-2','3-7','8-15','16-30','30+')
 *   - equity_pct           ((market_value - purchase_price) / market_value)
 *   - equity_bucket        ('low','medium','high','very_high')
 *   - mailing_in_state     (mailing state == 'OR')
 *   - mailing_in_county    (mailing zip in Deschutes-county zip set)
 *   - is_out_of_state      (mailing state != 'OR')
 *   - is_absentee          (mailing addr != site addr OR owner_occupied != 'Y')
 *   - is_entity            (owner name looks like LLC/trust/estate)
 *   - is_realtor_via_fub   (matched FUB person is in 'Real Estate Agent' stage)
 *   - property_kind        (Rsfr -> single_family, Rsmh -> manufactured, etc.)
 *   - included_in_outreach (boolean — TRUE if eligible for outreach)
 *   - exclusion_reason     (why excluded if not)
 *
 * Does NOT compute the full likely-seller score yet — that needs the research
 * subagent output to lock weights. This script writes the inputs the scorer
 * will consume.
 *
 * Inputs: 01-master.csv from westside-bend-merge-fub.mjs
 * Outputs: 01-master-local-enriched.csv (same rows + new columns)
 *          summary-local-enrich.json (counts per bucket)
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-local-enrich.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, 'out/westside-bend-merge/01-master.csv')
const OUTPUT = resolve(ROOT, 'out/westside-bend-merge/01-master-local-enriched.csv')
const SUMMARY = resolve(ROOT, 'out/westside-bend-merge/summary-local-enrich.json')

// Deschutes County, OR zip codes (Bend + nearby — same-county = local owner).
const DESCHUTES_ZIPS = new Set([
  '97701', '97702', '97703', '97707', '97708', '97709', // Bend
  '97739', // La Pine
  '97756', // Redmond
  '97759', // Sisters
  '97760', // Terrebonne
  '97712', // Brothers
])

const PROPERTY_KIND_MAP = {
  RSFR: 'single_family',
  RSMH: 'manufactured',
  RSCN: 'condo',
  RSTH: 'townhouse',
  RDPX: 'duplex',
  RSTR: 'triplex',
  RSQR: 'quadplex',
  CMRC: 'commercial',
  CMOF: 'commercial_office',
  CMIN: 'commercial_industrial',
  CMRT: 'commercial_retail',
  CMHT: 'commercial_hotel',
  AGLI: 'agricultural_livestock',
  AGOR: 'agricultural_orchard',
  AGCR: 'agricultural_crop',
  AGVN: 'agricultural_vineyard',
  AGRL: 'agricultural_rural',
  VLNT: 'vacant_land',
  VRES: 'vacant_residential',
  VCOM: 'vacant_commercial',
}

// -------- CSV parse/serialize (RFC 4180-ish) --------

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

// -------- Field derivers --------

function normalizeStreet(s) {
  if (!s) return ''
  return String(s).toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
}

function yearsOwned(purchaseDateIso) {
  if (!purchaseDateIso) return null
  const t = new Date(purchaseDateIso).getTime()
  if (!Number.isFinite(t)) return null
  const years = (Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000)
  return years > 0 ? Number(years.toFixed(1)) : null
}

function tenureBucket(years) {
  if (years == null) return ''
  if (years < 3) return '0-2'
  if (years < 8) return '3-7'
  if (years < 16) return '8-15'
  if (years < 31) return '16-30'
  return '30+'
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function equityPct(marketValue, purchasePrice) {
  if (!marketValue || !purchasePrice) return null
  if (marketValue <= 0 || purchasePrice <= 0) return null
  const ratio = (marketValue - purchasePrice) / marketValue
  return Number((ratio * 100).toFixed(1))
}

function equityBucket(pct) {
  if (pct == null) return ''
  if (pct < 25) return 'low'
  if (pct < 50) return 'medium'
  if (pct < 75) return 'high'
  return 'very_high'
}

function propertyKind(code) {
  if (!code) return ''
  const upper = String(code).toUpperCase()
  if (PROPERTY_KIND_MAP[upper]) return PROPERTY_KIND_MAP[upper]
  // Some county exports use "Rsfr" with mixed case; the upper-case lookup is the canonical key
  // For unknown codes, return the raw value for triage
  return upper.toLowerCase()
}

// -------- Realtor detection (FUB stage + tag heuristics) --------

// Realtor positive signals.
const REALTOR_TAG_PATTERNS = [
  /\brealtor\b/i,
  /\breal[\s_-]?estate[\s_-]?agent\b/i,
  /^industry:realtor$/i,
  /^industry:broker$/i,
  /^industry:agent$/i,
]
// Tags that contain agent/broker substrings but DO NOT mean this contact is
// a realtor — they're attribution / role metadata that Matt applies to his
// own contacts. Match these first and exclude before the positive scan.
const REALTOR_NEGATIVE_TAG_PATTERNS = [
  /^broker:/i,          // broker:matt, broker:rebecca — Matt is the assigned broker
  /^agent:/i,           // agent:matt — same
  /^assigned[-_]/i,     // assigned-to-X
  /^buyer'?s? agent$/i, // buyer's agent (role of the contact's buyer rep)
  /^seller'?s? agent$/i,
  /^lender:/i,
]

function isRealtorViaFub(row) {
  const stage = (row.fub_stage || '').trim().toLowerCase()
  if (stage === 'real estate agent') return { is: true, reason: 'fub_stage:Real Estate Agent' }
  const tags = String(row.fub_tags || '').split('; ').filter(Boolean)
  for (const t of tags) {
    if (REALTOR_NEGATIVE_TAG_PATTERNS.some((re) => re.test(t))) continue
    if (REALTOR_TAG_PATTERNS.some((re) => re.test(t))) {
      return { is: true, reason: `fub_tag:${t}` }
    }
  }
  return { is: false, reason: '' }
}

// -------- Eligibility for outreach --------

function classifyOutreach({ row, derived }) {
  if (derived.is_realtor_via_fub === 'TRUE') {
    return { included: false, reason: 'realtor' }
  }
  if (row.classification === 'ENTITY_OR_SKIP') {
    return { included: false, reason: 'entity_no_skiptrace' }
  }
  if (row.classification === 'DO_NOT_ENRICH') {
    return { included: false, reason: 'full_dnc' }
  }
  // ALREADY_COMPLETE, IN_FUB_NEEDS_*, NOT_IN_FUB, IN_FUB_PARTIAL_BLOCKED — all included
  // (PARTIAL_BLOCKED means a channel is blocked but the row itself is contactable)
  return { included: true, reason: '' }
}

async function main() {
  const csvText = await readFile(INPUT, 'utf8')
  const allRows = parseCsv(csvText)
  const headers = allRows.shift() || []
  const headerIdx = new Map(headers.map((h, i) => [h, i]))
  const get = (row, name) => {
    const i = headerIdx.get(name)
    return i == null ? '' : (row[i] || '').trim()
  }

  const enrichedHeaders = [
    ...headers,
    'years_owned',
    'tenure_bucket',
    'equity_pct',
    'equity_bucket',
    'mailing_in_state',
    'mailing_in_deschutes',
    'is_out_of_state',
    'is_absentee',
    'is_entity',
    'is_realtor_via_fub',
    'realtor_reason',
    'property_kind',
    'included_in_outreach',
    'exclusion_reason',
  ]

  const enrichedRows = []
  const stats = {
    total: 0,
    by_tenure: {}, by_equity: {}, by_property_kind: {}, by_exclusion: {},
    is_out_of_state: 0, is_absentee: 0, is_entity: 0, is_realtor_via_fub: 0,
    included: 0, excluded: 0,
    no_purchase_date: 0, no_market_value: 0, no_purchase_price: 0,
  }

  for (const arr of allRows) {
    if (arr.length < 5) continue
    const row = Object.fromEntries(headers.map((h, i) => [h, arr[i] ?? '']))
    stats.total += 1

    const years = yearsOwned(row.purchase_date)
    if (years == null) stats.no_purchase_date += 1
    const tenureBkt = tenureBucket(years)
    stats.by_tenure[tenureBkt || '(unknown)'] = (stats.by_tenure[tenureBkt || '(unknown)'] || 0) + 1

    const marketValue = toNumber(row.market_value)
    const purchasePrice = toNumber(row.purchase_price)
    if (!marketValue) stats.no_market_value += 1
    if (!purchasePrice) stats.no_purchase_price += 1
    const equity = equityPct(marketValue, purchasePrice)
    const equityBkt = equityBucket(equity)
    stats.by_equity[equityBkt || '(unknown)'] = (stats.by_equity[equityBkt || '(unknown)'] || 0) + 1

    const mailState = String(row.mail_state || '').trim().toUpperCase()
    const mailZip = String(row.mail_zip || '').replace(/[^0-9]/g, '').slice(0, 5)
    const siteAddr = normalizeStreet(row.site_address)
    const mailAddr = normalizeStreet(row.mail_address)
    const ownerOccupied = String(row.owner_occupied || '').trim().toUpperCase()

    const mailing_in_state = mailState === 'OR' ? 'TRUE' : ''
    const mailing_in_deschutes = DESCHUTES_ZIPS.has(mailZip) ? 'TRUE' : ''
    const is_out_of_state = mailState && mailState !== 'OR' ? 'TRUE' : ''
    // Absentee = mailing address differs from site OR owner_occupied flag says N
    const is_absentee = (mailAddr && siteAddr && mailAddr !== siteAddr) || ownerOccupied === 'N' ? 'TRUE' : ''
    const is_entity = row.classification === 'ENTITY_OR_SKIP' ? 'TRUE' : ''

    const realtor = isRealtorViaFub(row)
    const is_realtor_via_fub = realtor.is ? 'TRUE' : ''
    const realtor_reason = realtor.reason

    let property_kind = propertyKind(row.property_type_raw || '')
    // Backstop: if county code wasn't recognised, infer from building sqft + acreage.
    if (!property_kind || property_kind === (row.property_type_raw || '').toLowerCase()) {
      const acreage = toNumber(row.acreage)
      const buildingSqft = toNumber(row.building_sqft)
      if (buildingSqft != null && buildingSqft >= 600) property_kind = 'single_family'
      else if (buildingSqft != null && buildingSqft > 0 && buildingSqft < 600) property_kind = 'small_building_or_adu'
      else if ((buildingSqft == null || buildingSqft === 0) && acreage != null) property_kind = 'vacant_or_land_only'
      else property_kind = property_kind || 'unknown'
    }

    if (is_out_of_state) stats.is_out_of_state += 1
    if (is_absentee) stats.is_absentee += 1
    if (is_entity) stats.is_entity += 1
    if (is_realtor_via_fub) stats.is_realtor_via_fub += 1
    stats.by_property_kind[property_kind || '(unknown)'] = (stats.by_property_kind[property_kind || '(unknown)'] || 0) + 1

    const derived = {
      years_owned: years ?? '',
      tenure_bucket: tenureBkt,
      equity_pct: equity ?? '',
      equity_bucket: equityBkt,
      mailing_in_state,
      mailing_in_deschutes,
      is_out_of_state,
      is_absentee,
      is_entity,
      is_realtor_via_fub,
      realtor_reason,
      property_kind,
    }
    const outreach = classifyOutreach({ row, derived })
    derived.included_in_outreach = outreach.included ? 'TRUE' : ''
    derived.exclusion_reason = outreach.reason

    if (outreach.included) stats.included += 1
    else {
      stats.excluded += 1
      stats.by_exclusion[outreach.reason] = (stats.by_exclusion[outreach.reason] || 0) + 1
    }

    enrichedRows.push({ ...row, ...derived })
  }

  await writeFile(OUTPUT, rowsToCsv(enrichedHeaders, enrichedRows), 'utf8')
  await writeFile(SUMMARY, JSON.stringify(stats, null, 2), 'utf8')

  console.log('[local-enrich] Total rows:', stats.total)
  console.log('[local-enrich] Included in outreach:', stats.included)
  console.log('[local-enrich] Excluded:', stats.excluded)
  console.log('  Reasons:', stats.by_exclusion)
  console.log('[local-enrich] Out-of-state owners:', stats.is_out_of_state)
  console.log('[local-enrich] Absentee owners:', stats.is_absentee)
  console.log('[local-enrich] Entity owners (LLC/trust):', stats.is_entity)
  console.log('[local-enrich] Realtor (via FUB stage/tag):', stats.is_realtor_via_fub)
  console.log('[local-enrich] Tenure distribution:')
  for (const [k, v] of Object.entries(stats.by_tenure).sort()) console.log(`    ${k.padEnd(12)} ${v}`)
  console.log('[local-enrich] Equity distribution:')
  for (const [k, v] of Object.entries(stats.by_equity).sort()) console.log(`    ${k.padEnd(12)} ${v}`)
  console.log('[local-enrich] Property kind:')
  for (const [k, v] of Object.entries(stats.by_property_kind).sort()) console.log(`    ${k.padEnd(28)} ${v}`)
  console.log('[local-enrich] Data quality gaps:')
  console.log('  Missing purchase_date:', stats.no_purchase_date)
  console.log('  Missing market_value :', stats.no_market_value)
  console.log('  Missing purchase_price:', stats.no_purchase_price)
  console.log(`[local-enrich] Output: ${OUTPUT}`)
  console.log(`[local-enrich] Summary: ${SUMMARY}`)
}

main().catch((err) => {
  console.error('[local-enrich] FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
