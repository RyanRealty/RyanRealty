#!/usr/bin/env node
/**
 * Resolve the human behind each entity-owned property by querying the
 * Deschutes County ArcGIS REST taxlot layer (DIAL data, public, free).
 *
 * Layer:  https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0
 *
 * Exposes per parcel:
 *   OWNER          — deeded name (LLC / Trust / etc.)
 *   IN_CARE_OF     — human contact behind the entity (e.g. "C/O JOHN DOE TRUSTEE")
 *   M_ADDRESS      — tax mailing address
 *   M_CITY / M_STATE / M_ZIP — mailing location
 *   ACCOUNT_ID     — DIAL account number for deep-linking
 *
 * Per CLAUDE.md memory `feedback_gis_authoritative_only.md` — DIAL is an
 * approved authoritative source for Deschutes County.
 *
 * Reads:  out/westside-bend-merge/04-master-entity-resolved.csv
 * Writes: out/westside-bend-merge/04-master-dial-resolved.csv
 *         out/westside-bend-merge/summary-dial-resolution.json
 *
 * Idempotent. Re-running on already-resolved rows is a no-op.
 *
 * Usage:
 *   node scripts/_dial-entity-resolver.mjs              # all unresolved entities
 *   node scripts/_dial-entity-resolver.mjs --limit 10   # smoke test
 *   node scripts/_dial-entity-resolver.mjs --all-rows   # ALL rows (entities + westside, verifies all)
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const INPUT = path.join(ROOT, 'out/westside-bend-merge/04-master-entity-resolved.csv')
const OUTPUT = path.join(ROOT, 'out/westside-bend-merge/04-master-dial-resolved.csv')
const SUMMARY = path.join(ROOT, 'out/westside-bend-merge/summary-dial-resolution.json')
const LAYER_URL = 'https://maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0/query'

const RATE_LIMIT_MS = 200 // 5 req/sec — generous for a public ArcGIS endpoint
const TIMEOUT_MS = 15000

function parseArgs(argv) {
  const out = { limit: Infinity, allRows: false }
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (t === '--limit') out.limit = parseInt(argv[++i], 10)
    else if (t === '--all-rows') out.allRows = true
  }
  return out
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

function titleCase(s) {
  return String(s).toLowerCase().split(/\s+/).map((w) =>
    w.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-')
  ).join(' ')
}

async function queryParcel(lat, lng) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify({ x: lng, y: lat }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'dbo_GIS_MAILING.OWNER,dbo_GIS_MAILING.IN_CARE_OF,dbo_GIS_MAILING.M_ADDRESS,dbo_GIS_MAILING.M_CITY,dbo_GIS_MAILING.M_STATE,dbo_GIS_MAILING.M_ZIP,dbo_GIS_MAILING.ACCOUNT_ID,Taxlot_Assessor_Account.TAXLOT,Taxlot_Assessor_Account.Subdivision',
    returnGeometry: 'false',
    f: 'json',
  })
  const url = `${LAYER_URL}?${params.toString()}`
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const j = await r.json()
      const feat = j.features && j.features[0]
      if (!feat) return null
      const a = feat.attributes || {}
      return {
        owner: a['dbo_GIS_MAILING.OWNER'] || '',
        inCareOf: a['dbo_GIS_MAILING.IN_CARE_OF'] || '',
        mAddress: a['dbo_GIS_MAILING.M_ADDRESS'] || '',
        mCity: a['dbo_GIS_MAILING.M_CITY'] || '',
        mState: a['dbo_GIS_MAILING.M_STATE'] || '',
        mZip: a['dbo_GIS_MAILING.M_ZIP'] || '',
        accountId: a['dbo_GIS_MAILING.ACCOUNT_ID'] || '',
        taxlot: a['Taxlot_Assessor_Account.TAXLOT'] || '',
        subdivision: a['Taxlot_Assessor_Account.Subdivision'] || '',
      }
    } catch (e) {
      if (attempt === 3) return { error: e.message }
      await new Promise((r) => setTimeout(r, 500 * attempt))
    }
  }
}

/**
 * Parse IN_CARE_OF for the human name. Common patterns:
 *   "C/O JOHN DOE TRUSTEE"            → John Doe
 *   "C/O MG PARTNERS LLP OR BRYAN NOON" → Bryan Noon (after "OR")
 *   "C/O JANE SMITH"                  → Jane Smith
 *   "C/O DOE JOHN & MARY"             → John & Mary Doe
 *   "C/O ABC MANAGEMENT INC"          → keep as entity (no human)
 */
function parseInCareOf(raw) {
  if (!raw) return null
  let s = String(raw).trim().replace(/^C\/O\s*/i, '').trim()
  if (!s) return null

  // Split on " OR " — typically: "ENTITY OR HUMAN", pick the human side
  if (/\bOR\b/i.test(s)) {
    const parts = s.split(/\s+OR\s+/i).map((p) => p.trim())
    const humanPart = parts.find((p) => !/\b(LLP|LLC|INC|CORP|MANAGEMENT|PARTNERS|HOLDINGS|GROUP|COMPANY|TRUST)\b/i.test(p))
    if (humanPart) s = humanPart
    else s = parts[parts.length - 1]
  }

  // Strip "TRUSTEE", "TRUSTEES", "TTEE" suffixes
  s = s.replace(/\b(TRUSTEES?|TTEE|MANAGER|MGR|REGISTERED AGENT|AGENT|EXECUTOR)\b/gi, '').trim()
  s = s.replace(/\s+/g, ' ').trim()

  // If the remaining string is still business-like, no human extractable
  if (/\b(LLP|LLC|INC|CORP|MANAGEMENT|PARTNERS|HOLDINGS|GROUP|COMPANY)\b/i.test(s)) return null
  if (!s) return null

  // Common formats:
  //   "DOE JOHN"            → surname first
  //   "JOHN DOE"            → first last
  //   "DOE JOHN & MARY"     → surname first, two firsts
  //   "JOHN & MARY DOE"     → couple last
  const ampMatch = s.match(/^([a-z]+)\s+([a-z]+)\s*(?:&|\+|and)\s*([a-z]+)\s*$/i)
  if (ampMatch) {
    // Pattern: SURNAME FIRST1 & FIRST2
    return {
      first: titleCase(ampMatch[2]) + ' & ' + titleCase(ampMatch[3]),
      last: titleCase(ampMatch[1]),
      full: `${titleCase(ampMatch[2])} & ${titleCase(ampMatch[3])} ${titleCase(ampMatch[1])}`,
    }
  }
  const ampMatch2 = s.match(/^([a-z]+)\s*(?:&|\+|and)\s*([a-z]+)\s+([a-z]+)\s*$/i)
  if (ampMatch2) {
    // Pattern: FIRST1 & FIRST2 SURNAME
    return {
      first: titleCase(ampMatch2[1]) + ' & ' + titleCase(ampMatch2[2]),
      last: titleCase(ampMatch2[3]),
      full: `${titleCase(ampMatch2[1])} & ${titleCase(ampMatch2[2])} ${titleCase(ampMatch2[3])}`,
    }
  }
  // Plain "FIRST LAST" or "LAST FIRST" — DIAL convention is usually LAST FIRST
  const twoWord = s.match(/^([a-z]+)\s+([a-z]+)\s*$/i)
  if (twoWord) {
    // Heuristic: if first word is short (≤3 chars) it's likely a given name; otherwise treat as surname-first
    const [, w1, w2] = twoWord
    if (w1.length <= 3) {
      return { first: titleCase(w1), last: titleCase(w2), full: `${titleCase(w1)} ${titleCase(w2)}` }
    } else {
      // Default DIAL ordering: SURNAME FIRST
      return { first: titleCase(w2), last: titleCase(w1), full: `${titleCase(w2)} ${titleCase(w1)}` }
    }
  }
  // 3+ words: probably "DOE JOHN ROBERT" surname first
  const parts = s.split(/\s+/)
  if (parts.length >= 2) {
    const last = parts[0]
    const first = parts.slice(1).join(' ')
    return { first: titleCase(first), last: titleCase(last), full: `${titleCase(first)} ${titleCase(last)}` }
  }
  return null
}

// ---- main ----

const args = parseArgs(process.argv.slice(2))

const text = await fs.readFile(INPUT, 'utf8')
const rows = parseCsv(text)
const headers = rows[0]
const data = rows.slice(1)

const idx = {
  is_entity: headers.indexOf('is_entity'),
  classification: headers.indexOf('classification'),
  owner_full: headers.indexOf('owner_full'),
  owner_first: headers.indexOf('owner_first'),
  owner_last: headers.indexOf('owner_last'),
  mail_address: headers.indexOf('mail_address'),
  mail_city: headers.indexOf('mail_city'),
  mail_state: headers.indexOf('mail_state'),
  mail_zip: headers.indexOf('mail_zip'),
  apn: headers.indexOf('apn'),
  latitude: headers.indexOf('latitude'),
  longitude: headers.indexOf('longitude'),
  entity_resolution: headers.indexOf('entity_resolution'),
}

const NEW_COLS = [
  'dial_owner', 'dial_in_care_of', 'dial_m_address', 'dial_m_city', 'dial_m_state', 'dial_m_zip',
  'dial_account_id', 'dial_taxlot', 'dial_subdivision', 'dial_lookup_status',
]
for (const c of NEW_COLS) if (!headers.includes(c)) headers.push(c)

// Filter to rows that need lookup
const targets = []
for (let i = 0; i < data.length; i += 1) {
  const r = data[i]
  while (r.length < headers.length) r.push('')
  const hasCoords = r[idx.latitude] && r[idx.longitude]
  if (!hasCoords) continue

  if (args.allRows) {
    targets.push({ i, lat: parseFloat(r[idx.latitude]), lng: parseFloat(r[idx.longitude]) })
  } else {
    // Only entities still flagged TRUE (unresolved by free pass) OR with no entity_resolution yet
    const stillEntity = r[idx.is_entity] === 'TRUE'
    if (stillEntity) {
      targets.push({ i, lat: parseFloat(r[idx.latitude]), lng: parseFloat(r[idx.longitude]) })
    }
  }
}

console.log(`[dial] Targets: ${targets.length} rows (limit=${args.limit === Infinity ? 'no limit' : args.limit})`)
const toProcess = targets.slice(0, args.limit)

const stats = {
  attempted: 0,
  noFeature: 0,
  errors: 0,
  hadInCareOf: 0,
  extractedHuman: 0,
  hadMailingAddr: 0,
  byCity: {},
  samples: { resolved: [], pending: [], errors: [] },
}

for (let n = 0; n < toProcess.length; n += 1) {
  const { i, lat, lng } = toProcess[n]
  const result = await queryParcel(lat, lng)
  stats.attempted += 1
  if (!result) {
    stats.noFeature += 1
    data[i][headers.indexOf('dial_lookup_status')] = 'no-feature'
    if ((n + 1) % 50 === 0) process.stdout.write(' [n=' + (n + 1) + ' nf=' + stats.noFeature + ']\n')
    continue
  }
  if (result.error) {
    stats.errors += 1
    data[i][headers.indexOf('dial_lookup_status')] = 'error: ' + result.error.slice(0, 80)
    if (stats.samples.errors.length < 3) stats.samples.errors.push({ i, err: result.error })
    process.stdout.write('E')
    continue
  }
  // Write DIAL fields
  data[i][headers.indexOf('dial_owner')] = result.owner
  data[i][headers.indexOf('dial_in_care_of')] = result.inCareOf
  data[i][headers.indexOf('dial_m_address')] = result.mAddress
  data[i][headers.indexOf('dial_m_city')] = result.mCity
  data[i][headers.indexOf('dial_m_state')] = result.mState
  data[i][headers.indexOf('dial_m_zip')] = result.mZip
  data[i][headers.indexOf('dial_account_id')] = result.accountId
  data[i][headers.indexOf('dial_taxlot')] = result.taxlot
  data[i][headers.indexOf('dial_subdivision')] = result.subdivision

  // Always update mailing address if DIAL has one and we don't
  if (result.mAddress && !data[i][idx.mail_address]) {
    data[i][idx.mail_address] = result.mAddress
    data[i][idx.mail_city] = result.mCity
    data[i][idx.mail_state] = result.mState
    data[i][idx.mail_zip] = result.mZip
    stats.hadMailingAddr += 1
  }

  // Parse IN_CARE_OF for human name
  const human = parseInCareOf(result.inCareOf)
  if (result.inCareOf) stats.hadInCareOf += 1
  if (human) {
    stats.extractedHuman += 1
    if (data[i][idx.owner_first] === '' || /trust|llc|inc|corp/i.test(data[i][idx.owner_first] || '')) {
      data[i][idx.owner_first] = human.first
      data[i][idx.owner_last] = human.last
      data[i][idx.owner_full] = human.full + ' (per DIAL IN_CARE_OF on ' + (result.owner || 'entity') + ')'
    }
    // Flip classification + is_entity so this row joins the main import
    if (data[i][idx.classification] === 'ENTITY_OR_SKIP') {
      data[i][idx.classification] = 'NOT_IN_FUB'
    }
    if (data[i][idx.is_entity] === 'TRUE') {
      data[i][idx.is_entity] = 'FALSE_BUT_DEEDED_TO_ENTITY'
    }
    data[i][headers.indexOf('dial_lookup_status')] = 'resolved-via-in-care-of'
    if (stats.samples.resolved.length < 5) stats.samples.resolved.push({
      owner: result.owner, inCareOf: result.inCareOf, extracted: human.full,
    })
  } else {
    data[i][headers.indexOf('dial_lookup_status')] = result.inCareOf ? 'no-human-in-care-of' : 'no-in-care-of'
    if (stats.samples.pending.length < 5) stats.samples.pending.push({
      owner: result.owner, inCareOf: result.inCareOf || '(none)',
    })
  }

  const ci = result.mCity || 'unknown'
  stats.byCity[ci] = (stats.byCity[ci] || 0) + 1

  if ((n + 1) % 50 === 0) {
    process.stdout.write(` [${n + 1}/${toProcess.length} resolved=${stats.extractedHuman}]\n`)
  } else if ((n + 1) % 10 === 0) {
    process.stdout.write('.')
  }
  await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
}

// Write output
const out = [headers.map(csvEscape).join(',')]
for (const r of data) out.push(headers.map((_, j) => csvEscape(r[j])).join(','))
await fs.writeFile(OUTPUT, out.join('\n') + '\n')
await fs.writeFile(SUMMARY, JSON.stringify(stats, null, 2))

console.log(`\n\n[dial] === Done ===`)
console.log(`Attempted: ${stats.attempted}`)
console.log(`No feature at point: ${stats.noFeature}`)
console.log(`Errors: ${stats.errors}`)
console.log(`Had IN_CARE_OF field populated: ${stats.hadInCareOf}`)
console.log(`Extracted a human name from IN_CARE_OF: ${stats.extractedHuman}`)
console.log(`Backfilled mailing address: ${stats.hadMailingAddr}`)
console.log(`\nSample resolved:`)
for (const s of stats.samples.resolved) {
  console.log(`  "${s.owner}" with C/O "${s.inCareOf}" → ${s.extracted}`)
}
console.log(`\nSample pending (no human extractable):`)
for (const s of stats.samples.pending) {
  console.log(`  "${s.owner}" with C/O "${s.inCareOf}"`)
}
console.log(`\nOutput: ${path.relative(ROOT, OUTPUT)}`)
console.log(`Summary: ${path.relative(ROOT, SUMMARY)}`)
