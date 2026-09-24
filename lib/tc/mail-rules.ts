/**
 * The mail filing rules: one decision per email. Which deal it belongs to, which
 * cycle on that deal, or why it belongs to none. The written form of these rules
 * is docs/TC_MAIL_FILING_RULES.md; the table-driven tests beside this file are
 * the enforcement. Pure. No I/O.
 *
 * The rules replace the 2026-08-23 filer, which picked a deal from WHO an email
 * touched. A house address on a deal contact matched every email in Matt's
 * inbox (3,088 messages onto one closed file), and a title officer on several
 * files sent mail about one property onto another. Here the email's own content
 * decides first: escrow or MLS number, then the street address. Who it touched
 * only decides when the content is silent and exactly one open deal fits.
 */

import { BROKERS } from '@/lib/brand/contact'

export const MAIL_RULES_VERSION = 'mail-rules-v4-2026-09-24'

const HOUSE_DOMAINS = new Set(['ryan-realty.com', 'mail.ryan-realty.com'])

/**
 * Outside addresses that are our own brokers. Matt forwards old deal mail into
 * his inbox from this one ("[Deal: 54474 Huntington Rd] Fwd: …"); it is the
 * house, never a buyer's agent.
 */
const HOUSE_ALIASES: ReadonlySet<string> = new Set(['matt.lists.homes@gmail.com'])

/**
 * Workspace mailboxes that play OUTSIDE parties on the test files (Vault Test
 * Buyer, Marketing Test Lead). They must match as parties, never as the house.
 */
export const TEST_PARTY_ALIASES: ReadonlySet<string> = new Set(['admin@ryan-realty.com', 'marketing@ryan-realty.com'])

export function normalizeEmail(raw: string | null | undefined): string {
  const e = String(raw ?? '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at <= 0) return e
  // Plus-addressing reaches the same mailbox: admin+agent@ is admin@.
  const local = e.slice(0, at).replace(/\+.*$/, '')
  return `${local}@${e.slice(at + 1)}`
}

/** Our own brokerage address. Test-party aliases are outside parties, not the house. */
export function isHouseAddress(raw: string | null | undefined): boolean {
  const e = normalizeEmail(raw)
  if (!e.includes('@')) return false
  if (TEST_PARTY_ALIASES.has(e)) return false
  if (HOUSE_ALIASES.has(e)) return true
  return HOUSE_DOMAINS.has(e.split('@')[1] ?? '')
}

function domainOf(raw: string | null | undefined): string {
  return normalizeEmail(raw).split('@')[1] ?? ''
}

function domainIn(raw: string | null | undefined, domains: readonly string[]): boolean {
  const dom = domainOf(raw)
  return !!dom && domains.some((d) => dom === d || dom.endsWith(`.${d}`))
}

/**
 * Our own machines. The site's Resend domain carries lead notices, CMAs,
 * listing alerts, market reports and newsletters; the Resend sandbox carries
 * the Studio's production drafts ("listing reel draft v2", "5 approved
 * photos"). A broker never types into either, so they name properties without
 * being mail about a deal (2026-09-24 audit).
 */
const HOUSE_SYSTEM_DOMAINS: readonly string[] = ['mail.ryan-realty.com', 'resend.dev']

export function isHouseSystemSender(raw: string | null | undefined): boolean {
  return domainIn(raw, HOUSE_SYSTEM_DOMAINS)
}

/**
 * A mailbox no person reads: noreply@, workspace-noreply@, do-not-reply@,
 * mailer-daemon@. Not alert@ or notifications@: ListTrac sends our sellers
 * their listing report as Matt from alert@listtrac.com, and calendar invites
 * come from notification addresses.
 */
export function isAutomatedSender(raw: string | null | undefined): boolean {
  const local = normalizeEmail(raw).split('@')[0] ?? ''
  return /(?:^|[._-])(?:no-?reply|do-?not-?reply|donotreply)(?:[._-]|$)|^(?:mailer-daemon|postmaster)$/.test(local)
}

/**
 * Senders whose mail about a property is part of a transaction by what they
 * are: e-sign and transaction platforms, title and escrow companies, and the
 * showing and MLS systems that report on our listings. Their mail naming one
 * of our addresses files even when it reads as ordinary mail; a stranger's
 * does not (rule 3).
 */
const ESIGN_DOMAINS: readonly string[] = ['skyslope.com', 'docusign.net', 'docusign.com', 'dotloop.com', 'authentisign.com']

const TRANSACTION_SENDER_DOMAINS: readonly string[] = [
  ...ESIGN_DOMAINS,
  'westerntitle.com',
  'firstam.com',
  'amerititle.com',
  'fnf.com',
  'ticortitle.com',
  'ctt.com',
  'suprasystems.com',
  'showingtime.com',
  'flexmls.com',
  'listtrac.com',
]

/** Platforms that give every file its own inbound address ("BeaumontDrive2070260b4@skyslope.com"). */
const FILE_ALIAS_DOMAINS: readonly string[] = ['skyslope.com']

/** Our own brokers. Their names on an outside address (a platform sending "as" Matt) never identify a file. */
const HOUSE_PERSON_NAMES: readonly string[] = [
  ...Object.values(BROKERS).flatMap((b) => [b.name, b.nameShort]),
  'Matthew Ryan',
]

// ── message + deal shapes ──────────────────────────────────────────────────

export type MailAttachmentFacts = {
  name: string
  /** Page text when the PDF was read. Page 1 is enough for identification. */
  text?: string | null
  /** Form the content identified (OREF/OR library name), null when unknown. */
  formName?: string | null
  formNumber?: string | null
  executionState?: string | null
}

/** One address on the From / To / Cc lines with the display name written beside it. */
export type MailPerson = { email: string; name: string | null; role: 'from' | 'to' | 'cc' }

export type MailFacts = {
  messageKey: string
  sentAt: string
  from: string[]
  to: string[]
  cc: string[]
  /** The same addresses with their display names ("cambria Johnson <…@gmail.com>"). */
  people?: MailPerson[]
  subject: string
  body: string
  attachments: MailAttachmentFacts[]
  /** List-Unsubscribe present, Precedence bulk/list, or Auto-Submitted not "no". */
  bulkHeaders: boolean
  autoReply: boolean
}

export type DealCycleFacts = {
  id: string
  kind: string
  status: string | null
  mlsNumber: string | null
  escrowNumber: string | null
  listingDate: string | null
  acceptanceDate: string | null
  closeDate: string | null
  deadDate: string | null
  createdAt: string | null
  /** Names on this cycle's contract (tc_cycles.buyers / sellers). */
  buyers?: string[]
  sellers?: string[]
}

export type DealFacts = {
  dealId: string
  address: string
  city: string | null
  stage: string
  cycles: DealCycleFacts[]
  /** Our clients on the file (buyers/sellers), from tc_deal_people → CRM emails. */
  partyEmails: string[]
  /** Everyone else on the file: title, escrow, lender, other agent, TC firm. */
  contactEmails: string[]
  /** Names of the parties: CRM names of tc_deal_people and every cycle's buyers and sellers. */
  partyNames?: string[]
  /** Names of the contacts, including the ones on file with no email (tc_deal_contacts.name). */
  contactNames?: string[]
  /** The MLS subdivision of the property ("Valhalla Heights"), from listings by the cycles' MLS numbers. */
  subdivisions?: string[]
}

export type ThreadAnchor = { dealId: string; method: string }

export type MailCategory =
  | 'offer'
  | 'counter'
  | 'executed_agreement'
  | 'addendum'
  | 'disclosure'
  | 'escrow_title'
  | 'lender'
  | 'inspection'
  | 'closing'
  | 'post_close'
  | 'signing_notice'
  | 'listing_alert'
  | 'system_alert'
  | 'auto_reply'
  | 'general'

export type MailStatus = 'filed' | 'ambiguous' | 'unfiled_transaction' | 'not_deal' | 'bulk'

export type MailMethod = 'thread' | 'escrow' | 'mls' | 'address' | 'party' | 'contact'

export type MailCandidate = { dealId: string; score: number; evidence: string[] }

export type MailDecision = {
  status: MailStatus
  dealId: string | null
  cycleId: string | null
  method: MailMethod | null
  score: number
  category: MailCategory
  direction: 'inbound' | 'outbound' | 'internal'
  reasons: string[]
  candidates: MailCandidate[]
  propertyHint: string | null
}

// ── address evidence ───────────────────────────────────────────────────────

// Long forms first: "Southwest 45th" is the same street as "SW 45th" (the
// 3480 SW 45th inspection mail that queued because it spelled it out).
const DIRECTIONAL = '(?:northeast|northwest|southeast|southwest|north|south|east|west|ne|nw|se|sw|n|s|e|w)\\.?'
const STREET_SUFFIX =
  '(?:street|st|avenue|ave|drive|dr|road|rd|lane|ln|loop|court|ct|way|place|pl|boulevard|blvd|circle|cir|terrace|ter|trail|trl|highway|hwy|parkway|pkwy|crater)'
const STREET_SUFFIX_WORD = new RegExp(`^${STREET_SUFFIX}$`, 'i')

const SHORT_DIRECTIONAL: Record<string, string> = {
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  northeast: 'ne',
  northwest: 'nw',
  southeast: 'se',
  southwest: 'sw',
}

/** "southwest" → "sw"; a short form stays as written. */
function shortDirectional(dir: string): string {
  const d = dir.replace('.', '').toLowerCase()
  return SHORT_DIRECTIONAL[d] ?? d
}

/** Both spellings of a directional, for matching text: "sw" → (?:sw|southwest). */
function directionalRe(dir: string): string {
  const short = shortDirectional(dir)
  const long = Object.keys(SHORT_DIRECTIONAL).find((k) => SHORT_DIRECTIONAL[k] === short)
  return long ? `(?:${short}|${long})` : short
}

/** "3480 southwest 45th" → "3480 sw 45th"; "123 west" (West is the street) stays. */
function canonicalDirectional(address: string): string {
  return address.replace(
    /^(\d+\s+)(northeast|northwest|southeast|southwest|north|south|east|west)\b(?=\s+\S)/i,
    (_, num: string, dir: string) => `${num}${shortDirectional(dir)}`,
  )
}

export type ParsedDealAddress = {
  number: string
  street: string
  /** Directional written on the file ("sw"), null when none. */
  directional: string | null
  /** The word after the street name on the file ("house" in School House Rd), null when none. */
  next: string | null
  city: string | null
}

/** "3480 SW 45th Street, Redmond, OR" → { number: 3480, directional: sw, street: 45th, next: street, city: redmond }. */
export function parseDealAddress(address: string, city?: string | null): ParsedDealAddress | null {
  const first = String(address ?? '').split(',')[0]?.trim() ?? ''
  // A doubled directional ("2354 NW NW Drouillard", as SkySlope exports some) reads once.
  const m = first.match(
    new RegExp(`^(\\d{2,6})\\s+(?:(${DIRECTIONAL})\\s+(?:\\2\\s+)?)?([a-z0-9][a-z0-9'-]*)(?:\\s+([a-z][a-z'-]*))?`, 'i'),
  )
  if (!m) return null
  const cityPart = (city ?? String(address).split(',')[1] ?? '').trim().toLowerCase() || null
  // "123 West Ave": West is the street, not a directional.
  if (m[2] && m[2].length > 2 && STREET_SUFFIX_WORD.test(m[3])) {
    return { number: m[1], directional: null, street: m[2].toLowerCase(), next: m[3].toLowerCase(), city: cityPart }
  }
  return {
    number: m[1],
    directional: m[2] ? shortDirectional(m[2]) : null,
    street: m[3].toLowerCase(),
    next: m[4] ? m[4].toLowerCase() : null,
    city: cityPart,
  }
}

const SUFFIX_VARIANTS: Record<string, string> = {
  street: 'st(?:reet)?',
  st: 'st(?:reet)?',
  avenue: 'ave(?:nue)?',
  ave: 'ave(?:nue)?',
  drive: 'dr(?:ive)?',
  dr: 'dr(?:ive)?',
  road: 'r(?:oa)?d',
  rd: 'r(?:oa)?d',
  lane: 'la?ne?',
  ln: 'la?ne?',
  court: 'c(?:our)?t',
  ct: 'c(?:our)?t',
  place: 'pl(?:ace)?',
  pl: 'pl(?:ace)?',
  circle: 'cir(?:cle)?',
  cir: 'cir(?:cle)?',
  boulevard: 'blvd|boulevard',
  blvd: 'blvd|boulevard',
}

/**
 * The street without its house number: "SW 45th" or "Beaumont Drive". Weaker
 * than a full address, but it names the property, so it beats who sent it.
 * A numbered street needs its directional; a named street needs its next word.
 */
export function mentionsDealStreet(text: string, parsed: ParsedDealAddress): boolean {
  const street = escapeRe(parsed.street)
  if (parsed.directional) {
    if (new RegExp(`\\b${directionalRe(parsed.directional)}\\.?\\s+${street}\\b`, 'i').test(text)) return true
  }
  if (/^\d/.test(parsed.street) || !parsed.next || parsed.street.length < 4) return false
  // A two-word name ("School House") is also written as one ("Schoolhouse Rd.").
  if (!STREET_SUFFIX_WORD.test(parsed.next)) return new RegExp(`\\b${compoundRe(parsed.street, parsed.next)}\\b`, 'i').test(text)
  const next = SUFFIX_VARIANTS[parsed.next] ?? escapeRe(parsed.next)
  return new RegExp(`\\b${splitRe(parsed.street)}\\s+(?:${next})\\b`, 'i').test(text)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "school" + "house" → school\s*house: the name with or without its space. */
function compoundRe(first: string, second: string): string {
  return `${escapeRe(first)}\\s*${escapeRe(second)}`
}

/**
 * A long one-word street name written as two ("Schoolhouse" as "School
 * House"): every split into two parts of three letters or more. Short and
 * numbered names match only as written.
 */
function splitRe(street: string): string {
  if (street.length < 8 || /\d/.test(street)) return escapeRe(street)
  const alts = [escapeRe(street)]
  for (let i = 3; i <= street.length - 3; i++) alts.push(`${escapeRe(street.slice(0, i))}\\s+${escapeRe(street.slice(i))}`)
  return `(?:${alts.join('|')})`
}

// Words that name plenty besides a street: never enough alone.
const GENERIC_STREET_WORDS: ReadonlySet<string> = new Set([
  'old', 'new', 'main', 'park', 'view', 'school', 'market', 'high', 'north', 'south', 'east', 'west', 'home', 'house', 'land',
])

/**
 * The name people call the property by, with no number and no suffix:
 * "Drouillard", "Nordic", "School House". Null for a numbered street ("45th"
 * alone names half of Redmond) and for a word too common to mean one street.
 */
export function bareStreetName(parsed: ParsedDealAddress): string | null {
  if (/^\d/.test(parsed.street)) return null
  if (parsed.next && !STREET_SUFFIX_WORD.test(parsed.next)) return `${parsed.street} ${parsed.next}`
  if (parsed.street.length < 4 || GENERIC_STREET_WORDS.has(parsed.street)) return null
  return parsed.street
}

/** The subject or a file name calls the property by its street alone: "Home Warranty - Nordic". */
export function mentionsBareStreet(text: string, parsed: ParsedDealAddress): boolean {
  const name = bareStreetName(parsed)
  if (!name) return false
  const [first, second] = name.split(' ')
  return new RegExp(`\\b${second ? compoundRe(first, second) : splitRe(first)}\\b`, 'i').test(text)
}

/**
 * House number followed by the street's first word, directional optional:
 * "909 NW Delaware" or "909 Delaware". A two-word name also matches written
 * as one ("56111 Schoolhouse" is 56111 School House Rd) and a long one-word
 * name written as two.
 */
export function mentionsDealAddress(text: string, parsed: ParsedDealAddress): boolean {
  const street =
    parsed.next && !STREET_SUFFIX_WORD.test(parsed.next)
      ? `${escapeRe(parsed.street)}(?:\\s*${escapeRe(parsed.next)})?`
      : splitRe(parsed.street)
  const re = new RegExp(`\\b${parsed.number}\\s+(?:${DIRECTIONAL}\\s+)?${street}\\b`, 'i')
  return re.test(text)
}

const GENERIC_ADDRESS = new RegExp(
  `\\b(\\d{3,6})\\s+((?:${DIRECTIONAL}\\s+)?[a-z0-9][a-z0-9'-]*(?:\\s+[a-z][a-z'-]*){0,2}?)\\s+${STREET_SUFFIX}\\b`,
  'gi',
)

/** Distinct street addresses written with a suffix ("20702 Beaumont Drive"). */
export function streetAddressesIn(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(GENERIC_ADDRESS)) {
    out.add(addressKey(m))
  }
  return [...out]
}

function addressKey(m: RegExpMatchArray): string {
  return canonicalDirectional(`${m[1]} ${m[2]}`.replace(/\s+/g, ' ').trim().toLowerCase())
}

// A contact block: a phone number, an email address, a "tel:" link or a phone label.
const CONTACT_BLOCK = /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\btel:|\b(?:phone|fax|office|direct|cell|mobile)\s*[:#]/i
// A listing line: a price, beds or baths, square feet, an MLS number, a listing status.
const LISTING_ENTRY =
  /\$\s?\d{1,3}(?:,\d{3})+|\b\d+\s*(?:bd|br|beds?|bedrooms?|ba|baths?|bathrooms?)\b|\bsq\.?\s?ft\b|\bmls\s*#?\s*\d{6,}|\b(?:new listing|just listed|back on market|price (?:change|reduced|drop))\b/i

// What may follow an office address on its own line: a suite, the city, state and zip, a mail client's link.
const ADDRESS_LINE_REST = /^(?:,?\s*(?:suite|ste\.?|unit|#)\s*[\w-]+)?(?:,?\s*[a-z][a-z .]*,?\s+(?:or|oregon|wa|washington|ca|id)\b\.?(?:\s+\d{5}(?:-\d{4})?)?)?[\s,.]*$/i

/**
 * An address that is the sender's letterhead, not what the email lists: no
 * price, beds or baths after it, and either a suite right after it, or a line
 * of its own in a block with a phone number or an email address. Western
 * Title signs every message, and every quoted layer, with its Bend and
 * Redmond offices. An address inside a sentence ("the signed docs for 20702
 * Beaumont Drive") is never letterhead.
 */
function isLetterheadAddress(text: string, start: number, end: number): boolean {
  if (LISTING_ENTRY.test(text.slice(end, end + 160))) return false
  if (/^\s*,?\s*(?:suite|ste\.?|unit|#)\s*\w/i.test(text.slice(end, end + 40))) return true
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEndAt = text.indexOf('\n', end)
  const lineEnd = lineEndAt < 0 ? text.length : lineEndAt
  const before = text.slice(lineStart, start).trim()
  const rest = text.slice(end, lineEnd).replace(/<[^>]*>/g, '').trim()
  if (before || !ADDRESS_LINE_REST.test(rest)) return false
  const lines = text.split('\n')
  const at = text.slice(0, start).split('\n').length - 1
  return CONTACT_BLOCK.test(lines.slice(Math.max(0, at - 6), at + 7).join('\n'))
}

/**
 * The street addresses a message lists as its content: every address in the
 * subject, and the body's addresses minus letterhead. Three or more is a
 * digest (a hot sheet, a market report), not mail about one property.
 */
export function listedAddresses(subject: string, body: string): string[] {
  const out = new Set(streetAddressesIn(subject))
  for (const m of body.matchAll(GENERIC_ADDRESS)) {
    const start = m.index ?? 0
    if (isLetterheadAddress(body, start, start + m[0].length)) continue
    out.add(addressKey(m))
  }
  return [...out]
}

// ── comparables reports ───────────────────────────────────────────────────

const COMPARABLES_NAME = /\bcomps?\b|\bcma\b|\bcomparables?\b|\bcompar(?:ative|able) market\b|\bmarket analysis\b|\bbpo\b|\bbroker price opinion\b|\bappraisal report\b/i
const COMPARABLES_TEXT =
  /\bcompar(?:ative|able) market analysis\b|\bCMA\b|\bbroker price opinion\b|\buniform residential appraisal report\b|\bcomparable (?:sales|properties|listings)\b/i

/**
 * A CMA, broker price opinion or appraisal: a report about one property that
 * lists others. Known by its file name or by the title on its first page.
 */
export function isComparablesReport(a: Pick<MailAttachmentFacts, 'name' | 'text'>): boolean {
  return COMPARABLES_NAME.test(String(a.name ?? '').replace(/[_.-]+/g, ' ')) || COMPARABLES_TEXT.test(String(a.text ?? '').slice(0, 800))
}

/**
 * The property a comparables report is about: the address its file name
 * carries the house number of, else the one it repeats most (the subject
 * heads every page; each comp appears once or twice), the first on a tie.
 */
export function comparablesSubject(a: Pick<MailAttachmentFacts, 'name' | 'text'>): string | null {
  const counts = new Map<string, { n: number; first: number; written: string; number: string }>()
  for (const m of String(a.text ?? '').matchAll(GENERIC_ADDRESS)) {
    const key = addressKey(m)
    const hit = counts.get(key)
    if (hit) hit.n++
    else counts.set(key, { n: 1, first: m.index ?? 0, written: m[0], number: m[1] })
  }
  const all = [...counts.values()]
  if (!all.length) return null
  const named = String(a.name ?? '').match(/\b(\d{3,6})\b/)?.[1]
  const byName = named ? all.filter((c) => c.number === named) : []
  const pool = byName.length ? byName : all
  pool.sort((x, y) => y.n - x.n || x.first - y.first)
  return pool[0].written
}

// ── people named on the message ───────────────────────────────────────────

const NAME_NOISE: ReadonlySet<string> = new Set([
  'mr', 'mrs', 'ms', 'dr', 'jr', 'sr', 'ii', 'iii', 'iv', 'trustee', 'trustees', 'trust', 'family', 'revocable', 'living', 'the', 'and', 'of', 'llc', 'inc', 'estate',
])

function nameTokens(raw: string | null | undefined): string[] {
  let s = String(raw ?? '')
    .replace(/\s+via\s+.*$/i, '')
    .replace(/[<(].*$/, '')
    .trim()
  if (!s || s.includes('@')) return []
  // "Moore, Tonya" is Tonya Moore; "Millard, Trustee" is not a reversed name.
  const comma = s.match(/^([^,]+),\s*([^,]+)$/)
  if (comma && !/\b(?:trust|trustees?|llc|inc|jr|sr)\b/i.test(s)) s = `${comma[2]} ${comma[1]}`
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ''))
    .filter((t) => t.length >= 2 && !NAME_NOISE.has(t))
}

/**
 * The display name on an address is the person on the file: first and last
 * name both present, in order ("pat Otheragent" is Pat Otheragent; "Tanya
 * Hogan" is on "Patrick and Tanya Hogan"). A first name alone never counts.
 */
export function personNameMatches(display: string | null | undefined, known: string | null | undefined): boolean {
  const a = nameTokens(display)
  const b = nameTokens(known)
  if (a.length < 2 || b.length < 2) return false
  const i = b.indexOf(a[0])
  const j = b.lastIndexOf(a[a.length - 1])
  return i >= 0 && j > i
}

function isHousePerson(display: string | null | undefined): boolean {
  return HOUSE_PERSON_NAMES.some((n) => personNameMatches(display, n))
}

// ── per-file platform addresses ───────────────────────────────────────────

/**
 * SkySlope gives every file its own inbound address, built from the street
 * and the house number: "BeaumontDrive2070260b4@skyslope.com" is 20702
 * Beaumont Drive, "SW45thStreet3480@…" is 3480 SW 45th Street. Mail sent to
 * one names that property as surely as its street in the subject. The house
 * number must agree: the digits after the street start with it.
 */
export function platformAliasNamesDeal(addresses: readonly string[], parsed: ParsedDealAddress): boolean {
  for (const raw of addresses) {
    if (!domainIn(raw, FILE_ALIAS_DOMAINS)) continue
    const local = String(raw).trim().split('@')[0] ?? ''
    // The house number and SkySlope's hex tail ("2070260b4") follow the last letter of the street.
    const m = local.match(/^(.*?[a-z])(\d[0-9a-f]*)$/i)
    if (!m) continue
    const words = m[1].toLowerCase().replace(/[^a-z0-9]/g, '')
    const street = (parsed.next && !STREET_SUFFIX_WORD.test(parsed.next) ? parsed.street + parsed.next : parsed.street).replace(/[^a-z0-9]/g, '')
    if (street.length < 3 || !words.includes(street)) continue
    if (m[2].startsWith(parsed.number)) return true
  }
  return false
}

// Case-sensitive on the street (a name is capitalized), so the directional spells both cases.
const DIRECTIONAL_ANY_CASE = '(?:(?:[Nn]orth|[Ss]outh)(?:[Ee]ast|[Ww]est)?|[Ee]ast|[Ww]est|[NnSs][EeWw]?|[EeWw])\\.?'
const SUBJECT_ADDRESS = new RegExp(
  `(?<![\\d$,.])\\b(\\d{3,6})\\s+((?:${DIRECTIONAL_ANY_CASE}\\s+)?)([A-Za-z0-9][A-Za-z0-9'-]*)(?:\\s+([A-Z][a-z'-]+))?`,
  'g',
)

/**
 * The property a subject names, if any: "Re: 909 Delaware" → "909 delaware".
 * Subjects carry the property on transaction mail; bodies carry office
 * addresses in signatures, so body text never counts here. Without a street
 * suffix the street must read as a name (capitalized, or an ordinal after a
 * directional), and a 19xx/20xx number needs a directional, since it is
 * usually a year. Without a suffix only the first street word is kept: the
 * next capitalized word is as often the subject's own ("61260 Sunflower
 * Email to Deb", "19496 Septic Invoice"), and one property must group as one.
 */
export function propertyInSubject(subject: string): string | null {
  const withSuffix = streetAddressesIn(subject)
  if (withSuffix.length) return withSuffix[0]
  for (const m of subject.matchAll(SUBJECT_ADDRESS)) {
    const [, num, dir, street] = m
    const hasDir = !!dir.trim()
    const ordinal = /^\d+(?:st|nd|rd|th)$/i.test(street)
    const named = /^[A-Z][a-z'-]{2,}$/.test(street)
    if (!(named || (ordinal && hasDir))) continue
    if (/^(?:19|20)\d{2}$/.test(num) && !hasDir) continue
    return canonicalDirectional([num, dir.trim(), street].filter(Boolean).join(' ').toLowerCase())
  }
  return null
}

function subjectNamesDeal(subjectProperty: string, parsed: ParsedDealAddress | null): boolean {
  if (!parsed) return false
  return mentionsDealAddress(subjectProperty, parsed) || mentionsDealStreet(subjectProperty, parsed)
}

/** One slip of the keyboard between two house numbers: a digit wrong, missing, extra, or two swapped ("2372" or "2731" for 2732). */
function nearHouseNumber(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length === b.length) {
    const diff = [...a].map((ch, i) => (ch === b[i] ? -1 : i)).filter((i) => i >= 0)
    if (diff.length === 1) return true
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]
  }
  if (Math.abs(a.length - b.length) !== 1) return false
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  for (let i = 0; i < long.length; i++) if (long.slice(0, i) + long.slice(i + 1) === short) return true
  return false
}

const DIRECTIONAL_WORD = new RegExp(`^${DIRECTIONAL}$`, 'i')

/**
 * The subject's property is this deal's, written badly, so it names no other
 * property: the deal's street with a mistyped house number ("SPD's for 2372
 * NW Ordway" about 2732 Ordway Ave), or the deal's house number followed by a
 * word that is no street, no suffix written ("19496 Septic Invoice" about
 * 19496 Tumalo Reservoir Rd). A different street with its suffix ("19496
 * Pine Street") and a property with no file ("909 NW Delaware") still name
 * another property.
 */
function subjectMisnamesDeal(subject: string, subjectProperty: string, parsed: ParsedDealAddress): boolean {
  const [num, ...rest] = subjectProperty.split(' ')
  const words = rest.filter((w) => !DIRECTIONAL_WORD.test(w))
  if (words[0] === parsed.street && nearHouseNumber(num, parsed.number)) return true
  return num === parsed.number && !streetAddressesIn(subject).some((a) => a.startsWith(`${num} `))
}

/**
 * The subject writes this deal's street with its house number one keystroke
 * off ("2731 Ordway Title Report" for 2732 Ordway Ave): the street named in
 * the subject, so street evidence (rule 3 still asks that it be transaction
 * mail or from someone on our files). A short or common street word, and a
 * two-word name written without its second word, never count.
 */
function subjectMistypesDeal(subject: string, subjectProperty: string, parsed: ParsedDealAddress): boolean {
  const num = subjectProperty.split(' ')[0]
  if (num === parsed.number || !nearHouseNumber(num, parsed.number)) return false
  if (/^\d/.test(parsed.street) ? !parsed.directional : parsed.street.length < 4 || GENERIC_STREET_WORDS.has(parsed.street)) return false
  const compound = parsed.next && !STREET_SUFFIX_WORD.test(parsed.next) ? `\\s*${escapeRe(parsed.next)}` : ''
  return new RegExp(`\\b${num}\\s+(?:${DIRECTIONAL}\\s+)?${escapeRe(parsed.street)}${compound}\\b`, 'i').test(subject)
}

// ── subdivisions ───────────────────────────────────────────────────────────

const CITY_NAMES: ReadonlySet<string> = new Set([
  'bend', 'redmond', 'sisters', 'sunriver', 'la pine', 'prineville', 'madras', 'terrebonne', 'powell butte', 'tumalo', 'culver',
  'crooked river ranch', 'black butte ranch', 'camp sherman', 'ashland',
])

// One-word subdivision names that are ordinary words or places, not one neighborhood.
const COMMON_PLACE_WORDS: ReadonlySet<string> = new Set([
  'boulevard', 'railroad', 'highland', 'highlands', 'meadow', 'meadows', 'ridge', 'estates', 'village', 'heights', 'crossing', 'downtown',
  'westside', 'eastside', 'river', 'lakes', 'woods', 'pines', 'terrace', 'commons', 'plaza', 'townsite', 'addition', 'acres', 'ranch',
  'hills', 'vista', 'summit', 'creek', 'canyon', 'butte', 'station', 'center', 'central', 'county', 'unknown', 'other', 'rural', 'none',
])

/**
 * An MLS subdivision name that can stand for one property: not a placeholder
 * ("N/A"), not a city ("Prineville"), not one ordinary word ("Railroad",
 * "Boulevard"). A trailing "Phase 1" is dropped.
 */
export function usableSubdivision(raw: string | null | undefined): string | null {
  const s = String(raw ?? '')
    .replace(/\s+phase\s+\w+$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = s.toLowerCase()
  if (s.length < 5 || /^(?:n\/?a|none|unknown|other|not applicable|no subdivision)$/i.test(s)) return null
  if (CITY_NAMES.has(lower)) return null
  if (!lower.includes(' ') && (s.length < 6 || COMMON_PLACE_WORDS.has(lower) || GENERIC_STREET_WORDS.has(lower))) return null
  return s
}

function mentionsSubdivision(text: string, name: string): boolean {
  return new RegExp(`\\b${name.split(' ').map(escapeRe).join('\\s+')}\\b`, 'i').test(text)
}

// ── identifiers ────────────────────────────────────────────────────────────

function normId(s: string | null | undefined): string {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Escrow or file number in the text. Short or generic numbers never count. */
export function mentionsEscrowNumber(text: string, escrow: string | null | undefined): boolean {
  const want = normId(escrow)
  if (want.length < 6 || !/\d{4,}/.test(want)) return false
  const hay = normId(text)
  return hay.includes(want)
}

/** MLS numbers are 9 digits in Central Oregon (220xxxxxx); require a clean word boundary. */
export function mentionsMlsNumber(text: string, mls: string | null | undefined): boolean {
  const want = String(mls ?? '').replace(/\D/g, '')
  if (want.length < 8) return false
  return new RegExp(`(?<!\\d)${want}(?!\\d)`).test(text)
}

// ── categories ─────────────────────────────────────────────────────────────

const TRANSACTION_CATEGORIES: ReadonlySet<MailCategory> = new Set([
  'offer',
  'counter',
  'executed_agreement',
  'addendum',
  'disclosure',
  'escrow_title',
  'lender',
  'inspection',
  'closing',
  'post_close',
])

export function isTransactionCategory(c: MailCategory): boolean {
  return TRANSACTION_CATEGORIES.has(c)
}

const SALE_AGREEMENT_NAME = /sale\s+agreement|purchase\s+(?:and\s+sale\s+)?agreement|\bpsa\b|\brsa\b|\b(?:oref[\s_-]*)?001\b/i
const COUNTER_NAME = /counter[\s_-]*offer|\bcounter\b|\b[bs]co\d*\b|\b(?:oref[\s_-]*)?003\b/i

function attachmentBlob(a: MailAttachmentFacts): string {
  return `${a.formName ?? ''} ${a.name ?? ''}`.replace(/[_.-]+/g, ' ')
}

export function isTransactionFormAttachment(a: MailAttachmentFacts): boolean {
  if (a.formNumber || a.formName) return true
  return /agreement|addendum|counter|disclosure|\bpsa\b|\b[bs]co\d*\b|oref|earnest|escrow|closing|settlement|inspection|repair|termination|amendment/i.test(
    attachmentBlob(a),
  )
}

/**
 * System notices ("[Expired] 363 Bluff, Bend …", "[Deploy] …", Google
 * Workspace's "[Notice] …"): they name properties, they are not deal mail.
 */
const SYSTEM_ALERT_SUBJECT = /^\[(?:expired|deploy|data|preview|alert|cron|loop|seo|ci|health|digest|notice)\b[^\]]*\]/i

const LISTING_ALERT_SUBJECT =
  /\bnew listings?\b|\bupdates? for\b|home search is set|^copy:\s*subscription|\bprice (?:drop|change|reduced)\b|\bopen house(?:s)? (?:this|near)\b|\bhot ?sheet\b|\bmarket (?:update|report)\b/i

/**
 * E-sign platforms' own subjects. Checked before the listing-alert words: an
 * OREF form's name can read like an alert ("Envelope completed: Appraisal
 * Price Change" is a fully executed addendum, 2026-09-24 audit).
 */
const ESIGN_SUBJECT =
  /documents? to sign|signature (?:is )?(?:requested|still needed)|your signed documents|envelope (?:completed|sent|voided|declined|signed)|has been signed|please docusign|docusign|dotloop|authentisign|digisign/i

/** A contract ended: termination agreement, mutual release, release of earnest money. */
const TERMINATION = /\bterminat(?:ion|e|ed)\b|\bmutual release\b|\brelease of earnest\b|\bcancel(?:l)?ation (?:agreement|of (?:sale|contract|agreement))\b/i

const FORWARD_SUBJECT = /^\s*(?:\[[^\]]*\]\s*)?(?:fwd?|fw)\s*:/i

/** A sale agreement itself: an addendum, amendment or termination "to the Sale Agreement" is not one. */
function isSaleAgreementDoc(a: MailAttachmentFacts): boolean {
  const blob = attachmentBlob(a)
  return SALE_AGREEMENT_NAME.test(blob) && !/addend|amend|terminat/i.test(blob)
}

/** A termination form or notice, by the subject or a file name. */
export function isTerminationMail(input: { subject: string; attachments: readonly MailAttachmentFacts[] }): boolean {
  return TERMINATION.test(input.subject ?? '') || input.attachments.some((a) => TERMINATION.test(attachmentBlob(a)))
}

/**
 * The part of a body its sender wrote: quoted lines ("> …") and everything
 * after a reply header ("On <date> … wrote:", "-----Original Message-----",
 * Outlook's "From: … Sent: …") are earlier mail, about something else. A
 * forwarded message is kept: the broker forwarded it on purpose.
 */
export function stripQuotedHistory(body: string): string {
  const lines = String(body ?? '').split(/\r?\n/)
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('>')) continue
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(line)) break
    if (/^on\b.{0,200}\bwrote:$/i.test(line)) break
    if (/^on\b/i.test(line) && line.length < 200 && /\bwrote:$/i.test((lines[i + 1] ?? '').trim())) break
    if (/^from:\s/i.test(line) && lines.slice(i + 1, i + 5).some((l) => /^sent:\s/i.test(l.trim()))) break
    out.push(lines[i])
  }
  return out.join('\n')
}

/**
 * The people of a deal talking about it: another agent's "my clients", "the
 * sellers", a showing being arranged, a walkthrough. Not a category (it names
 * no transaction step), but mail a stranger writes about one of our
 * addresses in these words is about the deal, not a pitch: "Get more buyers
 * for …" and "virtual staging helps buyers …" never say them.
 */
const DEAL_PEOPLE_TALK =
  /\b(?:my|our) (?:buyers?|clients?)\b|\bthe sellers?(?:'s?)?\b|\bshowing (?:on|at|request|requests|time|times|feedback|instructions|appointment|today|tomorrow)\b|\b(?:schedule|book|request|confirm) (?:a )?showing\b|\bsecond showing\b|\bwalk[- ]?through\b/i

/**
 * The property's own records: service invoices and history, permits, a home
 * warranty, a survey, septic and well reports. A heating company sending "all
 * of the service invoices I have for this address" is deal mail, though the
 * company is on no file.
 */
const PROPERTY_RECORDS =
  /\bservice (?:records?|invoices?|history|reports?)\b|\binvoices? for (?:this|the) (?:address|property|home)\b|\bpermits?\b|\bhome warranty\b|\bsurvey\b|\bsepti[c] (?:inspection|report|pump(?:ing)?|certification)\b|\bwell (?:test|report|log|inspection|flow)\b/i

/** A stranger's mail about one of our addresses, written as deal talk or carrying the property's records (subject, and the body the sender wrote). */
function dealPeopleTalk(subject: string, body: string): boolean {
  if (MARKETING_BODY.test(body)) return false
  const text = `${subject}\n${stripQuotedHistory(body).slice(0, 2000)}`
  return DEAL_PEOPLE_TALK.test(text) || PROPERTY_RECORDS.test(text)
}

/** Newsletters, promotions and cold outreach say so at the bottom. */
const MARKETING_BODY =
  /\bunsubscribe\b|\bopt[\s-]?out\b|\bmanage (?:your )?(?:email )?preferences\b|\bupdate your (?:email )?preferences\b|\bview (?:this email )?in (?:your |a )?browser\b/i

/**
 * The step a body names when the subject and file names do not: "decide on
 * our counter offer", "the earnest money was received", "clear to close".
 * Only phrases a transaction uses; a single common word ("closing", "title",
 * "keys") never decides from the body. Marketing mail never reads as a
 * transaction from its body.
 */
function bodyCategory(subject: string, body: string, bulkHeaders: boolean): MailCategory | null {
  if (bulkHeaders || MARKETING_BODY.test(body)) return null
  const own = (FORWARD_SUBJECT.test(subject) ? body : stripQuotedHistory(body)).slice(0, 2000)
  if (!own.trim()) return null
  if (/\bcounter[\s-]?of+ers?\b/i.test(own)) return 'counter'
  if (/\boffer to purchase\b|\b(?:our|their|the|an|buyers?'?|my clients?'?) offer (?:on|for|is|was)\b|\baccept(?:ed)? (?:the |our |their |your )?offer\b/i.test(own)) return 'offer'
  if (/\baddend(?:um|a)\b|\bamendment\b|\bamendatory\b|\btermination (?:agreement|of)\b/i.test(own)) return 'addendum'
  if (/\bclosing (?:statement|disclosure|date|docs|documents|appointment|funds)\b|\bsettlement statement\b|\bsigning (?:appointment|docs|documents)\b/i.test(own)) return 'closing'
  if (/\bseller'?s? (?:property )?disclosures?\b|\bproperty disclosures?\b|\bspds?\b/i.test(own)) return 'disclosure'
  if (/\binspection (?:report|response|contingency|period|scheduled|request)\b|\brepair (?:request|list)\b|\bhome inspection\b|\binspector\b/i.test(own)) return 'inspection'
  // Never the bare word "escrow" (every Western Title message is signed
  // "Senior Escrow Officer … Western Title & Escrow Company"), never "wire
  // instructions" (title footers carry a wire-fraud warning), and never
  // "purchase price" (a pricing letter to a prospective seller says it too).
  if (
    /\bescrow (?:number|no\.?|#|instructions|account|deposit|file|is open|opened|has opened)\b|\bopen(?:ed)? escrow\b|\bclose of escrow\b|\bearnest money\b|\bpreliminary title\b|\btitle (?:report|commitment)\b/i.test(
      own,
    )
  ) {
    return 'escrow_title'
  }
  if (
    /\bappraisal (?:report|inspection|appointment|came in|value|contingency|is scheduled|was scheduled)\b|\bappraiser\b|\bloan (?:estimate|approval|commitment|docs)\b|\bpre-?approv|\bunderwrit|\bclear to close\b/i.test(
      own,
    )
  ) {
    return 'lender'
  }
  return null
}

export function categorizeMail(input: {
  subject: string
  body: string
  attachments: readonly MailAttachmentFacts[]
  autoReply: boolean
  fromHouseSystem: boolean
  bulkHeaders?: boolean
}): MailCategory {
  const subject = input.subject ?? ''
  if (input.autoReply || /^(?:automatic reply|auto(?:matic)?[- ]?reply|out of (?:the )?office)\b/i.test(subject.trim())) {
    return 'auto_reply'
  }
  // Our own machines (the site's Resend domain, the Studio's sandbox) and system notices.
  if (input.fromHouseSystem || SYSTEM_ALERT_SUBJECT.test(subject.trim())) return 'system_alert'
  const attachments = input.attachments ?? []
  // Fully executed by its read, or by its file name ("… Fully Executed.pdf",
  // SkySlope's "_X_" executed marker).
  const executedSale = attachments.find(
    (a) =>
      isSaleAgreementDoc(a) &&
      (a.executionState === 'fully_executed' || /fully[\s_-]*(?:executed|signed)/i.test(a.name ?? '') || /(?:^|[\s_-])X_(?=[A-Z0-9])/.test(a.name ?? '')),
  )
  if (executedSale) return 'executed_agreement'
  if (ESIGN_SUBJECT.test(subject)) return 'signing_notice'
  // A transaction form attached is never a listing alert.
  if (LISTING_ALERT_SUBJECT.test(subject) && !attachments.some(isTransactionFormAttachment)) return 'listing_alert'
  if (attachments.some((a) => COUNTER_NAME.test(attachmentBlob(a))) || /counter[\s-]?offer|\bcounter\b/i.test(subject)) {
    return 'counter'
  }
  if (attachments.some(isSaleAgreementDoc) || /\boffers?\b/i.test(subject)) {
    return 'offer'
  }
  if (
    attachments.some((a) => /addendum|amendment|terminat/i.test(attachmentBlob(a))) ||
    /addendum|amendment|\btermination (?:agreement|of)\b|\bcontract termination\b|\bterminat(?:e|ing) (?:the )?(?:contract|agreement|sale|transaction)\b/i.test(subject)
  ) {
    return 'addendum'
  }
  const hay = `${subject}\n${attachments.map(attachmentBlob).join(' ')}`
  if (/closing (?:statement|disclosure)|settlement statement|\balta\b|\bfunded\b|\brecord(?:ed|ing)\b|final (?:statement|hud)|\bclosing\b|\bclose of escrow\b|\bkeys\b/i.test(hay)) {
    return 'closing'
  }
  // HOA documents, CC&Rs and a reserve study are the buyer's to review, like a disclosure.
  if (/disclosure|\bspds?\b|\bspd\b|seller'?s? property|\bhoa (?:docs|documents|resale|certificate|statement)\b|\bcc ?& ?rs\b|\bccrs\b|\breserve study\b|\bresale certificate\b/i.test(hay)) {
    return 'disclosure'
  }
  // Inspections by their kind too: a septic evaluation (Oregon's ESER), radon, sewer scope, pest/WDO, mold.
  if (/\binspection|\brepair|\beser\b|\bseptic\b|\bradon\b|\bsewer scope\b|\bwdo\b|\bpest inspection\b|\bmold\b/i.test(hay)) return 'inspection'
  if (/\bescrow\b|\btitle\b|\bprelim|wire|\bwt\d{5,}|open order|earnest/i.test(hay)) return 'escrow_title'
  if (/\bloan\b|\blender\b|pre-?approval|\bappraisal|underwrit|clear to close|\bctc\b|mortgage/i.test(hay)) return 'lender'
  return bodyCategory(subject, input.body ?? '', !!input.bulkHeaders) ?? 'general'
}

// ── direction ──────────────────────────────────────────────────────────────

export function mailDirection(facts: Pick<MailFacts, 'from' | 'to' | 'cc'>): 'inbound' | 'outbound' | 'internal' {
  const fromHouse = facts.from.length > 0 && facts.from.every(isHouseAddress)
  if (!fromHouse) return 'inbound'
  const outside = [...facts.to, ...facts.cc].some((e) => !isHouseAddress(e))
  return outside ? 'outbound' : 'internal'
}

// ── deal windows ───────────────────────────────────────────────────────────

const LIVE_STAGES = new Set(['pending', 'pre_contract', 'active_listing'])
const POST_CLOSE_DAYS = 120
const PRE_OPEN_DAYS = 45
const DAY = 86_400_000

function t(d: string | null | undefined): number | null {
  if (!d) return null
  const n = Date.parse(d.length === 10 ? `${d}T12:00:00Z` : d)
  return Number.isFinite(n) ? n : null
}

/** When a cycle was open: listing or acceptance (a little before) to close/dead (plus the post-close tail). */
function cycleWindow(c: DealCycleFacts): { start: number | null; end: number | null } {
  const end = t(c.closeDate) ?? t(c.deadDate)
  const start = t(c.listingDate) ?? t(c.acceptanceDate) ?? (end != null ? end - 365 * DAY : null)
  return { start: start == null ? null : start - PRE_OPEN_DAYS * DAY, end: end == null ? null : end + POST_CLOSE_DAYS * DAY }
}

/**
 * Was the deal open for mail at this moment? A live deal always is. A closed or
 * dead deal is open from its cycle's start to 120 days after close, so title's
 * recorded deed and the final statement still file, but a holiday card from a
 * client who closed two years ago does not.
 */
export function dealOpenAt(deal: DealFacts, sentAt: string): boolean {
  if (LIVE_STAGES.has(deal.stage)) return true
  const at = t(sentAt)
  if (at == null) return false
  for (const c of deal.cycles) {
    const w = cycleWindow(c)
    if (w.end == null && w.start == null) continue
    if ((w.start == null || at >= w.start) && (w.end == null || at <= w.end)) return true
  }
  return false
}

/** What the message itself says about which cycle it belongs to. */
export type CycleHints = {
  /** The message's own text (subject, body, attachment names and text): escrow and MLS numbers, buyer names. */
  text?: string
  /** A termination or release: it belongs to the contract it ends. */
  termination?: boolean
}

/** "WT0278291" → WT\d{7}: another number of the same shape is another escrow file. */
function escrowShapeRe(escrow: string | null | undefined): RegExp | null {
  const e = String(escrow ?? '').trim()
  if (e.length < 6 || !/\d{4,}/.test(e)) return null
  const shape = e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\d+/g, (m) => `\\d{${m.length}}`)
  return new RegExp(`(?<![A-Za-z0-9])${shape}(?![A-Za-z0-9])`, 'gi')
}

/**
 * The names on this cycle's contract and on no other cycle of the file (the
 * sellers of a relisted home are on every cycle; the buyers of each contract
 * are not). A full name in the message is strong; a last name alone is weak.
 */
function cycleNameScore(c: DealCycleFacts, cycles: readonly DealCycleFacts[], text: string): number {
  if (!text) return 0
  const others = cycles.filter((x) => x.id !== c.id).flatMap((x) => [...(x.buyers ?? []), ...(x.sellers ?? [])])
  const otherTokens = new Set(others.flatMap((o) => nameTokens(o)))
  let best = 0
  for (const name of [...(c.buyers ?? []), ...(c.sellers ?? [])]) {
    if (others.some((o) => personNameMatches(o, name) || personNameMatches(name, o))) continue
    const toks = nameTokens(name)
    if (toks.length < 2) continue
    const first = escapeRe(toks[0])
    const last = escapeRe(toks[toks.length - 1])
    if (new RegExp(`\\b${first}\\b[^\\n]{0,40}?\\b${last}\\b|\\b${last},\\s*${first}\\b`, 'i').test(text)) best = Math.max(best, 12)
    else if (last.length >= 5 && !otherTokens.has(toks[toks.length - 1]) && new RegExp(`\\b${last}\\b`, 'i').test(text)) best = Math.max(best, 4)
  }
  return best
}

/**
 * The cycle on the deal this email belongs to. Offers and counters go to the
 * listing cycle (the offer log lives there). Everything else goes by what the
 * message says first and by date second:
 *  - the escrow or MLS number it names, when that number tells the cycles
 *    apart (and another escrow number of the same shape counts against a
 *    cycle that has a different one);
 *  - a buyer or seller on only one cycle's contract, by name;
 *  - a termination goes to the contract it ends: a cancelled cycle whose
 *    window holds the date, never a closed one;
 *  - then the cycle whose contract was live on the send date, then the one
 *    whose window holds it, a live sale cycle ahead of a cancelled one, and
 *    after close the closed sale cycle.
 * On 64350 Old Bend Redmond Hwy (a first contract cancelled, a second closed)
 * the first contract's escrow opening, its sale agreement and its termination
 * all landed on the closed cycle under the flat live-ahead-of-cancelled rule.
 */
export function pickCycleForMail(
  cycles: readonly DealCycleFacts[],
  sentAt: string,
  category: MailCategory,
  hints: CycleHints = {},
): string | null {
  if (!cycles.length) return null
  const at = t(sentAt) ?? Date.now()
  if ((category === 'offer' || category === 'counter') && !hints.termination) {
    const listing = cycles.find((c) => c.kind === 'listing')
    if (listing) return listing.id
  }
  const cancelled = (c: DealCycleFacts) => /cancel|dead|terminat|withdrawn|expired/i.test(c.status ?? '')
  const closed = (c: DealCycleFacts) => /closed|sold/i.test(c.status ?? '')
  const text = hints.text ?? ''
  const escrowNamed = new Set(cycles.filter((c) => mentionsEscrowNumber(text, c.escrowNumber)).map((c) => c.id))
  const mlsNamed = new Set(cycles.filter((c) => mentionsMlsNumber(text, c.mlsNumber)).map((c) => c.id))
  let best: { id: string; score: number; recency: number } | null = null
  for (const c of cycles) {
    const w = cycleWindow(c)
    let score = 0
    const holds = (w.start == null || at >= w.start) && (w.end == null || at <= w.end)
    if (holds) score += 10
    const accepted = t(c.acceptanceDate)
    if (c.kind === 'sale' && accepted != null && accepted <= at + PRE_OPEN_DAYS * DAY) score += 5
    // Under contract on the send date: accepted (the day before counts, dates are days) through close or cancellation.
    const ended = t(c.closeDate) ?? t(c.deadDate)
    if (c.kind === 'sale' && accepted != null && accepted - DAY <= at && (ended == null || at <= ended + DAY)) score += 6
    if (!cancelled(c)) score += 3
    if (escrowNamed.has(c.id) && escrowNamed.size < cycles.length) score += 20
    if (mlsNamed.has(c.id) && mlsNamed.size < cycles.length) score += 12
    const shape = escrowShapeRe(c.escrowNumber)
    if (shape && !escrowNamed.has(c.id) && [...text.matchAll(shape)].length) score -= 8
    score += cycleNameScore(c, cycles, text)
    if (hints.termination) {
      if (cancelled(c) && holds) score += 25
      if (closed(c)) score -= 30
    }
    const recency = accepted ?? t(c.listingDate) ?? t(c.createdAt) ?? 0
    if (!best || score > best.score || (score === best.score && recency > best.recency)) {
      best = { id: c.id, score, recency }
    }
  }
  return best?.id ?? cycles[0].id
}

// ── the decision ───────────────────────────────────────────────────────────

const W = { escrow: 100, mls: 90, thread: 80, address: 60, street: 30, subject: 15, city: 5, party: 20, contact: 10, name: 8 } as const

/**
 * The text a message's identifiers are read from: subject, body, attachment
 * names and attachment text. A comparables report (CMA, BPO, appraisal)
 * contributes only the property it is about: its comps' addresses and MLS
 * numbers are other properties, and one of them may be our file (19496
 * Tumalo's CMA listed 64350 Old Bend Redmond Hwy, MLS 220205567, as comp 5,
 * and rule 1 filed the email there).
 */
function dealText(facts: MailFacts): string {
  const names = facts.attachments.map((a) => a.name).join(' ')
  const attText = facts.attachments
    .map((a) => (isComparablesReport(a) ? comparablesSubject(a) ?? '' : (a.text ?? '').slice(0, 6000)))
    .join('\n')
  return `${facts.subject}\n${facts.body}\n${names}\n${attText}`.slice(0, 60_000)
}

/** What a message says about its cycle, for pickCycleForMail. */
export function cycleHintsFor(facts: MailFacts): CycleHints {
  return { text: dealText(facts), termination: isTerminationMail(facts) }
}

function addressesOf(list: readonly string[]): Set<string> {
  return new Set(list.map(normalizeEmail).filter((e) => e.includes('@') && !isHouseAddress(e)))
}

/** The subject names this deal by its full address, its MLS number or its escrow number. */
function subjectIdentifiesDeal(subject: string, d: DealFacts, parsed: ParsedDealAddress | null): boolean {
  return (
    (!!parsed && mentionsDealAddress(subject, parsed)) ||
    d.cycles.some((c) => mentionsMlsNumber(subject, c.mlsNumber) || mentionsEscrowNumber(subject, c.escrowNumber))
  )
}

export function decideMailFiling(input: {
  facts: MailFacts
  deals: readonly DealFacts[]
  thread: ThreadAnchor | null
}): MailDecision {
  const { facts, deals, thread } = input
  const direction = mailDirection(facts)
  const fromHouseSystem = facts.from.some(isHouseSystemSender)
  const categoryBase = categorizeMail({
    subject: facts.subject,
    body: facts.body,
    attachments: facts.attachments,
    autoReply: facts.autoReply,
    fromHouseSystem,
    bulkHeaders: facts.bulkHeaders,
  })
  const full = dealText(facts)
  const namesText = `${facts.subject}\n${facts.attachments.map((a) => a.name).join('\n')}`
  const participants = addressesOf([...facts.from, ...facts.to, ...facts.cc])
  // The test-party mailboxes (admin@, marketing@) also get Google Workspace
  // notices and CRM test sends. They stand for a test file's client only on
  // mail the alias harness wrote, which always carries its "[TC TEST <run>]" tag.
  if (!/\[TC TEST\b/i.test(facts.subject)) for (const alias of TEST_PARTY_ALIASES) participants.delete(alias)
  // A machine writing to a client is not the client writing (a security
  // notice, a receipt, an alert): its recipients are not evidence. Nor are an
  // alert's, an auto-reply's or a system notice's.
  const fromMachine = facts.from.length > 0 && facts.from.every((e) => isAutomatedSender(e) || isHouseSystemSender(e))
  const recipientsSilent =
    categoryBase === 'system_alert' ||
    categoryBase === 'auto_reply' ||
    categoryBase === 'listing_alert' ||
    (fromMachine && categoryBase === 'general')
  if (recipientsSilent) for (const e of [...facts.to, ...facts.cc]) participants.delete(normalizeEmail(e))
  const fromSet = new Set(facts.from.map(normalizeEmail))
  // Display names beside outside addresses, for people on a file by name only.
  // Never a machine's (SkySlope sends "as" the broker) and never our own brokers.
  const named = (facts.people ?? []).filter(
    (p) => !!p.name && participants.has(normalizeEmail(p.email)) && !isAutomatedSender(p.email) && !isHousePerson(p.name),
  )
  const subjectProperty = propertyInSubject(facts.subject)
  const parsedById = new Map(deals.map((d) => [d.dealId, parseDealAddress(d.address, d.city)]))
  // The files the subject names. Exactly one: the email is about that file,
  // whatever else its body lists (a title officer's two offices, a Flexmls
  // report's "also viewed" homes), so it is no digest.
  const subjectDeals = deals.filter((d) => {
    const p = parsedById.get(d.dealId) ?? null
    return subjectIdentifiesDeal(facts.subject, d, p) || (!!p && mentionsDealStreet(facts.subject, p))
  })
  const digest = subjectDeals.length !== 1 && listedAddresses(facts.subject, facts.body).length >= 3
  const knownPeople = new Set(deals.flatMap((d) => [...d.partyEmails, ...d.contactEmails]).map(normalizeEmail))
  const isKnownSender = (e: string) => knownPeople.has(normalizeEmail(e)) || domainIn(e, TRANSACTION_SENDER_DOMAINS)
  const reasons: string[] = []

  const scored: MailCandidate[] = []
  // Per deal: the people (emails, and names) who put it on the list; and whether the sender is one of them.
  const peopleOn = new Map<string, Set<string>>()
  const senderOn = new Set<string>()
  const senderNamedOn = new Set<string>()
  for (const d of deals) {
    const evidence: string[] = []
    let score = 0
    const parsed = parsedById.get(d.dealId) ?? null
    if (d.cycles.some((c) => mentionsEscrowNumber(full, c.escrowNumber))) {
      score += W.escrow
      evidence.push('escrow')
    }
    if (!digest && d.cycles.some((c) => mentionsMlsNumber(full, c.mlsNumber))) {
      score += W.mls
      evidence.push('mls')
    }
    if (!digest && parsed && mentionsDealAddress(full, parsed)) {
      score += W.address
      evidence.push('address')
      if (parsed.city && full.toLowerCase().includes(parsed.city)) {
        score += W.city
        evidence.push('city')
      }
    } else if (
      !digest &&
      parsed &&
      (mentionsDealStreet(namesText, parsed) ||
        platformAliasNamesDeal([...facts.to, ...facts.cc], parsed) ||
        (!!subjectProperty && subjectMistypesDeal(facts.subject, subjectProperty, parsed)))
    ) {
      // A street without its house number only counts where the email names
      // its own subject: a vendor pitch quoting "Beaumont Drive" in the body
      // is not mail about 20702 Beaumont. A SkySlope file address
      // ("BeaumontDrive2070260b4@skyslope.com") names it as surely, and so
      // does the subject's street with a mistyped house number ("2731 Ordway").
      score += W.street
      evidence.push('street')
    }
    // Forwarded chains quote other properties; the one in the subject is the one it is about.
    if (subjectDeals.includes(d)) {
      score += W.subject
      evidence.push('subject')
    }
    if (thread?.dealId === d.dealId) {
      score += W.thread
      evidence.push('thread')
    }
    const people = new Set<string>()
    const partyHit = d.partyEmails.map(normalizeEmail).filter((e) => participants.has(e))
    const contactHit = d.contactEmails.map(normalizeEmail).filter((e) => participants.has(e))
    for (const e of [...partyHit, ...contactHit]) {
      people.add(e)
      if (fromSet.has(e)) senderOn.add(d.dealId)
    }
    // By name: someone on the file whose email the file does not carry (an
    // other agent SkySlope listed with no email), writing or written to. The
    // person is their address on this email, however each file knows them: a
    // title officer on ten files by email and one by name is on eleven.
    const knownNames = [...(d.partyNames ?? []), ...(d.contactNames ?? [])]
    let nameHit = false
    for (const p of named) {
      const email = normalizeEmail(p.email)
      if (people.has(email) || !knownNames.some((n) => personNameMatches(p.name, n))) continue
      nameHit = true
      people.add(email)
      if (fromSet.has(email)) {
        senderOn.add(d.dealId)
        senderNamedOn.add(d.dealId)
      }
    }
    if (partyHit.length) {
      score += W.party
      evidence.push('party')
    }
    if (contactHit.length) {
      score += W.contact
      evidence.push('contact')
    }
    if (nameHit) {
      score += W.name
      evidence.push('name')
    }
    peopleOn.set(d.dealId, people)
    if (score > 0) scored.push({ dealId: d.dealId, score, evidence })
  }
  const hasEvidence = (c: MailCandidate, ...kinds: string[]) => kinds.some((k) => c.evidence.includes(k))
  // A thread never outvotes the message: when the email itself names another
  // of our files and not the thread's own, the file its thread sits on is no
  // candidate on the thread's word (Supra reuses one thread per sender across
  // every listing). When it names both, the thread still breaks the tie.
  if (thread && scored.some((c) => c.dealId !== thread.dealId && hasEvidence(c, 'escrow', 'mls', 'address', 'street'))) {
    const anchored = scored.find((c) => c.dealId === thread.dealId)
    if (anchored && hasEvidence(anchored, 'thread') && !hasEvidence(anchored, 'escrow', 'mls', 'address', 'street')) {
      anchored.score -= W.thread
      anchored.evidence = anchored.evidence.filter((e) => e !== 'thread')
      if (anchored.score <= 0) scored.splice(scored.indexOf(anchored), 1)
    }
  }
  scored.sort((a, b) => b.score - a.score)
  const byId = new Map(deals.map((d) => [d.dealId, d]))

  const finish = (
    status: MailStatus,
    dealId: string | null,
    method: MailMethod | null,
    score: number,
    category: MailCategory = categoryBase,
  ): MailDecision => {
    const deal = dealId ? byId.get(dealId) : undefined
    let cat = category
    // After close, closing mail (recorded deed, final statement) and general
    // mail read as post-close. A forwarded "Open Escrow" or inspection report
    // keeps its own category: it is about that step, whenever it was sent.
    if (deal && status === 'filed' && !LIVE_STAGES.has(deal.stage) && (cat === 'closing' || cat === 'general')) {
      const closedAt = Math.max(...deal.cycles.map((c) => t(c.closeDate) ?? 0))
      if (closedAt > 0 && (t(facts.sentAt) ?? 0) > closedAt) cat = 'post_close'
    }
    return {
      status,
      dealId,
      cycleId: deal ? pickCycleForMail(deal.cycles, facts.sentAt, cat, { text: full, termination: isTerminationMail(facts) }) : null,
      method,
      score,
      category: cat,
      direction,
      reasons,
      candidates: scored.slice(0, 5),
      propertyHint: subjectProperty,
    }
  }

  const hardHits = scored.filter((c) => hasEvidence(c, 'escrow', 'mls'))

  // Rule 0 — noise. Auto-replies, alerts and list mail never file on who they
  // touched. An escrow number of exactly one deal (title's automated notices)
  // lifts bulk mail onto that deal; so does exactly one deal's full address
  // or MLS number in the subject (a Flexmls activity report), and then the
  // rules below still decide it (a vendor's pitch naming our listing is refused
  // by rule 3). Our own machines and system notices are never lifted.
  const noise =
    facts.bulkHeaders ||
    categoryBase === 'listing_alert' ||
    categoryBase === 'system_alert' ||
    categoryBase === 'auto_reply' ||
    digest
  if (noise) {
    const quiet = categoryBase === 'auto_reply' || categoryBase === 'system_alert'
    const escrowOnly = scored.filter((c) => hasEvidence(c, 'escrow'))
    if (!quiet && escrowOnly.length === 1) {
      reasons.push('bulk mail carrying one deal escrow number')
      return finish('filed', escrowOnly[0].dealId, 'escrow', escrowOnly[0].score)
    }
    const identified = deals.filter((d) => subjectIdentifiesDeal(facts.subject, d, parsedById.get(d.dealId) ?? null))
    if (quiet || categoryBase === 'listing_alert' || digest || identified.length !== 1) {
      reasons.push(
        categoryBase === 'auto_reply'
          ? 'auto-reply'
          : categoryBase === 'system_alert'
            ? fromHouseSystem
              ? 'our own system mail'
              : 'a system notice'
            : digest
              ? 'lists three or more street addresses (a digest, not one property)'
              : categoryBase === 'listing_alert'
                ? 'listing alert'
                : 'bulk headers',
      )
      return finish('bulk', null, null, 0)
    }
    reasons.push('bulk mail naming one deal in its subject')
  }

  // Rule 1 — hard identifiers: escrow or MLS number of exactly one deal.
  if (hardHits.length) {
    const top = hardHits[0]
    if (hardHits.length === 1 || top.score > hardHits[1].score) {
      reasons.push(`${top.evidence.includes('escrow') ? 'escrow' : 'MLS'} number of one deal`)
      return finish('filed', top.dealId, top.evidence.includes('escrow') ? 'escrow' : 'mls', top.score)
    }
    reasons.push('identifiers of more than one deal')
    return finish('ambiguous', null, null, top.score)
  }

  // Rule 2 — the thread already lives on a deal, and this email names no other property.
  if (thread && byId.has(thread.dealId)) {
    const other = scored.find((c) => c.dealId !== thread.dealId && hasEvidence(c, 'address', 'street'))
    const anchored = scored.find((c) => c.dealId === thread.dealId)
    if (!other) {
      reasons.push(`same thread as mail already filed (${thread.method})`)
      return finish('filed', thread.dealId, 'thread', anchored?.score ?? W.thread)
    }
    reasons.push('thread is filed elsewhere but this email names another deal address')
  }

  // Rule 3 — the street address of exactly one deal (house number + street
  // name), then the street name alone ("SW 45th", "Beaumont Drive").
  const knownCorrespondent = direction !== 'inbound' || facts.from.some((e) => knownPeople.has(normalizeEmail(e)))
  const transactionMail =
    isTransactionCategory(categoryBase) || categoryBase === 'signing_notice' || facts.attachments.some(isTransactionFormAttachment)
  const outsideRecipients = [...facts.to, ...facts.cc].map(normalizeEmail).filter((e) => e.includes('@') && !isHouseAddress(e))
  for (const kind of ['address', 'street'] as const) {
    const hits = scored.filter((c) => hasEvidence(c, kind))
    if (!hits.length) continue
    if (kind === 'street' && !isTransactionCategory(categoryBase) && categoryBase !== 'signing_notice' && !knownCorrespondent) {
      reasons.push('names a street of one of our files, but a stranger wrote it and it is not transaction mail')
      return finish('not_deal', null, null, 0)
    }
    // A full address alone does not make ordinary mail deal mail: a vendor's
    // pitch, a magazine's ad sales, our own "just listed" letters to the
    // neighbours (2026-09-24 audit). It files when someone on the file is on
    // it, when a title company, e-sign platform or showing system sent it,
    // when it reads as a transaction (a new appraiser or lender) or as the
    // deal's people talking (another agent arranging a showing), or when a
    // broker filed it by hand ("[Deal: …]").
    if (kind === 'address' && !transactionMail && !hits.some((h) => hasEvidence(h, 'party', 'contact', 'name')) && !/^\s*\[deal:/i.test(facts.subject)) {
      if (direction === 'inbound' && !facts.from.some(isKnownSender) && !dealPeopleTalk(facts.subject, facts.body)) {
        reasons.push('names an address of one of our files, but a stranger wrote it and it is not transaction mail')
        return finish('not_deal', null, null, 0)
      }
      if (direction === 'outbound' && !outsideRecipients.some(isKnownSender)) {
        reasons.push('our own mail naming an address of one of our files, to no one on any file')
        return finish('not_deal', null, null, 0)
      }
    }
    const top = hits[0]
    if (hits.length === 1 || top.score > hits[1].score) {
      reasons.push(kind === 'address' ? 'street address of one deal' : 'street name of one deal, no house number')
      return finish('filed', top.dealId, 'address', top.score)
    }
    reasons.push(`${kind === 'address' ? 'street address' : 'street name'} of more than one deal`)
    return finish('ambiguous', null, null, top.score)
  }

  // The name people call a file by: its bare street ("Nordic", "School
  // House"), or its MLS subdivision ("Valhalla Heights") when exactly one
  // file open on the send date carries it.
  const subdivisionOwners = new Map<string, DealFacts[]>()
  for (const d of deals) {
    if (!dealOpenAt(d, facts.sentAt)) continue
    for (const raw of d.subdivisions ?? []) {
      const s = usableSubdivision(raw)
      if (!s) continue
      const list = subdivisionOwners.get(s.toLowerCase()) ?? []
      if (!list.includes(d)) list.push(d)
      subdivisionOwners.set(s.toLowerCase(), list)
    }
  }
  // distinctive: a bare name of six letters or two words ("Nordic", "School
  // House"), never a short common word ("Test", "Bluff") when nothing else says
  // the mail is about a transaction.
  const callsByName = (d: DealFacts, distinctive = false) => {
    const p = parsedById.get(d.dealId) ?? null
    const bare = p ? bareStreetName(p) : null
    if (p && bare && (!distinctive || bare.length >= 6 || bare.includes(' ')) && mentionsBareStreet(namesText, p)) return true
    return (d.subdivisions ?? []).some((raw) => {
      const s = usableSubdivision(raw)
      const owners = s ? subdivisionOwners.get(s.toLowerCase()) : undefined
      return !!s && owners?.length === 1 && owners[0] === d && mentionsSubdivision(namesText, s)
    })
  }

  // Rule 3b — our own transaction mail calling one file by its street alone:
  // "[Ordway forward] OREF 022A Buyers Repair Addendum 2". A broker wrote it
  // and it carries a transaction form or reads as one, so the name is the file.
  // An e-sign platform sending as our broker ("Nordic Counteroffer (Buyer #2)"
  // from noreply@skyslope.com) is our own mail too, and between our own
  // brokers ("Re: More Clarification on Nordic PA") the name is the file
  // whatever the words.
  const ownMail = direction !== 'inbound' || facts.from.some((e) => domainIn(e, ESIGN_DOMAINS))
  if (ownMail && (transactionMail || direction === 'internal') && !subjectProperty) {
    const byName = deals.filter((d) => callsByName(d, !transactionMail))
    if (byName.length === 1) {
      reasons.push('our transaction mail naming one deal by its street or subdivision')
      return finish('filed', byName[0].dealId, 'address', W.street)
    }
  }

  // Rule 4 — who it touched, only when the content is silent. A subject that
  // names a property not on the candidate never files by sender. Someone on a
  // file by name only counts when they wrote it or it is transaction mail.
  const open = scored.filter((c) => {
    const d = byId.get(c.dealId)
    if (!d || !dealOpenAt(d, facts.sentAt)) return false
    if (hasEvidence(c, 'party', 'contact')) return true
    return hasEvidence(c, 'name') && (senderNamedOn.has(c.dealId) || transactionMail)
  })
  const namesOther = (c: MailCandidate) => {
    if (!subjectProperty) return false
    const p = parsedById.get(c.dealId) ?? null
    if (!p) return true
    return !subjectNamesDeal(subjectProperty, p) && !subjectMisnamesDeal(facts.subject, subjectProperty, p)
  }
  const eligible = open.filter((c) => !namesOther(c))
  const methodFor = (c: MailCandidate): MailMethod => {
    if (hasEvidence(c, 'party')) return 'party'
    if (hasEvidence(c, 'contact')) return 'contact'
    const d = byId.get(c.dealId)
    return d && named.some((p) => (d.partyNames ?? []).some((n) => personNameMatches(p.name, n))) ? 'party' : 'contact'
  }
  if (open.length && !eligible.length) {
    reasons.push(`subject names ${subjectProperty}, which is not the sender's deal`)
  } else if (eligible.length === 1) {
    const only = eligible[0]
    const method = methodFor(only)
    const byNameOnly = !hasEvidence(only, 'party', 'contact')
    reasons.push(`${method === 'party' ? 'our client' : 'a contact'} on exactly one open deal${byNameOnly ? ', by name' : ''}`)
    return finish('filed', only.dealId, method, only.score)
  } else if (eligible.length > 1) {
    // Step two: of the deals the sender is on, the subject or a file name
    // calls exactly one by its street ("Home Warranty - Nordic") or its subdivision.
    const byName = eligible.filter((c) => {
      const d = byId.get(c.dealId)
      return !!d && callsByName(d)
    })
    if (byName.length === 1) {
      reasons.push(`on ${eligible.length} open deals; the subject names one by its street or subdivision`)
      return finish('filed', byName[0].dealId, 'address', byName[0].score)
    }
    // Step three: someone on the email is on exactly one of those files (the
    // other agent, by name, among a TC firm's several): that file. Only for
    // transaction mail, or when that person wrote it: a title officer's
    // holiday invitation reaching one client is not mail about that client's file.
    const count = new Map<string, number>()
    for (const c of eligible) for (const k of peopleOn.get(c.dealId) ?? []) count.set(k, (count.get(k) ?? 0) + 1)
    const unique = eligible.filter((c) => [...(peopleOn.get(c.dealId) ?? [])].some((k) => count.get(k) === 1))
    if (unique.length === 1 && (transactionMail || senderOn.has(unique[0].dealId))) {
      reasons.push(`on ${eligible.length} open deals; someone on the email is on only one of them`)
      return finish('filed', unique[0].dealId, methodFor(unique[0]), unique[0].score)
    }
    const [a, b] = eligible
    if (a.score > b.score && hasEvidence(a, 'party') && !hasEvidence(b, 'party')) {
      reasons.push('our client on one open deal, a contact on others')
      return finish('filed', a.dealId, 'party', a.score)
    }
    // An agent or title officer on many files sends plenty of mail about none
    // of them: dropped. A client on several files (selling one home, buying
    // the next) writing about "the walkthrough" means one of them: a person
    // picks, so it is queued.
    const clientOnSeveral = eligible.filter((c) => hasEvidence(c, 'party')).length > 1
    if (!isTransactionCategory(categoryBase) && !facts.attachments.length && !clientOnSeveral) {
      reasons.push(`general mail from someone on ${eligible.length} open deals, naming none`)
      return finish('not_deal', null, null, 0)
    }
    reasons.push(`sender or recipients are on ${eligible.length} open deals and the email names none`)
    return finish('ambiguous', null, null, a.score)
  }

  // Rule 5 — transaction mail with no deal: keep it, grouped by the property it names.
  // An e-sign completion for a property ("Envelope completed: Sellers
  // Counteroffer Rejection - 1450 Revere Ave") is a transaction record too.
  const transactionForm = facts.attachments.some(isTransactionFormAttachment)
  if ((isTransactionCategory(categoryBase) || categoryBase === 'signing_notice') && (transactionForm || subjectProperty)) {
    reasons.push(subjectProperty ? `transaction mail for ${subjectProperty}, no deal on file` : 'transaction documents, no deal on file')
    return finish('unfiled_transaction', null, null, 0)
  }
  reasons.push('no deal evidence')
  return finish('not_deal', null, null, 0)
}

// ── offers ─────────────────────────────────────────────────────────────────

function money(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw.replace(/[,$\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Terms printed on an offer or counter PDF. Every figure comes from the
 * document's own text (§0: the source is the offer); a term that does not
 * parse stays null rather than guessed.
 */
export function parseOfferTerms(text: string | null | undefined): {
  price: number | null
  earnestMoney: number | null
  financing: 'cash' | 'conventional' | 'fha' | 'va' | 'other' | null
} {
  const s = String(text ?? '').replace(/\s+/g, ' ')
  const priceRaw =
    s.match(/purchase\s+price[^$\d]{0,80}\$\s?([\d,]{5,}(?:\.\d{2})?)/i)?.[1] ??
    s.match(/\bprice\s+(?:of|is|:)?[^$\d]{0,30}\$\s?([\d,]{5,}(?:\.\d{2})?)/i)?.[1]
  const earnestRaw = s.match(/earnest\s+money[^$\d]{0,100}\$\s?([\d,]{3,}(?:\.\d{2})?)/i)?.[1]
  let financing: 'cash' | 'conventional' | 'fha' | 'va' | 'other' | null = null
  const fin = s.match(/\b(all\s+cash|cash\s+(?:offer|purchase)|conventional|FHA|VA\s+loan|USDA)\b/i)?.[1]?.toLowerCase() ?? null
  if (fin) {
    if (fin.includes('cash')) financing = 'cash'
    else if (fin === 'conventional') financing = 'conventional'
    else if (fin === 'fha') financing = 'fha'
    else if (fin.startsWith('va')) financing = 'va'
    else financing = 'other'
  }
  return { price: money(priceRaw), earnestMoney: money(earnestRaw), financing }
}

export type OfferCapture = {
  kind: 'offer' | 'counter_in' | 'counter_out'
  agentName: string | null
  agentEmail: string | null
  price: number | null
  earnestMoney: number | null
  financing: 'cash' | 'conventional' | 'fha' | 'va' | 'other' | null
}

/**
 * Does this filed email carry an offer on OUR listing? Inbound offers and
 * counters from the buyer side are recorded whether or not we ever reply
 * (OAR 863-015-0250(1): keep all offers received). Our own counter back is
 * recorded against the same thread.
 */
export function offerFromMail(input: {
  decision: MailDecision
  facts: MailFacts
  fromName: string | null
  listingSide: boolean
}): OfferCapture | null {
  const { decision, facts } = input
  if (decision.status !== 'filed' || !input.listingSide) return null
  if (decision.category !== 'offer' && decision.category !== 'counter') return null
  const hasDoc = facts.attachments.some((a) => SALE_AGREEMENT_NAME.test(attachmentBlob(a)) || COUNTER_NAME.test(attachmentBlob(a)))
  const offerSubject = /\boffers?\b|counter/i.test(facts.subject)
  if (!hasDoc && !offerSubject) return null
  // A forward is not the offer arriving: "[Deal: …] Fwd: Offer 3 Review" is a broker re-filing history.
  if (decision.direction === 'inbound' && /^\s*(?:\[[^\]]*\]\s*)?(?:fwd?|fw)\s*:/i.test(facts.subject)) return null
  const text = facts.attachments.map((a) => a.text ?? '').join('\n') || facts.body
  const terms = parseOfferTerms(text)
  if (decision.direction === 'outbound' || decision.direction === 'internal') {
    if (decision.category !== 'counter' || decision.direction === 'internal') return null
    return { kind: 'counter_out', agentName: null, agentEmail: null, ...terms }
  }
  const sender = facts.from.map(normalizeEmail).find((e) => !isHouseAddress(e)) ?? null
  return {
    kind: decision.category === 'counter' ? 'counter_in' : 'offer',
    agentName: input.fromName?.trim() || null,
    agentEmail: sender,
    ...terms,
  }
}

// ── opening files from mail ───────────────────────────────────────────────

export type QueuedMailForOpen = {
  id: string
  propertyHint: string | null
  subject: string | null
  category: string
  broker: string | null
  sentAt: string
}

export type FileToOpen = {
  propertyHint: string
  address: string
  broker: string | null
  rowIds: string[]
  reason: string
}

/** Proof a transaction on this property is under way through us, not just talk about it. */
const TRANSACTION_UNDER_WAY =
  /\b(?:open(?:ed)?\s+escrow|escrow(?:\s*\/\s*title)?\s+(?:is\s+)?open(?:ed)?|opening\s+escrow|title\s+opened|final\s+settlement|settlement\s+statement|closing\s+today|recorded)\b/i

const CENTRAL_OREGON_CITY =
  /,\s*(Bend|Redmond|Sisters|Sunriver|La Pine|Prineville|Madras|Terrebonne|Powell Butte|Tumalo|Culver|Crooked River Ranch|Black Butte Ranch|Camp Sherman)\b(?:,\s*OR(?:egon)?)?(?:\s+(\d{5}))?/i

/** The fullest street address the group's subjects write, with the city when one names it. */
export function bestAddressFromSubjects(hint: string, subjects: readonly string[]): string {
  const num = hint.split(' ')[0]
  let street: string | null = null
  let city: string | null = null
  let zip: string | null = null
  for (const s of subjects) {
    for (const m of s.matchAll(GENERIC_ADDRESS)) {
      if (m[1] !== num) continue
      const written = m[0].trim()
      if (!street || written.length > street.length) street = written
      const after = s.slice((m.index ?? 0) + m[0].length)
      const c = after.match(CENTRAL_OREGON_CITY)
      if (c && after.indexOf(c[0]) < 3) {
        city = c[1]
        zip = c[2] ?? zip
      }
    }
  }
  const base =
    street ??
    hint.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Nw|Ne|Sw|Se)\b/g, (m) => m.toUpperCase())
  return [base, city ? `${city}, OR${zip ? ` ${zip}` : ''}` : null].filter(Boolean).join(', ')
}

/**
 * Queued transaction mail that proves a deal is under way for a property with
 * no file (escrow opened, a settlement statement, a closing notice, a fully
 * executed agreement) opens a file for that property, so nothing waits on a
 * person to notice. Offers alone never open a file: an unanswered lowball on a
 * listing with no file stays in the queue for the broker.
 */
export function filesToOpenFromQueue(rows: readonly QueuedMailForOpen[]): FileToOpen[] {
  const groups = new Map<string, QueuedMailForOpen[]>()
  for (const r of rows) {
    if (!r.propertyHint) continue
    const list = groups.get(r.propertyHint) ?? []
    list.push(r)
    groups.set(r.propertyHint, list)
  }
  const out: FileToOpen[] = []
  for (const [hint, list] of groups) {
    const proof =
      list.find((r) => r.category === 'executed_agreement') ??
      list.find((r) => TRANSACTION_UNDER_WAY.test(r.subject ?? ''))
    if (!proof) continue
    const brokers = list.map((r) => r.broker).filter((b): b is string => !!b)
    const broker = brokers.sort((a, b) => brokers.filter((x) => x === b).length - brokers.filter((x) => x === a).length)[0] ?? null
    out.push({
      propertyHint: hint,
      address: bestAddressFromSubjects(hint, list.map((r) => r.subject ?? '')),
      broker,
      rowIds: list.map((r) => r.id),
      reason: proof.category === 'executed_agreement' ? 'fully executed agreement received' : `"${(proof.subject ?? '').trim().slice(0, 80)}"`,
    })
  }
  return out
}
