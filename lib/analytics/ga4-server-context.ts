import { cookies, headers } from 'next/headers'
import { readGa4ClientIdFromCookies, readGa4SessionFromCookies, type Ga4BrowserSession } from '@/lib/ga4-measurement-protocol'
import { CONSENT_COOKIE, recordingAllowed } from '@/lib/identity/consent'
import { stripGa4UrlParams } from '@/app/api/visitors/track/strip-identity'
import { classifyAutomation } from './automation'
import { decideGaSuppression, hasAutomationMarker, hasInternalUserCookie, type GaSuppression } from './ga-suppression'

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
  suppression: GaSuppression
}

export function ga4ContextFromRequest(args: {
  cookieStore: { get(name: string): { value: string } | undefined }
  cookieHeader: string
  referer: string
  userAgent: string | null
  secGpc: string | null
}): Ga4ServerContext {
  const { cookieStore, cookieHeader, referer, userAgent, secGpc } = args
  const analyticsAllowed = recordingAllowed({ consentCookie: cookieStore.get(CONSENT_COOKIE)?.value, secGpc })
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
    // No Referer: the page is unknown, so judge the browser only.
    const marker = hasAutomationMarker({ cookieHeader })
    if (classifyAutomation({ userAgent, marker }).automated) suppression = { suppress: true, reason: 'automation' }
    else if (hasInternalUserCookie(cookieHeader)) suppression = { suppress: true, reason: 'internal-user' }
    else suppression = { suppress: false, reason: null }
  }
  return {
    clientId: readGa4ClientIdFromCookies(cookieStore) ?? undefined,
    session: readGa4SessionFromCookies(cookieStore),
    pageLocation: page ? stripGa4UrlParams(page.toString()) : undefined,
    referer,
    analyticsAllowed,
    suppression,
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
  })
}

/** True when this request may send a server event to GA4. */
export function ga4ServerSendAllowed(ctx: Ga4ServerContext): boolean {
  return ctx.analyticsAllowed && !ctx.suppression.suppress
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
