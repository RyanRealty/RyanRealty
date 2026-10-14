/**
 * Who a county owner-of-record names, and which of them an email belongs to.
 *
 * WHY (Matt 2026-10-14, 429 Irving). The county listed "DAVID & MARGO KREMERS
 * TRUST". The skip trace returned one person record, Margo, carrying the
 * household's emails, and the first email was dkremers@hotmail.com. The letter
 * opened "Hi Margo," in David's inbox and he wrote back as Dave. The same shape
 * sent "Hi Jason," to aletakatra@ (LAFFERTY, JASON C & ALETA P) and "Hi James,"
 * to roopal74@ (GROSS, JAMES M & MEHTA, ROOPAL R). Nothing in the chain had
 * compared the greeted name with the address being mailed.
 *
 * THE RULE. A letter greets a person by name only when the name and the email
 * belong to the same person. When the owner of record names two or more
 * people, the email's local part decides: the stored name stays when the
 * local part carries it, the greeting moves to the co-owner it does carry, and
 * otherwise the letter says "Hi there,". One named owner with an email that
 * carries no name keeps the stored name; there is nobody else it could be. An
 * email built from the family surname with a first name or initial that
 * belongs to nobody on record is another household member, so "Hi there,".
 *
 * Pure. The county string is parsed here, never guessed at: Deschutes writes a
 * person as "LAST, FIRST M", a couple as "LAST, FIRST M & FIRST M" or
 * "LAST, FIRST & LAST, FIRST", and a trust as "FIRST & FIRST LAST TRUST".
 */

import { isPlausibleFirstName } from '@/lib/crm/merge'
import { isCompanyOwnedEntity } from '@/lib/prospecting/company-owner'

export type HouseholdPerson = {
  first: string
  last: string | null
  /** Every given-name token on the record, first name included: ["Erin", "C"], ["Eugene", "Eric"]. */
  given?: string[]
}

export type OwnerHousehold = {
  raw: string
  /** Named people, title-cased ("David", "Kremers"). */
  people: HouseholdPerson[]
  /** Family names on the record: every person's surname plus surname-only parties. */
  surnames: string[]
  /** Parties the record lists: named people, surname-only parties, and an ET AL. */
  parties: number
  entity: boolean
}

export type EmailNameMatch = 'strong' | 'weak' | 'none'

/** The county owner string names an entity, not a person (the same test lib/owner-resolution.mjs runs). */
export const OWNER_ENTITY_RE = /\b(LLC|TRUST|TRUSTEE|INC|CORP|LP|LLP|PARTNERSHIP|PROPERTIES|HOLDINGS|ESTATE|BANK|HOA|ASSOC)\b/i
const ENTITY_RE = OWNER_ENTITY_RE
const ET_AL_RE = /\bET\s*AL\b\.?/g
// Words a trust or estate title adds around the people it names.
const TITLE_WORD_RE =
  /\b(?:TRUSTS?|TRUSTEES?|TTEES?|CO-?TTEES?|SUCCESSOR|SUCC|TR|REVOCABLE|IRREVOCABLE|REV|IRREV|LIVING|LIV|FAMILY|FAM|THE|OF|DATED|DTD|UTD|U\/?[AD]|AGREEMENT|AGMT|SURVIVORS?(?:'S)?|JTWROS|JT|ESTATE|ET\s+UX|ET\s+VIR)\b\.?/g

function titleCase(word: string): string {
  return word
    .toLowerCase()
    .split(/(['’-])/)
    .map((part) => (part.length > 0 && /[a-z]/i.test(part[0]!) ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join('')
}

function tokens(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean)
}

/** A name token the greeting could use: letters only, not a lone initial. */
function nameToken(t: string | undefined): string | null {
  const s = (t ?? '').replace(/[.,]+$/g, '')
  if (!/^[A-Za-z][A-Za-z'’-]*$/.test(s)) return null
  if (s.length < 2) return null
  return s
}

/** Every given-name token, initials included, title-cased: "EUGENE ERIC" -> ["Eugene", "Eric"], "ERIN C" -> ["Erin", "C"]. */
function givenTokens(parts: readonly string[]): string[] {
  return parts
    .map((t) => t.replace(/[.,]+$/g, ''))
    .filter((t) => /^[A-Za-z][A-Za-z'’-]*$/.test(t))
    .map(titleCase)
}

/** Parse a county owner string into the people it names. Empty input is an empty household. */
export function parseOwnerHousehold(raw: string | null | undefined): OwnerHousehold {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  const empty: OwnerHousehold = { raw: text, people: [], surnames: [], parties: 0, entity: false }
  if (!text) return empty
  const entity = ENTITY_RE.test(text)
  if (entity && isCompanyOwnedEntity(text)) return { ...empty, entity: true, parties: 1 }
  let cleaned = text.toUpperCase()
  const etAl = ET_AL_RE.test(cleaned)
  ET_AL_RE.lastIndex = 0
  cleaned = cleaned
    .replace(ET_AL_RE, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d[\d/-]*\b/g, ' ')
    .replace(/%/g, ' ')
    .replace(TITLE_WORD_RE, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  const segments = cleaned
    .split(/\s*(?:&|\/|\bAND\b)\s*/)
    .map((s) => s.replace(/^[,\s]+|[,\s]+$/g, '').trim())
    .filter(Boolean)
  const people: HouseholdPerson[] = []
  const surnames: string[] = []
  let parties = 0
  const hasComma = segments.some((s) => s.includes(','))
  if (hasComma) {
    // "LAST, FIRST M & FIRST M" and "LAST, FIRST & LAST, FIRST".
    let lastSeen: string | null = null
    for (const seg of segments) {
      if (seg.includes(',')) {
        const [l, rest] = seg.split(',', 2)
        const last = nameToken(tokens(l ?? '').join(' ')) ?? nameToken(tokens(l ?? '')[0])
        const given = givenTokens(tokens(rest ?? ''))
        const first = nameToken(tokens(rest ?? '')[0])
        if (last) lastSeen = titleCase(last)
        if (first) people.push({ first: titleCase(first), last: lastSeen, given })
        else if (lastSeen) surnames.push(lastSeen)
        parties++
      } else {
        const given = givenTokens(tokens(seg))
        const first = nameToken(tokens(seg)[0])
        if (first) people.push({ first: titleCase(first), last: lastSeen, given })
        else if (lastSeen) surnames.push(lastSeen)
        parties++
      }
    }
  } else {
    // "FIRST & FIRST LAST", "FIRST M LAST", "LAST" (a trust named for a family).
    const multi = segments.filter((s) => tokens(s).length >= 2)
    const sharedLast = multi.length > 0 ? nameToken(tokens(multi[multi.length - 1]!).at(-1)) : null
    for (const seg of segments) {
      const toks = tokens(seg)
      const first = nameToken(toks[0])
      if (toks.length >= 2) {
        const last = nameToken(toks[toks.length - 1])
        if (first) people.push({ first: titleCase(first), last: last ? titleCase(last) : null, given: givenTokens(toks.slice(0, -1)) })
        else if (last) surnames.push(titleCase(last))
        parties++
      } else if (sharedLast && first) {
        people.push({ first: titleCase(first), last: titleCase(sharedLast), given: [titleCase(first)] })
        parties++
      } else if (first) {
        surnames.push(titleCase(first))
        parties++
      }
    }
  }
  if (etAl) parties++
  for (const p of people) if (p.last && !surnames.includes(p.last)) surnames.push(p.last)
  return { raw: text, people, surnames, parties, entity }
}

function localPartOf(email: string | null | undefined): string | null {
  const s = String(email ?? '').trim().toLowerCase()
  const at = s.indexOf('@')
  if (at <= 0) return null
  return s.slice(0, at)
}

function norm(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')
}

/** The person's given names, lower-cased letters only, first name first. */
function givenOf(person: HouseholdPerson): string[] {
  const list = (person.given?.length ? person.given : [person.first]).map(norm).filter(Boolean)
  const first = norm(person.first)
  return first && !list.includes(first) ? [first, ...list] : list
}

/** True when `before` (letters that lead a surname in a local part) belongs to this person's given names. */
function prefixOwnedBy(before: string, person: HouseholdPerson): boolean {
  if (!before) return false
  for (const g of givenOf(person)) {
    if (g.length === 1) {
      if (before === g) return true
      continue
    }
    if (before === g || before.startsWith(g)) return true
    if (before.length === 1 && before === g[0]) return true
    if (before.length === 2 && before[0] === g[0]) return true
    if (g.length >= 5 && before.startsWith(g.slice(0, 3))) return true
    if (before.length >= 4 && g.endsWith(before)) return true
  }
  return false
}

/**
 * Does this email's local part carry this person? Strong when a given name is
 * there whole, or an initial with the surname (dkremers, cstulc for Erin C
 * Stulc, zludingt for a surname cut short). Weak when a short form of the
 * name sits with the surname (patlongclark for Patricia Clark, camehner for
 * Christine Mehner, randawells for Miranda Wells), the first four letters of
 * a longer name open the local part (margoabaker for Margaret, dallywally for
 * Dallin), five letters of a long name sit anywhere in it (lilchris for
 * Christopher), or the local part is the person's two initials (rw021585 for
 * Ryan Wood). None otherwise. Digits and punctuation do not count.
 */
export function emailNameMatch(email: string | null | undefined, person: HouseholdPerson): EmailNameMatch {
  const local = localPartOf(email)
  if (!local) return 'none'
  const letters = local.replace(/[^a-z]/g, '')
  const parts = local.split(/[^a-z]+/).filter(Boolean)
  const given = givenOf(person)
  const f = given[0] ?? ''
  const l = person.last ? norm(person.last) : ''
  if (!f) return 'none'
  const names = given.filter((g) => g.length >= 3)
  const initials = [...new Set(given.map((g) => g[0]!))]
  for (const g of names) {
    if (parts.includes(g)) return 'strong'
    // The name leads the local part and ends there (roopal74, margo.k), not
    // merely opens a longer word (annualreport is not Ann, maxwell is not Max).
    if (new RegExp(`^${g}(?=[^a-z]|$)`).test(local)) return 'strong'
  }
  if (l.length >= 3) {
    const lShort = l.length >= 7 ? l.slice(0, 6) : l
    for (const g of names) {
      if (letters === g + l || letters === l + g || letters === g + l[0]) return 'strong'
      if (letters.startsWith(g + l) || letters.startsWith(l + g)) return 'strong'
    }
    for (const i of initials) {
      if (letters === i + l || letters === l + i) return 'strong'
      if (letters.startsWith(i + lShort) || letters.startsWith(l + i) || letters.endsWith(l + i)) return 'strong'
    }
    if (parts.includes(l) && parts.some((p) => initials.includes(p) || (f.length >= 5 && p.startsWith(f.slice(0, 3))))) return 'strong'
  }
  for (const g of names) {
    if (g.length >= 4 && letters.includes(g)) return 'weak'
    if (g.length >= 5 && letters.startsWith(g.slice(0, 4))) return 'weak'
    if (g.length >= 7 && letters.includes(g.slice(0, 5))) return 'weak'
  }
  if (l.length >= 3) {
    const at = letters.indexOf(l)
    if (at >= 0) {
      const before = letters.slice(0, at)
      if (before && prefixOwnedBy(before, person)) return 'weak'
    }
    if (letters === f[0] + l[0]) return 'weak'
  }
  return 'none'
}

/**
 * True when the local part is built on a family surname from the record with
 * a first name, or a single initial, that belongs to nobody on it: nrugani@
 * against "RUGANI, DOMINIC", simonblanchard239@ against "BLANCHARD, JOHN M &
 * SUSAN W", rosaliewilson@ against "WILSON, KATHERINE". That is another
 * household member, and the letter does not guess which one. Two letters in
 * front of a surname (sk8yost, pkshultz) are not read as a name.
 */
export function emailNamesSomeoneElse(
  email: string | null | undefined,
  people: readonly HouseholdPerson[],
  surnames: readonly string[],
): boolean {
  const local = localPartOf(email)
  if (!local) return false
  const letters = local.replace(/[^a-z]/g, '')
  for (const surname of surnames) {
    const l = norm(surname)
    if (l.length < 4) continue
    const at = letters.indexOf(l)
    if (at < 0) continue
    const before = letters.slice(0, at)
    if (!before || before.length === 2) continue
    if (people.some((p) => prefixOwnedBy(before, p))) continue
    return true
  }
  return false
}

export type GreetingChoice = {
  firstName: string | null
  /** One line for the trace: which rule decided. */
  reason: string
}

function firstWordOf(name: string | null | undefined): string | null {
  return nameToken(tokens(String(name ?? '').replace(/,/g, ' '))[0])
}

function lastWordOf(name: string | null | undefined): string | null {
  const toks = tokens(String(name ?? '').replace(/,/g, ' '))
  if (toks.length < 2) return null
  return nameToken(toks[toks.length - 1])
}

function givenWordsOf(name: string | null | undefined): string[] {
  const toks = tokens(String(name ?? '').replace(/,/g, ' '))
  return givenTokens(toks.length >= 2 ? toks.slice(0, -1) : toks)
}

function sameFirst(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && norm(a) === norm(b)
}

/**
 * The first name a letter to `email` may open with.
 *
 * `baseFirstName` is what the stored client name alone would greet (the
 * caller's greetingFirstName). `ownerOfRecord` is the county owner string
 * when the row has one. The answer is the base name when the email carries
 * it, the co-owner the email does carry, or null for "Hi there,".
 */
export function chooseGreetingForEmail(args: {
  baseFirstName: string | null
  clientName?: string | null
  email?: string | null
  ownerOfRecord?: string | null
}): GreetingChoice {
  const base = args.baseFirstName?.trim() || null
  const email = (args.email ?? '').trim() || null
  if (!email) return { firstName: base, reason: 'no email to compare' }
  const household = parseOwnerHousehold(args.ownerOfRecord)
  const clientFirst = base ?? firstWordOf(args.clientName)
  const clientLast = lastWordOf(args.clientName)
  const clientPerson: HouseholdPerson | null = clientFirst
    ? {
        first: clientFirst,
        last: clientLast && !sameFirst(clientLast, clientFirst) ? clientLast : null,
        given: givenWordsOf(args.clientName).length ? givenWordsOf(args.clientName) : [clientFirst],
      }
    : null
  const people: HouseholdPerson[] = [...household.people]
  let parties = household.parties
  if (clientPerson && !people.some((p) => sameFirst(p.first, clientPerson.first))) {
    people.push(clientPerson)
    // A family trust named for the client's own surname (1986 MACCRONE LIVING
    // TRUST, Christine M Maccrone) is the client's party, not a second one.
    const surnameParty =
      clientPerson.last != null &&
      household.people.length === 0 &&
      household.surnames.some((sn) => sameFirst(sn, clientPerson.last))
    if (!surnameParty) parties += 1
  }
  const surnames = [...household.surnames]
  if (clientPerson?.last && !surnames.some((sn) => sameFirst(sn, clientPerson.last))) surnames.push(clientPerson.last)

  if (emailNamesSomeoneElse(email, people, surnames)) {
    return { firstName: null, reason: `${email} carries the family name with a first name nobody on record has` }
  }
  if (base) {
    const own = people.filter((p) => sameFirst(p.first, base))
    const best = own.map((p) => emailNameMatch(email, p)).find((m) => m !== 'none')
    if (best) return { firstName: base, reason: `${email} carries ${base} (${best})` }
  }
  const others = people.filter((p) => !sameFirst(p.first, base))
  for (const tier of ['strong', 'weak'] as const) {
    if (tier === 'weak' && !base) break
    const hits = others.filter((p) => emailNameMatch(email, p) === tier)
    const firsts = [...new Set(hits.map((p) => norm(p.first)))]
    if (firsts.length === 1) {
      const pick = hits[0]!.first
      if (isPlausibleFirstName(pick)) {
        return { firstName: pick, reason: `${email} carries ${pick}, not ${base ?? 'the stored name'} (${tier})` }
      }
    }
  }
  if (parties >= 2) {
    return { firstName: null, reason: `${email} carries none of the ${parties} parties on record` }
  }
  return { firstName: base, reason: base ? `one owner on record, ${base}` : 'no greeting name' }
}

const OWNER_OF_RECORD_MARKER = 'Owner of record: '
const LEGAL_ENTITY_MARKER = 'Legal owner (entity): '
const NOTE_CUTS = [
  ' Legal owner (entity):',
  ' Skip-trace resolved contact:',
  ' Greeting:',
  ' Mailing:',
  ' ABSENTEE ',
  ' Owner-occupied ',
  ' OUT-OF-STATE ',
  ' Owned since ',
  ' Skip trace',
]

/** The county owner string buildCountyNotes recorded, or null when the notes carry none. */
export function ownerOfRecordFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  for (const marker of [OWNER_OF_RECORD_MARKER, LEGAL_ENTITY_MARKER]) {
    const at = notes.indexOf(marker)
    if (at < 0) continue
    let rest = notes.slice(at + marker.length)
    let cut = rest.length
    for (const m of NOTE_CUTS) {
      const i = rest.indexOf(m)
      if (i >= 0 && i < cut) cut = i
    }
    rest = rest.slice(0, cut).trim()
    if (rest.endsWith('.')) rest = rest.slice(0, -1).trim()
    if (rest) return rest
  }
  return null
}

/** The sentence buildCountyNotes writes so every later read can parse the household back. */
export function ownerOfRecordNote(ownerRaw: string | null | undefined): string {
  const raw = String(ownerRaw ?? '').replace(/\s+/g, ' ').trim()
  return raw ? `${OWNER_OF_RECORD_MARKER}${raw}.` : ''
}
