/**
 * lead-quality — the intake screen for public lead forms (FUNNEL-1, visibility
 * audit 2026-09-22).
 *
 * WHY. In the 30 days to 2026-09-22 about three quarters of site arrivals were
 * scripted submits: 44 of 47 contact-form rows, 7 of 7 join rows and 11 of 30
 * alerts-sheet rows. Each one became a person, got the visitor confirmation and
 * a drip email (often to a real, harvested address), put three texts on the
 * broker's phone and, on the alerts lane, a five-minute call task. The shapes
 * are mechanical and nothing a person types:
 *
 *   - a name that is one long token of random mixed case  (bJSKIwsurKTralgVeDiGblO)
 *   - a Gmail address with the dot trick                   (k.el.v.f.ee@gmail.com)
 *   - a Faker-style Gmail local                            (jordyaprobertsgxi97@gmail.com)
 *   - a role mailbox or a throwaway domain                 (abuse@ziggo.nl)
 *   - a filled honeypot field
 *
 * The per-IP limiter cannot see them (contact bots arrive at least ~22 minutes
 * apart), so the screen reads the submission itself.
 *
 * WHAT IT DOES. Nothing is dropped or hidden. A suspect submit still becomes a
 * crm_people row, tagged `quality:suspect` plus one `quality:signal:<why>` per
 * signal, with a timeline note, so a broker can read it and remove the tag.
 * Every machine that acts on a new lead skips a person carrying the tag:
 * auto-enroll (lib/crm/enroll.ts), the lead pings in queueBrokerAlert, call
 * tasks (createNativeTask), the response clock, hot-lead escalation, and the
 * sequence engine's suppressed-SMS advance. The contact form and the alerts
 * sheet also skip their visitor confirmation and conversion pixels for it.
 *
 * PRECISION FIRST. A false positive silences a real lead, which costs more than
 * a bot getting through. Measured on crm_people with these exact rules
 * (read 2026-09-23T02:48Z, non-fleet, deleted = false):
 *   - site doors, 30 days from 2026-08-24T02:48Z: 69 of 92 flagged (contact
 *     47/51, join 7/7, alerts 14/31, sign-in 1/1); the 4 unflagged contact rows
 *     are people, and no row read as a person was flagged.
 *   - the pre-August book (22,930 rows, all named): 3 flagged, two of them the
 *     scripted rows of a 2026-06-10 import and one a skip-traced Farm row whose
 *     stored Gmail address is itself dot-tricked.
 * Alerts-sheet signups with ordinary foreign or free-mail addresses still get
 * through; nothing in an email-only submit separates them from a person.
 *
 * Pure and dependency-free (no server-only, no Supabase): lead-quality.test.ts.
 */

export const QUALITY_SUSPECT_TAG = 'quality:suspect'
export const QUALITY_SIGNAL_TAG_PREFIX = 'quality:signal:'

export type LeadQualitySignal =
  | 'honeypot'
  | 'random-token-name'
  | 'dot-trick-email'
  | 'pattern-email'
  | 'role-account-email'
  | 'disposable-email'

export type LeadQualityVerdict = {
  suspect: boolean
  signals: LeadQualitySignal[]
}

/** Case changes between adjacent letters: 'aBcD' = 3. */
export function caseSwitches(token: string): number {
  let n = 0
  for (let i = 1; i < token.length; i++) {
    const prevLower = token[i - 1] === token[i - 1].toLowerCase()
    const curLower = token[i] === token[i].toLowerCase()
    if (prevLower !== curLower) n++
  }
  return n
}

/**
 * Glued capitalised words, the way a person types a name with no spaces:
 * 'DeLaCruzGarcia', 'JohnMcGregor'. Every part is capitalised and carries a
 * vowel ('Mc' excepted). A generated token can fall into the capitalised shape
 * by chance ('BbxYggNvulOdbPey'), but its parts are not syllables.
 */
export function isGluedName(token: string): boolean {
  const parts = token.match(/[A-Z][a-z]+/g)
  if (!parts || parts.join('') !== token) return false
  return parts.every((p) => p === 'Mc' || /[aeiou]/.test(p))
}

/**
 * One token of 12+ ASCII letters, both cases, 3+ case changes, that is not a
 * glued name. A person does not type 'QKlvETWISqnRlVJW' or 'xFTASUZOhtmkVANKQH'.
 * Every contact-form and join bot name in the 30-day read is 16 to 24 letters.
 */
export function isRandomToken(token: string): boolean {
  if (!/^[A-Za-z]{12,}$/.test(token)) return false
  if (!/[a-z]/.test(token) || !/[A-Z]/.test(token)) return false
  if (isGluedName(token)) return false
  return caseSwitches(token) >= 3
}

/** Any whitespace-separated token of the name is a random token. */
export function isRandomTokenName(name: string | null | undefined): boolean {
  const tokens = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  return tokens.some(isRandomToken)
}

function splitEmail(email: string | null | undefined): { local: string; domain: string } | null {
  const e = String(email ?? '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at <= 0 || at === e.length - 1) return null
  return { local: e.slice(0, at), domain: e.slice(at + 1) }
}

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

/**
 * Gmail ignores dots, so scripts sprinkle them to make one inbox look like many
 * (k.el.v.f.ee, c.h.anem.m.e.rso.n27.4). Two in a row or a dot at either end is
 * not a valid address at all. Otherwise it takes 4+ dots AND segments averaging
 * 2.5 characters or less: a person who uses dots uses them between words
 * ('on.one.is.here.ok' averages 2.6, 'popsy.is.a.chocoholic' 4.5), a script
 * cuts one word into shards.
 */
export function isDotTrickEmail(email: string | null | undefined): boolean {
  const parts = splitEmail(email)
  if (!parts || !GMAIL_DOMAINS.has(parts.domain)) return false
  const local = parts.local.split('+')[0]
  if (local.includes('..') || local.startsWith('.') || local.endsWith('.')) return true
  const segments = local.split('.')
  if (segments.length < 5) return false
  const letters = segments.reduce((n, s) => n + s.length, 0)
  return letters / segments.length <= 2.5
}

/**
 * Faker-style Gmail local: 15+ lowercase letters then exactly 2 or 3 digits and
 * nothing else — first name, a stray pair of letters, a surname, a random
 * suffix, a number (jordyaprobertsgxi97, francogaflatleycvp84).
 */
export function isPatternEmail(email: string | null | undefined): boolean {
  const parts = splitEmail(email)
  if (!parts || !GMAIL_DOMAINS.has(parts.domain)) return false
  return /^[a-z]{15,}\d{2,3}$/.test(parts.local)
}

/** Mailboxes no person signs up for listing alerts from. Kept narrow on purpose. */
const ROLE_LOCALS = new Set([
  'abuse',
  'postmaster',
  'hostmaster',
  'mailer-daemon',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
])

export function isRoleAccountEmail(email: string | null | undefined): boolean {
  const parts = splitEmail(email)
  return Boolean(parts && ROLE_LOCALS.has(parts.local.split('+')[0]))
}

/** Throwaway-inbox providers. A short, exact list: no fuzzy matching. */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'sharklasers.com',
  'yopmail.com',
  '10minutemail.com',
  'temp-mail.org',
  'tempmail.com',
  'trashmail.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'throwawaymail.com',
])

export function isDisposableEmail(email: string | null | undefined): boolean {
  const parts = splitEmail(email)
  return Boolean(parts && DISPOSABLE_DOMAINS.has(parts.domain))
}

/**
 * The verdict for one submission. `name` is what the visitor typed (not the
 * 'Lead <email>' placeholder a nameless row is stored under).
 *
 * The Faker-style address counts ONLY on a nameless submit (the alerts sheet
 * asks for an email and nothing else). Where a person typed a name, the address
 * alone is not evidence: 19 of 5,551 Gmail addresses in the pre-August book have
 * the same shape and belong to real owners (christopherpearson53@gmail.com).
 */
export function classifyLeadQuality(input: {
  name?: string | null
  email?: string | null
  honeypot?: boolean
}): LeadQualityVerdict {
  const signals: LeadQualitySignal[] = []
  const named = String(input.name ?? '').trim().length > 0
  if (input.honeypot === true) signals.push('honeypot')
  if (isRandomTokenName(input.name)) signals.push('random-token-name')
  if (isDotTrickEmail(input.email)) signals.push('dot-trick-email')
  if (!named && isPatternEmail(input.email)) signals.push('pattern-email')
  if (isRoleAccountEmail(input.email)) signals.push('role-account-email')
  if (isDisposableEmail(input.email)) signals.push('disposable-email')
  return { suspect: signals.length > 0, signals }
}

/**
 * Broker-alert kinds a suspect person never triggers: the lead-arrival ping,
 * the response-clock pings, and the return-visit (looking-at / CMA-open) pings.
 * A reply, a booked appointment, a CMA a broker built and the task digest are
 * a person or a broker acting, so they still text (lib/crm/broker-alerts.ts).
 */
export function isSuspectSilencedAlertKind(kind: string): boolean {
  return kind === 'new-lead' || kind.startsWith('untouched-') || kind.startsWith('return-visit:')
}

/** The tags a suspect create carries: the flag plus one tag per signal. */
export function qualityTags(verdict: LeadQualityVerdict): string[] {
  if (!verdict.suspect) return []
  return [QUALITY_SUSPECT_TAG, ...verdict.signals.map((s) => `${QUALITY_SIGNAL_TAG_PREFIX}${s}`)]
}

/** Does this person carry the suspect flag? Every skip gate reads this one test. */
export function hasSuspectTag(tags: unknown): boolean {
  return Array.isArray(tags) && tags.includes(QUALITY_SUSPECT_TAG)
}

/** Plain-language reason for the timeline note and logs. */
export function describeSignals(signals: readonly LeadQualitySignal[]): string {
  const words: Record<LeadQualitySignal, string> = {
    honeypot: 'the hidden form field was filled',
    'random-token-name': 'the name is one random run of mixed-case letters',
    'dot-trick-email': 'the Gmail address uses the dot trick',
    'pattern-email': 'the Gmail address has the generated name-plus-digits shape',
    'role-account-email': 'the address is a role mailbox, not a person',
    'disposable-email': 'the address is on a throwaway-inbox domain',
  }
  return signals.map((s) => words[s]).join('; ')
}
