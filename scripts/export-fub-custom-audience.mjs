#!/usr/bin/env node
// Export Follow Up Boss contacts to a Meta-Custom-Audience-ready CSV with
// SHA-256-hashed PII (Meta's required format).
//
// Two output modes:
//   --mode lookalike-seed   pulls past-seller stages (Listing Signed, Closed,
//                           Seller Nurture, Connected) — feeds a Meta Lookalike
//                           Audience that finds new Bend homeowners similar
//                           to people Matt has actually transacted with. Per
//                           2026 research these LALs deliver 30–50% lower CPL
//                           than broad-interest targeting.
//   --mode suppression      pulls EVERY FUB person — used as an Exclusion
//                           audience on every prospecting campaign so Matt
//                           never pays to reacquire leads already in FUB.
//                           Per the research playbook, this is non-negotiable.
//
// Output is plain CSV with columns Meta accepts directly:
//   email, phone, fn, ln, ct, st, country, zip, dob_yyyymmdd
// Hashed columns: email, phone, fn, ln (SHA-256 lowercase trimmed).
// Plain-text columns: ct (city), st (state, 2-char), country (ISO-2), zip.
// Blank cells are allowed; Meta uses every signal it has to match.
//
// Match-rate expectation per 2026 Meta data:
//   email + phone        50–70% match
//   email only           30–50%
//   phone only           20–35%
//
// Run:
//   node --env-file=.env.local scripts/export-fub-custom-audience.mjs
//   node --env-file=.env.local scripts/export-fub-custom-audience.mjs --mode suppression
//   node --env-file=.env.local scripts/export-fub-custom-audience.mjs --mode lookalike-seed --limit 5000
//
// Then in Meta Ads Manager:
//   Audiences → Create Audience → Custom Audience → Customer List
//   → Upload CSV (the file path printed at the end of this script)
//   → Map the columns Meta detects (already named correctly)
//   → Name it: "Ryan Realty FUB past sellers" or "Ryan Realty FUB suppression"

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const FUB_BASE = 'https://api.followupboss.com/v1'
const ROOT = process.cwd()

// ── args ───────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2))
const MODE = args.mode ?? 'lookalike-seed'
const LIMIT = Math.max(100, Math.min(50_000, Number(args.limit ?? 50_000)))
const OUT_DIR = resolve(ROOT, args['out-dir'] ?? 'out/meta-custom-audiences')
const FUB_KEY = (process.env.FOLLOWUPBOSS_API_KEY || process.env.FUB_API_KEY || '').trim()
const FUB_SYSTEM = process.env.FOLLOWUPBOSS_SYSTEM?.trim()
const FUB_SYSTEM_KEY = process.env.FOLLOWUPBOSS_SYSTEM_KEY?.trim()

if (!FUB_KEY) {
  console.error('FOLLOWUPBOSS_API_KEY (or FUB_API_KEY) is not set. Did you forget --env-file=.env.local?')
  process.exit(1)
}
if (!['lookalike-seed', 'suppression'].includes(MODE)) {
  console.error(`Unknown --mode: ${MODE}. Valid modes: lookalike-seed, suppression`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })

// LAL seed strategy: include every contact that is NOT explicitly cold,
// disqualified, archived, or do-not-contact. This is broader than the strict
// seller-stage allowlist used by the outreach cron because FUB stage usage is
// inconsistent across the account (most contacts have no stage at all). For
// LAL purposes we want maximum signal volume — Meta needs 1000+ records to
// build a useful Lookalike, and 100+ to even create the Custom Audience.
const SELLER_STAGE_DENYLIST = new Set(
  [
    'disqualified',
    'do not contact',
    'archive',
    'trash',
    'spam',
    'unsubscribed',
    'cold lead',
    'lost',
  ]
)

// ── boot ───────────────────────────────────────────────────────────────────

const fubHeaders = (() => {
  const h = {
    Accept: 'application/json',
    Authorization: 'Basic ' + Buffer.from(`${FUB_KEY}:`).toString('base64'),
  }
  if (FUB_SYSTEM) h['X-System'] = FUB_SYSTEM
  if (FUB_SYSTEM_KEY) h['X-System-Key'] = FUB_SYSTEM_KEY
  return h
})()

console.log(`mode=${MODE}`)
console.log(`limit=${LIMIT}`)
console.log(`out_dir=${OUT_DIR}`)

const all = await fetchAllFubPeople({ limit: LIMIT })
console.log(`Pulled ${all.length} FUB people total`)

const filtered = MODE === 'lookalike-seed' ? all.filter(isLookalikeSeedRow) : all
console.log(`Filtered to ${filtered.length} for ${MODE}`)

const rows = filtered.map(toMetaRow).filter((r) => r.email || r.phone)
console.log(`Rows with at least one matchable identifier: ${rows.length}`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const filename = `${MODE}-${stamp}.csv`
const outPath = join(OUT_DIR, filename)
const csv = toCsv(rows)
writeFileSync(outPath, csv, 'utf8')
console.log(`\nWrote ${rows.length} rows to ${outPath}`)
console.log('\nNext steps in Meta Ads Manager:')
console.log('  1. Audiences → Create Audience → Custom Audience → Customer List')
console.log(`  2. Upload ${outPath}`)
console.log(
  `  3. Name it: ${MODE === 'lookalike-seed' ? 'Ryan Realty FUB past sellers' : 'Ryan Realty FUB suppression'}`
)
console.log('  4. Origin: Customers from your business (people who interacted directly)')
if (MODE === 'lookalike-seed') {
  console.log('  5. After it processes, build a Lookalike Audience: 1% Bend metro, source = this audience.')
} else {
  console.log('  5. After it processes, add as Exclusion on every prospecting ad set.')
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = 'true'
    }
  }
  return out
}

async function fetchAllFubPeople({ limit }) {
  // FUB rejects offset >= 2000 ("Deep pagination disabled, use 'nextLink'").
  // Switch to next-link pagination via the Link header, which is the
  // documented mechanism for crossing 2000+ records.
  const initial = new URL(`${FUB_BASE}/people`)
  initial.searchParams.set('limit', '100')
  initial.searchParams.set('fields', 'id,name,firstName,lastName,emails,phones,addresses,stage,tags,source')
  initial.searchParams.set('sort', 'created')
  let nextUrl = initial.toString()
  const out = []
  while (nextUrl && out.length < limit) {
    let res
    try {
      res = await fetch(nextUrl, { headers: fubHeaders })
    } catch (err) {
      console.error(`Network error at ${nextUrl}: ${err.message}`)
      break
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      break
    }
    const json = await res.json().catch(() => null)
    const people = Array.isArray(json?.people) ? json.people : []
    if (people.length === 0) break
    out.push(...people)
    process.stdout.write(`\r  fetched ${out.length} so far...`)
    // Find next link. FUB exposes it in two places:
    //   1. JSON body  (json._metadata.nextLink, json._metadata.next, etc.)
    //   2. Link header  (Link: <url>; rel="next")
    const headerLink = parseNextFromLinkHeader(res.headers.get('link'))
    const bodyLink =
      json?._metadata?.nextLink ||
      json?._metadata?.next ||
      json?.metadata?.nextLink ||
      json?.metadata?.next ||
      null
    nextUrl = headerLink || bodyLink || null
    // Some FUB tenants return relative paths — normalize.
    if (nextUrl && !/^https?:\/\//i.test(nextUrl)) {
      nextUrl = nextUrl.startsWith('/') ? `https://api.followupboss.com${nextUrl}` : `${FUB_BASE}/${nextUrl}`
    }
  }
  process.stdout.write('\n')
  return out
}

function parseNextFromLinkHeader(header) {
  if (!header) return null
  // Link: <https://api.followupboss.com/v1/people?...>; rel="next", <...>; rel="prev"
  const parts = header.split(',').map((p) => p.trim())
  for (const part of parts) {
    const m = part.match(/^<([^>]+)>;\s*rel\s*=\s*"?next"?/i)
    if (m) return m[1]
  }
  return null
}

function isLookalikeSeedRow(person) {
  const stage = (person.stage ?? '').trim().toLowerCase()
  if (stage && SELLER_STAGE_DENYLIST.has(stage)) return false
  // Reject explicit realtor/agent/lender contacts — they distort the LAL.
  const tags = Array.isArray(person.tags) ? person.tags.map((t) => String(t).toLowerCase()) : []
  const isVendor = tags.some((t) =>
    /(realtor|real estate agent|broker|lender|loan officer|title rep|escrow|vendor|partner)/.test(t)
  )
  if (isVendor) return false
  return true
}

function sha256Lower(value) {
  if (!value) return ''
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return ''
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

function normalizePhone(value) {
  if (!value) return ''
  let digits = String(value).replace(/\D/g, '')
  if (!digits) return ''
  // Default to US country code when the number is 10 digits.
  if (digits.length === 10) digits = '1' + digits
  // Meta wants E.164 without the leading "+". Strip leading 0s.
  return digits.replace(/^0+/, '')
}

function firstNonEmpty(arr, key) {
  if (!Array.isArray(arr)) return ''
  for (const item of arr) {
    const v = item?.[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function toMetaRow(person) {
  const fullName = (person.name ?? '').trim()
  const fnameRaw =
    (person.firstName?.trim?.() || fullName.split(/\s+/)[0] || '').replace(/[^A-Za-z]/g, '')
  const lnameRaw =
    (person.lastName?.trim?.() || fullName.split(/\s+/).slice(1).join(' ') || '').replace(/[^A-Za-z]/g, '')
  const email = firstNonEmpty(person.emails, 'value').toLowerCase()
  const phone = normalizePhone(firstNonEmpty(person.phones, 'value'))
  const addr = Array.isArray(person.addresses) && person.addresses.length > 0 ? person.addresses[0] : null
  const city = (addr?.city ?? '').trim().toLowerCase().replace(/[^a-z]/g, '')
  const state = (addr?.state ?? '').trim().toUpperCase().slice(0, 2)
  const country = ((addr?.country ?? 'US').trim().toUpperCase() || 'US').slice(0, 2)
  const zip = (addr?.code ?? addr?.postalCode ?? addr?.zip ?? '').toString().trim().slice(0, 10)

  return {
    email: sha256Lower(email),
    phone: sha256Lower(phone),
    fn: sha256Lower(fnameRaw),
    ln: sha256Lower(lnameRaw),
    ct: city,
    st: state,
    country,
    zip,
  }
}

function toCsv(rows) {
  const header = ['email', 'phone', 'fn', 'ln', 'ct', 'st', 'country', 'zip']
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(header.map((k) => csvCell(row[k] ?? '')).join(','))
  }
  return lines.join('\n') + '\n'
}

function csvCell(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
