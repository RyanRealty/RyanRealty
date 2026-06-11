#!/usr/bin/env node
/**
 * Enrich west-side Bend homeowner records via the BatchData API. Fills in
 * mobile phone, email, age range, gender, marital status, household size,
 * presence of children, occupation tier, income bracket, net worth, plus a
 * recently-divorced / recently-moved / equity-rich flag set when available.
 *
 * Input: out/westside-bend-merge/04-master-realtor-flagged.csv
 *        (the fully-classified master CSV; we enrich every row with
 *        include_in_outreach=TRUE that doesn't already have phone AND email)
 *
 * Output: out/westside-bend-merge/06-master-enriched.csv
 *         out/westside-bend-merge/batchdata-raw-responses.jsonl
 *         out/westside-bend-merge/summary-enrichment.json
 *
 * Required environment variables (set in .env.local):
 *   BATCHDATA_API_KEY  — get one at https://batchdata.io (pay-per-match plan
 *                        is fine, ~$0.07/record for our volume).
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-enrich-batchdata.mjs --dry-run
 *   node --env-file=.env.local scripts/westside-bend-enrich-batchdata.mjs --limit 25
 *   node --env-file=.env.local scripts/westside-bend-enrich-batchdata.mjs --apply
 *
 * The script is idempotent: it skips any row we already enriched (rows where
 * `enrichment_provider` is non-empty from a prior run) unless --force is set.
 *
 * Pricing safety: every run prints the projected cost before sending any
 * batches. Use --max-spend $50 to cap a run; the script aborts before
 * exceeding the cap.
 */

import { readFile, writeFile, appendFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, 'out/westside-bend-merge/04-master-realtor-flagged.csv')
const OUTPUT = resolve(ROOT, 'out/westside-bend-merge/06-master-enriched.csv')
const RAW = resolve(ROOT, 'out/westside-bend-merge/batchdata-raw-responses.jsonl')
const SUMMARY = resolve(ROOT, 'out/westside-bend-merge/summary-enrichment.json')

const COST_PER_MATCH_USD = 0.07
const BATCH_SIZE = 100
const REQUEST_TIMEOUT_MS = 60000

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    const eq = t.indexOf('=')
    if (eq > -1) { out[t.slice(2, eq)] = t.slice(eq + 1); continue }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { out[t.slice(2)] = next; i += 1 }
    else { out[t.slice(2)] = true }
  }
  return out
}

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

// ---- BatchData API ----------------------------------------------------

const BATCHDATA_BASE = 'https://api.batchdata.com/api/v1'

// BatchData skip-trace endpoint takes a "requests" array of property+person
// payloads. Each entry returns one match (or null).
//
// Reference: https://docs.batchdata.com/reference/skip-trace
async function callBatchDataSkipTrace(apiKey, batch) {
  const body = {
    requests: batch.map((p) => ({
      propertyAddress: {
        street: p.site_address,
        city: p.site_city,
        state: p.site_state,
        zip: String(p.site_zip || '').slice(0, 5),
      },
      mailingAddress: p.mail_address && p.mail_address !== p.site_address
        ? {
            street: p.mail_address,
            city: p.mail_city,
            state: p.mail_state,
            zip: String(p.mail_zip || '').slice(0, 5),
          }
        : undefined,
      name: {
        first: p.owner_first,
        last: p.owner_last,
      },
    })),
  }
  const ctl = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const res = await fetch(`${BATCHDATA_BASE}/property/skip-trace`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: ctl,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`BatchData HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// Map a single BatchData response back into per-row enrichment fields.
function extractEnrichment(response, originalIndex) {
  if (!response) return null
  // BatchData responses include:
  //   - emails:        array of { email, tested }                       — note: `email` not `address`
  //   - phoneNumbers:  array of { number, type, carrier, tested,
  //                               reachable, dnc, lastReportedDate, score } — note: `phoneNumbers` not `phones`
  //   - demographics:  { age, ageRange, gender, maritalStatus, householdSize,
  //                      presenceOfChildren, occupation, income, netWorth }
  //   - flags:         { recentlyMoved, recentlyDivorced, equityRich, vacant }
  //
  // CRITICAL: BatchData wraps everything under `response.results.persons[]`.
  // This function receives the per-person object (one persons[] entry), so
  // we read fields directly off it.
  const emails = (response.emails || []).filter((e) => e?.email)
  const primaryEmail = emails[0]?.email || ''
  const phones = (response.phoneNumbers || []).filter((p) => p?.number && !p.dnc)
  // Prefer non-DNC, then reachable, then highest score
  const sortedPhones = phones.slice().sort((a, b) => (b.score || 0) - (a.score || 0))
  const mobile = sortedPhones.find((p) => /mobile|cell/i.test(p.type || ''))
  const primaryPhone = (mobile || sortedPhones[0])?.number || ''
  const primaryPhoneType = (mobile || sortedPhones[0])?.type || ''
  const d = response.demographics || {}
  const f = response.flags || {}
  const dobRaw = d.birthDate || d.dateOfBirth || d.dob || d.birthday || ''

  // TCPA / DNC / litigator handling — see reference_tcpa_litigator_handling.md
  // BatchData $0.07 skip-trace exposes: litigator (top-level), dnc.tcpa,
  // per-phone dnc, death.deceased. These map to FUB hard-stop tags in the
  // build script's deriveTags so they auto-exclude from every smart list.
  const isLitigator = response.litigator === true
  const tcpaDnc = response.dnc?.tcpa === true
  const isDeceased = response.death?.deceased === true
  // If ALL returned phones are DNC-flagged → person is fully DNC on phone
  const rawPhones = response.phoneNumbers || []
  const allPhonesDnc = rawPhones.length > 0 && rawPhones.every((p) => p?.dnc === true)
  // Mailing address (USPS-verified) — better than what we had from county
  const ma = response.mailingAddress || {}

  return {
    enrichment_provider: 'batchdata',
    enrichment_matched: emails.length > 0 || phones.length > 0 ? 'TRUE' : '',
    enriched_email: primaryEmail,
    enriched_phone: primaryPhone,
    enriched_phone_type: primaryPhoneType,
    enriched_phone_count: phones.length,
    enriched_email_count: emails.length,
    enriched_litigator: isLitigator ? 'TRUE' : '',
    enriched_tcpa_dnc: tcpaDnc ? 'TRUE' : '',
    enriched_deceased: isDeceased ? 'TRUE' : '',
    enriched_all_phones_dnc: allPhonesDnc ? 'TRUE' : '',
    enriched_mailing_street: ma.street || '',
    enriched_mailing_city: ma.city || '',
    enriched_mailing_state: ma.state || '',
    enriched_mailing_zip: ma.zip || '',
    enriched_age: d.age || '',
    enriched_age_range: d.ageRange || '',
    enriched_dob: dobRaw ? String(dobRaw).slice(0, 10) : '',
    enriched_gender: d.gender || '',
    enriched_marital_status: d.maritalStatus || '',
    enriched_household_size: d.householdSize || '',
    enriched_presence_of_children: d.presenceOfChildren || '',
    enriched_occupation: d.occupation || '',
    enriched_income_range: d.income || '',
    enriched_net_worth: d.netWorth || '',
    enriched_flag_recently_moved: f.recentlyMoved ? 'TRUE' : '',
    enriched_flag_recently_divorced: f.recentlyDivorced ? 'TRUE' : '',
    enriched_flag_equity_rich: f.equityRich ? 'TRUE' : '',
  }
}

// ---- Main -------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = !!args['dry-run']
  const limit = args.limit ? Number(args.limit) : Infinity
  const maxSpend = args['max-spend'] ? Number(args['max-spend']) : Infinity
  const force = !!args.force

  const apiKey = (process.env.BATCHDATA_API_KEY || '').trim()
  if (!apiKey && !dryRun) {
    console.error(`
[batchdata] Missing BATCHDATA_API_KEY in .env.local.

Sign up at https://batchdata.io:
  1. Create account (no credit card required to view dashboard)
  2. Choose Pay-Per-Match plan ($0.07/record, no minimum, no subscription)
  3. Generate API key in dashboard → API Keys
  4. Add BATCHDATA_API_KEY=<your-key> to .env.local
  5. Re-run this script

Or use --dry-run to preview what would be enriched without an API key.
`)
    process.exit(1)
  }

  // Load master CSV — defaults to INPUT but accepts --input override
  const inputPath = args.input ? resolve(ROOT, args.input) : INPUT
  console.log(`[batchdata] Input: ${inputPath}`)
  const text = await readFile(inputPath, 'utf8')
  const allRows = parseCsv(text)
  const header = allRows.shift() || []
  const idx = new Map(header.map((h, i) => [h, i]))
  const get = (row, name) => {
    const j = idx.get(name)
    return j == null ? '' : String(row[j] ?? '').trim()
  }

  // Find rows needing enrichment
  // - include_in_outreach must be TRUE (covers all non-entity, non-full-DNC)
  // - Either phone OR email missing (and not blocked)
  // - Skip rows already enriched unless --force
  const candidates = []
  const rowsForOutput = []
  for (let i = 0; i < allRows.length; i += 1) {
    const arr = allRows[i]
    if (arr.length < 5) continue
    const r = Object.fromEntries(header.map((h, j) => [h, arr[j] ?? '']))
    rowsForOutput.push(r)
    if (r.include_in_outreach !== 'TRUE') continue
    const hasEmail = !!r.fub_email
    const hasPhone = !!r.fub_phone
    if (hasEmail && hasPhone) continue
    // Already enriched in a prior run?
    if (!force && r.enrichment_provider) continue
    candidates.push({ outIndex: rowsForOutput.length - 1, ...r })
  }

  const selectedCount = Math.min(candidates.length, limit)
  const projectedCost = (selectedCount * COST_PER_MATCH_USD).toFixed(2)
  console.log(`[batchdata] Eligible rows for enrichment: ${candidates.length}`)
  console.log(`[batchdata] Will process: ${selectedCount} (limit=${limit})`)
  console.log(`[batchdata] Projected cost @ $${COST_PER_MATCH_USD}/match: $${projectedCost}`)

  if (Number(projectedCost) > maxSpend) {
    console.error(`[batchdata] Projected cost exceeds --max-spend ${maxSpend}. Aborting.`)
    process.exit(2)
  }
  if (dryRun) {
    const breakdown = {
      eligible: candidates.length,
      willProcess: selectedCount,
      projectedCostUsd: Number(projectedCost),
      costPerMatchUsd: COST_PER_MATCH_USD,
      needsEmailOnly: candidates.filter((c) => !c.fub_email && c.fub_phone).length,
      needsPhoneOnly: candidates.filter((c) => c.fub_email && !c.fub_phone).length,
      needsBoth: candidates.filter((c) => !c.fub_email && !c.fub_phone).length,
      realtorsInPool: candidates.filter((c) => c.is_realtor_any === 'TRUE').length,
      nonRealtorsInPool: candidates.filter((c) => c.is_realtor_any !== 'TRUE').length,
      entitiesSkipped: rowsForOutput.filter((r) => r.classification === 'ENTITY_OR_SKIP').length,
      fullDncSkipped: rowsForOutput.filter((r) => r.fub_dnc === 'TRUE').length,
      note: 'BatchData bills per API request sent, not per successful match. Actual spend may be lower if match rate < 100%.',
    }
    console.log(`[batchdata] --dry-run cost estimate:`)
    console.log(JSON.stringify(breakdown, null, 2))
    await writeFile(SUMMARY.replace('.json', '-estimate.json'), JSON.stringify(breakdown, null, 2), 'utf8')
    console.log(`[batchdata] Wrote ${SUMMARY.replace('.json', '-estimate.json')}`)
    console.log(`[batchdata] --dry-run set, exiting without API calls.`)
    process.exit(0)
  }

  // Process in batches
  const t0 = Date.now()
  let processed = 0
  let matched = 0
  let phoneCount = 0
  let emailCount = 0
  const errors = []

  // Capture original header order for the output (preserve all 04- columns +
  // append enrichment columns)
  const enrichmentColumns = [
    'enrichment_provider',
    'enrichment_matched',
    'enriched_email',
    'enriched_phone',
    'enriched_phone_type',
    'enriched_phone_count',
    'enriched_email_count',
    'enriched_litigator',
    'enriched_tcpa_dnc',
    'enriched_deceased',
    'enriched_all_phones_dnc',
    'enriched_mailing_street',
    'enriched_mailing_city',
    'enriched_mailing_state',
    'enriched_mailing_zip',
    'enriched_age',
    'enriched_age_range',
    'enriched_dob',
    'enriched_gender',
    'enriched_marital_status',
    'enriched_household_size',
    'enriched_presence_of_children',
    'enriched_occupation',
    'enriched_income_range',
    'enriched_net_worth',
    'enriched_flag_recently_moved',
    'enriched_flag_recently_divorced',
    'enriched_flag_equity_rich',
  ]
  const outHeader = [...header.filter((h) => !enrichmentColumns.includes(h)), ...enrichmentColumns]

  for (let off = 0; off < selectedCount; off += BATCH_SIZE) {
    const slice = candidates.slice(off, Math.min(off + BATCH_SIZE, selectedCount))
    let response
    try {
      response = await callBatchDataSkipTrace(apiKey, slice)
      await appendFile(RAW, slice.map((s, i) => JSON.stringify({ candidate: s, response: response?.results?.persons?.[i] || null })).join('\n') + '\n', 'utf8')
    } catch (err) {
      errors.push({ batch: off, error: err.message })
      console.error(`[batchdata] batch ${off} failed: ${err.message}`)
      continue
    }

    const results = response?.results?.persons || []
    for (let i = 0; i < slice.length; i += 1) {
      processed += 1
      const enr = extractEnrichment(results[i], slice[i].outIndex)
      if (!enr) continue
      if (enr.enrichment_matched === 'TRUE') matched += 1
      if (enr.enriched_phone) phoneCount += 1
      if (enr.enriched_email) emailCount += 1
      Object.assign(rowsForOutput[slice[i].outIndex], enr)
    }
    console.log(`[batchdata] processed ${processed}/${selectedCount} matched=${matched} phone=${phoneCount} email=${emailCount}`)
    await new Promise((r) => setTimeout(r, 250))
  }

  await writeFile(OUTPUT, rowsToCsv(outHeader, rowsForOutput), 'utf8')

  const summary = {
    completedAt: new Date().toISOString(),
    elapsedSeconds: Math.round((Date.now() - t0) / 1000),
    provider: 'batchdata',
    eligible: candidates.length,
    processed,
    matched,
    phoneCount,
    emailCount,
    estimatedCostUsd: Number((processed * COST_PER_MATCH_USD).toFixed(2)),
    matchRate: processed > 0 ? Number(((matched / processed) * 100).toFixed(1)) : 0,
    phoneRate: processed > 0 ? Number(((phoneCount / processed) * 100).toFixed(1)) : 0,
    emailRate: processed > 0 ? Number(((emailCount / processed) * 100).toFixed(1)) : 0,
    errors: errors.length,
  }
  await writeFile(SUMMARY, JSON.stringify(summary, null, 2), 'utf8')

  console.log('\n[batchdata] === Summary ===')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`\n[batchdata] Output: ${OUTPUT}`)
  console.log(`[batchdata] Raw responses: ${RAW}`)
}

main().catch((err) => {
  console.error('[batchdata] FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
