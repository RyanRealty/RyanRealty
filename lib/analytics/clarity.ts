/**
 * Microsoft Clarity: session recordings and heatmaps of the public site (Matt
 * 2026-10-14), to see where visitors click, scroll, get stuck or leave.
 *
 * ONE switch: CLARITY_PROJECT_ID. While it is null nothing loads and nothing is
 * called. components/ClarityRecorder.tsx is the only caller of the runtime half
 * of this file; AnalyticsIdentityBridge hands it the hashed CRM id.
 *
 * WHEN IT LOADS (decideClarity). Every one of these must hold:
 *   - the project id is set and this is a production build;
 *   - GA4 may count the page (ga-suppression.ts): not /admin (the CRM lives
 *     there), a ryan-realty.com host, not automation, not a broker's browser
 *     (rr_internal=1);
 *   - the address carries no secret (private-paths.ts: /sign, /cma-drafts, the
 *     unsubscribe pages) and is not a signed-in personal area (/account,
 *     /dashboard: the visitor's own name, saved homes and transactions are on
 *     screen);
 *   - the address names no person and carries nothing typed
 *     (CLARITY_BLOCKING_PARAMS: Clarity sends the full page address, so a `?_pid=`
 *     arrival is not recorded until the identity bridge has cleaned the address
 *     bar, and `/sell?address=` / `/contact?inquiry=` are not recorded at all);
 *   - analytics consent under the SAME rule GA4 uses (hasAnalyticsConsent in
 *     components/CookieConsentBanner.tsx): no Global Privacy Control, a stored
 *     banner answer with analytics on, or no answer outside a restricted region.
 *
 * CONSENT (learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2).
 * On load the page sends `consentv2` with analytics_Storage granted and
 * ad_Storage following the marketing choice. When analytics is withdrawn the
 * page sends `consentv2` denied, which makes Clarity erase its _clck / _clsk
 * cookies and end the session, and then `stop`. The stop is needed because
 * clarity-js answers a denial by restarting itself in cookieless "no-consent"
 * mode 250 ms later (src/data/metadata.ts consentv2, Setting.RestartDelay), and
 * our rule is no recording at all without analytics consent. `stop` is not in
 * Microsoft's API table but is a method of the clarity-js object every window
 * call dispatches to (src/clarity.ts, src/queue.ts); a stop sent while Clarity is
 * between pages is queued and runs when it restarts. A withdrawn page is never
 * reloaded: the next full page load decides again.
 *
 * NAVIGATION. clarity-js restarts itself on every address change, and its stop
 * sends a final upload, so a halt decided after a navigation would still send
 * the excluded page's address and title. installNavigationGuard judges each
 * pushState / replaceState / popstate destination BEFORE the address changes and
 * stops Clarity first; a later public page starts it again (`start`).
 *
 * TAGS. clarity-js resets custom tags and the identify id at the start of every
 * Clarity page, and treats every address change (a ?bbox= map move included) as
 * a new page. So the tags are applied from a `metadata` callback registered with
 * recall on, the pattern Microsoft's own tag uses for its C_IS tag: it runs on the
 * current page and once on every later one. Only these values ever reach Clarity:
 *   identify        the hashed id GA4 gets as user_id (`crm-<sha256>` / `em-<sha256>`),
 *                   only for a known contact; Clarity hashes it again on the client
 *   page_type       lib/analytics/page-type.ts
 *   visitor_intent  buyer | seller | both | browsing (lib/analytics/visitor-intent.ts)
 *   primary_market  a place slug from the same module
 * Every value is checked against its shape here, so an email, a phone number or
 * a name cannot pass (clarity.test.ts).
 *
 * MASKING. Clarity masks every input box and dropdown in all modes. The public
 * lead forms also carry `data-clarity-mask="True"`, which masks the element and
 * its children, so typed answers echoed back on the page are not recorded either.
 */
import { decideGaSuppression, PRODUCTION_HOST, type GaSuppressionReason } from './ga-suppression'
import { isPrivatePath, SECRET_URL_PARAMS } from './private-paths'
import { PAGE_TYPES, pageTypeFromPath } from './page-type'
import { MARKET_SLUG_MAX, VISITOR_INTENTS } from './visitor-intent'
import { GA4_STRIP_PARAMS } from '@/app/api/visitors/track/strip-identity'

/**
 * The Clarity project id: Matt's "Ryan Realty" project, created 2026-10-14
 * (clarity.microsoft.com/projects/view/yxw12mqn71). It is public by design: it
 * ships in every page's tag request (www.clarity.ms/tag/<id>), like the GA4
 * measurement id. null = off: nothing loads, nothing is called.
 */
export const CLARITY_PROJECT_ID: string | null = 'yxw12mqn71'

/** Microsoft's tag loader. The tag then loads clarity.js from scripts.clarity.ms. */
export const CLARITY_TAG_BASE = 'https://www.clarity.ms/tag/'

/** The HTML attribute that masks an element and its children in recordings. */
export const CLARITY_MASK_ATTRIBUTE = 'data-clarity-mask'

/** Clarity's first-party cookies (clarity-js types/data.d.ts CookieKey, SessionKey). */
export const CLARITY_COOKIES = ['_clck', '_clsk'] as const

/** Signed-in personal areas: never recorded. */
export const CLARITY_EXCLUDED_PREFIXES = ['account', 'dashboard'] as const

/**
 * Query parameters that name a person, carry a secret or carry what a visitor
 * typed. Clarity sends the full page address, so a page whose address holds one
 * is not recorded: the identity params GA4 never sees, the secret-bearing ones
 * private-paths.ts scrubs from error reports, Supabase's email-link token, a raw
 * email or phone, and the free text two public forms put in the address (the
 * home page's value box sends `/sell?address=`, the /about box `/contact?inquiry=`).
 */
export const CLARITY_BLOCKING_PARAMS: readonly string[] = [
  ...new Set<string>([
    ...GA4_STRIP_PARAMS,
    ...SECRET_URL_PARAMS,
    'token_hash',
    'email',
    'phone',
    'address',
    'inquiry',
    'message',
  ]),
]

export type ClarityBlockReason =
  | 'no-project-id'
  | 'non-production-build'
  | GaSuppressionReason
  | 'private-path'
  | 'personal-area'
  | 'identity-in-url'
  | 'gpc'
  | 'no-analytics-consent'

export type ClarityDecision = { load: boolean; reason: ClarityBlockReason | null }

export type ClarityDecisionInput = {
  projectId: string | null | undefined
  /** IS_NON_PRODUCTION_BUILD (lib/analytics/non-production-build.ts). */
  nonProductionBuild: boolean
  pathname: string | null | undefined
  host: string | null | undefined
  /** The page's query string, with or without the leading `?`. */
  search: string | null | undefined
  userAgent: string | null | undefined
  webdriver?: unknown
  /** `document.cookie`. */
  cookieHeader: string | null | undefined
  /** navigator.globalPrivacyControl === true. */
  gpc: boolean
  /** hasAnalyticsConsent(): the same answer GA4's consent update uses. */
  analyticsConsent: boolean
}

const PROJECT_ID_RE = /^[a-z0-9]{1,32}$/i

export function isClarityProjectId(value: unknown): value is string {
  return typeof value === 'string' && PROJECT_ID_RE.test(value)
}

export function clarityTagUrl(projectId: string): string {
  return CLARITY_TAG_BASE + encodeURIComponent(projectId)
}

/** /account and /dashboard, and anything under them. */
export function isClarityExcludedPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string') return false
  const first = pathname.split(/[?#]/)[0].split('/').filter(Boolean)[0]?.toLowerCase()
  return !!first && (CLARITY_EXCLUDED_PREFIXES as readonly string[]).includes(first)
}

/** True when the query string carries any CLARITY_BLOCKING_PARAMS key, even empty. */
export function hasClarityBlockingParam(search: string | null | undefined): boolean {
  if (!search) return false
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return true
  }
  for (const key of params.keys()) {
    if (CLARITY_BLOCKING_PARAMS.includes(key.toLowerCase())) return true
  }
  return false
}

/** May Clarity record this page? The first failing condition is the reason. */
export function decideClarity(input: ClarityDecisionInput): ClarityDecision {
  const no = (reason: ClarityBlockReason): ClarityDecision => ({ load: false, reason })
  if (!isClarityProjectId(input.projectId)) return no('no-project-id')
  if (input.nonProductionBuild) return no('non-production-build')
  const ga = decideGaSuppression({
    pathname: input.pathname,
    host: input.host,
    search: input.search,
    userAgent: input.userAgent,
    webdriver: input.webdriver,
    cookieHeader: input.cookieHeader,
  })
  if (ga.suppress && ga.reason) return no(ga.reason)
  if (isPrivatePath(input.pathname)) return no('private-path')
  if (isClarityExcludedPath(input.pathname)) return no('personal-area')
  if (hasClarityBlockingParam(input.search)) return no('identity-in-url')
  if (input.gpc) return no('gpc')
  if (!input.analyticsConsent) return no('no-analytics-consent')
  return { load: true, reason: null }
}

// ── Values sent to Clarity ───────────────────────────────────────────────────

export const CLARITY_TAG_KEYS = ['page_type', 'visitor_intent', 'primary_market'] as const
export type ClarityTagKey = (typeof CLARITY_TAG_KEYS)[number]
export type ClarityTag = readonly [ClarityTagKey, string]

/** A place slug: lowercase words joined by hyphens, at least one letter, GA4's 36-character cap. */
const MARKET_TAG_RE = /^(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/

export type ClarityPageContext = {
  pathname: string | null | undefined
  /** The stored visitor intent label (readVisitorIntentMemory().intent). */
  visitorIntent?: unknown
  /** The stored primary market slug (readVisitorIntentMemory().primaryMarket). */
  primaryMarket?: unknown
}

/** The custom tags for a page. A value that is not its expected shape is left out. */
export function clarityTags(ctx: ClarityPageContext): ClarityTag[] {
  const out: ClarityTag[] = []
  const pageType = pageTypeFromPath(ctx.pathname || '/')
  if ((PAGE_TYPES as readonly string[]).includes(pageType)) out.push(['page_type', pageType])
  if (typeof ctx.visitorIntent === 'string' && (VISITOR_INTENTS as readonly string[]).includes(ctx.visitorIntent)) {
    out.push(['visitor_intent', ctx.visitorIntent])
  }
  const market = ctx.primaryMarket
  if (typeof market === 'string' && market.length <= MARKET_SLUG_MAX && MARKET_TAG_RE.test(market)) {
    out.push(['primary_market', market])
  }
  return out
}

/** The GA4 user_id shape from /api/identity/me: a prefix and a SHA-256 hex digest. */
const HASHED_USER_ID_RE = /^(crm|em)-[0-9a-f]{64}$/

/** The id Clarity may be given, or null. Anything but a hashed id (an email, a raw number) is refused. */
export function clarityUserId(hashedUserId: unknown): string | null {
  return typeof hashedUserId === 'string' && HASHED_USER_ID_RE.test(hashedUserId) ? hashedUserId : null
}

export type ClarityConsentValue = 'granted' | 'denied'
export type ClarityConsent = { ad_Storage: ClarityConsentValue; analytics_Storage: ClarityConsentValue }

export const CLARITY_CONSENT_DENIED: Readonly<ClarityConsent> = { ad_Storage: 'denied', analytics_Storage: 'denied' }

/** The consentv2 payload: analytics from the analytics choice, ad storage from the marketing choice. */
export function clarityConsent(args: { analytics: boolean; marketing: boolean }): ClarityConsent {
  return {
    ad_Storage: args.analytics && args.marketing ? 'granted' : 'denied',
    analytics_Storage: args.analytics ? 'granted' : 'denied',
  }
}

// ── Runtime (browser) ───────────────────────────────────────────────────────
//
// Called only from effects in components/ClarityRecorder.tsx. The window is a
// parameter so the tests can pass a fake one.

type ClarityFn = ((...args: unknown[]) => unknown) & { q?: unknown[]; v?: unknown }

export type ClarityWindow = {
  clarity?: ClarityFn
  document: Pick<Document, 'createElement' | 'getElementsByTagName' | 'getElementById' | 'head' | 'cookie'>
  history: History
  location: Pick<Location, 'href'>
  addEventListener: Window['addEventListener']
  removeEventListener: Window['removeEventListener']
}

export type ClarityState = 'off' | 'running' | 'halted' | 'withdrawn'

type Runtime = {
  state: ClarityState
  win: ClarityWindow | null
  consent: ClarityConsent | null
  userId: string | null
  pageContext: (() => ClarityPageContext) | null
  /** decideClarity for a destination address, from the component. */
  mayRecord: ((url: URL) => boolean) | null
  /** Undoes the navigation guard (tests only). */
  unguard: (() => void) | null
}

const runtime: Runtime = {
  state: 'off',
  win: null,
  consent: null,
  userId: null,
  pageContext: null,
  mayRecord: null,
  unguard: null,
}

const SCRIPT_ID = 'clarity-script'

export function clarityState(): ClarityState {
  return runtime.state
}

/** Tests only. */
export function resetClarityRuntime(): void {
  runtime.unguard?.()
  runtime.state = 'off'
  runtime.win = null
  runtime.consent = null
  runtime.userId = null
  runtime.pageContext = null
  runtime.mayRecord = null
  runtime.unguard = null
}

function call(...args: unknown[]): void {
  const fn = runtime.win?.clarity
  if (typeof fn !== 'function') return
  try {
    fn(...args)
  } catch {
    /* recording never breaks a page */
  }
}

/** Microsoft's snippet: a queue stub, then the async tag script (as @microsoft/clarity 1.0.2 injectScript). */
function injectTag(w: ClarityWindow, projectId: string): void {
  if (typeof w.clarity !== 'function') {
    // The snippet's stub pushes the arguments object; clarity.js replays the queue in order.
    const stub: ClarityFn = function () {
      // eslint-disable-next-line prefer-rest-params
      ;(stub.q = stub.q || []).push(arguments)
    }
    w.clarity = stub
  }
  const d = w.document
  if (d.getElementById(SCRIPT_ID)) return
  const t = d.createElement('script')
  t.async = true
  t.src = clarityTagUrl(projectId)
  t.id = SCRIPT_ID
  const y = d.getElementsByTagName('script')[0]
  if (y?.parentNode) y.parentNode.insertBefore(t, y)
  else d.head.appendChild(t)
}

/**
 * Stop Clarity BEFORE it can record a page it may not see.
 *
 * clarity-js wraps history.pushState / replaceState and listens for popstate;
 * on any address change it stops and schedules its own restart on the new
 * address 250 ms later (src/core/history.ts). A stop sent from a React effect
 * after the navigation lands while Clarity is between pages, is queued, and runs
 * only after that restart, whose stop sends a final upload (src/data/upload.ts
 * stop) carrying the new page's address and title. So the destination is judged
 * here, synchronously, before the address changes: stopping first means Clarity's
 * own wrapper sees an inactive Clarity and schedules nothing. Installed once,
 * before the tag loads, so this listener precedes Clarity's in registration order
 * as well as by the capture phase.
 */
function installNavigationGuard(w: ClarityWindow): void {
  if (runtime.unguard) return
  const h = w.history
  const restores: (() => void)[] = []
  const guard = (target: string | URL | null | undefined) => {
    if (runtime.state !== 'running' || !runtime.mayRecord) return
    let dest: URL
    try {
      dest = new URL(target == null ? w.location.href : String(target), w.location.href)
    } catch {
      return
    }
    let allowed = false
    try {
      allowed = runtime.mayRecord(dest)
    } catch {
      allowed = false
    }
    if (!allowed) haltClarity()
  }
  for (const method of ['pushState', 'replaceState'] as const) {
    const inner = h[method]
    if (typeof inner !== 'function') continue
    const wrapped = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      guard(url)
      return inner.call(this, data, unused, url)
    }
    try {
      h[method] = wrapped
      restores.push(() => {
        if (h[method] === wrapped) h[method] = inner
      })
    } catch {
      /* a read-only history (some WebViews): the effect still halts it */
    }
  }
  const onPopState = () => guard(null)
  w.addEventListener('popstate', onPopState, true)
  restores.push(() => w.removeEventListener('popstate', onPopState, true))
  runtime.unguard = () => restores.forEach((r) => r())
}

/** identify + tags for the page Clarity is on. */
function applyPageContext(): void {
  if (runtime.state !== 'running') return
  if (runtime.userId) call('identify', runtime.userId)
  const ctx = runtime.pageContext ? runtime.pageContext() : null
  if (!ctx) return
  for (const [key, value] of clarityTags(ctx)) call('set', key, value)
}

function sameConsent(a: ClarityConsent | null, b: ClarityConsent): boolean {
  return !!a && a.ad_Storage === b.ad_Storage && a.analytics_Storage === b.analytics_Storage
}

/**
 * Record (or keep recording) this page. First call: inject the tag, send the
 * consent, register the per-page tag callback. After a halt: start again. While
 * running: send a changed consent. After a withdrawal: nothing until the next
 * full page load.
 */
export function startClarity(
  w: ClarityWindow,
  opts: {
    projectId: string
    consent: ClarityConsent
    pageContext: () => ClarityPageContext
    /** The same decision for a destination address; Clarity stops before it goes there. */
    mayRecord: (url: URL) => boolean
  },
): void {
  if (runtime.state === 'withdrawn') return
  runtime.win = w
  runtime.pageContext = opts.pageContext
  runtime.mayRecord = opts.mayRecord
  if (runtime.state === 'off') {
    if (!isClarityProjectId(opts.projectId)) return
    installNavigationGuard(w)
    injectTag(w, opts.projectId)
    runtime.state = 'running'
    runtime.consent = opts.consent
    call('consentv2', { ...opts.consent })
    // wait=false, recall=true: run now and again on every later Clarity page.
    call('metadata', applyPageContext, false, true)
    return
  }
  if (runtime.state === 'halted') {
    runtime.state = 'running'
    call('start')
    runtime.consent = opts.consent
    call('consentv2', { ...opts.consent })
    return
  }
  if (!sameConsent(runtime.consent, opts.consent)) {
    runtime.consent = opts.consent
    call('consentv2', { ...opts.consent })
  }
}

/** Stop recording on a page Clarity may not see (a personal area, a walk into /admin). Resumable. */
export function haltClarity(): void {
  if (runtime.state !== 'running') return
  runtime.state = 'halted'
  call('stop')
}

/** Delete Clarity's first-party cookies on this host and on the registrable domain. */
export function eraseClarityCookies(doc: Pick<Document, 'cookie'>, host: string | null | undefined): void {
  const raw = doc.cookie || ''
  const h = String(host || '').toLowerCase()
  const domain = h === PRODUCTION_HOST || h.endsWith(`.${PRODUCTION_HOST}`) ? PRODUCTION_HOST : null
  for (const name of CLARITY_COOKIES) {
    if (!new RegExp(`(?:^|;\\s*)${name}=`).test(raw)) continue
    const expired = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    doc.cookie = expired
    if (domain) doc.cookie = `${expired}; domain=${domain}`
  }
}

/**
 * Analytics consent was withdrawn (a decline, Global Privacy Control). Tell
 * Clarity the documented way, stop it, and delete its cookies. It stays off for
 * the rest of this page's life; the next full page load decides again. Sent
 * from a halt too: if Clarity is between pages the calls wait in its queue and
 * run the moment anything restarts it.
 */
export function withdrawClarity(doc: Pick<Document, 'cookie'>, host: string | null | undefined): void {
  if (runtime.state === 'running' || runtime.state === 'halted') {
    call('consentv2', { ...CLARITY_CONSENT_DENIED })
    call('stop')
    runtime.state = 'withdrawn'
  }
  eraseClarityCookies(doc, host)
}

/**
 * The hashed CRM id for a known contact (AnalyticsIdentityBridge, the same value
 * GA4 gets as user_id). Kept for every later Clarity page and sent now when
 * Clarity is recording. Anything but a hashed id (null when the visitor is not
 * known, after a sign-out) forgets the id, so later pages are not filed under a
 * contact who has left the browser. Clarity has no call to take back an id it was
 * given on the current page.
 */
export function rememberClarityUserId(hashedUserId: unknown): void {
  const id = clarityUserId(hashedUserId)
  if (id === runtime.userId) return
  runtime.userId = id
  if (id && runtime.state === 'running') call('identify', id)
}
