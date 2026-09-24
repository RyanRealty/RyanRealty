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

export const MAIL_RULES_VERSION = 'mail-rules-v3-2026-09-24'

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

export type MailFacts = {
  messageKey: string
  sentAt: string
  from: string[]
  to: string[]
  cc: string[]
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
  const next = SUFFIX_VARIANTS[parsed.next] ?? escapeRe(parsed.next)
  return new RegExp(`\\b${street}\\s+(?:${next})\\b`, 'i').test(text)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  return new RegExp(`\\b${name.split(' ').map(escapeRe).join('\\s+')}\\b`, 'i').test(text)
}

/** House number followed by the street's first word, directional optional: "909 NW Delaware" or "909 Delaware". */
export function mentionsDealAddress(text: string, parsed: ParsedDealAddress): boolean {
  const re = new RegExp(`\\b${parsed.number}\\s+(?:${DIRECTIONAL}\\s+)?${escapeRe(parsed.street)}\\b`, 'i')
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
    out.add(canonicalDirectional(`${m[1]} ${m[2]}`.replace(/\s+/g, ' ').trim().toLowerCase()))
  }
  return [...out]
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
 * usually a year.
 */
export function propertyInSubject(subject: string): string | null {
  const withSuffix = streetAddressesIn(subject)
  if (withSuffix.length) return withSuffix[0]
  for (const m of subject.matchAll(SUBJECT_ADDRESS)) {
    const [, num, dir, street, next] = m
    const hasDir = !!dir.trim()
    const ordinal = /^\d+(?:st|nd|rd|th)$/i.test(street)
    const named = /^[A-Z][a-z'-]{2,}$/.test(street)
    if (!(named || (ordinal && hasDir))) continue
    if (/^(?:19|20)\d{2}$/.test(num) && !hasDir) continue
    return canonicalDirectional([num, dir.trim(), street, next ?? ''].filter(Boolean).join(' ').toLowerCase())
  }
  return null
}

function subjectNamesDeal(subjectProperty: string, parsed: ParsedDealAddress | null): boolean {
  if (!parsed) return false
  return mentionsDealAddress(subjectProperty, parsed) || mentionsDealStreet(subjectProperty, parsed)
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

/** Our own pipelines' alerts ("[Expired] 363 Bluff, Bend …", "[Deploy] …"): they name properties, they are not deal mail. */
const SYSTEM_ALERT_SUBJECT = /^\[(?:expired|deploy|data|preview|alert|cron|loop|seo|ci|health|digest)\b[^\]]*\]/i

const LISTING_ALERT_SUBJECT =
  /\bnew listings?\b|\bupdates? for\b|home search is set|^copy:\s*subscription|\bprice (?:drop|change|reduced)\b|\bopen house(?:s)? (?:this|near)\b|\bhot ?sheet\b|\bmarket (?:update|report)\b/i

export function categorizeMail(input: {
  subject: string
  body: string
  attachments: readonly MailAttachmentFacts[]
  autoReply: boolean
  fromHouseSystem: boolean
}): MailCategory {
  const subject = input.subject ?? ''
  if (input.autoReply || /^(?:automatic reply|auto(?:matic)?[- ]?reply|out of (?:the )?office)\b/i.test(subject.trim())) {
    return 'auto_reply'
  }
  if (LISTING_ALERT_SUBJECT.test(subject)) return 'listing_alert'
  if (SYSTEM_ALERT_SUBJECT.test(subject.trim())) return 'system_alert'
  if (
    /documents? to sign|signature (?:is )?(?:requested|still needed)|your signed documents|envelope completed|please docusign|docusign|dotloop|authentisign/i.test(
      subject,
    )
  ) {
    return 'signing_notice'
  }
  const attachments = input.attachments ?? []
  // Fully executed by its read, or by its file name ("… Fully Executed.pdf",
  // SkySlope's "_X_" executed marker).
  const executedSale = attachments.find(
    (a) =>
      SALE_AGREEMENT_NAME.test(attachmentBlob(a)) &&
      (a.executionState === 'fully_executed' || /fully[\s_-]*(?:executed|signed)/i.test(a.name ?? '') || /(?:^|[\s_-])X_(?=[A-Z0-9])/.test(a.name ?? '')),
  )
  if (executedSale) return 'executed_agreement'
  if (attachments.some((a) => COUNTER_NAME.test(attachmentBlob(a))) || /counter[\s-]?offer|\bcounter\b/i.test(subject)) {
    return 'counter'
  }
  if (attachments.some((a) => SALE_AGREEMENT_NAME.test(attachmentBlob(a))) || /\boffers?\b/i.test(subject)) {
    return 'offer'
  }
  if (attachments.some((a) => /addendum|amendment/i.test(attachmentBlob(a))) || /addendum|amendment/i.test(subject)) {
    return 'addendum'
  }
  const hay = `${subject}\n${attachments.map(attachmentBlob).join(' ')}`
  if (/closing (?:statement|disclosure)|settlement statement|\balta\b|\bfunded\b|\brecord(?:ed|ing)\b|final (?:statement|hud)|\bclosing\b|\bclose of escrow\b|\bkeys\b/i.test(hay)) {
    return 'closing'
  }
  if (/disclosure|\bspds?\b|\bspd\b|seller'?s? property/i.test(hay)) return 'disclosure'
  if (/\binspection|\brepair/i.test(hay)) return 'inspection'
  if (/\bescrow\b|\btitle\b|\bprelim|wire|\bwt\d{5,}|open order|earnest/i.test(hay)) return 'escrow_title'
  if (/\bloan\b|\blender\b|pre-?approval|\bappraisal|underwrit|clear to close|\bctc\b|mortgage/i.test(hay)) return 'lender'
  return 'general'
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

/**
 * The cycle on the deal this email belongs to. Offers and counters go to the
 * listing cycle (the offer log lives there). Everything else goes to the cycle
 * whose window holds the send date, a live sale cycle ahead of a cancelled one,
 * and after close to the closed sale cycle.
 */
export function pickCycleForMail(cycles: readonly DealCycleFacts[], sentAt: string, category: MailCategory): string | null {
  if (!cycles.length) return null
  const at = t(sentAt) ?? Date.now()
  if (category === 'offer' || category === 'counter') {
    const listing = cycles.find((c) => c.kind === 'listing')
    if (listing) return listing.id
  }
  const cancelled = (c: DealCycleFacts) => /cancel|dead|terminat|withdrawn|expired/i.test(c.status ?? '')
  let best: { id: string; score: number; recency: number } | null = null
  for (const c of cycles) {
    const w = cycleWindow(c)
    let score = 0
    const holds = (w.start == null || at >= w.start) && (w.end == null || at <= w.end)
    if (holds) score += 10
    const accepted = t(c.acceptanceDate)
    if (c.kind === 'sale' && accepted != null && accepted <= at + PRE_OPEN_DAYS * DAY) score += 5
    if (!cancelled(c)) score += 3
    const recency = accepted ?? t(c.listingDate) ?? t(c.createdAt) ?? 0
    if (!best || score > best.score || (score === best.score && recency > best.recency)) {
      best = { id: c.id, score, recency }
    }
  }
  return best?.id ?? cycles[0].id
}

// ── the decision ───────────────────────────────────────────────────────────

const W = { escrow: 100, mls: 90, thread: 80, address: 60, street: 30, subject: 15, city: 5, party: 20, contact: 10 } as const

function dealText(facts: MailFacts): string {
  const names = facts.attachments.map((a) => a.name).join(' ')
  const attText = facts.attachments.map((a) => (a.text ?? '').slice(0, 6000)).join('\n')
  return `${facts.subject}\n${facts.body}\n${names}\n${attText}`.slice(0, 60_000)
}

function addressesOf(list: readonly string[]): Set<string> {
  return new Set(list.map(normalizeEmail).filter((e) => e.includes('@') && !isHouseAddress(e)))
}

export function decideMailFiling(input: {
  facts: MailFacts
  deals: readonly DealFacts[]
  thread: ThreadAnchor | null
}): MailDecision {
  const { facts, deals, thread } = input
  const direction = mailDirection(facts)
  const fromHouseSystem = facts.from.some((e) => normalizeEmail(e).endsWith('@mail.ryan-realty.com'))
  const categoryBase = categorizeMail({
    subject: facts.subject,
    body: facts.body,
    attachments: facts.attachments,
    autoReply: facts.autoReply,
    fromHouseSystem,
  })
  const full = dealText(facts)
  const namesText = `${facts.subject}\n${facts.attachments.map((a) => a.name).join('\n')}`
  const participants = addressesOf([...facts.from, ...facts.to, ...facts.cc])
  // The test-party mailboxes (admin@, marketing@) also get Google Workspace
  // notices and CRM test sends. They stand for a test file's client only on
  // mail the alias harness wrote, which always carries its "[TC TEST <run>]" tag.
  if (!/\[TC TEST\b/i.test(facts.subject)) for (const alias of TEST_PARTY_ALIASES) participants.delete(alias)
  const subjectProperty = propertyInSubject(facts.subject)
  const digest = streetAddressesIn(`${facts.subject}\n${facts.body}`).length >= 3
  const reasons: string[] = []

  const scored: MailCandidate[] = []
  for (const d of deals) {
    const evidence: string[] = []
    let score = 0
    const parsed = parseDealAddress(d.address, d.city)
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
    } else if (!digest && parsed && mentionsDealStreet(namesText, parsed)) {
      // A street without its house number only counts where the email names
      // its own subject: a vendor pitch quoting "Beaumont Drive" in the body
      // is not mail about 20702 Beaumont.
      score += W.street
      evidence.push('street')
    }
    // Forwarded chains quote other properties; the one in the subject is the one it is about.
    if (parsed && (mentionsDealAddress(facts.subject, parsed) || mentionsDealStreet(facts.subject, parsed))) {
      score += W.subject
      evidence.push('subject')
    }
    if (thread?.dealId === d.dealId) {
      score += W.thread
      evidence.push('thread')
    }
    const partyHit = d.partyEmails.some((e) => participants.has(normalizeEmail(e)))
    const contactHit = d.contactEmails.some((e) => participants.has(normalizeEmail(e)))
    if (partyHit) {
      score += W.party
      evidence.push('party')
    }
    if (contactHit) {
      score += W.contact
      evidence.push('contact')
    }
    if (score > 0) scored.push({ dealId: d.dealId, score, evidence })
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
      cycleId: deal ? pickCycleForMail(deal.cycles, facts.sentAt, cat) : null,
      method,
      score,
      category: cat,
      direction,
      reasons,
      candidates: scored.slice(0, 5),
      propertyHint: subjectProperty,
    }
  }

  const hasEvidence = (c: MailCandidate, ...kinds: string[]) => kinds.some((k) => c.evidence.includes(k))
  const hardHits = scored.filter((c) => hasEvidence(c, 'escrow', 'mls'))

  // Rule 0 — noise. Auto-replies and list mail never file on who they touched.
  // Only an escrow number (title's automated notices) lifts bulk mail onto a deal.
  const noise =
    facts.bulkHeaders ||
    categoryBase === 'listing_alert' ||
    categoryBase === 'system_alert' ||
    categoryBase === 'auto_reply' ||
    digest
  if (noise) {
    const escrowOnly = scored.filter((c) => hasEvidence(c, 'escrow'))
    if (escrowOnly.length === 1 && categoryBase !== 'auto_reply') {
      reasons.push('bulk mail carrying one deal escrow number')
      return finish('filed', escrowOnly[0].dealId, 'escrow', escrowOnly[0].score)
    }
    reasons.push(
      categoryBase === 'auto_reply'
        ? 'auto-reply'
        : digest
          ? 'lists three or more street addresses (a digest, not one property)'
          : categoryBase === 'listing_alert'
            ? 'listing alert'
            : categoryBase === 'system_alert'
              ? 'our own system alert'
              : 'bulk headers',
    )
    return finish('bulk', null, null, 0)
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
  const knownCorrespondent =
    direction !== 'inbound' || facts.from.some((e) => deals.some((d) => [...d.partyEmails, ...d.contactEmails].includes(normalizeEmail(e))))
  for (const kind of ['address', 'street'] as const) {
    const hits = scored.filter((c) => hasEvidence(c, kind))
    if (!hits.length) continue
    if (kind === 'street' && !isTransactionCategory(categoryBase) && categoryBase !== 'signing_notice' && !knownCorrespondent) {
      reasons.push('names a street of one of our files, but a stranger wrote it and it is not transaction mail')
      return finish('not_deal', null, null, 0)
    }
    const top = hits[0]
    if (hits.length === 1 || top.score > hits[1].score) {
      reasons.push(kind === 'address' ? 'street address of one deal' : 'street name of one deal, no house number')
      return finish('filed', top.dealId, 'address', top.score)
    }
    reasons.push(`${kind === 'address' ? 'street address' : 'street name'} of more than one deal`)
    return finish('ambiguous', null, null, top.score)
  }

  // Rule 3b — our own transaction mail calling one file by its street alone:
  // "[Ordway forward] OREF 022A Buyers Repair Addendum 2". A broker wrote it
  // and it carries a transaction form or reads as one, so the name is the file.
  const transactionMail = isTransactionCategory(categoryBase) || facts.attachments.some(isTransactionFormAttachment)
  if (direction !== 'inbound' && transactionMail && !subjectProperty) {
    const named = deals.filter((d) => {
      const p = parseDealAddress(d.address, d.city)
      return !!p && mentionsBareStreet(namesText, p)
    })
    if (named.length === 1) {
      reasons.push('our transaction mail naming one deal by its street')
      return finish('filed', named[0].dealId, 'address', W.street)
    }
  }

  // Rule 4 — who it touched, only when the content is silent. A subject that
  // names a property not on the candidate never files by sender.
  const open = scored.filter((c) => {
    const d = byId.get(c.dealId)
    return !!d && hasEvidence(c, 'party', 'contact') && dealOpenAt(d, facts.sentAt)
  })
  const namesOther = (c: MailCandidate) => {
    if (!subjectProperty) return false
    const d = byId.get(c.dealId)
    return !subjectNamesDeal(subjectProperty, d ? parseDealAddress(d.address, d.city) : null)
  }
  const eligible = open.filter((c) => !namesOther(c))
  if (open.length && !eligible.length) {
    reasons.push(`subject names ${subjectProperty}, which is not the sender's deal`)
  } else if (eligible.length === 1) {
    const only = eligible[0]
    const method: MailMethod = hasEvidence(only, 'party') ? 'party' : 'contact'
    reasons.push(`${method === 'party' ? 'our client' : 'a contact'} on exactly one open deal`)
    return finish('filed', only.dealId, method, only.score)
  } else if (eligible.length > 1) {
    // Step two: of the deals the sender is on, the subject or a file name
    // calls exactly one by its street ("Home Warranty - Nordic").
    const named = eligible.filter((c) => {
      const d = byId.get(c.dealId)
      const p = d ? parseDealAddress(d.address, d.city) : null
      return !!p && mentionsBareStreet(namesText, p)
    })
    if (named.length === 1) {
      reasons.push(`on ${eligible.length} open deals; the subject names one by its street`)
      return finish('filed', named[0].dealId, 'address', named[0].score)
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
