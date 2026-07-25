/**
 * market-report-audience — the AUDIENCE SELECTOR for market-report sends (W8.6).
 *
 * Before this module the market-report product had exactly ONE way to reach a
 * person: the per-contact cadence engine (lib/crm/market-report-send), which
 * walks `crm_report_subscriptions` and mails each subscriber on their own
 * weekly/monthly/quarterly window. There was no way to say "send the July Bend
 * report to everyone tagged past-client" without inventing a second ad-hoc blast
 * path, and a second blast path is exactly how suppression / opt-out / warm-up
 * rails get bypassed.
 *
 * This file is the vocabulary half of the fix: a small, typed, PURE descriptor
 * of "who does this send go to", plus the rule that maps each audience kind onto
 * the newsletter delivery ledger's existing entrypoint. It contains no DB access
 * and no 'server-only' marker on purpose — the admin picker (a client component)
 * imports the kind list and the labels as VALUES, and the server resolver
 * (lib/newsletter/market-report-bulk) imports the same constants, so the picker
 * and the router can never drift.
 *
 * Two ledger routes, both already built and already compliance-checked:
 *
 *   'audience-segment' -> enqueueNewsletter(id)          (newsletters.audience = 'segment:<seg>')
 *   'email-list'       -> enqueueNewsletterToEmails(id, emails)
 *
 * Both land in newsletters + newsletter_recipients + newsletter_send_schedule
 * and are drained by the SAME cron, which re-checks suppression and subscriber
 * status per row before every single message. Nothing here sends mail.
 */

import { hourInTimeZone, DEFAULT_SMS_TIMEZONE } from '@/lib/crm/quiet-hours'

// ── audience kinds ────────────────────────────────────────────────────────────

/**
 * The complete set of audiences a market-report send may target. SOURCE OF TRUTH:
 * scripts/check-market-report-bulk-ledger.mjs reads this array and fails the build
 * if any kind is not resolved by the server resolver, not routed to a ledger
 * entrypoint, or not offered in the admin picker. Adding a kind here without
 * wiring it is a RED build, not a silent dead option.
 */
export const MARKET_REPORT_AUDIENCE_KINDS = [
  'report-subscribers',
  'newsletter-segment',
  'crm-tag',
  'explicit',
] as const

export type MarketReportAudienceKind = (typeof MARKET_REPORT_AUDIENCE_KINDS)[number]

/** Cadence filter for the 'report-subscribers' audience ('any' = no filter). */
export const REPORT_CADENCE_FILTERS = ['any', 'weekly', 'monthly', 'quarterly'] as const
export type ReportCadenceFilter = (typeof REPORT_CADENCE_FILTERS)[number]

/** Newsletter segments (mirrors the NewsletterSegment union in lib/data/newsletter). */
export const NEWSLETTER_SEGMENT_KEYS = ['general', 'buyer', 'seller', 'past-client'] as const
export type NewsletterSegmentKey = (typeof NEWSLETTER_SEGMENT_KEYS)[number]

export type MarketReportAudience =
  | { kind: 'report-subscribers'; cadence: ReportCadenceFilter; areaSlug: string | null }
  | { kind: 'newsletter-segment'; segment: NewsletterSegmentKey }
  | { kind: 'crm-tag'; tag: string }
  | { kind: 'explicit'; emails: string[] }

/** Which newsletter-queue entrypoint an audience is delivered through. */
export type LedgerRoute = 'audience-segment' | 'email-list'

/**
 * Hard ceiling on an explicit / resolved email list. Mirrors ONE_OFF_MAX in
 * lib/newsletter/send-queue (the queue is the authority and rejects anything
 * over its own cap); duplicated here as a pure constant so the picker can warn
 * before a round trip.
 */
export const MAX_LIST_RECIPIENTS = 5000

/** Human labels for the picker. */
export const AUDIENCE_KIND_LABELS: Record<MarketReportAudienceKind, string> = {
  'report-subscribers': 'Market-report subscribers',
  'newsletter-segment': 'Newsletter segment',
  'crm-tag': 'CRM tag',
  explicit: 'Pasted email list',
}

// ── routing ───────────────────────────────────────────────────────────────────

/**
 * Map an audience kind to its ledger entrypoint. A newsletter SEGMENT is already
 * a first-class newsletter audience, so it goes through the audience enqueue (no
 * 5,000 cap, subscriber rows already exist). Everything else resolves to a list
 * of addresses and goes through the one-off enqueue, which mints a subscriber row
 * (and therefore an unsubscribe token) per recipient before queueing.
 *
 * Exhaustive by construction: the return type has no fallback branch, so a new
 * kind added to MARKET_REPORT_AUDIENCE_KINDS without a case here fails `tsc`.
 */
export function ledgerRouteFor(kind: MarketReportAudienceKind): LedgerRoute {
  switch (kind) {
    case 'newsletter-segment':
      return 'audience-segment'
    case 'report-subscribers':
    case 'crm-tag':
    case 'explicit':
      return 'email-list'
  }
}

/**
 * The value written to `newsletters.audience` for this send. For a segment it is
 * the exact `segment:<key>` string enqueueNewsletter parses; for a list route it
 * is a descriptive tag that keeps the audit trail readable in the admin list.
 */
export function newsletterAudienceValue(audience: MarketReportAudience): string {
  if (audience.kind === 'newsletter-segment') return `segment:${audience.segment}`
  return `market-report:${audience.kind}`
}

// ── parsing + description ─────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Validate an untrusted audience descriptor (a form payload) into the typed
 * union, or null when it is not a valid audience. Fail-closed: an unknown kind,
 * an unknown segment, an empty tag, or an empty email list all return null so the
 * caller refuses the send rather than guessing at a broader audience.
 */
export function parseMarketReportAudience(raw: unknown): MarketReportAudience | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const kind = str(o.kind) as MarketReportAudienceKind
  if (!(MARKET_REPORT_AUDIENCE_KINDS as readonly string[]).includes(kind)) return null

  switch (kind) {
    case 'report-subscribers': {
      const cadence = str(o.cadence) || 'any'
      if (!(REPORT_CADENCE_FILTERS as readonly string[]).includes(cadence)) return null
      const areaSlug = str(o.areaSlug).toLowerCase()
      return { kind, cadence: cadence as ReportCadenceFilter, areaSlug: areaSlug || null }
    }
    case 'newsletter-segment': {
      const segment = str(o.segment)
      if (!(NEWSLETTER_SEGMENT_KEYS as readonly string[]).includes(segment)) return null
      return { kind, segment: segment as NewsletterSegmentKey }
    }
    case 'crm-tag': {
      const tag = str(o.tag)
      if (!tag) return null
      return { kind, tag }
    }
    case 'explicit': {
      const list = Array.isArray(o.emails)
        ? o.emails.filter((e): e is string => typeof e === 'string')
        : []
      const emails = [...new Set(list.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))]
      if (emails.length === 0) return null
      return { kind, emails }
    }
  }
}

/** One-line human description of an audience, for the confirm dialog + audit trail. */
export function describeMarketReportAudience(audience: MarketReportAudience): string {
  switch (audience.kind) {
    case 'report-subscribers': {
      const cadence = audience.cadence === 'any' ? 'every cadence' : audience.cadence
      const area = audience.areaSlug ? `, subscribed to ${audience.areaSlug}` : ''
      return `Market-report subscribers (${cadence}${area})`
    }
    case 'newsletter-segment':
      return `Newsletter segment: ${audience.segment}`
    case 'crm-tag':
      return `CRM tag: ${audience.tag}`
    case 'explicit':
      return `Pasted list of ${audience.emails.length} address${audience.emails.length === 1 ? '' : 'es'}`
  }
}

// ── send window ───────────────────────────────────────────────────────────────

/**
 * Email send window, market time. The newsletter drain cron runs every two
 * minutes with no hour restriction, so an unguarded bulk enqueue at 03:00 would
 * start delivering at 03:02. TCPA quiet hours are an SMS rule and do not bind
 * email, but a market report landing at 3am reads as spam to a human and to a
 * mailbox provider's engagement model, so a bulk market-report send is never
 * STARTED outside 08:00-20:00 Pacific. Individual cadence sends are unaffected.
 *
 * Narrower than the SMS window on the late end (20:00 vs 21:00) on purpose: a
 * tranche that starts at 19:59 keeps delivering for minutes afterward.
 */
export const EMAIL_WINDOW_START_HOUR = 8
export const EMAIL_WINDOW_END_HOUR = 20

/** True when a bulk send must NOT start right now (market time). */
export function outsideEmailSendWindow(now: Date = new Date(), timeZone: string = DEFAULT_SMS_TIMEZONE): boolean {
  const h = hourInTimeZone(now, timeZone)
  return h < EMAIL_WINDOW_START_HOUR || h >= EMAIL_WINDOW_END_HOUR
}

/**
 * The next instant a bulk send may start: 08:05 market time, today if the window
 * has not opened yet, tomorrow if it has already closed. Pacific is UTC-7/-8, so
 * 16:05 UTC is safely after 08:00 PT under both standard and daylight time (the
 * same DST-safe marker nextSmsWindow uses).
 */
export function nextEmailSendWindow(now: Date = new Date(), timeZone: string = DEFAULT_SMS_TIMEZONE): Date {
  const h = hourInTimeZone(now, timeZone)
  const next = new Date(now)
  if (h >= EMAIL_WINDOW_END_HOUR) next.setUTCDate(next.getUTCDate() + 1)
  next.setUTCHours(16, 5, 0, 0)
  // Guard the pre-dawn case: 02:00 PT is 09:00/10:00 UTC on the SAME UTC day, so
  // 16:05 UTC today is still ahead. But 23:00 PT is already the NEXT UTC day, so
  // after the +1 above the marker could land in the past; push one more day.
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next
}
