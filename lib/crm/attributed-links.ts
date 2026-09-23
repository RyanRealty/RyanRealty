/**
 * Unified broker-attribution + open/click tracking for every outbound email.
 *
 * Matt's rule: EVERY link in newsletters, market reports, saved-search alerts,
 * and CMAs must carry broker attribution so the broker can see sent / opened /
 * delivered / bounced. After the CRM cutover, anything that relied on CRM's own
 * email tracking is dead. Tracking now lives in our email HTML (open pixel +
 * click redirects -> crm_timeline via the Resend webhook + the /api/track/e
 * endpoints).
 *
 * This module is the ONE place every send path calls. It composes the two
 * existing primitives in the correct order:
 *
 *   1. `decorateOutboundText` (lib/identity/outbound-links.ts, P7) — stamps
 *      ?agent=<broker> and the SIGNED ?_pid=<token> plus missing CRM UTMs
 *      (`utm_source=crm&utm_medium=email&utm_content=agent-<slug>`) onto every
 *      public ryan-realty.com link, so a click routes the lead AND attributes
 *      the GA session to email/CRM + that broker.
 *   2. `instrumentEmailHtml` (lib/email-tracking.ts) — wraps every http(s) link
 *      through the signed click tracker and appends the 1x1 open pixel.
 *
 * Order matters: attribution FIRST (mutate the real destination URL while it is
 * still a plain ryan-realty.com link), THEN instrument (wrap the now-attributed
 * URL inside the signed click token). Instrumenting first would bury the real
 * URL inside a /api/track/e/click token where the attribution regex can no
 * longer see it, so no ?agent= would ever land.
 *
 * Both primitives are idempotent: `attributeSiteLinks` skips a link that already
 * carries ?agent=, and `instrumentEmailHtml` skips a link already wrapped
 * through /api/track/e. Running `attributeOutbound` twice on the same HTML
 * therefore does not double-encode or break a link.
 */
import { instrumentEmailHtml } from '@/lib/email-tracking'
import { channelFromEmailKey, decorateOutboundText } from '@/lib/identity/outbound-links'
import type { LinkChannel } from '@/lib/identity/link-token'

export interface AttributeOutboundOptions {
  /** brokers.slug of the broker who owns this contact / send (e.g. 'matt-ryan'). */
  brokerSlug: string
  /**
   * crm_people.id of the recipient — required for open/click tracking to write
   * the right crm_timeline rows. When null/undefined, links still get broker
   * attribution but no tracking wrapper is applied (no person to attribute the
   * open/click to). Never throws on a missing id.
   */
  personId?: number | null
  /** CRM legacy id — stamps ?_fuid= so a click backfills anonymous sessions. */
  fubPersonId?: number | null
  /** Stable key for this email, e.g. `newsletter:<id>` or `alert:<searchId>`. */
  emailKey: string
  /** Human label for the comms chain, usually the subject line. */
  label: string
  /** Recipient's short broker slug — stamped into the tracking token so opens/clicks carry broker (spec §5 / H1). */
  broker?: string
  /** Optional token TTL (newsletter links set 180d); omitted = non-expiring, unchanged. */
  ttlSeconds?: number
  /** Identity-loop channel for the signed ?_pid= token; derived from emailKey when omitted. */
  channel?: LinkChannel
}

/**
 * The single helper every outbound HTML send path routes through. Returns the
 * final, broker-attributed, open/click-instrumented HTML. Safe to call twice.
 */
export function attributeOutbound(html: string, opts: AttributeOutboundOptions): string {
  if (typeof html !== 'string' || html.length === 0) return html

  // Idempotency guard. Once instrumented, the body's links are signed
  // /api/track/e/click tokens and the open pixel is /api/track/e/open — both
  // are ryan-realty.com URLs, so a naive second `attributeSiteLinks` pass would
  // append ?agent= / ?_fuid= to those tracking URLs (corrupting them) even
  // though `instrumentEmailHtml` itself correctly skips re-wrapping. The real
  // destination is already attributed INSIDE the signed token, so a second full
  // pass is a no-op by design — return the body unchanged.
  if (html.includes('/api/track/e/')) return html

  const personId = typeof opts.personId === 'number' && Number.isInteger(opts.personId) && opts.personId > 0
    ? opts.personId
    : null

  // 1) Broker attribution + the SIGNED person token on the real destination
  //    links, through the one decoration helper (P7 identity loop): a click
  //    identifies the visit server-side in /api/visitors/track. Idempotent for
  //    clean HTML: a link already carrying ?agent= and a token is untouched.
  const attributed = decorateOutboundText(html, {
    brokerSlug: opts.brokerSlug,
    personId,
    channel: opts.channel ?? channelFromEmailKey(opts.emailKey),
  })

  // 2) Open + click tracking — only when we have a recipient to attribute it to.
  if (personId === null) return attributed

  return instrumentEmailHtml(attributed, {
    personId,
    emailKey: opts.emailKey,
    label: opts.label,
    broker: opts.broker,
    ttlSeconds: opts.ttlSeconds,
  })
}

/**
 * Attribute a single URL (non-HTML cases: SMS bodies, a plain saved-search
 * alert link, a button href built outside an HTML template). Stamps
 * ?agent=<broker> (and ?_fuid= when provided) using the same idempotent rule as
 * the HTML path — a URL that already carries ?agent= is returned untouched.
 *
 * No open/click instrumentation is applied here: the pixel + click wrapper need
 * an HTML body. For SMS, attribution alone gives the broker routing; click
 * tracking on a bare SMS link would need a different (link-shortener) path.
 */
export function attributeUrl(
  url: string,
  brokerSlug: string,
  // Retired vendor-CRM id: accepted so existing call sites compile, never
  // stamped (an unsigned id identifies nobody; P7 identity loop 2026-09-23).
  _legacyPersonId?: number | null,
  crmPersonId?: number | null,
  channel: LinkChannel = 'email',
): string {
  if (typeof url !== 'string' || url.length === 0) return url
  return decorateOutboundText(url, { brokerSlug, personId: crmPersonId ?? null, channel })
}
