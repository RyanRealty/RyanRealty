/**
 * Owner and contact names do not print in a CMA letter or an email draft.
 * Greeting policy is on hold; the body still must not carry the row's name
 * tokens. A token is a word from client_name / owner / contact that is not a
 * generic role word.
 */

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
    out = out.replace(new RegExp(escapeRegExp(phrase), 'gi'), '')
  }
  for (const token of tokens) {
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

/** True when any owner/contact token appears as a whole word in the copy. */
export function letterContainsOwnerContactNames(
  htmlOrText: string,
  source: LetterNameSource | null | undefined,
): boolean {
  const tokens = ownerContactNameTokens(source)
  if (tokens.length === 0) return false
  const words = new Set((textOf(htmlOrText).match(NAME_TOKEN_RE) ?? []).map((w) => w.toLowerCase()))
  return tokens.some((t) => words.has(t.toLowerCase()))
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

/** Hard refuse: the letter or email draft carries the row's owner/contact name. */
export function letterOwnerNameCheck(
  htmlOrText: string,
  source: LetterNameSource | null | undefined,
  opts?: { showOwnerName?: boolean },
): LetterNameCheck {
  const tokens = ownerContactNameTokens(source)
  const graded = htmlWithoutAllowedPreparedNameLines(htmlOrText, opts)
  const hit = letterContainsOwnerContactNames(graded, source)
  const allowed = showOwnerName(opts?.showOwnerName)
  return {
    id: 'letter-no-owner-names',
    severity: 'hard',
    pass: !hit,
    detail: hit
      ? `Letter or email draft printed owner/contact name token(s): ${tokens.join(', ')}.`
      : tokens.length
        ? allowed
          ? 'Owner/contact name tokens appear only on the two prepared lines, or not at all.'
          : 'Owner/contact name tokens are absent from the letter and email draft.'
        : 'Row carries no owner/contact name tokens.',
  }
}
