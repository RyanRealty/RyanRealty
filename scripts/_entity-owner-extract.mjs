#!/usr/bin/env node
/**
 * Free-extraction pass on the 1,553 entity-owned property rows. Most trust
 * names contain the family surname inline:
 *   "Carboy Family Trust"           → surname Carboy
 *   "Owens Donna L Living Trust"    → Donna L Owens
 *   "Wetle J & T Living Trust"      → Wetle family, J + T initials
 *   "Crawford-pettibone Trust"      → Crawford-Pettibone surname(s)
 *   "Huhn L & K Joint Trust"        → Huhn family
 * LLCs named after addresses ("2258 NW 6th St LLC") have no human extractable
 * and need SOS lookup OR BatchData skip-trace by property address.
 *
 * Reads:  out/westside-bend-merge/04-master-with-textexport.csv
 * Writes: out/westside-bend-merge/04-master-entity-resolved.csv
 *         out/westside-bend-merge/summary-entity-extract.json
 *
 * Per-entity outcome:
 *   - resolved-trust-name      → surname extracted from trust name
 *   - resolved-personal-llc    → "John Smith LLC" pattern
 *   - pending-address-llc      → "1234 St LLC" pattern, needs skip-trace
 *   - pending-generic-llc      → "Cascade Properties LLC" — SOS or skip-trace
 *   - pending-generic-trust    → "Springleaf Trust" — needs skip-trace
 *   - pending-other            → other corp/partnership/foundation
 *
 * Idempotent. Re-run is a no-op (writes same CSV).
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const INPUT = path.join(ROOT, 'out/westside-bend-merge/04-master-dial-resolved.csv')
const OUTPUT = path.join(ROOT, 'out/westside-bend-merge/04-master-entity-resolved.csv')
const SUMMARY = path.join(ROOT, 'out/westside-bend-merge/summary-entity-extract.json')

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

const TRUST_SUFFIX_REGEX = new RegExp(
  '\\b(family\\s+)?(living|joint|revocable|irrevocable|qualified|qtip|grat|charitable|inter\\s+vivos|family|survivor[\\s\']?s|by[\\s\']?pass|credit|marital|generation\\s+skipping|gst|land|real\\s+estate)?\\s*trust(s)?\\b.*$',
  'i',
)

const KNOWN_LLC_SUFFIXES = /\b(llc|l\.l\.c\.|inc|corp(oration)?|co\.|company|partnership|lp|l\.p\.|llp|l\.l\.p\.|holdings?|properties|investments?|realty|rentals?|capital|associates?)\b.*$/i

const ADDRESS_LLC_REGEX = /^\d+\s+(n|s|e|w|nw|ne|sw|se)?\s*[a-z]+/i

function extractFromTrust(rawName) {
  if (!rawName) return null
  // Strip trust suffix
  let stripped = rawName.replace(TRUST_SUFFIX_REGEX, '').trim()
  if (!stripped) return null
  // Strip year tags + qualifier words that the suffix regex missed
  stripped = stripped.replace(/\b(dated|of|established|created|the)\b/gi, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(rev|revocable|irrevocable|qualified|joint|family|surviv\w*|bypass|by-pass|credit|marital|gst|land|charitable)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim()
  if (!stripped) return null

  // "First1 & First2 Surname" pattern: "Jon & Terry Sprecher", "Howard & Nancy Friedman"
  const firstsCoupleSurname = stripped.match(/^([a-z]+)\s*(?:&|and|\+)\s*([a-z]+)\s+([a-z]+)\s*$/i)
  if (firstsCoupleSurname) {
    const [, first1, first2, surname] = firstsCoupleSurname
    return {
      first: titleCase(first1) + ' & ' + titleCase(first2),
      last: titleCase(surname),
      full: `${titleCase(first1)} & ${titleCase(first2)} ${titleCase(surname)}`,
      method: 'trust-firsts-couple-surname',
      isEntity: false,
    }
  }

  // "Surname1 & Surname2" couple: "Graterol & Coady"
  const surnamesCouple = stripped.match(/^([a-z]+)\s*(?:&|and|\+)\s*([a-z]+)\s*$/i)
  if (surnamesCouple) {
    const [, a, b] = surnamesCouple
    return {
      first: '',
      last: titleCase(a) + ' & ' + titleCase(b),
      full: `${titleCase(a)} & ${titleCase(b)} Family`,
      method: 'trust-surnames-couple',
      isEntity: false,
    }
  }

  // "First Middle Last" three-word: "Richard H Dehen"
  const firstMiddleLast = stripped.match(/^([a-z]+)\s+([a-z])\s+([a-z]+)\s*$/i)
  if (firstMiddleLast) {
    const [, first, middle, last] = firstMiddleLast
    return {
      first: titleCase(first) + ' ' + middle.toUpperCase(),
      last: titleCase(last),
      full: `${titleCase(first)} ${middle.toUpperCase()} ${titleCase(last)}`,
      method: 'trust-first-middle-last',
      isEntity: false,
    }
  }

  // Hyphenated couple: "Crawford-Pettibone" → two surnames
  if (/^[a-z]+-[a-z]+$/i.test(stripped)) {
    const [a, b] = stripped.split('-')
    return {
      first: '',
      last: titleCase(a) + '-' + titleCase(b),
      full: `${titleCase(a)}-${titleCase(b)} Family`,
      method: 'trust-hyphenated-couple',
      isEntity: false,
    }
  }

  // "Surname Initials & Initials Joint" pattern: "Wetle J & T", "Huhn L & K"
  const initialsCoupleMatch = stripped.match(/^([a-z]+)\s+([a-z])\s*(?:&|and|\+)\s*([a-z])\s*$/i)
  if (initialsCoupleMatch) {
    const [, surname, i1, i2] = initialsCoupleMatch
    return {
      first: '',
      last: titleCase(surname),
      full: `${titleCase(surname)} (${i1.toUpperCase()} & ${i2.toUpperCase()} trustees)`,
      method: 'trust-surname-initials-couple',
      isEntity: false,
    }
  }

  // "Surname First [Middle]" pattern: "Owens Donna L", "Smith John"
  const surnameFirstMiddle = stripped.match(/^([a-z]+)\s+([a-z]+)\s*([a-z])?\s*$/i)
  if (surnameFirstMiddle) {
    const [, last, first, middle] = surnameFirstMiddle
    // If 'first' is a common surname pattern, treat as 2-word surname
    return {
      first: titleCase(first) + (middle ? ' ' + middle.toUpperCase() : ''),
      last: titleCase(last),
      full: `${titleCase(first)}${middle ? ' ' + middle.toUpperCase() : ''} ${titleCase(last)}`,
      method: 'trust-surname-first-middle',
      isEntity: false,
    }
  }

  // Single word remaining → likely surname (e.g., "Carboy Family Trust" → "Carboy")
  if (/^[a-z]+$/i.test(stripped)) {
    return {
      first: '',
      last: titleCase(stripped),
      full: `${titleCase(stripped)} family`,
      method: 'trust-surname-only',
      isEntity: false,
    }
  }

  // Two words remaining and second looks like a real surname → "First Last" pattern
  const twoWord = stripped.match(/^([a-z]+)\s+([a-z]+)\s*$/i)
  if (twoWord) {
    return {
      first: titleCase(twoWord[1]),
      last: titleCase(twoWord[2]),
      full: `${titleCase(twoWord[1])} ${titleCase(twoWord[2])}`,
      method: 'trust-first-last',
      isEntity: false,
    }
  }

  return null
}

function extractFromLlc(rawName) {
  if (!rawName) return null
  const cleaned = rawName.replace(KNOWN_LLC_SUFFIXES, '').trim()
  if (!cleaned) return null

  // Address-based LLC ("2258 NW 6th St LLC") — no human extractable
  if (ADDRESS_LLC_REGEX.test(cleaned)) {
    return { resolution: 'pending-address-llc', method: 'address-llc-skip-trace-needed' }
  }

  // "John Smith LLC" → two words, both capitalized, likely a name
  const personName = cleaned.match(/^([a-z]+)\s+([a-z]+)\s*$/i)
  if (personName && !/properties|holdings|capital|investments|rentals|management|real\s*estate/i.test(cleaned)) {
    return {
      first: titleCase(personName[1]),
      last: titleCase(personName[2]),
      full: `${titleCase(personName[1])} ${titleCase(personName[2])}`,
      method: 'llc-personal-name',
      isEntity: false,
    }
  }

  // Generic property/business name → no extract
  return { resolution: 'pending-generic-llc', method: 'sos-or-skip-trace-needed' }
}

function classifyAndExtract(rawName) {
  if (!rawName) return { resolution: 'pending-no-owner-field' }
  const u = rawName.toUpperCase()

  if (/\bTRUST\b/.test(u)) {
    const r = extractFromTrust(rawName)
    if (r) return { ...r, resolution: 'resolved-trust-name' }
    return { resolution: 'pending-generic-trust', method: 'skip-trace-needed', isEntity: true }
  }

  if (/\bLLC\b|\bL\.L\.C\.\b/.test(u)) {
    const r = extractFromLlc(rawName)
    if (r && !r.resolution) return { ...r, resolution: 'resolved-personal-llc' }
    return r || { resolution: 'pending-generic-llc', method: 'sos-needed', isEntity: true }
  }

  if (/\bINC\b|\bCORP\b/.test(u)) return { resolution: 'pending-corp', method: 'sos-needed', isEntity: true }
  if (/\bESTATE\b/.test(u)) return { resolution: 'pending-estate', method: 'probate-records-needed', isEntity: true }

  return { resolution: 'pending-other', method: 'manual-research', isEntity: true }
}

// ---- main ----

const text = await fs.readFile(INPUT, 'utf8')
const rows = parseCsv(text)
const headers = rows[0]
const data = rows.slice(1)

const idx = {
  is_entity: headers.indexOf('is_entity'),
  owner_full: headers.indexOf('owner_full'),
  owner_first: headers.indexOf('owner_first'),
  owner_last: headers.indexOf('owner_last'),
}

// Ensure new columns exist
const NEW_COLS = ['entity_resolution', 'entity_extract_method']
for (const c of NEW_COLS) if (!headers.includes(c)) headers.push(c)

const stats = {
  total: 0,
  byResolution: {},
  byMethod: {},
  samples: { resolved: [], pendingTrust: [], pendingLlc: [] },
}

for (const r of data) {
  // Pad with empty strings for new columns
  while (r.length < headers.length) r.push('')
  if ((r[idx.is_entity] || '') !== 'TRUE') continue
  stats.total += 1
  const rawName = r[idx.owner_full] || ''
  const result = classifyAndExtract(rawName)

  // Set new columns
  r[headers.indexOf('entity_resolution')] = result.resolution || 'unknown'
  r[headers.indexOf('entity_extract_method')] = result.method || ''

  // Update is_entity / owner_first / owner_last where confident
  if (result.first || result.last) {
    if (!r[idx.owner_first] || /trust|llc|inc|corp|estate/i.test(r[idx.owner_first])) {
      r[idx.owner_first] = result.first || ''
    }
    if (!r[idx.owner_last] || /trust|llc|inc|corp|estate/i.test(r[idx.owner_last])) {
      r[idx.owner_last] = result.last || ''
    }
    // If we extracted a human name and the entity flag is "trust" type, the row is still
    // formally an entity (deed is in trust name) but the contact is now a known human.
    if (result.isEntity === false && r[idx.is_entity] === 'TRUE') {
      r[idx.is_entity] = 'FALSE_BUT_DEEDED_TO_ENTITY'
    }
  }

  stats.byResolution[result.resolution] = (stats.byResolution[result.resolution] || 0) + 1
  stats.byMethod[result.method || '(none)'] = (stats.byMethod[result.method || '(none)'] || 0) + 1

  if (result.resolution === 'resolved-trust-name' && stats.samples.resolved.length < 5) {
    stats.samples.resolved.push({ raw: rawName, extracted: result.full, method: result.method })
  }
  if (result.resolution === 'pending-generic-trust' && stats.samples.pendingTrust.length < 5) {
    stats.samples.pendingTrust.push({ raw: rawName })
  }
  if (result.resolution === 'pending-generic-llc' && stats.samples.pendingLlc.length < 5) {
    stats.samples.pendingLlc.push({ raw: rawName })
  }
}

// Write output CSV
const outLines = [headers.map(csvEscape).join(',')]
for (const r of data) outLines.push(headers.map((_, i) => csvEscape(r[i])).join(','))
await fs.writeFile(OUTPUT, outLines.join('\n') + '\n')

await fs.writeFile(SUMMARY, JSON.stringify(stats, null, 2))

console.log(`\n[entity-extract] Total entities: ${stats.total}`)
console.log('\nBy resolution:')
for (const [k, v] of Object.entries(stats.byResolution).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(5)}  ${k}`)
}
console.log('\nSample resolved trusts:')
for (const s of stats.samples.resolved) console.log(`  "${s.raw}" → "${s.extracted}" (${s.method})`)
console.log('\nSample pending generic trusts (need skip-trace):')
for (const s of stats.samples.pendingTrust) console.log(`  "${s.raw}"`)
console.log('\nSample pending LLCs (need SOS or skip-trace):')
for (const s of stats.samples.pendingLlc) console.log(`  "${s.raw}"`)
console.log(`\nOutput: ${path.relative(ROOT, OUTPUT)}`)
console.log(`Summary: ${path.relative(ROOT, SUMMARY)}`)
