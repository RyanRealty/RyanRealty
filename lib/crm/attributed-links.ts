/**
 * Unified broker-attribution + open/click tracking for every outbound email.
 *
 * Matt's rule: EVERY link in newsletters, market reports, saved-search alerts,
 * and CMAs must carry broker attribution so the broker can see sent / opened /
 * delivered / bounced. After the FUB cutover, anything that relied on FUB's own
 * email tracking is dead. Tracking now lives in our email HTML (open pixel +
 * click redirects -> crm_timeline via the Resend webhook + the /api/track/e
 * endpoints).
 *
 * This module is the ONE place every send path calls. It composes the two
 * existing primitives in the correct order:
 *
 *   1. `attributeSiteLinks` (lib/crm/merge.ts) — stamps ?agent=<broker> (and
 *      optionally ?_fuid=<id>) onto every public ryan-realty.com link, so a
 *      click routes the lead to the right broker and backfills their sessions.
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
import { attributeSiteLinks } from '@/lib/crm/merge'
import { instrumentEmailHtml } from '@/lib/email-tracking'

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
  /** FUB legacy id — stamps ?_fuid= so a click backfills anonymous sessions. */
  fubPersonId?: number | null
  /** Stable key for this email, e.g. `newsletter:<id>` or `alert:<searchId>`. */
  emailKey: string
  /** Human label for the comms chain, usually the subject line. */
  label: string
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

  // 1) Broker attribution on the real destination links (idempotent on its own
  //    for clean HTML: a link already carrying ?agent= is left untouched).
  const attributed = attributeSiteLinks(html, opts.brokerSlug, opts.fubPersonId ?? null)

  // 2) Open + click tracking — only when we have a recipient to attribute it to.
  const personId = typeof opts.personId === 'number' && Number.isInteger(opts.personId) && opts.personId > 0
    ? opts.personId
    : null
  if (personId === null) return attributed

  return instrumentEmailHtml(attributed, {
    personId,
    emailKey: opts.emailKey,
    label: opts.label,
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
  fubPersonId?: number | null,
): string {
  if (typeof url !== 'string' || url.length === 0) return url
  return attributeSiteLinks(url, brokerSlug, fubPersonId ?? null)
}
