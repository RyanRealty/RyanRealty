/**
 * Google review asks: drafted for Matt's approval, never sent here.
 *
 * Matt 2026-10-14: a review ask is DRAFTED (a) after each real closing in the
 * Vault and (b) for past clients he picks. Every send needs his yes on that one
 * message. The draft waits in his CRM Drafts folder (/admin/messages?f=drafts);
 * it goes out only when he opens it and presses Send, through the governed
 * send path (suppression check, click tracking). Pinned in
 * data/analytics/decisions.json as `gbp-review-asks-drafted-for-approval`.
 *
 * The body is the 2026-09-07 one-voice ask (marketing_brain_skills/brand-voice/
 * VOICE.md, mirrored by the crm_templates row `email-google-review`), with the
 * client's first name, the property, and the review link as a few linked words
 * (`[words](url)`, rendered as an anchor by lib/crm/email-body.ts) instead of
 * the raw address.
 *
 * This module is PURE. It never writes and never sends. The DAL stager
 * (`lib/data/crm/stageReviewAskDraft.ts`) is the only writer, and it only
 * writes `crm_message_drafts` plus one `crm_timeline` ledger row per ask.
 */
import { GBP_REVIEW_URL } from '@/lib/brand/contact'
import { isInternalRecipientEmail } from '@/lib/email/internal-recipient'
import { hasFleetTestTag, isFleetTestEmail, isFleetTestPhone } from '@/lib/crm/fleet-test-identity'
import { isIndustryContact } from '@/lib/crm/industry-contact'
import { isTestFile } from '@/lib/tc/dashboard'

export const REVIEW_ASK_SUBJECT = 'A quick favor'

/**
 * How old a Vault closing can be and still get its ask on the closing path.
 * Basis: the 2026-10-14 brief sized the after-closing path over the last 12
 * months. A closing reaches the Vault late (the SkySlope intake only began
 * 2026-09-24; the MLS close rule records a lapsed folder days after the
 * close), so the window is measured from the close date and is long enough
 * that a late arrival is still asked. Each person is drafted at most once.
 */
export const REVIEW_ASK_CLOSE_LOOKBACK_DAYS = 365

/**
 * Whose Drafts folder holds a review ask nobody clicked for: Matt's. Each send
 * needs his yes, and only the broker who owns a draft sees and sends it.
 */
export const REVIEW_ASK_APPROVER_SLUG = 'matt'

/** The tag a public form writes when the visitor ticked the SMS consent box. */
export const SMS_CONSENT_YES_TAG = 'sms-consent:yes'

// ── The message ──────────────────────────────────────────────────────────────

export type ReviewAskDraftInput = {
  /** The client's first name, already cleaned (see reviewAskFirstName). */
  firstName?: string | null
  /** The property, as the file names it. Only the street part is used. */
  address?: string | null
  /** First name of the broker who sends it (the draft's owner). */
  signerFirstName?: string | null
  /** The broker who worked the deal, when that is not the sender. */
  dealBrokerFirstName?: string | null
}

/** "3480 SW 45th Street, Redmond, OR 97756" → "3480 SW 45th Street". */
export function reviewAskStreet(address: string | null | undefined): string | null {
  const street = String(address ?? '').split(',')[0]?.trim() ?? ''
  return street.length > 0 ? street : null
}

/**
 * A first name fit to open a letter, or null. The CRM carries placeholders and
 * couples ("Unknown", "Jim & Sue", "J."), and a wrong name is worse than "Hi,".
 */
export function reviewAskFirstName(firstName: string | null | undefined, name?: string | null): string | null {
  const full = (name ?? '').trim()
  // The full name only stands in when it reads as one person's name: a trust,
  // an estate, a family or a couple ("Estate of John Doe", "Doe Family Trust",
  // "The Smiths", "Jim & Sue Smith") has no first name to greet.
  const fromName =
    full && !/[&,\/+]|\b(and|trust|trustees?|estate|family|the|llc|inc|corp|company|properties)\b/i.test(full)
      ? full.split(/\s+/)[0]
      : ''
  const raw = (firstName ?? '').trim() || fromName || ''
  if (!/^\p{L}[\p{L}'’-]{1,29}$/u.test(raw)) return null
  if (/^(unknown|test|n\/?a|none|owner|resident|client|buyer|seller)$/i.test(raw)) return null
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** The first word of a broker's name, as they sign ("Rebecca Peterson" → "Rebecca"). */
export function reviewAskSignerName(name: string | null | undefined): string | null {
  const w = String(name ?? '').trim().split(/\s+/)[0] ?? ''
  return w.length > 0 ? w : null
}

function thanksLine(input: ReviewAskDraftInput): string {
  const place = reviewAskStreet(input.address) ?? 'your home'
  const who = input.dealBrokerFirstName ? `${input.dealBrokerFirstName} and all of us at Ryan Realty` : 'us'
  return `Thank you again for trusting ${who} with ${place}. It meant a lot to work with you.`
}

/** The email draft. Plain text; the link is `[words](url)`. */
export function buildReviewAskBody(input: ReviewAskDraftInput | string | null = {}): string {
  const opts: ReviewAskDraftInput = typeof input === 'string' || input == null ? { address: input } : input
  const lines = [
    opts.firstName ? `Hi ${opts.firstName},` : 'Hi,',
    '',
    thanksLine(opts),
    '',
    `If you have two minutes, would you [leave us a Google review](${GBP_REVIEW_URL})? A few honest sentences about how it went helps the next family in Central Oregon find us.`,
    '',
    "Thank you. We're here whenever you need anything real estate, or just have a question about the market.",
  ]
  if (opts.signerFirstName) lines.push('', opts.signerFirstName)
  return lines.join('\n')
}

/**
 * The text draft, for a client with no usable email who ticked the SMS consent
 * box. The bare address is right here: the text send path swaps it for a
 * tracked short link.
 */
export function buildReviewAskText(input: ReviewAskDraftInput = {}): string {
  const hi = input.firstName ? `Hi ${input.firstName}, ` : 'Hi, '
  const place = reviewAskStreet(input.address) ?? 'your home'
  const sign = input.signerFirstName ? ` ${input.signerFirstName}, Ryan Realty` : ' Ryan Realty'
  return `${hi}thank you again for trusting us with ${place}. If you have two minutes, would you leave us a Google review? ${GBP_REVIEW_URL} Thank you!${sign}`
}

/** True for the email or text this module drafts (any version of the body). */
export function isReviewAskDraft(input: { subject?: string | null; body?: string | null }): boolean {
  const body = input.body ?? ''
  if (!body.includes(GBP_REVIEW_URL)) return false
  const subject = (input.subject ?? '').trim()
  return subject === REVIEW_ASK_SUBJECT || subject === ''
}

// ── Has this person been asked before? ───────────────────────────────────────

/**
 * Subjects of review asks already sent from the brokers' mailboxes. Read from
 * crm_timeline 2026-10-14 ("a quick review", "can you leave a quick review?",
 * "do you have time for a review?", "would you feel comfortable leaving a
 * review?"). Deal mail that only mentions a review ("Offer Review", "for your
 * review", "file review") does not match.
 */
const SENT_ASK_SUBJECTS: readonly RegExp[] = [
  /\bleav(?:e|ing)\b[^\n]{0,30}\breview\b/i,
  /\btime for a review\b/i,
  /^\s*a quick review\s*\??\s*$/i,
  /\bgoogle review\b/i,
]

/**
 * An outbound message that was a review ask: our own ask (its subject, or the
 * write-review link in its body), or one of the asks brokers wrote by hand.
 * `hasReviewLink` is the server's body test for a write-review link; the
 * brokers' signature carries a "Read our Google reviews" maps link, which is
 * not one.
 */
export function isSentReviewAsk(row: { kind: string; title: string | null; hasReviewLink: boolean }): boolean {
  if (row.kind !== 'email_out' && row.kind !== 'sms_out') return false
  if (row.hasReviewLink) return true
  // A reply or forward in the thread of an ask counts too ("Re: A quick review").
  const title = (row.title ?? '').trim().replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '')
  return SENT_ASK_SUBJECTS.some((re) => re.test(title))
}

/**
 * Body markers of a review link that was sent: Google's write-review form
 * (any place id) and the Business Profile short review link. The brokers'
 * signature carries a maps search link ("Read our Google reviews"), which is
 * neither.
 */
export const SENT_REVIEW_LINK_MARKERS: readonly string[] = ['writereview', 'g.page/r/']

// ── Who gets one ─────────────────────────────────────────────────────────────

export type ReviewAskPath = 'closing' | 'picked'
export type ReviewAskChannel = 'email' | 'text'

export type ReviewAskPerson = {
  id: number
  firstName: string | null
  name: string | null
  stage: string | null
  tags: readonly string[]
  emails: readonly string[]
  phones: readonly string[]
  deleted: boolean
}

export type ReviewAskHistory = {
  /** When a review ask was first drafted for this person (the ledger), if ever. */
  draftedAt: string | null
  /** When a review ask went out to this person, if ever. */
  askedAt: string | null
  /** The approver's Drafts already hold a review ask for this person. */
  pendingDraft: boolean
  /** The approver's Drafts hold some other draft on that channel (never overwritten). */
  slotTaken: { email: boolean; text: boolean }
}

export type ReviewAskConsent = {
  /** isSuppressed(person, 'email'): an opt-out, bounce, hard stop, or a failed read. */
  emailBlocked: boolean
  /** isSuppressed(person, 'sms'): do-not-call/text, the DNC registry, no consent, or a failed read. */
  smsBlocked: boolean
}

export type ReviewAskSkip =
  | 'deleted'
  | 'test'
  | 'internal'
  | 'industry'
  | 'already-drafted'
  | 'already-asked'
  | 'no-email'
  | 'email-blocked'
  | 'sms-blocked'
  | 'draft-slot-taken'

export type ReviewAskDecision =
  | { stage: true; channel: ReviewAskChannel }
  | { stage: false; reason: ReviewAskSkip }

export const REVIEW_ASK_SKIP_WORDS: Record<ReviewAskSkip, string> = {
  deleted: 'deleted contact',
  test: 'test contact',
  internal: 'one of our own addresses',
  industry: 'an agent, lender or vendor',
  'already-drafted': 'a review ask is already drafted',
  'already-asked': 'already asked for a review',
  'no-email': 'no email, and no text consent',
  'email-blocked': 'email is suppressed, and no text consent',
  'sms-blocked': 'no usable email, and texting is blocked (do not text or the Do Not Call list)',
  'draft-slot-taken': 'another draft is waiting for this person',
}

function isTestPerson(p: ReviewAskPerson): boolean {
  if (hasFleetTestTag([...p.tags])) return true
  if (String(p.stage ?? '').toLowerCase() === 'trash') return true
  return p.emails.some((e) => isFleetTestEmail(e)) || p.phones.some((ph) => isFleetTestPhone(ph))
}

function hasSmsConsent(p: ReviewAskPerson): boolean {
  return p.tags.some((t) => t.toLowerCase() === SMS_CONSENT_YES_TAG)
}

/**
 * Whether to draft an ask for one person, and on which channel. Email by
 * default; a text only when there is no usable email AND the person ticked the
 * SMS consent box AND nothing blocks SMS (do-not-call/text, the DNC registry).
 * Never a test or internal person, never someone asked or drafted before, and
 * never over a draft a broker started.
 */
export function decideReviewAsk(input: {
  person: ReviewAskPerson
  history: ReviewAskHistory
  consent: ReviewAskConsent
  path: ReviewAskPath
}): ReviewAskDecision {
  const { person, history, consent } = input
  const skip = reviewAskPrecheck(input)
  if (skip) return { stage: false, reason: skip }

  let channel: ReviewAskChannel | null = null
  const textable = person.phones.length > 0 && hasSmsConsent(person)
  if (person.emails.length > 0 && !consent.emailBlocked) channel = 'email'
  else if (textable && !consent.smsBlocked) channel = 'text'
  if (!channel) {
    if (textable) return { stage: false, reason: 'sms-blocked' }
    return { stage: false, reason: person.emails.length > 0 ? 'email-blocked' : 'no-email' }
  }

  if (history.slotTaken[channel]) return { stage: false, reason: 'draft-slot-taken' }
  return { stage: true, channel }
}

/** Which consent reads decideReviewAsk can use, so the stager asks only those. */
export function reviewAskConsentNeeds(person: ReviewAskPerson): { email: boolean; sms: boolean } {
  return { email: person.emails.length > 0, sms: person.phones.length > 0 && hasSmsConsent(person) }
}

/** The checks that need no consent read: identity and history. Null = go on. */
export function reviewAskPrecheck(input: {
  person: ReviewAskPerson
  history: ReviewAskHistory
  path: ReviewAskPath
}): ReviewAskSkip | null {
  const { person, history, path } = input
  if (person.deleted) return 'deleted'
  if (isTestPerson(person)) return 'test'
  if (person.emails.some((e) => isInternalRecipientEmail(e))) return 'internal'
  // A client who is also an agent is rare; on the automatic path an industry
  // contact on a file is far more often the other side's agent linked by
  // mistake. Matt can still pick one by hand.
  if (path === 'closing' && isIndustryContact({ tags: [...person.tags], stage: person.stage })) return 'industry'
  if (history.pendingDraft) return 'already-drafted'
  if (history.askedAt) return 'already-asked'
  // A draft Matt discarded stays discarded on the automatic path; his own pick
  // may draft again (nothing was sent).
  if (path === 'closing' && history.draftedAt) return 'already-drafted'
  return null
}

// ── The closing path ─────────────────────────────────────────────────────────

export type VaultClosing = {
  dealId: string
  address: string
  brokerName: string | null
  stageDetail: string | null
  /** The newest sale close on the file (tc_cycles.actual_closing_date). */
  closeDate: string
  parties: ReadonlyArray<{ personId: number; role: string }>
}

/** The first day (inclusive) a closing still counts, as YYYY-MM-DD. */
export function reviewAskSince(today: string, days: number = REVIEW_ASK_CLOSE_LOOKBACK_DAYS): string {
  const d = new Date(`${today.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * The (closing, person) pairs to consider: real closings only (no test file),
 * closed on or before today and inside the window, buyer and seller parties
 * only, newest closing first, and each person once.
 */
export function reviewAskClosingParties(
  closings: readonly VaultClosing[],
  today: string,
  days: number = REVIEW_ASK_CLOSE_LOOKBACK_DAYS,
): Array<{ closing: VaultClosing; personId: number }> {
  const since = reviewAskSince(today, days)
  const day = today.slice(0, 10)
  const real = closings
    .filter((c) => !isTestFile({ stageDetail: c.stageDetail, address: c.address }))
    .filter((c) => c.closeDate.slice(0, 10) >= since && c.closeDate.slice(0, 10) <= day)
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate) || a.dealId.localeCompare(b.dealId))
  const seen = new Set<number>()
  const out: Array<{ closing: VaultClosing; personId: number }> = []
  for (const closing of real) {
    for (const party of closing.parties) {
      if (party.role !== 'buyer' && party.role !== 'seller') continue
      if (!Number.isInteger(party.personId) || party.personId <= 0 || seen.has(party.personId)) continue
      seen.add(party.personId)
      out.push({ closing, personId: party.personId })
    }
  }
  return out
}

// ── The ledger ───────────────────────────────────────────────────────────────

/** Every review-ask ledger key for a person starts with this. */
export function reviewAskLedgerPrefix(personId: number): string {
  return `review-ask:${personId}:`
}

/**
 * The crm_timeline dedupe key (unique index) that records one drafted ask. A
 * closing keys on the deal, so the same person and deal can never be drafted
 * twice; a pick keys on the day.
 */
export function reviewAskLedgerKey(input: { personId: number; dealId?: string | null; day?: string | null }): string {
  const prefix = reviewAskLedgerPrefix(input.personId)
  if (input.dealId) return `${prefix}deal:${input.dealId}`
  return `${prefix}picked:${(input.day ?? '').slice(0, 10)}`
}
