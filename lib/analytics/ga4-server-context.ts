import { cookies, headers } from 'next/headers'
import { readGa4ClientIdFromCookies, readGa4SessionFromCookies, type Ga4BrowserSession } from '@/lib/ga4-measurement-protocol'
import {
  CONSENT_COOKIE,
  parseConsentCookie,
  recordingAllowed,
  trackingLevelFromConsent,
  type TrackingConsentLevel,
} from '@/lib/identity/consent'
import { stripGa4UrlParams } from '@/app/api/visitors/track/strip-identity'
import { decideGaSuppression, hasInternalUserCookie, type GaSuppression } from './ga-suppression'
import { consentRegionRestrictedFromCookieHeader } from './consent-regions'

/**
 * What a server-side GA4 event (Measurement Protocol) needs from the visitor's
 * own request, read in ONE place for every sender that runs inside a request:
 * generate_lead and the non-lead form events (lib/lead-tracking.ts),
 * person_identified (app/actions/identity-bridge.ts) and valuation_requested
 * (lib/cma-request.ts).
 *
 *   - clientId + session: the `_ga` and `_ga_<stream>` cookies, so the event
 *     lands in the visitor's real GA4 session and inherits its source.
 *   - pageLocation: the page the visitor submitted from (Referer, identity
 *     params stripped), so the event has a hostname and a page.
 *   - analyticsAllowed: false under GPC or a stored decline (Matt 2026-10-08).
 *   - suppression: the same rule the browser tag loader applies
 *     (lib/analytics/ga-suppression.ts, Matt 2026-10-05). A broker's own
 *     browser, automation, /admin or a preview host never reaches GA4,
 *     server events included (TRACKING_POLICY "What GA4 counts").
 */
export type Ga4ServerContext = {
  clientId: string | undefined
  session: Ga4BrowserSession | null
  pageLocation: string | undefined
  referer: string
  analyticsAllowed: boolean
  /**
   * The visitor's tier (docs/TRACKING_POLICY.md tier table): the stored banner
   * answer, or with no answer the region default from the request's country,
   * else the rr_cr region cookie (unknown fails closed to essential). 'declined'
   * under GPC or a decline. Decides whether a server event carries a user_id
   * (ga4KnownContact).
   */
  trackingLevel: TrackingConsentLevel
  suppression: GaSuppression
  /** The `rr_internal=1` cookie: a broker's or admin's own browser. */
  internalUser: boolean
}

export function ga4ContextFromRequest(args: {
  cookieStore: { get(name: string): { value: string } | undefined }
  cookieHeader: string
  referer: string
  userAgent: string | null
  secGpc: string | null
  /** The request's own Host header: judges the host when there is no Referer. */
  host?: string | null
  /** The visitor's country (x-vercel-ip-country): the region default when there is no banner answer. */
  country?: string | null
}): Ga4ServerContext {
  const { cookieStore, cookieHeader, referer, userAgent, secGpc } = args
  const consentCookie = cookieStore.get(CONSENT_COOKIE)?.value
  const analyticsAllowed = recordingAllowed({ consentCookie, secGpc })
  // No country header: the rr_cr region cookie middleware set from it (only an
  // explicit `0` is unrestricted), else fail closed to essential.
  const trackingLevel: TrackingConsentLevel = analyticsAllowed
    ? trackingLevelFromConsent(
        parseConsentCookie(consentCookie),
        args.country
          ? { country: args.country }
          : { restrictedRegion: consentRegionRestrictedFromCookieHeader(cookieHeader) },
      )
    : 'declined'
  let page: URL | null = null
  try {
    page = referer ? new URL(referer) : null
  } catch {
    page = null
  }
  let suppression: GaSuppression
  if (page) {
    suppression = decideGaSuppression({
      pathname: page.pathname,
      host: page.hostname,
      search: page.search,
      userAgent,
      cookieHeader,
    })
  } else {
    // No Referer (Referrer-Policy no-referrer, a privacy extension): the page
    // path is unknown, so judge the host this request reached plus the browser.
    suppression = decideGaSuppression({ pathname: '/', host: args.host ?? '', userAgent, cookieHeader })
  }
  return {
    clientId: readGa4ClientIdFromCookies(cookieStore) ?? undefined,
    session: readGa4SessionFromCookies(cookieStore),
    pageLocation: page ? stripGa4UrlParams(page.toString()) : undefined,
    referer,
    analyticsAllowed,
    trackingLevel,
    suppression,
    internalUser: hasInternalUserCookie(cookieHeader),
  }
}

/** The context for the current request (server action or route handler). */
export async function ga4ServerContext(): Promise<Ga4ServerContext> {
  const [cookieStore, headersList] = await Promise.all([cookies(), headers()])
  return ga4ContextFromRequest({
    cookieStore,
    cookieHeader: headersList.get('cookie') ?? '',
    referer: headersList.get('referer') ?? '',
    userAgent: headersList.get('user-agent'),
    secGpc: headersList.get('sec-gpc'),
    host: headersList.get('x-forwarded-host') ?? headersList.get('host'),
    // The track route's consent gate reads the same headers in the same order.
    country: headersList.get('x-vercel-ip-country') || headersList.get('cf-ipcountry'),
  })
}

/**
 * True when this request may send a server event to GA4.
 *
 * `serverToServer`: a provider webhook (Meta Lead Ads) has no visitor browser,
 * so the page, host and automation rules do not describe it (Meta's own user
 * agent would read as automation). Consent and a broker's browser still hold:
 * a decline, GPC or `rr_internal` on the request still sends nothing.
 */
export function ga4ServerSendAllowed(ctx: Ga4ServerContext, opts: { serverToServer?: boolean } = {}): boolean {
  if (!ctx.analyticsAllowed) return false
  if (opts.serverToServer) return !ctx.internalUser
  return !ctx.suppression.suppress
}

/**
 * The `knownContact` a server event for this contact passes to fireGa4Event,
 * which sends the hashed CRM id as user_id at the analytics tier or above
 * (lib/analytics/ga4-user-id.ts). No context (a provider webhook) is no visitor
 * consent to read, so null: no user id.
 */
export function ga4KnownContact(
  ctx: Ga4ServerContext | null,
  personId: number | null | undefined,
): { personId: number | null | undefined; trackingLevel: TrackingConsentLevel } | null {
  return ctx ? { personId, trackingLevel: ctx.trackingLevel } : null
}

/** The session + page params that tie a server event to the browser's GA4 session. */
export function ga4SessionEventParams(ctx: Ga4ServerContext): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (ctx.session) {
    out.session_id = ctx.session.sessionId
    if (ctx.session.sessionNumber) out.session_number = ctx.session.sessionNumber
  }
  if (ctx.pageLocation) out.page_location = ctx.pageLocation
  return out
}

type Ga4Param = string | number | boolean | undefined | null

/**
 * The event params a server event sends, in the order that survives GA4's
 * 25-parameter cap (sanitizeParams keeps the first 25): the event's identity
 * keys first (`lead_type`, `form_id`, ...), then the browser session, then the
 * rest. The session keys always win over a caller key of the same name, so no
 * `extra` can move the event out of the visitor's session.
 */
export function ga4ServerEventParams(
  ctx: Ga4ServerContext | null,
  params: Record<string, Ga4Param>,
  priority: readonly string[] = ['lead_type', 'form_id'],
): Record<string, Ga4Param> {
  const session = ctx ? ga4SessionEventParams(ctx) : {}
  const out: Record<string, Ga4Param> = {}
  for (const k of priority) if (params[k] !== undefined && params[k] !== null && !(k in session)) out[k] = params[k]
  Object.assign(out, session)
  for (const [k, v] of Object.entries(params)) if (!(k in out) && !(k in session)) out[k] = v
  return out
}

/**
 * Read the request and decide, in one step, for a server event: null when the
 * event must not be sent (consent, suppression, or the request could not be
 * read: fail closed), else the client id and the context to build params with.
 */
export async function ga4ServerSend(opts: { serverToServer?: boolean } = {}): Promise<{ clientId: string | undefined; ctx: Ga4ServerContext } | null> {
  let ctx: Ga4ServerContext
  try {
    ctx = await ga4ServerContext()
  } catch {
    return null
  }
  if (!ga4ServerSendAllowed(ctx, opts)) return null
  return { clientId: opts.serverToServer ? undefined : ctx.clientId, ctx }
}
