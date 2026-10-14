/**
 * Does the county name this contact as the owner of a parcel? (Matt 2026-10-14)
 *
 * Pure. No I/O. The DAL (lib/data/crm/getCountyOwnership.ts) hands in county
 * owner-of-record strings and the contact's names and addresses; this module
 * decides, conservatively, how each parcel relates to the contact.
 *
 * THE RULE. Ownership is claimed only when the recorded owner string NAMES the
 * contact: the same first name in the first-name position and the same family
 * name, with a middle initial and a Jr/Sr that do not contradict. Nothing is
 * fuzzy across family names, no nickname is equal to a given name, and a lone
 * initial never stands in for a first name. An entity owner (an LLC, a
 * corporation) never names a person. A trust names the people its title
 * carries ("DAVID & MARGO KREMERS TRUST"), and a trust titled only by a family
 * name ("KREMERS FAMILY TRUST") names nobody.
 *
 *   high      the owner of record names them AND the parcel's site or tax
 *             mailing address is an address we hold for them
 *   medium    the owner of record names them, no address of theirs matches
 *   resident  one of their addresses IS the parcel, the owner of record does
 *             not name them ("lives at, not owner of record")
 *
 * How the counties write a name (measured on the live layers 2026-10-14):
 *   Deschutes  "LAST, FIRST M & FIRST M", "LAST, FIRST & LAST, FIRST",
 *              "FIRST & FIRST LAST TRUST" (no comma: first-name order)
 *   Crook      "LAST FIRST M & FIRST M" (no comma: family name first)
 *   westside_parcels  structured owner1_first/owner1_last/owner2_first/
 *              owner2_last; a trust or company sits whole in owner1_first
 */

import { isCompanyOwnedEntity } from '@/lib/prospecting/company-owner'
import { SUFFIX_CANON } from '@/lib/data/crm/addressMatch'

// ── Shared text helpers ───────────────────────────────────────────────────────

/** Upper-case, accents folded, apostrophes dropped (O'BRIEN -> OBRIEN). */
export function foldText(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Letters only: the comparable key of a name or name part. */
export function nameKey(s: string | null | undefined): string {
  return foldText(s).replace(/[^A-Z]/g, '')
}

function words(s: string): string[] {
  return s
    .replace(/[^A-Z0-9 -]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter(Boolean)
}

const SUFFIXES = new Map<string, string>([
  ['JR', 'JR'],
  ['SR', 'SR'],
  ['II', 'II'],
  ['III', 'III'],
  ['IV', 'IV'],
  ['2ND', 'II'],
  ['3RD', 'III'],
])
const HONORIFICS = new Set(['MR', 'MRS', 'MS', 'MISS', 'DR'])
const SURNAME_PARTICLES = new Set(['VAN', 'VON', 'DE', 'DEL', 'DELA', 'LA', 'LE', 'DI', 'DA', 'ST', 'MAC', 'MC', 'O'])

/** A token that can be a given name or family name: letters, two or more. */
function isNameWord(t: string | undefined): t is string {
  return typeof t === 'string' && /^[A-Z][A-Z-]+$/.test(t) && nameKey(t).length >= 2
}

/** A lone initial ("A", "B."). */
function isInitial(t: string | undefined): boolean {
  return typeof t === 'string' && /^[A-Z]$/.test(t)
}

// ── Owner of record ───────────────────────────────────────────────────────────

export type OwnerKind = 'person' | 'trust' | 'entity'

/** One person an owner string names. `surnames` are the family names the record allows for them. */
export type OwnerParty = {
  first: string
  middles: string[]
  surnames: string[]
  suffix: string | null
}

export type ParsedOwner = {
  raw: string
  kind: OwnerKind
  /** People the record names. A segment the county order leaves ambiguous yields one entry per reading. */
  parties: OwnerParty[]
  /** Every family name on the record, named parties and surname-only trusts alike. */
  familyNames: string[]
}

/** Deschutes writes "LAST, FIRST" with a comma; Crook writes "LAST FIRST" without one. */
export type OwnerNameOrder = 'comma' | 'surname-first'

const TRUST_RE =
  /\b(?:TRUSTS?|TRUSTEES?|TTEES?|CO-?TTEES?|CO-?TRUSTEES?|TRS|ESTATE|REVOCABLE|IRREVOCABLE|REV|IRREV|LIVING)\b/
// Words a trust, estate or tenancy title adds around the people it names.
const TITLE_WORD_RE =
  /\b(?:TRUSTS?|TRUSTEES?|TTEES?|CO-?TTEES?|CO-?TRUSTEES?|TRS?|SUCCESSOR|SUCC|REVOCABLE|IRREVOCABLE|REV|IRREV|LIVING|LIV|FAMILY|FAM|THE|OF|DATED|DTD|UTD|UAD|UA|AGREEMENT|AGMT|SURVIVORS?|JTWROS|JT|TENANTS|ENTIRETY|ESTATE|DECEASED|DECD|PERSONAL|REPRESENTATIVE|LIFE|INTEREST|ET\s+UX|ET\s+VIR|ET\s*AL|ETAL)\b/g
// Owners that are organizations even without an LLC/INC marker.
const ENTITY_EXTRA_RE =
  /\b(?:PROPERTIES|HOLDINGS|BANK|HOA|ASSOC|ASSOCIATION|COMPANY|PARTNERS|PARTNERSHIP|CITY OF|COUNTY OF|STATE OF|UNITED STATES|FOUNDATION|DISTRICT|INVESTMENTS?|VENTURES|ENTERPRISES|RENTALS|DEVELOPMENT|MINISTRIES|COOPERATIVE|AUTHORITY)\b/

export function ownerKindOf(raw: string): OwnerKind {
  const text = foldText(raw)
  if (!text) return 'person'
  if (isCompanyOwnedEntity(text) || ENTITY_EXTRA_RE.test(text)) return 'entity'
  if (TRUST_RE.test(text)) return 'trust'
  return 'person'
}

// Tenancy markers that are never a name, stripped from every owner string.
const TENANCY_RE = /\b(?:ET\s+UX|ET\s+VIR|ET\s*AL|ETAL|JTWROS)\b/g

/**
 * Trust and estate title words come off only when the owner is a trust: on a
 * person, LIV, FAM and TR can be a given name or initials ("NILSEN, LIV").
 */
function cleanOwnerText(raw: string, kind: OwnerKind): string {
  let t = foldText(raw)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bC\/O\b.*$/g, ' ')
    .replace(/%.*$/g, ' ')
    .replace(TENANCY_RE, ' ')
  if (kind === 'trust') t = t.replace(TITLE_WORD_RE, ' ')
  return t
    .replace(/\b\d[\d/-]*\b/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSegments(text: string): string[] {
  return text
    .split(/\s*(?:&|\/|;|\bAND\b)\s*/)
    .map((s) => s.replace(/^[,\s]+|[,\s]+$/g, '').trim())
    .filter(Boolean)
}

/** Pull Jr/Sr/II/III and honorifics out of a token list. */
function stripAffixes(tokens: string[]): { tokens: string[]; suffix: string | null } {
  let suffix: string | null = null
  const out: string[] = []
  for (const t of tokens) {
    const bare = t.replace(/\.$/, '')
    const s = SUFFIXES.get(bare)
    if (s) {
      suffix = s
      continue
    }
    if (HONORIFICS.has(bare)) continue
    out.push(bare)
  }
  return { tokens: out, suffix }
}

function partyFrom(given: string[], surnames: string[], suffix: string | null): OwnerParty | null {
  const first = given[0]
  if (!isNameWord(first)) return null
  const keys = Array.from(new Set(surnames.map(nameKey).filter((k) => k.length >= 2)))
  if (keys.length === 0) return null
  return { first: nameKey(first), middles: given.slice(1).map(nameKey).filter(Boolean), surnames: keys, suffix }
}

/** The family name at the head of a surname-first token list, particles kept together (VAN DYKE). */
function leadingSurname(tokens: string[]): { surname: string; rest: string[] } {
  if (tokens.length >= 3 && SURNAME_PARTICLES.has(tokens[0]!)) {
    return { surname: tokens[0]! + tokens[1]!, rest: tokens.slice(2) }
  }
  return { surname: tokens[0] ?? '', rest: tokens.slice(1) }
}

/** The family name at the end of a first-name-order token list, particles kept together (VAN DOREN). */
function trailingSurname(tokens: string[]): { surname: string; given: string[] } {
  const n = tokens.length
  if (n >= 3 && SURNAME_PARTICLES.has(tokens[n - 2]!)) {
    return { surname: tokens[n - 2]! + tokens[n - 1]!, given: tokens.slice(0, -2) }
  }
  return { surname: tokens[n - 1] ?? '', given: tokens.slice(0, -1) }
}

/** The parties and family names one reading of an owner string yields. */
class Reading {
  parties: OwnerParty[] = []
  familyNames: string[] = []
  push(p: OwnerParty | null): void {
    if (p) this.parties.push(p)
  }
  family(s: string): void {
    const k = nameKey(s)
    if (k.length >= 2 && !this.familyNames.includes(k)) this.familyNames.push(k)
  }
}

/** "LAST, FIRST M & FIRST M" / "LAST, FIRST & LAST, FIRST" / "LAST, FIRST & FIRST LAST". */
function readCommaOrder(segments: string[]): Reading {
  const r = new Reading()
  let lastSeen: string | null = null
  for (const seg of segments) {
    if (seg.includes(',')) {
      const [l, rest] = seg.split(',', 2)
      const sur = stripAffixes(words(l ?? ''))
      const given = stripAffixes(words(rest ?? ''))
      const surname = sur.tokens.join('')
      if (nameKey(surname).length >= 2) {
        lastSeen = surname
        r.family(surname)
      }
      if (lastSeen) r.push(partyFrom(given.tokens, [lastSeen], given.suffix ?? sur.suffix))
      continue
    }
    const { tokens, suffix } = stripAffixes(words(seg))
    if (tokens.length === 0) continue
    if (lastSeen) r.push(partyFrom(tokens, [lastSeen], suffix))
    // "& KATHLEEN BERNARD" can also be a second family name; allow that reading too.
    if (tokens.length >= 2 && isNameWord(tokens[tokens.length - 1])) {
      const { surname, given } = trailingSurname(tokens)
      r.push(partyFrom(given, [surname], suffix))
      r.family(surname)
    }
  }
  return r
}

/** Crook: "LAST FIRST M & FIRST M" or "LAST FIRST & LAST FIRST". */
function readSurnameFirst(segments: string[]): Reading {
  const r = new Reading()
  let lead: string | null = null
  segments.forEach((seg, i) => {
    const { tokens, suffix } = stripAffixes(words(seg))
    if (tokens.length === 0) return
    if (i === 0 || !lead) {
      const { surname, rest } = leadingSurname(tokens)
      if (nameKey(surname).length < 2) return
      lead = surname
      r.family(surname)
      r.push(partyFrom(rest, [surname], suffix))
      return
    }
    // Reading A: shares the lead family name ("& JANE B").
    r.push(partyFrom(tokens, [lead], suffix))
    // Reading B: carries its own family name first ("& YOUNG ROBERT").
    if (tokens.length >= 2) {
      const { surname, rest } = leadingSurname(tokens)
      if (nameKey(surname).length >= 2) {
        r.family(surname)
        r.push(partyFrom(rest, [surname], suffix))
      }
    }
  })
  return r
}

/** First-name order without a comma: "FIRST M & FIRST M LAST" (a trust title) or "LAST" alone. */
function readFirstNameOrder(segments: string[]): Reading {
  const r = new Reading()
  const tokenSets = segments.map((s) => stripAffixes(words(s)))
  const multi = tokenSets.filter((t) => t.tokens.length >= 2)
  const lastMulti = multi[multi.length - 1]?.tokens
  const shared =
    lastMulti && isNameWord(lastMulti[lastMulti.length - 1]) ? trailingSurname(lastMulti).surname : null
  if (shared) r.family(shared)
  for (const { tokens, suffix } of tokenSets) {
    if (tokens.length === 0) continue
    if (tokens.length === 1) {
      if (shared && nameKey(tokens[0]) !== nameKey(shared)) r.push(partyFrom(tokens, [shared], suffix))
      else r.family(tokens[0]!)
      continue
    }
    const tail = tokens[tokens.length - 1]!
    if (isInitial(tail) || !isNameWord(tail)) {
      if (shared) r.push(partyFrom(tokens, [shared], suffix))
      continue
    }
    // A full last word is that person's own family name ("JOHN SMITH & JANE DOE"):
    // never also the shared one, so John Doe is not read into it.
    const { surname, given } = trailingSurname(tokens)
    r.family(surname)
    r.push(partyFrom(given, [surname], suffix))
  }
  return r
}

/**
 * Parse a county owner-of-record string into the people it names.
 * Empty input, or an entity, names nobody.
 *
 * Why not lib/crm/household-names.ts parseOwnerHousehold: that parser picks
 * one reading of a Deschutes string to choose a letter greeting. Ownership
 * needs every reading a county's order allows (Crook writes family name first,
 * and a Crook trust title can be in first-name order), and Jr/Sr kept, so a
 * name is never read into a party the record does not allow.
 */
export function parseOwnerOfRecord(raw: string | null | undefined, order: OwnerNameOrder): ParsedOwner {
  const text = foldText(raw)
  const kind = ownerKindOf(text)
  const empty: ParsedOwner = { raw: text, kind, parties: [], familyNames: [] }
  if (!text || kind === 'entity') return empty

  const segments = splitSegments(cleanOwnerText(text, kind))
  const readings: Reading[] = []
  if (segments.some((s) => s.includes(','))) readings.push(readCommaOrder(segments))
  else if (order === 'surname-first') {
    readings.push(readSurnameFirst(segments))
    // A Crook trust can be titled in first-name order ("CHAD M PENHOLLOW REVOCABLE LIVING TRUST").
    if (kind === 'trust') readings.push(readFirstNameOrder(segments))
  } else readings.push(readFirstNameOrder(segments))

  const familyNames: string[] = []
  for (const r of readings) for (const f of r.familyNames) if (!familyNames.includes(f)) familyNames.push(f)
  return { raw: text, kind, parties: readings.flatMap((r) => r.parties), familyNames }
}

/** The westside_parcels assessor export carries owners as structured fields. */
export function parseStructuredOwner(row: {
  owner1_first?: string | null
  owner1_last?: string | null
  owner2_first?: string | null
  owner2_last?: string | null
  all_owners?: string | null
}): ParsedOwner {
  const o1f = foldText(row.owner1_first)
  const o1l = foldText(row.owner1_last)
  const raw = foldText(row.all_owners) || [o1f, o1l].filter(Boolean).join(' ')
  // A trust or company is written whole into owner1_first with no last name.
  if (!o1l && o1f) return parseOwnerOfRecord(o1f, 'comma')
  const kind = ownerKindOf(raw)
  if (kind === 'entity') return { raw, kind, parties: [], familyNames: [] }
  const parties: OwnerParty[] = []
  const familyNames: string[] = []
  for (const [f, l] of [
    [row.owner1_first, row.owner1_last],
    [row.owner2_first, row.owner2_last],
  ] as const) {
    const sur = stripAffixes(words(foldText(l)))
    const given = stripAffixes(words(foldText(f)))
    const surname = sur.tokens.join('')
    if (nameKey(surname).length < 2) continue
    if (!familyNames.includes(nameKey(surname))) familyNames.push(nameKey(surname))
    const p = partyFrom(given.tokens, [surname], given.suffix ?? sur.suffix)
    if (p) parties.push(p)
  }
  return { raw, kind, parties, familyNames }
}

// ── The contact ───────────────────────────────────────────────────────────────

export type ContactPerson = {
  first: string
  middles: string[]
  last: string
  suffix: string | null
  /** The name as the contact record spells it ("Jane O'Pellworth"), for display only. */
  display: string
}

export type ContactIdentity = {
  /** The people a contact name carries ("John & Jane Smith" is two). */
  people: ContactPerson[]
  /** Set when the contact itself is an organization or a trust: its comparable key. */
  entityKey: string | null
  /**
   * The same two-word names read the other way round. Imported farm lists put
   * "FAERBER SUSAN" into first_name/last_name in county order. A reversed
   * reading may only corroborate a parcel that is also one of their addresses;
   * on its own it is never a match (classifyParcel).
   */
  reversed: ContactPerson[]
}

function contactPerson(givenTokens: string[], lastTokens: string[], suffix: string | null): ContactPerson | null {
  const given = givenTokens.filter((t) => !HONORIFICS.has(t))
  const first = given[0]
  const last = nameKey(lastTokens.join(''))
  if (!isNameWord(first) || last.length < 2) return null
  const first_ = nameKey(first)
  return { first: first_, middles: given.slice(1).map(nameKey).filter(Boolean), last, suffix, display: '' }
}

/** Title-case a name piece only when the record wrote it all in one case. */
function displayCase(s: string): string {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s
  return s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase())
}

/** The record's own spelling of a name key: a word, two adjacent words, or the whole field. */
export function recordSpelling(key: string, input: { first_name?: string | null; last_name?: string | null; name?: string | null }): string {
  const fields = [input.last_name, input.first_name, input.name].map((f) => String(f ?? '').trim()).filter(Boolean)
  const pool: string[] = [...fields]
  for (const f of fields) {
    const ws = f.split(/[\s&/;,]+/).map((w) => w.replace(/[.,]+$/, '')).filter(Boolean)
    pool.push(...ws)
    for (let i = 0; i + 1 < ws.length; i++) pool.push(`${ws[i]} ${ws[i + 1]}`)
  }
  const hit = pool.find((w) => nameKey(w) === key)
  return displayCase(hit ?? key)
}

function entityKeyOf(text: string): string {
  return nameKey(text.replace(/\bTHE\b/g, ' '))
}

/** Read a crm_people name into the people it carries. Missing parts name nobody. */
export function parseContactName(input: {
  first_name?: string | null
  last_name?: string | null
  name?: string | null
}): ContactIdentity {
  const firstField = foldText(input.first_name)
  const lastField = foldText(input.last_name)
  const full = foldText(input.name) || [firstField, lastField].filter(Boolean).join(' ')
  if (full && (isCompanyOwnedEntity(full) || ENTITY_EXTRA_RE.test(full))) {
    return { people: [], entityKey: entityKeyOf(full), reversed: [] }
  }
  if (full && TRUST_RE.test(full)) {
    // A contact that is a trust: its whole title, plus the people the title names.
    const people = parseOwnerOfRecord(full, 'comma')
      .parties.map((p) => ({ first: p.first, middles: p.middles, last: p.surnames[0]!, suffix: p.suffix, display: '' }))
      .filter((p) => p.last)
    return { people: withDisplay(people, input), entityKey: entityKeyOf(full), reversed: [] }
  }
  const people: ContactPerson[] = []
  const add = (p: ContactPerson | null) => {
    if (p && !people.some((q) => q.first === p.first && q.last === p.last)) people.push(p)
  }
  const reversedOf = (given: string[], last: string[]): ContactPerson[] => {
    if (given.length !== 1 || last.length !== 1) return []
    const r = contactPerson(last, given, null)
    return r ? withDisplay([r], input) : []
  }

  if (firstField && lastField) {
    const last = stripAffixes(words(lastField))
    const segs = splitSegments(firstField)
    // "John & Jane" in the first-name field: each given name shares the last name.
    for (const seg of segs) {
      const given = stripAffixes(words(seg))
      add(contactPerson(given.tokens, last.tokens, given.suffix ?? last.suffix))
    }
    const one = segs.length === 1 ? stripAffixes(words(segs[0]!)) : null
    return {
      people: withDisplay(people, input),
      entityKey: null,
      reversed: one && !one.suffix && !last.suffix ? reversedOf(one.tokens, last.tokens) : [],
    }
  }

  if (!full) return { people, entityKey: null, reversed: [] }
  // Name only, written "Smith, John" (a trailing ", Jr." is not that comma).
  const commaForm = full.replace(/,\s*(JR|SR|II|III|IV)\.?\s*$/, ' $1')
  if (commaForm.includes(',')) {
    for (const p of parseOwnerOfRecord(commaForm, 'comma').parties) {
      add({ first: p.first, middles: p.middles, last: p.surnames[0]!, suffix: p.suffix, display: '' })
    }
    return { people: withDisplay(people, input), entityKey: null, reversed: [] }
  }
  // Name only: "John A Smith", "John & Jane Smith", "John Smith & Jane Doe".
  const segs = splitSegments(full).map((s) => stripAffixes(words(s)))
  const multi = segs.filter((s) => s.tokens.length >= 2)
  const shared = multi[multi.length - 1]?.tokens
  const sharedLast = shared ? shared[shared.length - 1]! : null
  for (const seg of segs) {
    if (seg.tokens.length >= 2) {
      // "Marta Van Doren": a particle before the last word belongs to the family name.
      const cut = seg.tokens.length >= 3 && SURNAME_PARTICLES.has(seg.tokens[seg.tokens.length - 2]!) ? 2 : 1
      add(contactPerson(seg.tokens.slice(0, -cut), seg.tokens.slice(-cut), seg.suffix))
    } else if (seg.tokens.length === 1 && sharedLast) {
      add(contactPerson(seg.tokens, [sharedLast], seg.suffix))
    }
  }
  const only = segs.length === 1 && segs[0]!.tokens.length === 2 && !segs[0]!.suffix ? segs[0]!.tokens : null
  return {
    people: withDisplay(people, input),
    entityKey: null,
    reversed: only ? reversedOf([only[0]!], [only[1]!]) : [],
  }
}

function withDisplay(
  people: ContactPerson[],
  input: { first_name?: string | null; last_name?: string | null; name?: string | null },
): ContactPerson[] {
  return people.map((p) => ({ ...p, display: `${recordSpelling(p.first, input)} ${recordSpelling(p.last, input)}` }))
}

/** True when this owner-record party is this contact person. */
export function partyIsPerson(party: OwnerParty, person: ContactPerson): boolean {
  if (party.first !== person.first) return false
  if (!party.surnames.includes(person.last)) return false
  const pm = party.middles[0]
  const cm = person.middles[0]
  if (pm && cm && pm[0] !== cm[0]) return false
  if (party.suffix && person.suffix && party.suffix !== person.suffix) return false
  return true
}

/** The first contact person the owner record names, or null. */
export function ownerNamesContact(
  owner: ParsedOwner,
  contact: Pick<ContactIdentity, 'people' | 'entityKey'>,
): ContactPerson | 'entity' | null {
  // A company or trust contact is named by its own title, word for word.
  if (contact.entityKey && contact.entityKey.length >= 4 && entityKeyOf(owner.raw) === contact.entityKey) return 'entity'
  if (owner.kind === 'entity') return null
  for (const person of contact.people) {
    if (owner.parties.some((p) => partyIsPerson(p, person))) return person
  }
  return null
}

/** Two owner records name the same owner: a shared named person, or the same entity text. */
export function sameOwnerOfRecord(a: ParsedOwner, b: ParsedOwner): boolean {
  if (a.kind === 'entity' || b.kind === 'entity') return a.kind === b.kind && entityKeyOf(a.raw) === entityKeyOf(b.raw)
  for (const pa of a.parties) {
    for (const pb of b.parties) {
      if (pa.first === pb.first && pa.surnames.some((s) => pb.surnames.includes(s))) return true
    }
  }
  if (a.parties.length === 0 && b.parties.length === 0) {
    return a.familyNames.length > 0 && a.familyNames.some((f) => b.familyNames.includes(f))
  }
  return false
}

// ── Addresses ─────────────────────────────────────────────────────────────────

export type StreetAddress = {
  number: string
  /** Canonical directional (N, NE, ...), from before or after the street name. */
  direction: string
  /** Street-name tokens with suffix words folded to one spelling (STREET -> ST). */
  core: string[]
  unit: string
  /** nameKey of the city; '' when unknown. */
  city: string
  /** Five-digit zip; '' when unknown. */
  zip: string
}

const DIRECTION_CANON: Record<string, string> = {
  N: 'N',
  S: 'S',
  E: 'E',
  W: 'W',
  NE: 'NE',
  NW: 'NW',
  SE: 'SE',
  SW: 'SW',
  NORTH: 'N',
  SOUTH: 'S',
  EAST: 'E',
  WEST: 'W',
  NORTHEAST: 'NE',
  NORTHWEST: 'NW',
  SOUTHEAST: 'SE',
  SOUTHWEST: 'SW',
}
const SUFFIX_VALUES = new Set(Object.values(SUFFIX_CANON).map((v) => v.toUpperCase()))
// A unit is a number, a number with letters, or one letter: "APT 4", "#B12", "UNIT C".
// "LOT RD" is a street, not lot "RD".
const UNIT_RE = /(?:\s+|^)(?:#|APT|APARTMENT|UNIT|STE|SUITE|SPC|SPACE|LOT|BLDG)\.?\s*#?\s*([A-Z]?\d[A-Z0-9-]*|[A-Z])\s*$/

/** Parse one street line. No civic number (a PO box, a bare street) parses to null. */
export function parseStreetLine(
  street: string | null | undefined,
  place?: { city?: string | null; zip?: string | null; unit?: string | null },
): StreetAddress | null {
  let s = foldText(street).split(',')[0]!.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
  if (!s || /^(?:P\s*O|POST OFFICE)\s*BOX\b/.test(s) || /^BOX\b/.test(s)) return null
  let unit = foldText(place?.unit).replace(/[^A-Z0-9]/g, '')
  const um = s.match(UNIT_RE)
  if (um) {
    unit = unit || um[1]!.replace(/[^A-Z0-9]/g, '')
    s = s.slice(0, um.index).trim()
  }
  const hash = s.match(/\s#\s*([A-Z]?\d[A-Z0-9-]*|[A-Z])\b/)
  if (hash) {
    unit = unit || hash[1]!.replace(/[^A-Z0-9]/g, '')
    s = s.replace(hash[0], ' ').trim()
  }
  let toks = words(s)
  // "2439 NW Drouillard Ave 5": a bare number after the street type is the unit.
  const tail = toks[toks.length - 1]
  if (!unit && toks.length >= 4 && tail && /^(?:\d+[A-Z]?|[A-Z]\d+)$/.test(tail)) {
    const before = toks[toks.length - 2]!.toLowerCase()
    // Not after a road or highway word: "County Road 5" and "Old Hwy 20" are road names.
    if (SUFFIX_CANON[before] && !['rd', 'road', 'hwy', 'highway'].includes(before)) {
      unit = tail
      toks = toks.slice(0, -1)
    }
  }
  const num = toks[0]
  if (!num || !/^\d+[A-Z]?$/.test(num)) return null
  let rest = toks.slice(1).filter((t) => !/^\d+\/\d+$/.test(t))
  let direction = ''
  if (rest.length > 1 && DIRECTION_CANON[rest[0]!]) {
    direction = DIRECTION_CANON[rest[0]!]!
    rest = rest.slice(1)
  }
  if (rest.length > 1 && DIRECTION_CANON[rest[rest.length - 1]!]) {
    direction = direction || DIRECTION_CANON[rest[rest.length - 1]!]!
    rest = rest.slice(0, -1)
  }
  const core = rest.map((t) => (SUFFIX_CANON[t.toLowerCase()] ?? t.toLowerCase()).toUpperCase())
  if (core.length === 0) return null
  const zip = String(place?.zip ?? '').replace(/[^0-9]/g, '').slice(0, 5)
  return {
    number: num.replace(/^0+(?=\d)/, ''),
    direction,
    core,
    unit,
    city: nameKey(place?.city),
    zip: zip.length === 5 ? zip : '',
  }
}

function trailingSuffix(c: string[]): string | null {
  return c.length > 1 && SUFFIX_VALUES.has(c[c.length - 1]!) ? c[c.length - 1]! : null
}

function coresMatch(a: string[], b: string[]): boolean {
  const ja = a.join(' ')
  const jb = b.join(' ')
  if (ja === jb) return true
  const sa = trailingSuffix(a)
  const sb = trailingSuffix(b)
  const ba = sa ? a.slice(0, -1).join(' ') : ja
  const bb = sb ? b.slice(0, -1).join(' ') : jb
  // One side omits the street type ("BOND" vs "BOND ST"); two different types are two streets.
  if (ba === bb) return !sa || !sb || sa === sb
  // A type word inside the name ("HARRINGTON LOOP" vs "HARRINGTON LOOP RD").
  return (!!sb && ja === bb) || (!!sa && jb === ba)
}

/**
 * The same street address: civic number, street name and type, a directional
 * that does not contradict (NW BOND and SW BOND are two streets), and a unit
 * that does not contradict. A parcel with a unit is a match only for an address
 * that carries the same unit, so one building never lists every condo in it.
 */
export function sameStreet(contact: StreetAddress, parcel: StreetAddress): boolean {
  if (contact.number !== parcel.number) return false
  if (contact.direction && parcel.direction && contact.direction !== parcel.direction) return false
  if (!coresMatch(contact.core, parcel.core)) return false
  if (parcel.unit && contact.unit !== parcel.unit) return false
  return true
}

/**
 * The contact's address is in the parcel's place. With a city or zip on both
 * sides one must agree. A parcel carrying neither (Crook's site address has no
 * city) needs the contact's place to be one of `fallbackPlaces`.
 */
export function samePlace(
  contact: StreetAddress,
  parcel: StreetAddress,
  fallbackPlaces?: { cities: readonly string[]; zips: readonly string[] },
): boolean {
  const cityOk = !!contact.city && !!parcel.city && contact.city === parcel.city
  const zipOk = !!contact.zip && !!parcel.zip && contact.zip === parcel.zip
  if (cityOk || zipOk) return true
  if (!parcel.city && !parcel.zip && fallbackPlaces) {
    return (
      (!!contact.city && fallbackPlaces.cities.map(nameKey).includes(contact.city)) ||
      (!!contact.zip && fallbackPlaces.zips.includes(contact.zip))
    )
  }
  return false
}

// ── Classification ────────────────────────────────────────────────────────────

export type MatchStrength = 'high' | 'medium' | 'resident'

export type ContactAddress = { label: string; address: StreetAddress }

export type RelatedContact = { label: string; name: string; identity: ContactIdentity }

export type ParcelEvidence = {
  owner: ParsedOwner
  situs: StreetAddress | null
  mailing: StreetAddress | null
  /** Places a situs without its own city or zip may be matched in. */
  situsPlaces?: { cities: readonly string[]; zips: readonly string[] }
}

export type ParcelClassification = {
  strength: MatchStrength
  /** The contact person the record names (high, medium). */
  named: ContactPerson | 'entity' | null
  /** Which of their addresses is the site address, or the tax mailing address. */
  siteAddressLabel: string | null
  mailingAddressLabel: string | null
  /** resident only: the owner record carries their family name without naming them. */
  sharesFamilyName: boolean
  /** resident only: the owner record names a contact linked to them. */
  namesRelated: { label: string; name: string } | null
  /** high only: the name matched with the contact record's first and last name reversed. */
  nameReversed: boolean
}

function addressHit(
  addresses: ContactAddress[],
  target: StreetAddress | null,
  places?: { cities: readonly string[]; zips: readonly string[] },
): string | null {
  if (!target) return null
  for (const a of addresses) {
    if (sameStreet(a.address, target) && samePlace(a.address, target, places)) return a.label
  }
  return null
}

/** How one parcel relates to the contact, or null when it does not. */
export function classifyParcel(
  contact: ContactIdentity,
  addresses: ContactAddress[],
  parcel: ParcelEvidence,
  related: RelatedContact[] = [],
): ParcelClassification | null {
  const named = ownerNamesContact(parcel.owner, contact)
  const siteAddressLabel = addressHit(addresses, parcel.situs, parcel.situsPlaces)
  const mailingAddressLabel = addressHit(addresses, parcel.mailing)
  if (named) {
    return {
      strength: siteAddressLabel || mailingAddressLabel ? 'high' : 'medium',
      named,
      siteAddressLabel,
      mailingAddressLabel,
      sharesFamilyName: false,
      namesRelated: null,
      nameReversed: false,
    }
  }
  // A reversed reading counts only with the address agreeing too, and only as itself.
  if (siteAddressLabel || mailingAddressLabel) {
    const reversed = ownerNamesContact(parcel.owner, { people: contact.reversed, entityKey: null })
    if (reversed) {
      return {
        strength: 'high',
        named: reversed,
        siteAddressLabel,
        mailingAddressLabel,
        sharesFamilyName: false,
        namesRelated: null,
        nameReversed: true,
      }
    }
  }
  if (!siteAddressLabel) return null
  const lastNames = contact.people.map((p) => p.last)
  const sharesFamilyName =
    lastNames.some((l) => parcel.owner.familyNames.includes(l)) ||
    lastNames.some((l) => parcel.owner.parties.some((p) => p.surnames.includes(l)))
  let namesRelated: { label: string; name: string } | null = null
  for (const r of related) {
    if (ownerNamesContact(parcel.owner, r.identity)) {
      namesRelated = { label: r.label, name: r.name }
      break
    }
  }
  return { strength: 'resident', named: null, siteAddressLabel, mailingAddressLabel, sharesFamilyName, namesRelated, nameReversed: false }
}

/**
 * The longest run of letters in a raw name, apostrophes and hyphens as breaks:
 * "O'Darragh" -> "DARRAGH", "Smith-Jones" -> "SMITH". A county may write the
 * apostrophe or the space the contact record dropped, so the search looks for
 * this run and the matcher (which compares letters-only keys) decides.
 */
export function longestLetterRun(raw: string | null | undefined): string {
  const runs = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .match(/[A-Z]+/g)
  if (!runs) return ''
  return runs.reduce((best, r) => (r.length > best.length ? r : best), '')
}

/** Display a contact person the way the record matched them: "Margo Kremers". */
export function contactPersonLabel(p: ContactPerson): string {
  if (p.display) return p.display
  const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
  return `${cap(p.first)} ${cap(p.last)}`
}

/**
 * The plain-words line a broker reads for one classified parcel. Address labels
 * are noun phrases the DAL writes ("mailing address on their record",
 * "property on their deal").
 */
export function describeMatch(c: ParcelClassification, ownerRaw: string, ownerKind: OwnerKind): string {
  const owner = ownerRaw.trim()
  if (c.strength === 'high' || c.strength === 'medium') {
    const who = c.named && c.named !== 'entity' ? contactPersonLabel(c.named) : 'this contact'
    const via = ownerKind === 'trust' ? `, a trust that names ${who}` : ''
    if (c.strength === 'high') {
      const where = c.siteAddressLabel
        ? `this property is the ${c.siteAddressLabel}`
        : `the county mails its tax statement to the ${c.mailingAddressLabel}`
      const reversed = c.nameReversed ? ' (first and last name are reversed on the contact record)' : ''
      return `Owner of record: ${owner}${via}. The name matches ${who}${reversed}, and ${where}.`
    }
    return `Owner of record: ${owner}${via}. The name matches ${who}, but no address we hold for them is this property or its tax mailing address, so it could be someone else with the same name.`
  }
  const what = ownerKind === 'entity' ? 'a company' : ownerKind === 'trust' ? 'a trust that does not name them' : 'not them'
  let note = ''
  if (c.namesRelated) note = ` It names their ${c.namesRelated.label.toLowerCase()}, ${c.namesRelated.name}.`
  else if (c.sharesFamilyName) note = ' It carries their last name.'
  return `This property is the ${c.siteAddressLabel}. The owner of record is ${owner}, ${what}.${note}`
}
