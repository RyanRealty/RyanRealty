#!/usr/bin/env node
/**
 * Realtor identification (NOT exclusion) — flag every owner who is themselves
 * a licensed real estate professional, identify which brokerage they work
 * for, and produce per-row flags that tell downstream steps how to handle
 * them.
 *
 * Updated 2026-05-26 (Matt directive): realtors are NOT excluded from the
 * outreach list. They go INTO FUB with full contact enrichment so Matt has
 * the broker affiliation in his CRM. They DO get excluded from the Facebook
 * Custom Audience upload (no FB-side ads to other agents). The Facebook
 * builder reads `include_in_fb_cas` per row.
 *
 * Sources (union, with precedence):
 *   1. FlexMLS / Spark Platform — active Cascade East Association of
 *      Realtors members (UserType=Member, Active=true, LocalType in REALTOR
 *      / Designated REALTOR / MLS Only SalesPerson). Most authoritative for
 *      "currently active local broker".
 *   2. Oregon Real Estate Agency — full licensee registry (broader, includes
 *      Property Managers, Wholesalers, agents whose MLS membership has
 *      lapsed but license is current).
 *   3. FUB tags / stage — Matt's own tagging history (`industry:realtor`,
 *      `Realtor`, stage `Real Estate Agent`, etc.). Catches realtors Matt
 *      has personally tagged who may or may not appear in the formal lists.
 *
 * For each row we produce:
 *   - is_realtor_any                — TRUE if matched by any source
 *   - realtor_sources               — comma-separated list of which sources
 *                                      flagged this row (flexmls, orea, fub)
 *   - realtor_brokerage             — preferred brokerage display name
 *                                      (FlexMLS Office > OREA Business >
 *                                      blank)
 *   - realtor_license_number        — license number when available
 *   - realtor_license_type          — REALTOR / Designated REALTOR / B / PB /
 *                                      PM / etc.
 *   - realtor_match_confidence      — high | high-with-zip | low-multiple |
 *                                      review-common-name | (blank)
 *   - include_in_outreach           — TRUE except for entities + DNC
 *                                      (realtors KEPT IN outreach)
 *   - include_in_fb_cas             — FALSE for realtors, TRUE otherwise
 *                                      (still subject to entity / DNC rules)
 *
 * Inputs:
 *   - out/westside-bend-merge/03-master-scored.csv (the scored master CSV)
 *   - out/westside-bend-merge/orea_active_individuals.csv (downloaded earlier)
 *   - out/westside-bend-merge/flexmls_members.json (downloaded earlier)
 *
 * Output: out/westside-bend-merge/04-master-realtor-flagged.csv
 *         out/westside-bend-merge/summary-realtor-filter.json
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-realtor-filter.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, 'out/westside-bend-merge/03-master-scored.csv')
const OREA = resolve(ROOT, 'out/westside-bend-merge/orea_active_individuals.csv')
const FLEXMLS = resolve(ROOT, 'out/westside-bend-merge/flexmls_members.json')
const OUTPUT = resolve(ROOT, 'out/westside-bend-merge/04-master-realtor-flagged.csv')
const SUMMARY = resolve(ROOT, 'out/westside-bend-merge/summary-realtor-filter.json')

const DESCHUTES_CITIES = new Set([
  'bend', 'redmond', 'sisters', 'la pine', 'lapine', 'sunriver', 'tumalo',
  'alfalfa', 'powell butte', 'terrebonne', 'black butte ranch',
])
const DESCHUTES_ZIPS = new Set([
  '97701', '97702', '97703', '97707', '97708', '97709',
  '97756', '97758', '97759', '97760', '97739', '97738',
])

// ---- CSV --------------------------------------------------------------

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

// ---- Name normalization ----------------------------------------------

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z]/g, '')
}

function nameKey(first, last) {
  const f = normName(first)
  const l = normName(last)
  if (!f || !l) return ''
  return `${f}_${l}`
}

// ---- Source loaders ---------------------------------------------------

async function loadFlexmlsIndex() {
  if (!existsSync(FLEXMLS)) {
    console.warn(`[realtor-filter] WARN: ${FLEXMLS} not found — FlexMLS layer skipped`)
    return { byKey: new Map(), total: 0 }
  }
  const data = JSON.parse(await readFile(FLEXMLS, 'utf8'))
  const byKey = new Map()
  for (const m of data.members || []) {
    if (!m.firstName || !m.lastName) continue
    const k = nameKey(m.firstName, m.lastName)
    if (!k) continue
    const entry = {
      source: 'flexmls',
      id: m.id,
      first_name: m.firstName,
      last_name: m.lastName,
      brokerage: m.office || m.company || '',
      license_number: m.licenseNumber || '',
      license_type: m.localType || '',
      associations: m.associations || [],
      idx_participant: !!m.idxParticipant,
      modified_at: m.modifiedAt || '',
      mailing_zip: (m.addresses || []).find((a) => a.primary)?.postalCode
        || (m.addresses || [])[0]?.postalCode || '',
      mailing_city: (m.addresses || []).find((a) => a.primary)?.city
        || (m.addresses || [])[0]?.city || '',
    }
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(entry)
  }
  return { byKey, total: data.members?.length || 0 }
}

async function loadOreaIndex() {
  if (!existsSync(OREA)) {
    console.warn(`[realtor-filter] WARN: ${OREA} not found — OREA layer skipped`)
    return { byKey: new Map(), total: 0 }
  }
  const text = await readFile(OREA, 'utf8')
  const rows = parseCsv(text)
  const header = rows.shift() || []
  const find = (label) => header.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase())
  const colLast = find('Last Name')
  const colFirst = find('First Name')
  const colCity = find('City')
  const colZip = find('Zip')
  const colCounty = find('County Name')
  const colLicType = find('License Type')
  const colLicNum = find('License Number')
  const colLicStatus = find('License Status')
  const colBusiness = find('Business Name')

  const byKey = new Map()
  let total = 0
  for (const r of rows) {
    if (!r || r.length === 0) continue
    if (String(r[colLicStatus] || '').trim().toUpperCase() !== 'ACTIVE') continue
    const city = String(r[colCity] || '').trim().toLowerCase()
    const zip = String(r[colZip] || '').trim().slice(0, 5)
    const county = String(r[colCounty] || '').trim().toLowerCase()
    const inDeschutes = DESCHUTES_CITIES.has(city) || DESCHUTES_ZIPS.has(zip) || county === 'deschutes'
    if (!inDeschutes) continue
    const k = nameKey(r[colFirst], r[colLast])
    if (!k) continue
    total += 1
    const entry = {
      source: 'orea',
      first_name: r[colFirst] || '',
      last_name: r[colLast] || '',
      brokerage: r[colBusiness] || '',
      license_number: r[colLicNum] || '',
      license_type: r[colLicType] || '',
      mailing_city: r[colCity] || '',
      mailing_zip: r[colZip] || '',
    }
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(entry)
  }
  return { byKey, total }
}

// ---- Matcher ---------------------------------------------------------

function tryMatch(idx, key1, key2, mailZip, siteZip) {
  let candidates = []
  if (idx.byKey.has(key1)) candidates = candidates.concat(idx.byKey.get(key1))
  if (key2 !== key1 && idx.byKey.has(key2)) candidates = candidates.concat(idx.byKey.get(key2))
  if (candidates.length === 0) return null

  if (candidates.length === 1) {
    return { match: candidates[0], confidence: 'high' }
  }
  if (candidates.length <= 5) {
    const z = candidates.find((c) => {
      const cz = String(c.mailing_zip || '').slice(0, 5)
      return cz && (cz === mailZip || cz === siteZip)
    })
    if (z) return { match: z, confidence: 'high-with-zip' }
    return { match: candidates[0], confidence: 'low-multiple' }
  }
  return { match: candidates[0], confidence: 'review-common-name' }
}

// ---- Main ------------------------------------------------------------

async function main() {
  console.log('[realtor-filter] loading sources')
  const [flex, orea] = await Promise.all([loadFlexmlsIndex(), loadOreaIndex()])
  console.log(`[realtor-filter] FlexMLS active COAR members: ${flex.total} (${flex.byKey.size} unique name keys)`)
  console.log(`[realtor-filter] OREA Deschutes-active licensees: ${orea.total} (${orea.byKey.size} unique name keys)`)

  console.log('[realtor-filter] loading master scored CSV')
  const text = await readFile(INPUT, 'utf8')
  const allRows = parseCsv(text)
  const header = allRows.shift() || []
  const idx = new Map(header.map((h, i) => [h, i]))
  const get = (row, name) => {
    const j = idx.get(name)
    return j == null ? '' : String(row[j] ?? '').trim()
  }

  const newCols = [
    'is_realtor_any',
    'realtor_sources',
    'realtor_brokerage',
    'realtor_license_number',
    'realtor_license_type',
    'realtor_match_confidence',
    'include_in_outreach',
    'include_in_outreach_reason',
    'include_in_fb_cas',
    'include_in_fb_cas_reason',
  ]
  const outHeaders = [...header, ...newCols]
  const outRows = []
  const stats = {
    total: 0,
    realtor_via_fub: 0,
    realtor_via_orea: 0,
    realtor_via_flexmls: 0,
    realtor_any: 0,
    realtor_sources_count: { fub_only: 0, orea_only: 0, flexmls_only: 0, fub_orea: 0, fub_flexmls: 0, orea_flexmls: 0, all_three: 0 },
    by_confidence: {},
    by_brokerage: {},
    outreach_included: 0,
    outreach_excluded: 0,
    outreach_exclusion_reasons: {},
    fb_cas_included: 0,
    fb_cas_excluded: 0,
    fb_cas_exclusion_reasons: {},
  }

  for (const r of allRows) {
    if (r.length < 5) continue
    const row = Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))
    stats.total += 1

    const ownerFirst = get(r, 'owner_first')
    const ownerLast = get(r, 'owner_last')
    const mailZip = get(r, 'mail_zip').slice(0, 5)
    const siteZip = get(r, 'site_zip').slice(0, 5)
    const key1 = nameKey(ownerFirst, ownerLast)
    const key2 = nameKey(ownerLast, ownerFirst)

    const flexHit = tryMatch(flex, key1, key2, mailZip, siteZip)
    const oreaHit = tryMatch(orea, key1, key2, mailZip, siteZip)
    const fubFlag = get(r, 'is_realtor_via_fub') === 'TRUE'
    const fubReason = get(r, 'realtor_reason') || ''

    if (fubFlag) stats.realtor_via_fub += 1
    if (oreaHit) stats.realtor_via_orea += 1
    if (flexHit) stats.realtor_via_flexmls += 1

    const sources = []
    if (fubFlag) sources.push('fub')
    if (oreaHit) sources.push('orea')
    if (flexHit) sources.push('flexmls')

    const is_realtor_any = sources.length > 0
    if (is_realtor_any) {
      stats.realtor_any += 1
      const key = sources.sort().join('_') === 'flexmls_fub_orea' ? 'all_three'
        : sources.length === 1 ? sources[0] + '_only'
        : sources.sort().join('_')
      stats.realtor_sources_count[key] = (stats.realtor_sources_count[key] || 0) + 1
    }

    // Pick best match (FlexMLS preferred > OREA > FUB)
    const best = flexHit || oreaHit || null
    const confidence = best?.confidence || (fubFlag ? 'fub-tag' : '')
    const brokerage = best?.match?.brokerage || ''
    const licenseNumber = best?.match?.license_number || ''
    const licenseType = best?.match?.license_type || ''
    if (confidence) stats.by_confidence[confidence] = (stats.by_confidence[confidence] || 0) + 1
    if (brokerage) stats.by_brokerage[brokerage] = (stats.by_brokerage[brokerage] || 0) + 1

    // Outreach inclusion — realtors INCLUDED. Entities and DNC still excluded.
    const classification = get(r, 'classification')
    let include_in_outreach = true
    let outreachReason = ''
    if (classification === 'ENTITY_OR_SKIP') {
      include_in_outreach = false
      outreachReason = 'entity_no_skiptrace'
    } else if (classification === 'DO_NOT_ENRICH') {
      include_in_outreach = false
      outreachReason = 'full_dnc'
    }

    // FB CAS inclusion — realtors EXCLUDED. Entities also excluded (no human).
    // Plus normal exclusions (DNC).
    let include_in_fb_cas = true
    let fbReason = ''
    if (is_realtor_any) {
      include_in_fb_cas = false
      fbReason = 'realtor'
    } else if (classification === 'ENTITY_OR_SKIP') {
      include_in_fb_cas = false
      fbReason = 'entity_no_human'
    } else if (classification === 'DO_NOT_ENRICH') {
      include_in_fb_cas = false
      fbReason = 'full_dnc'
    }

    if (include_in_outreach) stats.outreach_included += 1
    else { stats.outreach_excluded += 1; stats.outreach_exclusion_reasons[outreachReason] = (stats.outreach_exclusion_reasons[outreachReason] || 0) + 1 }
    if (include_in_fb_cas) stats.fb_cas_included += 1
    else { stats.fb_cas_excluded += 1; stats.fb_cas_exclusion_reasons[fbReason] = (stats.fb_cas_exclusion_reasons[fbReason] || 0) + 1 }

    outRows.push({
      ...row,
      is_realtor_any: is_realtor_any ? 'TRUE' : '',
      realtor_sources: sources.join(';'),
      realtor_brokerage: brokerage,
      realtor_license_number: licenseNumber,
      realtor_license_type: licenseType,
      realtor_match_confidence: confidence,
      include_in_outreach: include_in_outreach ? 'TRUE' : '',
      include_in_outreach_reason: outreachReason,
      include_in_fb_cas: include_in_fb_cas ? 'TRUE' : '',
      include_in_fb_cas_reason: fbReason,
    })
  }

  await writeFile(OUTPUT, rowsToCsv(outHeaders, outRows), 'utf8')
  await writeFile(SUMMARY, JSON.stringify(stats, null, 2), 'utf8')

  console.log('[realtor-filter] === Summary ===')
  console.log(`  Total rows                      : ${stats.total}`)
  console.log(`  Realtor via FUB                 : ${stats.realtor_via_fub}`)
  console.log(`  Realtor via OREA                : ${stats.realtor_via_orea}`)
  console.log(`  Realtor via FlexMLS             : ${stats.realtor_via_flexmls}`)
  console.log(`  Realtor (any source)            : ${stats.realtor_any}`)
  console.log(`  Source overlap:`)
  for (const [k, v] of Object.entries(stats.realtor_sources_count)) {
    console.log(`    ${k.padEnd(20)} ${v}`)
  }
  console.log(`  Match confidence distribution:`)
  for (const [k, v] of Object.entries(stats.by_confidence)) {
    console.log(`    ${k.padEnd(24)} ${v}`)
  }
  console.log(`\n  Outreach (FUB import / skip-trace):`)
  console.log(`    Included                     : ${stats.outreach_included}`)
  console.log(`    Excluded                     : ${stats.outreach_excluded}`)
  for (const [k, v] of Object.entries(stats.outreach_exclusion_reasons)) {
    console.log(`      ${k.padEnd(24)} ${v}`)
  }
  console.log(`\n  Facebook Custom Audience:`)
  console.log(`    Included                     : ${stats.fb_cas_included}`)
  console.log(`    Excluded                     : ${stats.fb_cas_excluded}`)
  for (const [k, v] of Object.entries(stats.fb_cas_exclusion_reasons)) {
    console.log(`      ${k.padEnd(24)} ${v}`)
  }
  console.log('\n  Top brokerages represented on west side (flagged owners):')
  for (const [b, c] of Object.entries(stats.by_brokerage).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`    ${String(b).slice(0, 50).padEnd(50)} ${c}`)
  }
  console.log(`\n[realtor-filter] Output: ${OUTPUT}`)
}

main().catch((err) => {
  console.error('[realtor-filter] FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
