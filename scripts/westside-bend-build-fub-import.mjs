#!/usr/bin/env node
/**
 * Build the final FUB-importable CSV for the west side Bend homeowner
 * campaign. Reads the fully-enriched master (04-master-realtor-flagged.csv)
 * and emits a CSV in Follow Up Boss's standard import shape with:
 *
 *   - First Name / Last Name / Email / Phone / Address / City / State / Zip
 *   - Source / Stage / Tags (semicolon-separated)
 *   - One column per custom field (Property Address, Purchase Price,
 *     Purchase Year, Estimated Market Value, Equity Pct, Seller Score,
 *     Years Owned, Brokerage, Realtor License)
 *
 * Handles three real-world cases on the same import:
 *   1. Already in FUB with full contact — included; FUB's dedupe merges and
 *      adds the new tags + custom fields without overwriting existing data
 *   2. In FUB or new, with phone/email blank — included so we have the row;
 *      tags will trigger any "Needs Enrichment" Smart List or automation
 *   3. Realtor — included with `industry:realtor`, `brokerage:<office>`,
 *      `exclude:fb-cas`; full skip-trace enrichment when available
 *
 * Stage logic:
 *   - All west-side homeowners get stage "Seller Prospect" UNLESS they are
 *     already an existing FUB contact in a more-engaged stage. The FUB
 *     import will overwrite stage on existing contacts if the column is
 *     set — so we leave Stage blank for any row matched to a FUB person
 *     in a stage other than Lead / Cold-Nurture, to avoid demoting an
 *     active client back to Seller Prospect.
 *
 * The FUB UI mass import (Admin > Import) is the recommended ingestion path:
 *   - Pre-creates custom fields if missing (with confirmation)
 *   - Tag merging is automatic
 *   - Dedupe on email OR phone+name
 *   - Stage overwrite is only applied when Stage column is non-empty
 *
 * Inputs (auto-resolved):
 *   - out/westside-bend-merge/06-master-enriched.csv when present (post BatchData)
 *   - else out/westside-bend-merge/04-master-realtor-flagged.csv
 *
 * Outputs:
 *   - out/westside-bend-merge/05-fub-import.csv (everyone-eligible-for-FUB,
 *     7,765 rows = 9,234 minus 1,469 entities)
 *   - out/westside-bend-merge/05a-fub-import-entities.csv (separate; the
 *     1,469 entity rows for direct-mail-only outreach — Matt may want to
 *     decide later whether to load these into FUB at all)
 *   - out/westside-bend-merge/summary-fub-import.json
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-build-fub-import.mjs
 *   node --env-file=.env.local scripts/westside-bend-build-fub-import.mjs --include-entities
 */

import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBrokerBrief } from './lib/westside-broker-brief.mjs'
import { deriveDemographicTags } from './lib/westside-demographics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT_DEFAULT = resolve(ROOT, 'out/westside-bend-merge/04-master-realtor-flagged.csv')
const INPUT_ENRICHED = resolve(ROOT, 'out/westside-bend-merge/06-master-enriched.csv')
const SUMMARY_ENRICHED = resolve(ROOT, 'out/westside-bend-merge/summary-enrichment.json')
const OUT_MAIN = resolve(ROOT, 'out/westside-bend-merge/05-fub-import.csv')
const OUT_ENT = resolve(ROOT, 'out/westside-bend-merge/05a-fub-import-entities.csv')
const SUMMARY = resolve(ROOT, 'out/westside-bend-merge/summary-fub-import.json')

// Stages we MUST NOT demote. If a row's existing FUB stage is in this set,
// leave the import Stage column blank so FUB won't overwrite.
const PROTECTED_STAGES = new Set([
  'A - Hot 1-3 Months',
  'B - Warm 3-6 Months',
  'C - Cold 6+ Months',
  'Active Client',
  'Pending',
  'Closed',
  'Past Client',
  'Sphere',
  'Real Estate Agent', // already a properly-tagged industry contact
  'Archive',
  'Trash',
])

const IMPORT_BATCH_TAG = process.env.IMPORT_BATCH_TAG?.trim() || 'import:westside-2026-05'

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

// ---- Tag derivation ---------------------------------------------------

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function deriveTags(r) {
  const tags = new Set()

  // Pure-expired rows (from expired-backfill, no county/westside data) get a
  // different batch tag and skip the westside-specific source tags.
  const isPureExpired = String(r.classification || '') === 'EXPIRED' && !r.purchase_date
  const hasExpiredData = !!(r.expired_status || r.expired_listing_key)

  if (isPureExpired) {
    tags.add('import:expired-backfill-2026')
    tags.add('source:expired-listing-mls')
  } else {
    tags.add(IMPORT_BATCH_TAG)
    tags.add('source:county-assessor')
    tags.add('area:bend-westside')
  }

  // Expired-listing overlay — applies to BOTH westside-matched expireds AND
  // pure-expired rows so the smart list filter on intent:expired-listing
  // picks up every contact whose listing expired in 2026.
  if (hasExpiredData) {
    tags.add('intent:expired-listing')
    if (r.expired_status) tags.add(`expired-status:${String(r.expired_status).toLowerCase()}`)
    if (r.expired_listing_key) tags.add(`expired-mls:${r.expired_listing_key}`)
    if (r.expired_status_change_date) tags.add(`expired-detected:${r.expired_status_change_date}`)
    if (r.owner_lookup_status) tags.add(`owner-lookup:${r.owner_lookup_status}`)
  }

  // Area + neighborhood
  if (r.city_slug) tags.add(`city:${r.city_slug}`)
  if (r.neighborhood_slug) tags.add(`neighborhood:${r.neighborhood_slug}`)
  if (r.planned_community_slug) tags.add(`neighborhood:${r.planned_community_slug}`)
  if (r.subdivision_slug) tags.add(`subdivision:${r.subdivision_slug}`)

  // Owner type (canonical + west-side specific)
  if (r.is_entity === 'TRUE') {
    tags.add('owner:entity')
    tags.add('contact:direct-mail-only')
  } else if (r.is_out_of_state === 'TRUE') {
    tags.add('owner:absentee-outofstate')
    tags.add('owner:absentee')
    tags.add('geo:out-of-state')
  } else if (r.is_absentee === 'TRUE') {
    tags.add('owner:absentee-local')
    tags.add('owner:absentee')
    if (r.mailing_in_state === 'TRUE' && r.mailing_in_deschutes !== 'TRUE') {
      tags.add('geo:out-of-area')
    } else {
      tags.add('geo:local')
    }
  } else {
    tags.add('owner:occupied')
    tags.add('geo:local')
  }

  // Legacy state tags (keep for backward compat with existing smart lists)
  const mailState = String(r.mail_state || '').toUpperCase()
  if (mailState === 'OR') tags.add('state:in-state')
  else if (mailState) tags.add('state:out-of-state')

  // Tenure (bucket + canonical long-term / recent)
  if (r.score_tenure_bucket) tags.add(`tenure:${r.score_tenure_bucket}`)
  else if (r.tenure_bucket) tags.add(`tenure:${r.tenure_bucket}`)
  const yrs = Number(r.years_owned)
  if (Number.isFinite(yrs)) {
    if (yrs >= 8) tags.add('tenure:long-term')
    if (yrs <= 3) tags.add('tenure:recent')
  }

  // Equity (bucket tag + high-equity legacy alias)
  if (r.equity_bucket && r.equity_bucket !== 'unknown') {
    const eqSlug = String(r.equity_bucket).replace(/_/g, '-')
    tags.add(`equity:${eqSlug}`)
    if (eqSlug === 'high' || eqSlug === 'very-high') tags.add('equity:high')
  }

  // Score
  if (r.score_band) tags.add(`seller-score:${r.score_band}`)

  // Lifecycle
  if (r.score_lifecycle_tags) {
    for (const t of String(r.score_lifecycle_tags).split('; ').filter(Boolean)) {
      tags.add(t)
    }
  }

  // BatchData demographics + life events (no-ops until enrichment lands)
  for (const t of deriveDemographicTags(r)) tags.add(t)

  // Contact channels (county FUB match + BatchData enrichment)
  const email = String(r.fub_email || r.enriched_email || '').trim()
  const phone = String(r.fub_phone || r.enriched_phone || '').trim()
  if (email) tags.add('contact:has-email')
  if (phone) tags.add('contact:has-phone')
  if (!email && !phone && r.is_entity !== 'TRUE') tags.add('contact:needs-enrichment')
  if (r.is_entity === 'TRUE') tags.add('contact:direct-mail-only')
  if (r.fub_email_blocked === 'TRUE') tags.add('contact:do-not-email')
  if (r.fub_phone_blocked === 'TRUE') tags.add('contact:do-not-call')

  // TCPA / DNC / deceased — from BatchData enrichment.
  // See memory `reference_tcpa_litigator_handling.md`. compliance:hard-stop
  // is in every smart list's exclude group → auto-skips all blasts.
  if (r.enriched_litigator === 'TRUE') {
    tags.add('contact:do-not-text')
    tags.add('contact:do-not-call')
    tags.add('compliance:hard-stop')
    tags.add('tcpa:litigator')
    tags.add('exclude:fb-cas')
    tags.add('exclude:seller-automation')
    tags.add('exclude:buyer-automation')
  }
  if (r.enriched_tcpa_dnc === 'TRUE') {
    tags.add('contact:do-not-text')
    tags.add('contact:do-not-call')
    tags.add('compliance:dnc-registry')
  }
  if (r.enriched_all_phones_dnc === 'TRUE') {
    tags.add('contact:do-not-call')
  }
  if (r.enriched_deceased === 'TRUE') {
    tags.add('compliance:deceased')
    tags.add('compliance:hard-stop')
    tags.add('exclude:fb-cas')
    tags.add('exclude:seller-automation')
    tags.add('exclude:buyer-automation')
  }

  // NeverBounce email validation results (per memory reference_tcpa_litigator_handling.md
  // pattern — Bounced is FUB's canonical do-not-email gate, in every smart list exclude group).
  const nbResult = String(r.nb_result || '').toLowerCase()
  if (nbResult === 'invalid') {
    tags.add('email:invalid')
    tags.add('Bounced') // FUB system tag — auto-excluded from every email send
    tags.add('contact:do-not-email')
  } else if (nbResult === 'catchall') {
    tags.add('email:catchall')
  } else if (nbResult === 'unknown') {
    tags.add('email:unverified')
  } else if (nbResult === 'valid') {
    tags.add('email:valid')
  } else if (nbResult === 'disposable') {
    tags.add('email:disposable')
    tags.add('Bounced')
    tags.add('contact:do-not-email')
  }

  // Realtor / industry — CRM yes, seller/buyer LP + FB CAS no
  if (r.is_realtor_any === 'TRUE') {
    tags.add('industry:realtor')
    tags.add('audience:broker-recruit')
    tags.add('exclude:fb-cas')
    tags.add('exclude:seller-automation')
    tags.add('exclude:buyer-automation')
    if (r.realtor_brokerage) tags.add(`brokerage:${slugify(r.realtor_brokerage)}`)
    if (r.realtor_sources) {
      for (const s of String(r.realtor_sources).split(';').filter(Boolean)) tags.add(`realtor-source:${s}`)
    }
  }

  // FB CAS membership
  if (r.include_in_fb_cas === 'TRUE') tags.add('fb-audience:westside-all')

  return Array.from(tags).sort()
}

// ---- Stage logic ------------------------------------------------------

function deriveStage(r) {
  const existingStage = String(r.fub_stage || '').trim()
  if (r.is_realtor_any === 'TRUE') {
    // Keep existing stage (often Real Estate Agent). Do not demote or promote.
    return existingStage && PROTECTED_STAGES.has(existingStage) ? '' : (existingStage || 'Real Estate Agent')
  }
  // If the existing FUB stage is in the protected set, leave blank so we
  // don't demote an active client.
  if (existingStage && PROTECTED_STAGES.has(existingStage)) return ''
  return 'Seller Prospect'
}

// ---- Main -------------------------------------------------------------

const FUB_HEADERS = [
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Address',
  'City',
  'State',
  'Zip',
  'Source',
  'Stage',
  'Tags',
  // Custom fields (named exactly per FUB Admin > Custom Fields)
  'Custom Property Address',
  'Custom Purchase Price',
  'Custom Purchase Year',
  'Custom Estimated Market Value',
  'Custom Equity Pct',
  'Custom Seller Score',
  'Custom Years Owned',
  'Custom Brokerage',
  'Custom Realtor License',
  'Custom Realtor License Type',
  'Custom APN',
  'Custom Subdivision',
  'Custom Neighborhood',
  'Custom Planned Community',
  'Custom Bedrooms',
  'Custom Baths',
  'Custom Building Sqft',
  'Custom Lot Acres',
  'Custom Year Built',
  'Custom Last Purchase Date',
  // Internal — keep our own classifications visible in the import so Matt can
  // sort and filter on these even before Smart Lists are built.
  'Custom Classification',
  'Custom Seller Score Band',
  'Custom Include In FB CAS',
  'Custom Owner Age',
  'Custom Owner Age Range',
  'Custom Birthday',
  'Custom Gender',
  'Custom Marital Status',
  'Custom Household Size',
  'Custom Has Children',
  'Custom Occupation',
  'Custom Income Range',
  'Custom Net Worth Range',
  'Custom Phone Type',
  'Custom Enrichment Provider',
  'Custom Recently Moved',
  'Custom Recently Divorced',
  'Background',
]

function formatHasChildren(r) {
  const v = String(r.enriched_presence_of_children || '').trim().toUpperCase()
  if (v === 'TRUE' || v === 'Y' || v === 'YES') return 'Yes'
  if (v === 'FALSE' || v === 'N' || v === 'NO') return 'No'
  return ''
}

function mapRowToFub(r) {
  const tags = deriveTags(r)
  const stage = deriveStage(r)
  const briefRow = { ...r, import_batch: IMPORT_BATCH_TAG }
  return {
    'First Name': r.owner_first || '',
    'Last Name': r.owner_last || '',
    'Email': r.fub_email || r.enriched_email || '',
    'Phone': r.fub_phone || r.enriched_phone || '',
    'Address': r.mail_address || '',
    'City': r.mail_city || '',
    'State': r.mail_state || '',
    'Zip': r.mail_zip || '',
    'Source': 'County Assessor — West Side Bend 2026-05',
    'Stage': stage,
    'Tags': tags.join('; '),
    'Custom Property Address': r.site_address ? `${r.site_address}, ${r.site_city || ''}, ${r.site_state || ''} ${r.site_zip || ''}`.trim() : '',
    'Custom Purchase Price': r.purchase_price || '',
    'Custom Purchase Year': r.purchase_date ? r.purchase_date.slice(0, 4) : '',
    'Custom Estimated Market Value': r.market_value || '',
    'Custom Equity Pct': r.equity_pct ?? r.score_equity_pct ?? '',
    'Custom Seller Score': r.score_total || '',
    'Custom Years Owned': r.years_owned || '',
    'Custom Brokerage': r.realtor_brokerage || '',
    'Custom Realtor License': r.realtor_license_number || '',
    'Custom Realtor License Type': r.realtor_license_type || '',
    'Custom APN': r.apn || '',
    'Custom Subdivision': r.subdivision_label || r.subdivision || '',
    'Custom Neighborhood': r.neighborhood_label || '',
    'Custom Planned Community': r.planned_community_label || '',
    'Custom Bedrooms': r.bedrooms || '',
    'Custom Baths': r.baths || '',
    'Custom Building Sqft': r.building_sqft || '',
    'Custom Lot Acres': r.acreage || '',
    'Custom Year Built': r.year_built || '',
    'Custom Last Purchase Date': r.purchase_date || '',
    'Custom Classification': r.classification || '',
    'Custom Seller Score Band': r.score_band || '',
    'Custom Include In FB CAS': r.include_in_fb_cas || '',
    'Custom Owner Age': r.enriched_age || '',
    'Custom Owner Age Range': r.enriched_age_range || '',
    'Custom Birthday': r.enriched_dob || '',
    'Custom Gender': r.enriched_gender || '',
    'Custom Marital Status': r.enriched_marital_status || '',
    'Custom Household Size': r.enriched_household_size || '',
    'Custom Has Children': formatHasChildren(r),
    'Custom Occupation': r.enriched_occupation || '',
    'Custom Income Range': r.enriched_income_range || '',
    'Custom Net Worth Range': r.enriched_net_worth || '',
    'Custom Phone Type': r.enriched_phone_type || '',
    'Custom Enrichment Provider': r.enrichment_provider || '',
    'Custom Recently Moved': r.enriched_flag_recently_moved === 'TRUE' ? 'Yes' : '',
    'Custom Recently Divorced': r.enriched_flag_recently_divorced === 'TRUE' ? 'Yes' : '',
    'Background': buildBrokerBrief(briefRow),
  }
}

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

async function resolveInput(args) {
  if (args.input) return resolve(ROOT, args.input)
  if (args.enriched) return INPUT_ENRICHED
  try {
    const summaryText = await readFile(SUMMARY_ENRICHED, 'utf8')
    const summary = JSON.parse(summaryText)
    if (Number(summary.matched) > 0) {
      await access(INPUT_ENRICHED, constants.R_OK)
      return INPUT_ENRICHED
    }
  } catch {
    // No successful enrichment run yet — use county master.
  }
  return INPUT_DEFAULT
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const includeEntities = Boolean(args['include-entities'])
  const inputPath = await resolveInput(args)

  const text = await readFile(inputPath, 'utf8')
  const allRows = parseCsv(text)
  const header = allRows.shift() || []

  const mainRows = []
  const entRows = []
  const stats = {
    total: 0,
    main_rows: 0,
    entity_rows: 0,
    realtor_rows: 0,
    by_stage: {},
    by_score_band: {},
    has_email: 0,
    has_phone: 0,
    has_neither: 0,
    needs_enrichment: 0,
    with_demographics: 0,
    input_file: inputPath,
  }

  for (const arr of allRows) {
    if (arr.length < 5) continue
    const r = Object.fromEntries(header.map((h, i) => [h, arr[i] ?? '']))
    stats.total += 1

    const isEntity = r.classification === 'ENTITY_OR_SKIP'
    const target = isEntity ? entRows : mainRows
    if (!isEntity) stats.main_rows += 1
    else stats.entity_rows += 1
    if (r.is_realtor_any === 'TRUE') stats.realtor_rows += 1

    const fubRow = mapRowToFub(r)
    target.push(fubRow)
    stats.by_stage[fubRow.Stage || '(blank — protected)'] = (stats.by_stage[fubRow.Stage || '(blank — protected)'] || 0) + 1
    stats.by_score_band[r.score_band || '(unknown)'] = (stats.by_score_band[r.score_band || '(unknown)'] || 0) + 1
    if (fubRow.Email) stats.has_email += 1
    if (fubRow.Phone) stats.has_phone += 1
    if (!fubRow.Email && !fubRow.Phone) stats.has_neither += 1
    if (!fubRow.Email && !fubRow.Phone && !isEntity) stats.needs_enrichment += 1
    if (r.enriched_age || r.enriched_age_range || r.enrichment_matched === 'TRUE') stats.with_demographics += 1
  }

  // If include-entities flag set, merge them into the main file (rare —
  // mostly we want them separate so Matt can decide direct-mail-only).
  if (includeEntities) {
    mainRows.push(...entRows)
    stats.main_rows += stats.entity_rows
  }

  await writeFile(OUT_MAIN, rowsToCsv(FUB_HEADERS, mainRows), 'utf8')
  if (!includeEntities) await writeFile(OUT_ENT, rowsToCsv(FUB_HEADERS, entRows), 'utf8')
  await writeFile(SUMMARY, JSON.stringify(stats, null, 2), 'utf8')

  console.log('[fub-import] === Summary ===')
  console.log(`  Input file                       : ${inputPath}`)
  console.log(`  Total source rows                : ${stats.total}`)
  console.log(`  Main FUB import file (non-entity): ${stats.main_rows}`)
  if (!includeEntities) console.log(`  Entity import file (separate)    : ${stats.entity_rows}`)
  console.log(`  Realtor rows (industry-tagged)   : ${stats.realtor_rows}`)
  console.log(`  Email on file                    : ${stats.has_email}`)
  console.log(`  Phone on file                    : ${stats.has_phone}`)
  console.log(`  Missing both (needs enrichment)  : ${stats.needs_enrichment}`)
  console.log(`  Rows with BatchData demographics   : ${stats.with_demographics}`)
  console.log(`  Stage distribution:`)
  for (const [k, v] of Object.entries(stats.by_stage)) {
    console.log(`    ${k.padEnd(36)} ${v}`)
  }
  console.log(`  Score band distribution:`)
  for (const [k, v] of Object.entries(stats.by_score_band).sort()) {
    console.log(`    ${k.padEnd(12)} ${v}`)
  }
  console.log(`[fub-import] Main file: ${OUT_MAIN}`)
  if (!includeEntities) console.log(`[fub-import] Entity file: ${OUT_ENT}`)
  console.log(`[fub-import] Summary: ${SUMMARY}`)

  console.log(`\n[fub-import] Pre-import checklist (do once in FUB Admin):`)
  console.log(`  1. Stages → add "Seller Prospect"`)
  console.log(`  2. Custom Fields → create these (matching column names):`)
  console.log(`      - Property Address (Text)`)
  console.log(`      - Purchase Price (Number)`)
  console.log(`      - Purchase Year (Number)`)
  console.log(`      - Estimated Market Value (Number)`)
  console.log(`      - Equity Pct (Number)`)
  console.log(`      - Seller Score (Number)`)
  console.log(`      - Years Owned (Number)`)
  console.log(`      - Brokerage (Text)`)
  console.log(`      - Realtor License (Text)`)
  console.log(`      - Realtor License Type (Text)`)
  console.log(`      - APN (Text)`)
  console.log(`      - Subdivision (Text)`)
  console.log(`      - Neighborhood (Text)`)
  console.log(`      - Planned Community (Text)`)
  console.log(`      - Bedrooms (Number)`)
  console.log(`      - Baths (Number)`)
  console.log(`      - Building Sqft (Number)`)
  console.log(`      - Lot Acres (Number)`)
  console.log(`      - Year Built (Number)`)
  console.log(`      - Last Purchase Date (Date)`)
  console.log(`      - Classification (Text)`)
  console.log(`      - Seller Score Band (Text)`)
  console.log(`      - Include In FB CAS (Text)`)
  console.log(`      - Owner Age, Owner Age Range, Birthday, Gender, Marital Status`)
  console.log(`      - Household Size, Has Children, Occupation, Income Range, Net Worth Range`)
  console.log(`      - Phone Type, Enrichment Provider, Recently Moved, Recently Divorced`)
  console.log(`  3. Run: node --env-file=.env.local scripts/westside-bend-fub-provision.mjs --apply`)
  console.log(`  4. Run: node --env-file=.env.local scripts/westside-bend-fub-smart-lists.mjs --apply`)
  console.log(`  5. Admin → Import → upload ${OUT_MAIN}`)
}

main().catch((err) => {
  console.error('[fub-import] FATAL:', err.message)
  console.error(err.stack)
  process.exit(1)
})
