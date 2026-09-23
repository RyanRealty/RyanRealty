/**
 * THE link-decoration helper. Every outbound message that carries a link to
 * ryan-realty.com and goes to a known contact runs its text (HTML, plain text,
 * SMS body, or a single URL) through `decorateOutboundText` before it is sent
 * or stored (P7 identity loop, 2026-09-23; docs/TRACKING_POLICY.md).
 *
 * What it stamps on every public ryan-realty.com link:
 *   - `?agent=<broker>`     routes the lead to the broker whose message it is
 *   - `?_pid=<token>`       the SIGNED person token (lib/identity/link-token.ts);
 *                           /api/visitors/track verifies it and identifies the
 *                           visit, back-stitches the browser, and sets rr_pid
 *   - missing CRM UTMs      so the visit is a CRM session, not Direct
 *
 * What it removes: any unsigned `_pid=<digits>` / `_fuid=<digits>` already on a
 * link (a template or a stored URL built before signing existed). An unsigned
 * id identifies nobody, and leaving one in place would block the signed stamp
 * (attributeSiteLinks never double-stamps a param).
 *
 * It never adds an email address, a phone number or a name to a URL.
 *
 * Callers pick the channel; it lands in visitor_sessions.identified_via as
 * `tracked_link:<channel>`. `ci:identity-loop` fails any send path that stamps
 * `_pid` itself or calls attributeSiteLinks directly.
 */
import 'server-only'
import { attributeSiteLinks } from '@/lib/crm/merge'
import { signPersonLinkToken, type LinkChannel } from '@/lib/identity/link-token'

export type DecorateOutboundOptions = {
  /** brokers.slug of the broker the link routes to (e.g. 'matt'). */
  brokerSlug: string | null | undefined
  /** crm_people.id of the recipient. Null = broker attribution only. */
  personId: number | null | undefined
  /** Which sender this is. */
  channel: LinkChannel
  // There is deliberately no legacy vendor-CRM id option: `_fuid` is retired
  // (2026-09-23) because an unsigned id identifies nobody, so it is never stamped.
}

const OWN_LINK_RE = /https:\/\/(?:www\.)?ryan-realty\.com[^\s"'<)\]]*/g
const UNSIGNED_IDENTITY_PART = /^_(?:pid|fuid)=\d+$/

function validId(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0
}

/**
 * Channels whose links are not email. attributeSiteLinks fills a missing
 * utm_medium with `email` (the CRM default), which labelled every texted link
 * an email click; these channels claim the medium first so the visit's source
 * reads true on /admin/visitors/live.
 */
const MEDIUM_BY_CHANNEL: Partial<Record<LinkChannel, string>> = {
  sms: 'sms',
  personal: 'personal-link',
}

function withMediumIfMissing(url: string, medium: string): string {
  if (/[?&]utm_medium=/.test(url)) return url
  // Never on our own plumbing (admin, API, the /r/ short-link tracker).
  if (/ryan-realty\.com\/(?:admin|api\/|r\/)/.test(url)) return url
  const hashAt = url.indexOf('#')
  const base = hashAt === -1 ? url : url.slice(0, hashAt)
  const fragment = hashAt === -1 ? '' : url.slice(hashAt)
  return `${base}${base.includes('?') ? '&' : '?'}utm_medium=${medium}${fragment}`
}

/**
 * Remove unsigned identity params from one of our URLs. Handles HTML-escaped
 * `&amp;` separators (the text is often an HTML body) and keeps the fragment.
 * Exported for the unit test.
 */
export function stripUnsignedIdentity(url: string): string {
  const hashAt = url.indexOf('#')
  const base = hashAt === -1 ? url : url.slice(0, hashAt)
  const fragment = hashAt === -1 ? '' : url.slice(hashAt)
  const q = base.indexOf('?')
  if (q === -1) return url
  const path = base.slice(0, q)
  const query = base.slice(q + 1)
  const sep = query.includes('&amp;') ? '&amp;' : '&'
  const parts = query.split(/&amp;|&/)
  const kept = parts.filter((p) => !UNSIGNED_IDENTITY_PART.test(p))
  if (kept.length === parts.length) return url
  const rest = kept.filter(Boolean)
  return path + (rest.length ? `?${rest.join(sep)}` : '') + fragment
}

/**
 * Decorate every ryan-realty.com link in `text` (or `text` itself when it is a
 * single URL). Idempotent: a link that already carries a signed token and an
 * agent is returned unchanged.
 */
export function decorateOutboundText(text: string, opts: DecorateOutboundOptions): string {
  if (typeof text !== 'string' || text.length === 0) return text
  const personId = validId(opts.personId) ? opts.personId : null
  const token = personId ? signPersonLinkToken(personId, opts.channel) : null
  const medium = MEDIUM_BY_CHANNEL[opts.channel]
  const cleaned = text.replace(OWN_LINK_RE, (u) => {
    const stripped = stripUnsignedIdentity(u)
    return medium ? withMediumIfMissing(stripped, medium) : stripped
  })
  return attributeSiteLinks(cleaned, opts.brokerSlug ?? null, null, token)
}

/** Single-URL form (SMS short-link targets, a CMA link in a template). */
export function decorateOutboundUrl(url: string, opts: DecorateOutboundOptions): string {
  return decorateOutboundText(url, opts)
}

/**
 * Channel for an email from its tracking key (`newsletter:<id>`, `alert:<id>`,
 * `cma:<slug>`, `seq:<id>:<n>`, `market-report:...`). Unknown keys are 'email'.
 */
export function channelFromEmailKey(emailKey: string | null | undefined): LinkChannel {
  const k = String(emailKey ?? '').toLowerCase()
  if (k.startsWith('newsletter')) return 'newsletter'
  if (k.startsWith('alert') || k.startsWith('listing-alert') || k.startsWith('listing-match')) return 'alert'
  if (k.startsWith('cma') || k.startsWith('bpo')) return 'document'
  if (k.startsWith('seq')) return 'sequence'
  if (k.startsWith('market-report') || k.startsWith('report')) return 'report'
  if (k.startsWith('prospect')) return 'prospecting'
  return 'email'
}

/**
 * A contact's personal site link: the homepage (or any path) decorated for
 * them, for a broker to paste into a Facebook or Instagram DM, a Gmail reply or
 * a text from their own phone. Clicking it identifies the visit exactly like a
 * tracked email does.
 */
export function personalSiteLink(personId: number, brokerSlug: string | null, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return decorateOutboundUrl(`https://ryan-realty.com${clean}`, {
    brokerSlug,
    personId,
    channel: 'personal',
  })
}
