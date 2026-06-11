#!/usr/bin/env node
/**
 * Merge a homeowner CSV (e.g. west-side Bend from county records) against the
 * cached FollowUp Boss people roster, classify every row, and produce a
 * ready-for-FUB worklist plus an enrichment gap file.
 *
 * Inputs:
 *   --csv <path>      Source homeowner CSV (default: ~/Downloads/export (2).csv)
 *   --fub <path>      FUB cache JSON (default: out/fub-cache/people.json)
 *   --outdir <path>   Output dir (default: out/westside-bend-merge)
 *   --tag <string>    FUB tag to attach to ALL output rows (default: "westside-bend-2026-05")
 *
 * The script DOES NOT call any external API. It is purely a deterministic
 * dedupe + classify pass against the cached data. Expected runtime < 5s.
 *
 * Outputs (in --outdir):
 *   summary.json                       — counts, DNC reasons, match coverage
 *   01-master.csv                      — every CSV row + FUB match data + classification
 *   02-already-complete.csv            — in FUB, has phone + email, NOT DNC. No work needed.
 *   03-in-fub-needs-email.csv          — in FUB, has phone, missing email. Enrich email only.
 *   04-in-fub-needs-phone.csv          — in FUB, has email, missing phone. Enrich phone only.
 *   05-in-fub-needs-both.csv           — in FUB, missing both phone AND email. Enrich both.
 *   06-not-in-fub.csv                  — no FUB match at all. New contact + enrich.
 *   07-do-not-enrich.csv               — DNC / opted-out / Trash / Bounced. Audit trail only.
 *   08-entity-or-skip.csv              — LLCs, trusts, estates — skip skip-trace (irrelevant for sellers).
 *
 * Classification rules:
 *   1. If FUB person matched AND stage is "Trash" → DO_NOT_ENRICH
 *   2. If FUB person matched AND any DNC tag/email-optOut/phone-optOut → DO_NOT_ENRICH
 *   3. If CSV row's owner name looks like an LLC/Trust/Estate → ENTITY_OR_SKIP
 *   4. If FUB matched AND has valid phone AND valid email → ALREADY_COMPLETE
 *   5. If FUB matched AND missing email → IN_FUB_NEEDS_EMAIL
 *   6. If FUB matched AND missing phone → IN_FUB_NEEDS_PHONE
 *   7. If FUB matched AND missing both → IN_FUB_NEEDS_BOTH
 *   8. If no FUB match → NOT_IN_FUB
 *
 * Matching (CSV row -> FUB person) is layered:
 *   Tier A: site/mailing street normalized matches addresses[].street normalized
 *   Tier B: last name normalized AND street-number prefix matches (handles
 *           "2335 Nw Lakeside Pl" vs "2335 NW Lakeside Place")
 *   Tier C: first + last name AND city + zip match (for owners whose mailing
 *           lives outside the property — investors / second homes)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DEFAULT_CSV = resolve(homedir(), 'Downloads/export (2).csv')
const DEFAULT_FUB = resolve(ROOT, 'out/fub-cache/people.json')
const DEFAULT_OUTDIR = resolve(ROOT, 'out/westside-bend-merge')
const DEFAULT_TAG = 'westside-bend-2026-05'

// Channel-specific DNC tag patterns. A tag that matches EMAIL_DNC kills the
// email channel only. PHONE_DNC kills phone. FULL_DNC kills everything.
// `owner-lookup:dnc-clear` is a POSITIVE tag ("I checked the registry, this
// person is clear to contact"). It must NOT match.
const EMAIL_DNC_PATTERNS = [
  /\bunsubscrib/i,
  /\bbounced\b/i,
  /\bdo[\s_-]?not[\s_-]?email\b/i,
  /\bemail[\s_-]?opt[\s_-]?out\b/i,
]
const PHONE_DNC_PATTERNS = [
  /\bdo[\s_-]?not[\s_-]?call\b/i,
  /\bdo[\s_-]?not[\s_-]?text\b/i,
  /\bphone[\s_-]?opt[\s_-]?out\b/i,
]
const FULL_DNC_PATTERNS = [
  /\bdo[\s_-]?not[\s_-]?contact\b/i,
  /(^|[^a-z0-9-])dnc(?!-clear)([^a-z0-9-]|$)/i,
  /\bblacklist/i,
  /\bspam\b/i,
  /\bopt[\s_-]?out(?![\s_-]?(?:email|phone))\b/i,
]

const ENTITY_PATTERNS = [
  /\btrust\b/i,
  /\bestate\b/i,
  /\bllc\b/i,
  /\bl\.l\.c\b/i,
  /\binc\b/i,
  /\bcorp\b/i,
  /\bcorporation\b/i,
  /\bcompany\b/i,
  /\bco\.\b/i,
  /\blp\b/i,
  /\bltd\b/i,
  /\bfoundation\b/i,
  /\brevocable\b/i,
  /\birrevocable\b/i,
  /\bholdings\b/i,
  /\bpartners\b/i,
  /\bfamily\s+trust\b/i,
  /\bliving\s+trust\b/i,
  /\bbank\b/i,
  /\bchurch\b/i,
  /\bassociation\b/i,
  /\bhomeowners\b/i,
]

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (!t.startsWith('--')) { out._.push(t); continue }
    const eq = t.indexOf('=')
    if (eq > -1) { out[t.slice(2, eq)] = t.slice(eq + 1); continue }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { out[t.slice(2)] = next; i += 1 }
    else { out[t.slice(2)] = true }
  }
  return out
}

// -------- CSV parsing (RFC 4180-ish, handles embedded quotes/commas) --------

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

// -------- Normalization helpers --------

const STREET_TYPE_ALIASES = {
  street: 'st', st: 'st',
  avenue: 'ave', ave: 'ave', av: 'ave',
  road: 'rd', rd: 'rd',
  drive: 'dr', dr: 'dr',
  lane: 'ln', ln: 'ln',
  place: 'pl', pl: 'pl',
  court: 'ct', ct: 'ct',
  circle: 'cir', cir: 'cir',
  boulevard: 'blvd', blvd: 'blvd',
  highway: 'hwy', hwy: 'hwy',
  parkway: 'pkwy', pkwy: 'pkwy',
  terrace: 'ter', ter: 'ter',
  trail: 'trl', trl: 'trl',
  way: 'way',
  loop: 'loop',
}

const DIRECTIONAL_ALIASES = {
  north: 'n', n: 'n',
  south: 's', s: 's',
  east: 'e', e: 'e',
  west: 'w', w: 'w',
  northeast: 'ne', ne: 'ne',
  northwest: 'nw', nw: 'nw',
  southeast: 'se', se: 'se',
  southwest: 'sw', sw: 'sw',
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeName(s) {
  return clean(s).toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeStreet(s) {
  if (!s) return ''
  let t = String(s).toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = t.split(' ').filter(Boolean)
  const mapped = parts.map((p) => {
    if (Object.prototype.hasOwnProperty.call(DIRECTIONAL_ALIASES, p)) return DIRECTIONAL_ALIASES[p]
    if (Object.prototype.hasOwnProperty.call(STREET_TYPE_ALIASES, p)) return STREET_TYPE_ALIASES[p]
    return p
  })
  return mapped.join(' ')
}

function streetNumber(s) {
  const m = String(s ?? '').match(/^\s*(\d+[A-Za-z\-]*)/)
  return m ? m[1].toLowerCase() : ''
}

function buildAddressKey(street, city, postal) {
  const sn = normalizeStreet(street)
  const c = normalizeName(city)
  const p = String(postal ?? '').replace(/[^0-9]/g, '').slice(0, 5)
  return [sn, c, p].filter(Boolean).join('|')
}

function isEntityName(name) {
  const n = clean(name)
  if (!n) return false
  return ENTITY_PATTERNS.some((re) => re.test(n))
}

// -------- FUB indexing --------

function indexFub(fubCache) {
  const byAddress = new Map() // addrKey -> [personId]
  const byStreetOnly = new Map() // normalizedStreet -> [personId]
  const byLastName = new Map() // lastName -> [personId]
  const byId = new Map()
  const dncStats = { trashStage: 0, fullBlocked: 0, emailOnlyBlocked: 0, phoneOnlyBlocked: 0 }

  for (const p of fubCache.people || []) {
    byId.set(p.id, p)

    const tags = Array.isArray(p.tags) ? p.tags : []
    const dnc = analyzeDnc(p, tags)
    if (dnc.reasons.includes('stage:Trash')) dncStats.trashStage += 1
    if (dnc.isDnc) dncStats.fullBlocked += 1
    if (dnc.emailBlocked && !dnc.isDnc && !dnc.phoneBlocked) dncStats.emailOnlyBlocked += 1
    if (dnc.phoneBlocked && !dnc.isDnc && !dnc.emailBlocked) dncStats.phoneOnlyBlocked += 1

    // Address index
    for (const a of Array.isArray(p.addresses) ? p.addresses : []) {
      const key = buildAddressKey(a.street, a.city, a.code)
      if (key) {
        if (!byAddress.has(key)) byAddress.set(key, [])
        byAddress.get(key).push(p.id)
      }
      const stNorm = normalizeStreet(a.street)
      if (stNorm) {
        if (!byStreetOnly.has(stNorm)) byStreetOnly.set(stNorm, [])
        byStreetOnly.get(stNorm).push(p.id)
      }
    }

    // Custom owned property fields (sometimes the only address signal)
    const customProps = [p.customSellerPropertyAddress, p.customOpenHouseAddress]
    for (const cp of customProps) {
      const street = clean(cp)
      if (!street) continue
      const stNorm = normalizeStreet(street)
      if (stNorm) {
        if (!byStreetOnly.has(stNorm)) byStreetOnly.set(stNorm, [])
        byStreetOnly.get(stNorm).push(p.id)
      }
    }

    // Last name index (for owners whose mailing isn't in FUB)
    const ln = normalizeName(p.lastName)
    if (ln) {
      if (!byLastName.has(ln)) byLastName.set(ln, [])
      byLastName.get(ln).push(p.id)
    }
  }

  return { byAddress, byStreetOnly, byLastName, byId, dncStats }
}

function analyzeDnc(person, tags) {
  // Per-channel DNC. emailBlocked → no email outreach / no email skip-trace.
  // phoneBlocked → no phone outreach / no phone skip-trace. fullBlocked → no
  // outreach at all (still tracked so it doesn't get re-added by mistake).
  const reasons = []
  let emailBlocked = false
  let phoneBlocked = false
  let fullBlocked = false

  if (person.stage === 'Trash') {
    reasons.push('stage:Trash')
    fullBlocked = true
  }

  for (const t of tags) {
    if (FULL_DNC_PATTERNS.some((re) => re.test(t))) {
      reasons.push(`full-dnc-tag:${t}`)
      fullBlocked = true
    }
    if (EMAIL_DNC_PATTERNS.some((re) => re.test(t))) {
      reasons.push(`email-dnc-tag:${t}`)
      emailBlocked = true
    }
    if (PHONE_DNC_PATTERNS.some((re) => re.test(t))) {
      reasons.push(`phone-dnc-tag:${t}`)
      phoneBlocked = true
    }
  }

  const emails = Array.isArray(person.emails) ? person.emails : []
  const phones = Array.isArray(person.phones) ? person.phones : []

  for (const e of emails) {
    if (e?.optOut === true || e?.status === 'Invalid') {
      reasons.push(`email-${e.optOut ? 'optOut' : 'invalid'}:${e.value || '(none)'}`)
      emailBlocked = true
    }
  }
  for (const ph of phones) {
    if (ph?.optOut === true || ph?.status === 'Invalid') {
      reasons.push(`phone-${ph.optOut ? 'optOut' : 'invalid'}:${ph.value || '(none)'}`)
      phoneBlocked = true
    }
  }

  return {
    isDnc: fullBlocked,
    emailBlocked: fullBlocked || emailBlocked,
    phoneBlocked: fullBlocked || phoneBlocked,
    reasons,
  }
}

function pickPrimaryEmail(person) {
  const emails = Array.isArray(person.emails) ? person.emails : []
  const valid = emails.filter((e) => e?.value && e.status !== 'Invalid' && !e.optOut)
  const primary = valid.find((e) => e.isPrimary) || valid[0]
  return primary?.value ? clean(primary.value).toLowerCase() : ''
}

function pickPrimaryPhone(person) {
  const phones = Array.isArray(person.phones) ? person.phones : []
  const valid = phones.filter((ph) => ph?.value && ph.status !== 'Invalid' && !ph.optOut)
  // Prefer mobile/cell when available
  const mobile = valid.find((ph) => /mobile|cell/i.test(ph.type || ''))
  const primary = mobile || valid.find((ph) => ph.isPrimary) || valid[0]
  return primary?.value ? clean(primary.value) : ''
}

// -------- CSV column readers --------

function getCol(row, headerMap, name) {
  const idx = headerMap.get(name)
  if (idx == null) return ''
  return clean(row[idx])
}

function buildOwnerNames(row, headerMap) {
  // The county CSV is messy. Common shapes seen:
  //   1stFirst="Dennis"  1stLast="Oshea"  2ndFirst="Carol"  2ndLast="Oshea"
  //   1stFirst="Borsting" 1stLast=""       2ndFirst="Jon"   2ndLast="Borsting"
  //   AllOwners="Dennis Oshea and Carol Oshea"
  //
  // We produce an ordered list of (firstName, lastName) candidates plus the
  // raw All-Owners string so downstream matching can try the strongest pair
  // first.
  const a = {
    first: getCol(row, headerMap, "1st Owner's First Name"),
    last: getCol(row, headerMap, "1st Owner's Last Name"),
  }
  const b = {
    first: getCol(row, headerMap, "2nd Owner's First Name"),
    last: getCol(row, headerMap, "2nd Owner's Last Name"),
  }
  const all = getCol(row, headerMap, 'All Owners')

  const owners = []
  // Case: 1stLast looks like a first name and 1stFirst is empty → swap
  // We can't fully detect this without a names dictionary, but we can swap
  // when one of the two slots is empty.
  if (a.first && !a.last && b.last) {
    owners.push({ first: b.first || a.first, last: b.last })
  } else if (!a.first && a.last) {
    owners.push({ first: b.first || '', last: a.last })
  } else {
    if (a.first || a.last) owners.push({ first: a.first, last: a.last })
  }
  if ((b.first || b.last) && !owners.some((o) => o.first === b.first && o.last === b.last)) {
    owners.push({ first: b.first, last: b.last })
  }

  // Filter out blank-name records
  const cleaned = owners.filter((o) => o.first || o.last)
  return { owners: cleaned, allOwners: all }
}

// -------- Match a CSV row to a FUB person --------

function matchRow({ siteAddrKey, mailAddrKey, siteStreetNorm, mailStreetNorm, owners, csvSiteZip, csvMailZip }, idx) {
  // Tier A: address+city+zip match (mailing first — most authoritative for owner)
  for (const k of [mailAddrKey, siteAddrKey]) {
    if (!k) continue
    const hit = idx.byAddress.get(k)
    if (hit && hit.length > 0) {
      return { method: 'address-full', personId: hit[0], candidates: hit }
    }
  }

  // Tier B: street-normalized match + verify by last-name + zip
  const streetCandidates = new Set()
  for (const st of [mailStreetNorm, siteStreetNorm]) {
    if (!st) continue
    const hit = idx.byStreetOnly.get(st)
    if (hit) hit.forEach((id) => streetCandidates.add(id))
  }
  if (streetCandidates.size > 0) {
    for (const cid of streetCandidates) {
      const person = idx.byId.get(cid)
      if (!person) continue
      const lnSet = new Set(owners.map((o) => normalizeName(o.last)).filter(Boolean))
      const personLn = normalizeName(person.lastName)
      if (personLn && lnSet.has(personLn)) {
        return { method: 'street+lastname', personId: cid, candidates: [...streetCandidates] }
      }
    }
    // Street matched but the FUB person's last name does not match any owner
    // in the CSV. Property likely changed hands. Treat as no match — but
    // record the weak hit on the row for audit.
    return { method: 'street-only-rejected', personId: null, candidates: [...streetCandidates] }
  }

  // Tier C: last-name + zip (for owners whose mailing is out of state etc.)
  const zipSet = new Set([csvSiteZip, csvMailZip].filter(Boolean))
  for (const o of owners) {
    const lnNorm = normalizeName(o.last)
    if (!lnNorm) continue
    const lnHits = idx.byLastName.get(lnNorm)
    if (!lnHits) continue
    for (const cid of lnHits) {
      const person = idx.byId.get(cid)
      if (!person) continue
      const fnNorm = normalizeName(o.first)
      const personFn = normalizeName(person.firstName)
      if (fnNorm && personFn && (personFn === fnNorm || personFn.startsWith(fnNorm) || fnNorm.startsWith(personFn))) {
        // Confirm with at least one zip match if person has addresses
        const personZips = new Set((person.addresses || []).map((a) => (a.code || '').slice(0, 5)).filter(Boolean))
        if (personZips.size === 0 || [...zipSet].some((z) => personZips.has(z))) {
          return { method: 'firstname+lastname+zip', personId: cid, candidates: lnHits }
        }
      }
    }
  }

  return { method: 'none', personId: null, candidates: [] }
}

// -------- Output writers --------

const MASTER_HEADERS = [
  'classification',
  'enrich_email',
  'enrich_phone',
  'fub_id',
  'fub_match_method',
  'fub_stage',
  'fub_dnc',
  'fub_email_blocked',
  'fub_phone_blocked',
  'fub_dnc_reasons',
  'fub_email',
  'fub_phone',
  'fub_tags',
  'owner_first',
  'owner_last',
  'owner_full',
  'all_owners',
  'site_address',
  'site_city',
  'site_state',
  'site_zip',
  'mail_address',
  'mail_city',
  'mail_state',
  'mail_zip',
  'apn',
  'subdivision',
  'year_built',
  'bedrooms',
  'baths',
  'building_sqft',
  'acreage',
  'purchase_date',
  'purchase_price',
  'market_value',
  'owner_occupied',
  'property_type_raw',
  'latitude',
  'longitude',
  'county',
  'legal_description',
  'use_code_zoning',
]

const FUB_IMPORT_HEADERS = [
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Address',
  'City',
  'State',
  'Zip',
  'Property Address',
  'Property City',
  'Property State',
  'Property Zip',
  'Source',
  'Stage',
  'Tags',
  'Custom Subdivision',
  'Custom Year Built',
  'Custom APN',
  'Custom Bedrooms',
  'Custom Baths',
  'Custom Building Sqft',
  'Custom Lot Acres',
  'Custom Purchase Date',
  'Custom Purchase Price',
  'Custom Market Value',
  'Custom Owner Occupied',
  'Custom FUB Match Method',
]

function classificationFor({ fubPerson, ownerEntity }) {
  // Returns { classification, enrichEmail, enrichPhone, dnc }
  if (ownerEntity) {
    return { classification: 'ENTITY_OR_SKIP', enrichEmail: false, enrichPhone: false, dnc: null }
  }
  if (!fubPerson) {
    return { classification: 'NOT_IN_FUB', enrichEmail: true, enrichPhone: true, dnc: { isDnc: false, emailBlocked: false, phoneBlocked: false, reasons: [] } }
  }
  const tags = Array.isArray(fubPerson.tags) ? fubPerson.tags : []
  const dnc = analyzeDnc(fubPerson, tags)
  if (dnc.isDnc) {
    return { classification: 'DO_NOT_ENRICH', enrichEmail: false, enrichPhone: false, dnc }
  }
  const hasEmail = !!pickPrimaryEmail(fubPerson)
  const hasPhone = !!pickPrimaryPhone(fubPerson)
  const enrichEmail = !hasEmail && !dnc.emailBlocked
  const enrichPhone = !hasPhone && !dnc.phoneBlocked

  let classification
  if (hasEmail && hasPhone) classification = 'ALREADY_COMPLETE'
  else if (!hasEmail && !hasPhone) classification = enrichEmail || enrichPhone ? 'IN_FUB_NEEDS_BOTH' : 'IN_FUB_PARTIAL_BLOCKED'
  else if (!hasEmail) classification = enrichEmail ? 'IN_FUB_NEEDS_EMAIL' : 'IN_FUB_PARTIAL_BLOCKED'
  else classification = enrichPhone ? 'IN_FUB_NEEDS_PHONE' : 'IN_FUB_PARTIAL_BLOCKED'

  return { classification, enrichEmail, enrichPhone, dnc }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const csvPath = args.csv ? resolve(args.csv) : DEFAULT_CSV
  const fubPath = args.fub ? resolve(ROOT, String(args.fub)) : DEFAULT_FUB
  const outdir = args.outdir ? resolve(ROOT, String(args.outdir)) : DEFAULT_OUTDIR
  const tag = String(args.tag || DEFAULT_TAG)

  console.log(`[merge] csv=${csvPath}`)
  console.log(`[merge] fub=${fubPath}`)
  console.log(`[merge] outdir=${outdir}`)
  console.log(`[merge] tag=${tag}`)

  const [csvText, fubJson] = await Promise.all([
    readFile(csvPath, 'utf8'),
    readFile(fubPath, 'utf8'),
  ])
  const fubCache = JSON.parse(fubJson)
  console.log(`[merge] FUB cache: ${fubCache.people.length} people, fetched ${fubCache.fetchedAt}`)

  const rows = parseCsv(csvText)
  const headerRow = rows.shift() || []
  const headerMap = new Map(headerRow.map((h, i) => [h, i]))
  console.log(`[merge] CSV rows: ${rows.length}`)

  const idx = indexFub(fubCache)
  console.log(`[merge] FUB index: ${idx.byAddress.size} address keys, ${idx.byStreetOnly.size} street-norm keys, ${idx.byLastName.size} last-name keys`)
  console.log(`[merge] FUB DNC summary: fullBlocked=${idx.dncStats.fullBlocked} emailOnlyBlocked=${idx.dncStats.emailOnlyBlocked} phoneOnlyBlocked=${idx.dncStats.phoneOnlyBlocked} (Trash=${idx.dncStats.trashStage})`)

  const masterRows = []
  const buckets = {
    ALREADY_COMPLETE: [],
    IN_FUB_NEEDS_EMAIL: [],
    IN_FUB_NEEDS_PHONE: [],
    IN_FUB_NEEDS_BOTH: [],
    IN_FUB_PARTIAL_BLOCKED: [],
    NOT_IN_FUB: [],
    DO_NOT_ENRICH: [],
    ENTITY_OR_SKIP: [],
  }

  // Track which FUB persons we've already counted, so we report unique matches.
  const matchedFubIds = new Set()

  for (const row of rows) {
    if (row.length < 5) continue // skip blank tail row

    const siteStreet = getCol(row, headerMap, 'Site Address')
    const siteCity = getCol(row, headerMap, 'Site City')
    const siteState = getCol(row, headerMap, 'Site State')
    const siteZip = getCol(row, headerMap, 'Site Zip Code')

    const mailStreet = getCol(row, headerMap, 'Mail Address')
    const mailCity = getCol(row, headerMap, 'Mailing City')
    const mailState = getCol(row, headerMap, 'Mailing State')
    const mailZip = getCol(row, headerMap, 'Mailing Zip Code')

    const { owners, allOwners } = buildOwnerNames(row, headerMap)
    const primaryOwner = owners[0] || { first: '', last: '' }
    const ownerFull = clean(`${primaryOwner.first} ${primaryOwner.last}`)
    const ownerEntity =
      isEntityName(allOwners) ||
      isEntityName(ownerFull) ||
      isEntityName(`${primaryOwner.last}`)

    const siteAddrKey = buildAddressKey(siteStreet, siteCity, siteZip)
    const mailAddrKey = buildAddressKey(mailStreet, mailCity, mailZip)
    const siteStreetNorm = normalizeStreet(siteStreet)
    const mailStreetNorm = normalizeStreet(mailStreet)

    const csvSiteZip = String(siteZip || '').replace(/[^0-9]/g, '').slice(0, 5)
    const csvMailZip = String(mailZip || '').replace(/[^0-9]/g, '').slice(0, 5)

    const match = matchRow(
      { siteAddrKey, mailAddrKey, siteStreetNorm, mailStreetNorm, owners, csvSiteZip, csvMailZip },
      idx,
    )
    const fubPerson = match.personId ? idx.byId.get(match.personId) : null
    if (fubPerson) matchedFubIds.add(fubPerson.id)

    const { classification, enrichEmail, enrichPhone, dnc } = classificationFor({ fubPerson, ownerEntity })
    const tags = Array.isArray(fubPerson?.tags) ? fubPerson.tags : []

    const masterRow = {
      classification,
      enrich_email: enrichEmail ? 'TRUE' : '',
      enrich_phone: enrichPhone ? 'TRUE' : '',
      fub_id: fubPerson?.id || '',
      fub_match_method: match.method,
      fub_stage: fubPerson?.stage || '',
      fub_dnc: dnc?.isDnc ? 'TRUE' : '',
      fub_email_blocked: dnc?.emailBlocked ? 'TRUE' : '',
      fub_phone_blocked: dnc?.phoneBlocked ? 'TRUE' : '',
      fub_dnc_reasons: (dnc?.reasons || []).join('; '),
      fub_email: fubPerson ? pickPrimaryEmail(fubPerson) : '',
      fub_phone: fubPerson ? pickPrimaryPhone(fubPerson) : '',
      fub_tags: tags.join('; '),
      owner_first: primaryOwner.first,
      owner_last: primaryOwner.last,
      owner_full: ownerFull,
      all_owners: allOwners,
      site_address: siteStreet,
      site_city: siteCity,
      site_state: siteState,
      site_zip: siteZip,
      mail_address: mailStreet,
      mail_city: mailCity,
      mail_state: mailState,
      mail_zip: mailZip,
      apn: getCol(row, headerMap, 'APN / Parcel Number'),
      subdivision: getCol(row, headerMap, 'Subdivision'),
      year_built: getCol(row, headerMap, 'Year Built'),
      bedrooms: getCol(row, headerMap, 'Bedrooms'),
      baths: getCol(row, headerMap, 'Baths'),
      building_sqft: getCol(row, headerMap, 'Building Size'),
      acreage: getCol(row, headerMap, 'Acreage'),
      purchase_date: getCol(row, headerMap, 'Purchase Date'),
      purchase_price: getCol(row, headerMap, 'Purchase Price'),
      market_value: getCol(row, headerMap, 'Market Value (Assessed)'),
      owner_occupied: getCol(row, headerMap, 'Owner Occupied'),
      property_type_raw: getCol(row, headerMap, 'Property Type'),
      latitude: getCol(row, headerMap, 'Latitude'),
      longitude: getCol(row, headerMap, 'Longitude'),
      county: getCol(row, headerMap, 'County'),
      legal_description: getCol(row, headerMap, 'Legal Description'),
      use_code_zoning: getCol(row, headerMap, 'Zoning Code'),
    }
    masterRows.push(masterRow)
    buckets[classification].push(masterRow)
  }

  // ---- Write outputs ----
  await mkdir(outdir, { recursive: true })

  // Combined enrichment-needed bucket: rows where we should call the skip
  // trace provider. Keep separated outputs for transparency, but the canonical
  // input to the enrichment step is 09-enrichment-needed.csv.
  const enrichmentNeeded = masterRows.filter((r) => r.enrich_email || r.enrich_phone)

  // Vendor-agnostic skip-trace input: 5 standard columns expected by every
  // major service (BatchSkipTrace, REDX, Vulcan7, IDI, Endato, Tracers,
  // PropStream, Apify TruePeopleSearch actors, etc.). One row per CSV
  // homeowner row that needs enrichment. Property address is used as the
  // anchor because that's what's most reliable from county data.
  const SKIP_INPUT_HEADERS = ['First Name', 'Last Name', 'Address', 'City', 'State', 'Zip']
  const skipInputRows = enrichmentNeeded.map((r) => ({
    'First Name': r.owner_first,
    'Last Name': r.owner_last,
    Address: r.site_address,
    City: r.site_city,
    State: r.site_state,
    Zip: r.site_zip,
  }))

  await writeFile(resolve(outdir, '01-master.csv'), rowsToCsv(MASTER_HEADERS, masterRows), 'utf8')
  await writeFile(resolve(outdir, '02-already-complete.csv'), rowsToCsv(MASTER_HEADERS, buckets.ALREADY_COMPLETE), 'utf8')
  await writeFile(resolve(outdir, '03-in-fub-needs-email.csv'), rowsToCsv(MASTER_HEADERS, buckets.IN_FUB_NEEDS_EMAIL), 'utf8')
  await writeFile(resolve(outdir, '04-in-fub-needs-phone.csv'), rowsToCsv(MASTER_HEADERS, buckets.IN_FUB_NEEDS_PHONE), 'utf8')
  await writeFile(resolve(outdir, '05-in-fub-needs-both.csv'), rowsToCsv(MASTER_HEADERS, buckets.IN_FUB_NEEDS_BOTH), 'utf8')
  await writeFile(resolve(outdir, '06-not-in-fub.csv'), rowsToCsv(MASTER_HEADERS, buckets.NOT_IN_FUB), 'utf8')
  await writeFile(resolve(outdir, '07-do-not-enrich.csv'), rowsToCsv(MASTER_HEADERS, buckets.DO_NOT_ENRICH), 'utf8')
  await writeFile(resolve(outdir, '08-entity-or-skip.csv'), rowsToCsv(MASTER_HEADERS, buckets.ENTITY_OR_SKIP), 'utf8')
  await writeFile(resolve(outdir, '09-enrichment-needed.csv'), rowsToCsv(MASTER_HEADERS, enrichmentNeeded), 'utf8')
  await writeFile(resolve(outdir, '10-in-fub-partial-blocked.csv'), rowsToCsv(MASTER_HEADERS, buckets.IN_FUB_PARTIAL_BLOCKED), 'utf8')
  await writeFile(resolve(outdir, '11-skip-trace-input.csv'), rowsToCsv(SKIP_INPUT_HEADERS, skipInputRows), 'utf8')

  const dncReasonCounts = {}
  for (const row of buckets.DO_NOT_ENRICH) {
    for (const r of row.fub_dnc_reasons.split('; ').filter(Boolean)) {
      dncReasonCounts[r] = (dncReasonCounts[r] || 0) + 1
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    inputs: {
      csv: csvPath,
      fub: fubPath,
      fubFetchedAt: fubCache.fetchedAt,
      fubPeopleCount: fubCache.people.length,
    },
    csvTotalRows: masterRows.length,
    uniqueFubMatchesAcrossCsv: matchedFubIds.size,
    buckets: {
      ALREADY_COMPLETE: buckets.ALREADY_COMPLETE.length,
      IN_FUB_NEEDS_EMAIL: buckets.IN_FUB_NEEDS_EMAIL.length,
      IN_FUB_NEEDS_PHONE: buckets.IN_FUB_NEEDS_PHONE.length,
      IN_FUB_NEEDS_BOTH: buckets.IN_FUB_NEEDS_BOTH.length,
      IN_FUB_PARTIAL_BLOCKED: buckets.IN_FUB_PARTIAL_BLOCKED.length,
      NOT_IN_FUB: buckets.NOT_IN_FUB.length,
      DO_NOT_ENRICH: buckets.DO_NOT_ENRICH.length,
      ENTITY_OR_SKIP: buckets.ENTITY_OR_SKIP.length,
    },
    enrichmentCandidates: {
      total: enrichmentNeeded.length,
      needsEmail: enrichmentNeeded.filter((r) => r.enrich_email).length,
      needsPhone: enrichmentNeeded.filter((r) => r.enrich_phone).length,
    },
    dncReasonCounts,
    matchMethodCounts: masterRows.reduce((acc, r) => {
      acc[r.fub_match_method] = (acc[r.fub_match_method] || 0) + 1
      return acc
    }, {}),
    tag,
  }
  await writeFile(resolve(outdir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')

  console.log('\n[merge] === Classification ===')
  for (const [k, v] of Object.entries(summary.buckets)) {
    console.log(`  ${k.padEnd(22)} ${v}`)
  }
  console.log(`\n[merge] Enrichment candidates (needs phone OR email, not DNC, not entity): ${summary.enrichmentCandidates.total}`)
  console.log(`  needs email: ${summary.enrichmentCandidates.needsEmail}`)
  console.log(`  needs phone: ${summary.enrichmentCandidates.needsPhone}`)
  console.log(`\n[merge] Match methods:`)
  for (const [k, v] of Object.entries(summary.matchMethodCounts)) {
    console.log(`  ${k.padEnd(28)} ${v}`)
  }
  console.log(`\n[merge] DNC reason counts:`)
  for (const [k, v] of Object.entries(dncReasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(40)} ${v}`)
  }
  console.log(`\n[merge] outputs in: ${outdir}`)
}

main().catch((err) => {
  console.error(`[merge] FATAL: ${err.message}`)
  console.error(err.stack)
  process.exit(1)
})
