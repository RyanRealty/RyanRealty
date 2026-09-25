/**
 * Owner and contact names do not print in a CMA letter or an email draft.
 * Greeting policy is on hold; the body still must not carry the row's name
 * tokens. A token is a word from client_name / owner / contact that is not a
 * generic role word.
 */

const ROLE_WORDS = new Set([
  'the',
  'owner',
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

/** Cover / signature line: never "Prepared for <name>". */
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

/** Hard refuse: the letter or email draft carries the row's owner/contact name. */
export function letterOwnerNameCheck(
  htmlOrText: string,
  source: LetterNameSource | null | undefined,
): LetterNameCheck {
  const tokens = ownerContactNameTokens(source)
  const hit = letterContainsOwnerContactNames(htmlOrText, source)
  return {
    id: 'letter-no-owner-names',
    severity: 'hard',
    pass: !hit,
    detail: hit
      ? `Letter or email draft printed owner/contact name token(s): ${tokens.join(', ')}.`
      : tokens.length
        ? 'Owner/contact name tokens are absent from the letter and email draft.'
        : 'Row carries no owner/contact name tokens.',
  }
}
