#!/usr/bin/env node
/**
 * scripts/meta-upload-mls-audiences.mjs
 *
 * Pushes 3 Meta Custom Audiences from a parcel/assessor CSV export:
 *
 *   1. "RR MLS — Bend Property Owners (all)"     — every deduped owner
 *   2. "RR MLS — 97703 Property Owners"          — Site Zip = 97703
 *   3. "RR MLS — Absentee Owners (Bend area)"    — Mailing City ≠ Site City
 *
 * Match keys per Meta spec (FN, LN, CT, ST, ZIP) — Meta's multi-key
 * schema for non-email/phone records. Each value individually SHA-256
 * hashed after Meta's normalization rules (lowercase, no whitespace,
 * digits-only for zip, 2-letter for state).
 *
 * Dedup: by (first_name + last_name + mailing_zip) — collapses owners
 * who hold multiple parcels at the same mailing address.
 *
 * Privacy: all PII is hashed server-side before any network call. Meta
 * never receives plaintext names. The raw CSV stays local — does NOT get
 * committed (data/ + Downloads/ are gitignored).
 *
 * Usage:
 *   vercel env pull .env.tmp --environment=production --yes
 *   set -a && source .env.tmp && set +a
 *   node scripts/meta-upload-mls-audiences.mjs --dry-run                       # see counts
 *   node scripts/meta-upload-mls-audiences.mjs --csv "/path/to/export.csv"     # apply
 *   rm .env.tmp
 *
 * Default CSV path: ~/Downloads/export (1).csv (fallback to export.csv).
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const DRY_RUN = process.argv.includes('--dry-run')
let csvPath = null
const csvIdx = process.argv.indexOf('--csv')
if (csvIdx > -1) csvPath = process.argv[csvIdx + 1]
if (!csvPath) {
  const candidates = [
    join(homedir(), 'Downloads', 'export (1).csv'),
    join(homedir(), 'Downloads', 'export.csv'),
  ]
  csvPath = candidates.find(p => existsSync(p))
}
if (!csvPath || !existsSync(csvPath)) {
  console.error(`CSV not found. Tried defaults under ~/Downloads. Use --csv <path>.`)
  process.exit(1)
}

const META_TOKEN = (process.env.META_PAGE_ACCESS_TOKEN || '').trim()
const AD_ACCT_RAW = (process.env.META_AD_ACCOUNT_ID || '').trim()
if (!META_TOKEN || !AD_ACCT_RAW) {
  console.error('Missing env: META_PAGE_ACCESS_TOKEN, META_AD_ACCOUNT_ID required.')
  process.exit(1)
}
const AD_ACCT = AD_ACCT_RAW.startsWith('act_') ? AD_ACCT_RAW : `act_${AD_ACCT_RAW}`

const OUT_DIR = resolve(join(process.cwd(), 'out', 'meta-mls-audiences', new Date().toISOString().replace(/[:.]/g, '-')))

// ─── CSV parser (handles quoted fields with commas) ───────────────────────

function parseCsv(text) {
  const rows = []
  let cur = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { field += c }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else { field += c }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
  return rows
}

// ─── Meta-spec hashing ────────────────────────────────────────────────────

const sha256 = s => createHash('sha256').update(s).digest('hex')

function normName(v) { return (v || '').trim().toLowerCase().replace(/[^a-z]/g, '') }
function normCity(v) { return (v || '').trim().toLowerCase().replace(/[^a-z]/g, '') }
function normState(v) {
  // Meta wants 2-letter lowercase state code
  const s = (v || '').trim().toLowerCase()
  return s.length === 2 ? s : s.replace(/[^a-z]/g, '').slice(0, 2)
}
function normZip(v) {
  // Meta wants digits-only (no extended +4)
  const z = (v || '').replace(/\D/g, '').slice(0, 5)
  return z
}

// ─── Meta API ─────────────────────────────────────────────────────────────

async function meta(method, path, body) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/v21.0/${path}${sep}access_token=${encodeURIComponent(META_TOKEN)}`
  const init = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  const r = await fetch(url, init)
  const text = await r.text()
  let parsed; try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: r.status, ok: r.ok, body: parsed }
}

async function findOrCreateCA(name, description) {
  const list = await meta('GET', `${AD_ACCT}/customaudiences?fields=id,name&limit=200`)
  const existing = (list.body.data ?? []).find(a => a.name === name)
  if (existing) {
    console.log(`    ✓ Found existing CA "${name}" (${existing.id})`)
    return existing.id
  }
  const create = await meta('POST', `${AD_ACCT}/customaudiences`, {
    name, description, subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY',
  })
  if (!create.ok) throw new Error(`CA create failed for "${name}": ${JSON.stringify(create.body).slice(0, 300)}`)
  console.log(`    ✓ Created new CA "${name}" (${create.body.id})`)
  return create.body.id
}

async function pushRecords(caId, records) {
  // Schema: [FN, LN, CT, ST, ZIP]. Each row is the hashes for one person.
  // Meta accepts up to 10K rows per call; batch 5K for safety.
  const schema = ['FN', 'LN', 'CT', 'ST', 'ZIP']
  const batchSize = 5000
  let pushed = 0
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const data = batch.map(p => [
      sha256(normName(p.fn)),
      sha256(normName(p.ln)),
      sha256(normCity(p.ct)),
      sha256(normState(p.st)),
      sha256(normZip(p.zip)),
    ])
    const r = await meta('POST', `${caId}/users`, { payload: { schema, data } })
    if (!r.ok) {
      console.warn(`     ! batch ${i}-${i + batch.length}: HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`)
    } else {
      pushed += data.length
    }
  }
  return pushed
}

// ─── Load + process CSV ───────────────────────────────────────────────────

console.log(`${'='.repeat(70)}\nMLS → Meta Custom Audiences\nMode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\nCSV:  ${csvPath}\n${'='.repeat(70)}`)

const rows = parseCsv(readFileSync(csvPath, 'utf8'))
const header = rows[0]
const dataRows = rows.slice(1).filter(r => r.some(c => (c || '').trim().length > 0))
console.log(`\nParsed ${dataRows.length} data rows.`)

const col = name => header.findIndex(h => h === name || h === `"${name}"`)
const idx = {
  fn: col("1st Owner's First Name"),
  ln: col("1st Owner's Last Name"),
  fn2: col("2nd Owner's First Name"),
  ln2: col("2nd Owner's Last Name"),
  siteCity: col('Site City'),
  siteState: col('Site State'),
  siteZip: col('Site Zip Code'),
  mailCity: col('Mailing City'),
  mailState: col('Mailing State'),
  mailZip: col('Mailing Zip Code'),
}
for (const [k, v] of Object.entries(idx)) {
  if (v < 0) { console.error(`CSV missing column for "${k}"`); process.exit(1) }
}

const all = []         // all owners (deduped)
const seen = new Set()
for (const r of dataRows) {
  const fn = (r[idx.fn] || '').trim()
  const ln = (r[idx.ln] || '').trim()
  if (!fn && !ln) continue
  const mz = (r[idx.mailZip] || '').trim()
  const dedupKey = `${fn.toLowerCase()}|${ln.toLowerCase()}|${mz}`
  if (seen.has(dedupKey)) continue
  seen.add(dedupKey)
  const siteCity = (r[idx.siteCity] || '').trim().toLowerCase()
  const siteState = (r[idx.siteState] || '').trim().toUpperCase()
  const mailCity = (r[idx.mailCity] || '').trim().toLowerCase()
  const mailState = (r[idx.mailState] || '').trim().toUpperCase()
  const siteZip = (r[idx.siteZip] || '').trim()
  const isAbsentee = mailCity && mailState && (mailCity !== siteCity || mailState !== siteState)
  all.push({
    fn, ln,
    ct: r[idx.mailCity] || '',
    st: r[idx.mailState] || '',
    zip: mz,
    siteZip, isAbsentee,
  })
}

const sub97703 = all.filter(p => p.siteZip === '97703')
const subAbsentee = all.filter(p => p.isAbsentee)

console.log(`\n## Audience splits (deduped by name+mailing-zip):`)
console.log(`  Total unique owners:             ${all.length}`)
console.log(`  97703 property owners:           ${sub97703.length}`)
console.log(`  Absentee owners (any property):  ${subAbsentee.length}`)

if (DRY_RUN) {
  console.log('\n(DRY RUN — no audiences created/updated.)')
  process.exit(0)
}

// ─── Push to Meta ─────────────────────────────────────────────────────────

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const audiences = [
  { name: 'RR MLS — Bend Property Owners (all)', desc: 'All deduped Bend-area property owners from MLS/assessor export. Multi-key match: FN+LN+CT+ST+ZIP.', records: all },
  { name: 'RR MLS — 97703 Property Owners', desc: 'Owners whose Site Zip = 97703 (West Bend / NW Crossing / Awbrey area).', records: sub97703 },
  { name: 'RR MLS — Absentee Owners (Bend area)', desc: 'Owners whose mailing city/state differs from the property city/state — out-of-area / second-home / investment owners.', records: subAbsentee },
]

const results = []
for (const a of audiences) {
  console.log(`\n## ${a.name}  (${a.records.length} records)`)
  const id = await findOrCreateCA(a.name, a.desc)
  const pushed = await pushRecords(id, a.records)
  console.log(`    ✓ Pushed ${pushed} records`)
  results.push({ name: a.name, id, expectedRecords: a.records.length, pushed })
}

const summary = {
  applied: new Date().toISOString(),
  csv: csvPath,
  totalRowsInCsv: dataRows.length,
  uniqueOwnersAfterDedup: all.length,
  audiences: results,
}
writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(`\n${'='.repeat(70)}\nSummary written: ${join(OUT_DIR, 'summary.json')}\n${'='.repeat(70)}`)
console.log('Meta typically matches records within 30 min – 2 hrs.')
console.log('Final audience sizes show up in Ads Manager → Audiences after matching completes.')
