/**
 * Owner and contact names do not print in a CMA letter or an email draft.
 * Greeting policy is on hold; the body still must not carry the row's name
 * tokens. A token is a word from client_name / owner / contact that is not a
 * generic role word.
 *
 * What is held against the owner, and what is not:
 *   - Role words (the, owner, seller...) never become tokens.
 *   - Ordinary, entity and directional words (price, hill, homes, llc, estate,
 *     nw...) count only in a name-shaped position: a greeting, "Prepared for",
 *     a sign-off, a to/cc line, or a capitalized pair beside another name
 *     token.
 *   - Our own identity (the brokerage and the brokers, read from
 *     lib/brand/contact) is removed from the text before the CHECK grades it.
 *     A client named Ryan is not refused for "Matt Ryan" or "Ryan Realty". Whole
 *     phrases only, and never a phrase the owner's own name is made of. The MLS
 *     scrub is never told our identity: a remark's "Ryan" can be the owner.
 *   - Trust words (trust, rev, revocable, liv, living, family) are none of
 *     those. They are scrubbed everywhere on purpose and the check refuses
 *     them everywhere.
 * A real printed name (a greeting, a sign-off, the full name) still fails.
 */

import { BRAND, BROKERS } from '@/lib/brand/contact'

const ROLE_WORDS = new Set([
  'the',
  'owner',
  'owners',
  'client',
  'seller',
  'buyer',
  'lead',
  'mr',
  'mrs',
  'ms',
  'miss',
  'dr',
  'and',
  'or',
  'of',
])

/**
 * Ordinary words and real-estate vocabulary that are also surnames, plus the
 * words a company or estate owner name is made of, plus street directionals.
 * They print all over a CMA ("list price", "What price and time", "sales of
 * homes like yours", "115 NW Oregon Ave") and all over MLS remarks ("real
 * estate"). A hit requires a name-shaped position, not a bare whole-word match.
 *
 * TRUST WORDS ARE NOT HERE ON PURPOSE: trust, rev, revocable, liv, living,
 * family. A trust name is scrubbed from MLS text everywhere and the check
 * refuses it everywhere (letter-privacy.trust-scrub.test.ts holds that).
 */
const COMMON_NAME_WORDS = new Set([
  'price',
  'prices',
  'hill',
  'hills',
  'rose',
  'roses',
  'wood',
  'woods',
  'stone',
  'stones',
  'lake',
  'lakes',
  'park',
  'parks',
  'brook',
  'brooks',
  'ridge',
  'ridges',
  'field',
  'fields',
  'river',
  'rivers',
  'young',
  'king',
  'kings',
  'bell',
  'bells',
  // Company and estate owners (assessor rows such as "QUILLFEATHER HOMES LLC",
  // "ESTATE OF ..."). The real-estate nouns first. House and land are not
  // here: both are surnames ("the House family"), so they stay strict.
  'home',
  'homes',
  'houses',
  'property',
  'properties',
  'estate',
  'estates',
  'realty',
  'rental',
  'rentals',
  'holding',
  'holdings',
  'investment',
  'investments',
  'investors',
  'builder',
  'builders',
  'construction',
  'development',
  'developments',
  'developers',
  'management',
  'capital',
  'partners',
  'group',
  'company',
  // Legal forms.
  'llc',
  'inc',
  'co',
  'corp',
  'ltd',
  'lp',
  'llp',
  'pllc',
  'limited',
  // Street directionals. They print in every address, ours included ("115 NW
  // Oregon Ave", comp addresses), and a builder's name can end in one
  // ("... Homes NW"). One-letter directionals never become tokens. The bare
  // cardinals (north, south, east, west) are not here: they are surnames too
  // ("kept by the West family"), and a letter rarely prints one.
  'ne',
  'nw',
  'se',
  'sw',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
])

export function isCommonNameWord(token: string): boolean {
  return COMMON_NAME_WORDS.has(token.toLowerCase())
}

export type LetterNameSource = {
  clientName?: string | null
  ownerName?: string | null
  contactName?: string | null
  firstName?: string | null
}

/** Distinct name tokens from the row. Empty when the row has no personal name. */
export function ownerContactNameTokens(source: LetterNameSource | null | undefined): string[] {
  const raw = [source?.clientName, source?.ownerName, source?.contactName, source?.firstName]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(' ')
  if (!raw) return []
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const part of raw.split(/[\s,./&+-]+/)) {
    const t = part.replace(/[^A-Za-z'-]/g, '').trim()
    if (t.length < 2) continue
    const key = t.toLowerCase()
    if (ROLE_WORDS.has(key)) continue
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(t)
  }
  return tokens
}

const NAME_TOKEN_RE = /[A-Za-z][A-Za-z'-]+/g

function textOf(htmlOrText: string): string {
  return htmlOrText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

const MONTH_ABBR: Record<string, string> = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  sept: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December',
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function significantWords(phrase: string): string[] {
  return phrase
    .split(/[\s,./&+-]+/)
    .map((part) => part.replace(/[^A-Za-z'-]/g, ''))
    .filter((part) => part.length >= 2 && !ROLE_WORDS.has(part.toLowerCase()))
}

/** A phrase whose every word is ordinary vocabulary, not a given name. */
function phraseIsOnlyCommonWords(phrase: string): boolean {
  const words = significantWords(phrase)
  return words.length > 0 && words.every((word) => isCommonNameWord(word))
}

/**
 * "Mr. Price", "Mrs Price", "MRS.PRICE": an honorific makes an ordinary word a
 * surname. The token matches in any letter case; the honorific must start with
 * a capital M, so "mr" inside a sentence is not one. Miss and Dr are left out:
 * "don't miss Park Commons" and "Mirror Lake Dr. Lake access" are not titles.
 */
function honorificRegExp(token: string): RegExp {
  return new RegExp(`\\b(mrs|mr|ms)(?:\\.\\s*|\\s+)${escapeRegExp(token)}\\b`, 'gi')
}

function isHonorific(title: string): boolean {
  return title.startsWith('M')
}

/**
 * Greeting, "Prepared for", a sign-off, a to/cc line, an honorific, or a
 * capitalized pair sitting next to another name token ("Ada Price", "PRICE
 * HILL"). The pair matches in any letter case, because the stored name and the
 * printed text rarely share one (an assessor's "ROSE WEST" prints as "Rose
 * West"); both printed words must start with a capital.
 */
function commonWordInNamePosition(text: string, token: string, tokens: string[]): boolean {
  const t = escapeRegExp(token)
  if (new RegExp(`\\b(?:hi|hello|dear|hey),?\\s+${t}\\b`, 'i').test(text)) return true
  for (const m of text.matchAll(honorificRegExp(token))) if (isHonorific(m[1]!)) return true
  if (new RegExp(`\\bprepared\\s+for\\s+(?!the\\s+owners\\b)(?:[A-Za-z][A-Za-z'-]*\\s+){0,3}${t}\\b`, 'i').test(text)) {
    return true
  }
  if (new RegExp(`\\b(?:sincerely|regards|cheers|thanks|thank you),?\\s+${t}\\b`, 'i').test(text)) return true
  if (new RegExp(`(?:^|\\n)\\s*(?:to|cc|bcc)\\s*:[^\\n]*\\b${t}\\b`, 'i').test(text)) return true
  for (const other of tokens) {
    if (other.toLowerCase() === token.toLowerCase()) continue
    const o = escapeRegExp(other)
    const pair = new RegExp(`\\b(${o})\\s+(${t})\\b|\\b(${t})\\s+(${o})\\b`, 'gi')
    let match: RegExpExecArray | null
    while ((match = pair.exec(text))) {
      const left = match[1] ?? match[3]
      const right = match[2] ?? match[4]
      if (left && right && /^[A-Z]/.test(left) && /^[A-Z]/.test(right)) return true
    }
  }
  return false
}

/** Drop a capitalized pair of name tokens ("Price Quincy" or "Quincy Price"). */
function scrubCapitalizedNamePairs(text: string, tokens: string[]): string {
  let out = text
  for (const a of tokens) {
    for (const b of tokens) {
      if (a.toLowerCase() === b.toLowerCase()) continue
      const re = new RegExp(`\\b(${escapeRegExp(a)})\\s+(${escapeRegExp(b)})\\b`, 'gi')
      out = out.replace(re, (whole, left: string, right: string) =>
        /^[A-Z]/.test(left) && /^[A-Z]/.test(right) ? '' : whole,
      )
    }
  }
  return out
}

function scrubCommonWordNamePositions(text: string, token: string, tokens: string[]): string {
  const t = escapeRegExp(token)
  let out = text
  out = out.replace(new RegExp(`\\b(hi|hello|dear|hey),?\\s+${t}\\b`, 'gi'), '$1')
  // "Mr. Price" names the owner: drop the surname with its honorific.
  out = out.replace(honorificRegExp(token), (whole, title: string) => (isHonorific(title) ? '' : whole))
  out = out.replace(
    new RegExp(`\\b(prepared\\s+for\\s+(?!the\\s+owners\\b)(?:[A-Za-z][A-Za-z'-]*\\s+){0,3})${t}\\b`, 'gi'),
    '$1',
  )
  out = out.replace(new RegExp(`\\b(sincerely|regards|cheers|thanks|thank you),?\\s+${t}\\b`, 'gi'), '$1')
  out = out.replace(new RegExp(`(^|\\n)(\\s*(?:to|cc|bcc)\\s*:[^\\n]*?)\\b${t}\\b`, 'gi'), '$1$2')
  for (const other of tokens) {
    if (other.toLowerCase() === token.toLowerCase()) continue
    const o = escapeRegExp(other)
    out = out.replace(new RegExp(`\\b(${o})\\s+(${t})\\b`, 'gi'), (whole, mate: string, word: string) =>
      /^[A-Z]/.test(mate) && /^[A-Z]/.test(word) ? mate : whole,
    )
    out = out.replace(new RegExp(`\\b(${t})\\s+(${o})\\b`, 'gi'), (whole, word: string, mate: string) =>
      /^[A-Z]/.test(word) && /^[A-Z]/.test(mate) ? mate : whole,
    )
  }
  return out
}

/**
 * Take owner and trust tokens out of MLS-sourced text before it is printed.
 *
 * A month abbreviation that is also a name ("Jan" in "Listed Jan 7") is
 * spelled out, so the date stays true and the name token is not printed.
 * Any other whole-word token, including trust words (Rev, Liv, Trust), is
 * removed. The name check stays the backstop.
 */
export function scrubMlsOwnerTokens(
  text: string,
  source: LetterNameSource | null | undefined,
): string {
  if (!text) return text
  const tokens = ownerContactNameTokens(source)
  if (tokens.length === 0) return text
  let out = text
  const phrases = [source?.clientName, source?.ownerName, source?.contactName, source?.firstName]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 2)
    .sort((a, b) => b.length - a.length)
  for (const phrase of phrases) {
    // "Price" alone must not wipe every "list price". A name of two or more
    // words comes out whole in any letter case, even when every word in it is
    // ordinary ("PRICE HILL", "STONE HOMES LLC"): the whole phrase is the name.
    if (significantWords(phrase).length < 2 && phraseIsOnlyCommonWords(phrase)) continue
    out = out.replace(new RegExp(escapeRegExp(phrase), 'gi'), '')
  }
  // Reverse order ("Price Quincy") is not the stored phrase. Take the pair
  // out before the given name is deleted on its own and the surname is left.
  out = scrubCapitalizedNamePairs(out, tokens)
  for (const token of tokens) {
    if (isCommonNameWord(token)) {
      out = scrubCommonWordNamePositions(out, token, tokens)
      continue
    }
    const month = MONTH_ABBR[token.toLowerCase()]
    const word = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi')
    if (month) {
      out = out.replace(new RegExp(`\\b${escapeRegExp(token)}\\b(?=\\s+\\d)`, 'gi'), month)
      out = out.replace(word, '')
    } else {
      out = out.replace(word, '')
    }
  }
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .trim()
}

type MlsTextRow = {
  publicRemarks?: string | null
  viewDescription?: string | null
  listingHistoryLine?: string | null
  whyItSat?: string | null
}

/** Scrub the MLS text fields a letter prints: remarks, view, history, why-it-sat. */
export function scrubMlsTextRow<T extends MlsTextRow>(row: T, source: LetterNameSource | null | undefined): T {
  if (ownerContactNameTokens(source).length === 0) return row
  const scrub = (s: string | null | undefined) => (typeof s === 'string' ? scrubMlsOwnerTokens(s, source) : s)
  return {
    ...row,
    publicRemarks: scrub(row.publicRemarks) ?? row.publicRemarks,
    viewDescription: scrub(row.viewDescription) ?? row.viewDescription,
    listingHistoryLine: scrub(row.listingHistoryLine) ?? row.listingHistoryLine,
    whyItSat: scrub(row.whyItSat) ?? row.whyItSat,
  }
}

/**
 * A month abbreviation that is also a name token, written as a date
 * ("Jan 7"), is spelled out. Other name tokens are left for the field scrub
 * and the name check. Running the full token delete over the finished HTML
 * also eats the street when a name word sits in the address.
 */
export function expandNameMonthDatesInHtml(
  html: string,
  source: LetterNameSource | null | undefined,
): string {
  if (!html) return html
  const months = ownerContactNameTokens(source).filter((token) => MONTH_ABBR[token.toLowerCase()])
  if (months.length === 0) return html
  const sourceRe = `\\b(?:${months.map(escapeRegExp).join('|')})\\b(?=\\s+\\d)`
  return html.replace(/>([^<]+)</g, (whole, text: string) => {
    const next = text.replace(new RegExp(sourceRe, 'gi'), (match) => MONTH_ABBR[match.toLowerCase()] ?? match)
    return next === text ? whole : `>${next}<`
  })
}

/** Scrub owner tokens in HTML text nodes. Tags and attributes stay. */
export function scrubOwnerTokensInHtml(
  html: string,
  source: LetterNameSource | null | undefined,
): string {
  if (!html || ownerContactNameTokens(source).length === 0) return html
  return html.replace(/>([^<]+)</g, (whole, text: string) => {
    const next = scrubMlsOwnerTokens(text, source)
    return next === text ? whole : `>${next}<`
  })
}

/** "matthew-ryan" -> "Matthew Ryan": the roster's web slug, spelled out. */
function nameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * The phrases that are OUR identity, not an owner's name: the brokerage and
 * every broker on the roster, in each form the roster carries. "Matt Ryan" is
 * the display name, "Matthew Ryan" is the web slug spelled out, "Rebecca Ryser
 * Peterson" is the legal name behind the everyday "Rebecca Peterson", and
 * "Ryan Realty LLC" is the legal form of the brand name. Every other spelling
 * the brand module lists (BRAND.alternateNames) begins with "Ryan Realty".
 *
 * Read from lib/brand/contact.ts (BRAND, BROKERS), the roster the signature,
 * the email sender name, and the JSON-LD already read. There is no second list
 * here: a broker added to BROKERS is covered the day it is added. A broker who
 * exists only in public.brokers is not on the roster, and a client who shares
 * that broker's name meets the old refusal until the broker is added there.
 * Longest first, so the legal form wins over the bare brand name.
 */
export function ourIdentityPhrases(): string[] {
  const phrases = new Set<string>()
  // A full name only. A bare "Matt" would take "Hi Matt," out of the text
  // before it is graded, and a client called Matt would print unrefused.
  const add = (phrase: string) => {
    const t = phrase.trim()
    if (significantWords(t).length >= 2) phrases.add(t)
  }
  add(BRAND.name)
  add(BRAND.legalName)
  for (const broker of Object.values(BROKERS)) {
    add(broker.name)
    add(broker.nameShort)
    add(nameFromSlug(broker.slug))
  }
  return [...phrases].sort((a, b) => b.length - a.length)
}

/** Each identity phrase with its comparable words, worked out once. */
const OUR_IDENTITY = ourIdentityPhrases().map((phrase) => ({
  phrase,
  // Same word rule as the owner tokens, so a hyphenated name compares alike.
  words: significantWords(phrase).map((word) => word.toLowerCase()),
}))

function identityRegExp(phrases: readonly string[]): RegExp {
  const alternatives = phrases.map((phrase) => phrase.split(/\s+/).map(escapeRegExp).join('\\s+'))
  return new RegExp(`\\b(?:${alternatives.join('|')})\\b`, 'gi')
}

const OUR_IDENTITY_RE = identityRegExp(OUR_IDENTITY.map(({ phrase }) => phrase))

/**
 * Text with the brokerage and broker names taken out. Whole phrases only: a
 * bare "Matt" or "Ryan" is not our identity and stays for the grader, so a
 * greeting to a client who shares a first name still fails.
 *
 * One phrase is NOT taken out: a phrase made only of words in the owner's own
 * name. A client called Matt Ryan (or an owner called "Ryan Realty Holdings")
 * is a real name that reads exactly like ours, and only a person can tell the
 * two apart, so the letter stays refused as it was before this rule existed.
 *
 * For grading only. The MLS scrub functions never call this: a remark that
 * says "Ryan" can be naming the owner.
 */
function withoutOurOwnIdentity(text: string, tokens: readonly string[]): string {
  const ownWords = new Set(tokens.map((token) => token.toLowerCase()))
  const ours = OUR_IDENTITY.filter(({ words }) => words.length === 0 || !words.every((word) => ownWords.has(word)))
  if (ours.length === 0) return text
  const re = ours.length === OUR_IDENTITY.length ? OUR_IDENTITY_RE : identityRegExp(ours.map(({ phrase }) => phrase))
  return text.replace(re, ' ')
}

/**
 * Tokens that actually print. A real given name matches as a whole word.
 * An ordinary word (price, hill, stone, homes, llc) matches only in a
 * name-shaped position. The list is the tokens that hit, not every token on
 * the row.
 *
 * Our own brokerage and broker names are taken out of the copy first, so a
 * client named Ryan is not a hit on "Matt Ryan" or "Ryan Realty". This is the
 * one grader: letterOwnerNameCheck and letterContainsOwnerContactNames both
 * read it, so they cannot disagree.
 */
export function ownerNameTokenHits(
  htmlOrText: string,
  source: LetterNameSource | null | undefined,
): string[] {
  const tokens = ownerContactNameTokens(source)
  if (tokens.length === 0) return []
  const text = withoutOurOwnIdentity(textOf(htmlOrText), tokens)
  const words = new Set<string>()
  for (const word of text.match(NAME_TOKEN_RE) ?? []) {
    const w = word.toLowerCase()
    words.add(w)
    // A possessive still carries the name ("Zzyzx's offer"). Only a trailing
    // 's is dropped, so "don't" never reads as "don".
    if (w.endsWith("'s")) words.add(w.slice(0, -2))
  }
  const hits: string[] = []
  for (const token of tokens) {
    if (!words.has(token.toLowerCase())) continue
    if (isCommonNameWord(token) && !commonWordInNamePosition(text, token, tokens)) continue
    hits.push(token)
  }
  return hits
}

/** True when any owner/contact token appears as a whole word in the copy (ours excluded). */
export function letterContainsOwnerContactNames(
  htmlOrText: string,
  source: LetterNameSource | null | undefined,
): boolean {
  return ownerNameTokenHits(htmlOrText, source).length > 0
}

/** Greeting used while the broker's name ruling is on hold. */
export const HELD_LETTER_GREETING = 'Hi there,'

/**
 * One-line flip for the two owner-addressed prepared lines (cover + closing).
 * Default off: names stay out of the letter until the broker rules them in.
 */
export const CMA_LETTER_SHOW_OWNER_NAME = false

/** Full owner/contact name for the two prepared lines, or null. */
export function letterOwnerDisplayName(source: LetterNameSource | string | null | undefined): string | null {
  if (typeof source === 'string') {
    const t = source.trim()
    return t || null
  }
  const raw = [source?.clientName, source?.ownerName, source?.contactName]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .find(Boolean)
  return raw || null
}

function showOwnerName(override?: boolean): boolean {
  return override ?? CMA_LETTER_SHOW_OWNER_NAME
}

/** Street only: drop city/state/zip when the row stored a full line. */
export function letterStreetAddress(raw?: string | null): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  return (t.split(',')[0] ?? t).trim()
}

/**
 * Cover line. Flag on: "Prepared for <name> by Matt Ryan, Ryan Realty · <date>".
 * Flag off: "Prepared for the owners of <street> by Matt Ryan, Ryan Realty · <date>".
 */
export function preparedCoverLine(args: {
  brokerName?: string | null
  generatedAt: string
  ownerName?: string | null
  streetAddress?: string | null
  showOwnerName?: boolean
}): string {
  const who = (args.brokerName ?? '').trim() || 'Matt Ryan'
  const date = args.generatedAt.trim()
  if (showOwnerName(args.showOwnerName)) {
    const owner = (args.ownerName ?? '').trim()
    if (owner) return `Prepared for ${owner} by ${who}, Ryan Realty · ${date}`
  }
  const street = letterStreetAddress(args.streetAddress)
  if (street) return `Prepared for the owners of ${street} by ${who}, Ryan Realty · ${date}`
  return `Prepared by ${who}, Ryan Realty · ${date}`
}

/**
 * Closing line. Flag on: "Prepared <date> for <name>. This is a comparative…"
 * Flag off: "Prepared <date> for the owners of <street>. This is a comparative…"
 */
export function preparedClosingLine(args: {
  generatedAt: string
  ownerName?: string | null
  streetAddress?: string | null
  showOwnerName?: boolean
}): string {
  const date = args.generatedAt.trim()
  if (showOwnerName(args.showOwnerName)) {
    const owner = (args.ownerName ?? '').trim()
    if (owner) {
      return `Prepared ${date} for ${owner}. This is a comparative market analysis. It is not an appraisal.`
    }
  }
  const street = letterStreetAddress(args.streetAddress)
  if (street) {
    return `Prepared ${date} for the owners of ${street}. This is a comparative market analysis. It is not an appraisal.`
  }
  return `Prepared ${date}. This is a comparative market analysis. It is not an appraisal.`
}

/** Cover / signature line: never "Prepared for <name>" when the flag is off. */
export function preparedLineWithoutName(brokerName?: string | null): string {
  const who = (brokerName ?? '').trim()
  return who ? `Prepared by ${who}, Ryan Realty` : 'Prepared'
}

export function preparedFinePrint(generatedAt: string, brokerClause?: string): string {
  const extra = brokerClause?.trim() ? ` ${brokerClause.trim()}` : ''
  return `Prepared ${generatedAt}${extra}. This is a comparative market analysis. It is not an appraisal.`
}

export type LetterNameCheck = {
  id: 'letter-no-owner-names'
  severity: 'hard'
  pass: boolean
  detail: string
}

const OWNERS_COVER_RE =
  /Prepared for the owners of\s+[^<]+?\s+by\s+[^,<]+,\s+Ryan Realty\s+·\s+[^<]+/gi
const OWNERS_CLOSE_RE =
  /Prepared\s+[^.<]+?\s+for the owners of\s+[^.<]+(?=\.\s+This is a comparative market analysis)/gi
const NAMED_COVER_RE = /Prepared for\s+[^<]+?\s+by\s+[^,<]+,\s+Ryan Realty\s+·\s+[^<]+/gi
const NAMED_CLOSE_RE =
  /Prepared\s+[^.<]+?\s+for\s+[^.<]+(?=\.\s+This is a comparative market analysis)/gi
const ANY_COVER_RE = /Prepared(?: for (?:the owners of )?[\s\S]*?)? by [^,<]+, Ryan Realty · [^<]+/gi
const ANY_CLOSE_LEAD_RE = /Prepared [^.<]+?(?=\.\s+This is a comparative market analysis)/gi

function extractPreparedDate(html: string): string {
  const fromCover = html.match(/Ryan Realty ·\s*([^<]+)/i)
  if (fromCover?.[1]?.trim()) return fromCover[1].trim()
  const fromClose = html.match(/Prepared\s+([A-Z][a-z]+ \d{1,2}, \d{4})/)
  return fromClose?.[1]?.trim() ?? ''
}

function extractCoverStreet(html: string): string {
  const titled = html.match(/<h1[^>]*class="[^"]*cover-title[^"]*"[^>]*>([^<]+)<\/h1>/i)
  if (titled?.[1]) return letterStreetAddress(titled[1])
  const hero = html.match(/<h1[^>]*class="[^"]*hero-h[^"]*"[^>]*>([^<]+)<\/h1>/i)
  return letterStreetAddress(hero?.[1] ?? '')
}

/**
 * Print-time rewrite of the two prepared sentences on stored HTML.
 * Does not touch rec, band, or comps. No database write.
 */
export function applyPreparedLinesToStoredHtml(
  html: string,
  args: {
    streetAddress?: string | null
    brokerName?: string | null
    generatedAt?: string | null
    ownerName?: string | null
    showOwnerName?: boolean
  },
): string {
  ANY_COVER_RE.lastIndex = 0
  ANY_CLOSE_LEAD_RE.lastIndex = 0
  const street = letterStreetAddress(args.streetAddress) || extractCoverStreet(html)
  const date = (args.generatedAt ?? '').trim() || extractPreparedDate(html)
  if (!street && !date) return html
  const cover = preparedCoverLine({
    brokerName: args.brokerName,
    generatedAt: date,
    ownerName: args.ownerName,
    streetAddress: street,
    showOwnerName: args.showOwnerName,
  })
  const close = preparedClosingLine({
    generatedAt: date,
    ownerName: args.ownerName,
    streetAddress: street,
    showOwnerName: args.showOwnerName,
  })
  const closeLead = close.replace(/\.\s+This is a comparative market analysis[\s\S]*$/, '')
  let out = html
  if (ANY_COVER_RE.test(out)) {
    ANY_COVER_RE.lastIndex = 0
    out = out.replace(ANY_COVER_RE, cover)
  }
  if (ANY_CLOSE_LEAD_RE.test(out)) {
    ANY_CLOSE_LEAD_RE.lastIndex = 0
    out = out.replace(ANY_CLOSE_LEAD_RE, closeLead)
  }
  return out
}

/**
 * Strip the two prepared sentences so a street token that collides with a
 * last name (Murphy, Slate) does not fail the name contract. When the flag
 * is on, also strip the named prepared lines.
 */
export function htmlWithoutAllowedPreparedNameLines(
  htmlOrText: string,
  opts?: { showOwnerName?: boolean },
): string {
  OWNERS_COVER_RE.lastIndex = 0
  OWNERS_CLOSE_RE.lastIndex = 0
  NAMED_COVER_RE.lastIndex = 0
  NAMED_CLOSE_RE.lastIndex = 0
  const html = htmlOrText.replace(OWNERS_COVER_RE, 'Prepared by Ryan Realty').replace(OWNERS_CLOSE_RE, 'Prepared')
  if (!showOwnerName(opts?.showOwnerName)) return html
  return html.replace(NAMED_COVER_RE, 'Prepared by Ryan Realty').replace(NAMED_CLOSE_RE, 'Prepared')
}

/**
 * Hard refuse: the letter or email draft carries the row's owner/contact name.
 *
 * Order matters. The two prepared sentences are set aside first (their
 * patterns read the literal "Ryan Realty"), then ownerNameTokenHits takes the
 * tags out, takes our own brokerage and broker names out, and grades what is
 * left.
 */
export function letterOwnerNameCheck(
  htmlOrText: string,
  source: LetterNameSource | null | undefined,
  opts?: { showOwnerName?: boolean },
): LetterNameCheck {
  const tokens = ownerContactNameTokens(source)
  const graded = htmlWithoutAllowedPreparedNameLines(htmlOrText, opts)
  const hits = ownerNameTokenHits(graded, source)
  const allowed = showOwnerName(opts?.showOwnerName)
  return {
    id: 'letter-no-owner-names',
    severity: 'hard',
    pass: hits.length === 0,
    detail: hits.length
      ? `Letter or email draft printed owner/contact name token(s): ${hits.join(', ')}.`
      : tokens.length
        ? allowed
          ? 'Owner/contact name tokens appear only on the two prepared lines, or not at all.'
          : 'Owner/contact name tokens are absent from the letter and email draft.'
        : 'Row carries no owner/contact name tokens.',
  }
}
