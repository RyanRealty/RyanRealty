/**
 * Cookie-notice timing: when the first-layer prompt may appear.
 *
 * Counsel memo 002 §5.3. Pure: no document, window, Date.now, or storage.
 * The banner reads cookies and storage in effects and passes the numbers here.
 */

import type { ConsentState } from '@/lib/identity/consent'

/** Bump when purposes or partners named in the banner change. */
export const CONSENT_PURPOSES_VERSION = 1

/** Footer and settings icon dispatch this; the banner opens the second layer. */
export const OPEN_COOKIE_SETTINGS_EVENT = 'rr:open-cookie-settings'

/**
 * High-intent moment for the one extra US no-answer ask.
 * Dispatched from lib/tracking.ts trackEvent; the banner listens.
 */
export const CONTEXTUAL_CONSENT_ASK_EVENT = 'rr:contextual-consent-ask'

/** Valuation request or saved-search request. address_submit is the valuation address step. */
export const CONTEXTUAL_CONSENT_EVENT_NAMES = [
  'valuation_requested',
  'save_search',
  'address_submit',
] as const

export type ContextualConsentEventName = (typeof CONTEXTUAL_CONSENT_EVENT_NAMES)[number]

export function isContextualConsentEvent(name: string): name is ContextualConsentEventName {
  return (CONTEXTUAL_CONSENT_EVENT_NAMES as readonly string[]).includes(name)
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000
export const US_DECLINE_REPROMPT_DAYS = 90
/**
 * Six months (Counsel memo 002 §5.3; ICO "six months").
 * 183 days is half of 365, rounded up, so the wait is never shorter than six calendar months.
 * Applies to every restricted region (EEA, UK, CH, and unknown), which is what `rr_cr` already means.
 */
export const RESTRICTED_DECLINE_REPROMPT_DAYS = 183

/**
 * First-layer bar and the floating settings icon stay off these paths.
 * Cookie settings in the footer still opens the second layer, so the banner stays mounted.
 * Matches HideOnLP: /lp/*, /admin, /sign/*, /concept/*.
 */
export function consentFirstLayerSuppressed(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/lp/')) return true
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  if (pathname.startsWith('/sign/')) return true
  if (pathname.startsWith('/concept/')) return true
  return false
}

/** localStorage: last shown time and whether the contextual ask was used. */
export const CONSENT_PROMPT_STORAGE_KEY = 'rr_consent_prompt'
/** sessionStorage: visitor closed the notice with X this session. */
export const CONSENT_PROMPT_DISMISS_KEY = 'rr_consent_dismissed'
/** sessionStorage: this tab has already begun a consent-prompt session. */
export const CONSENT_PROMPT_SESSION_KEY = 'rr_consent_session'

export type ConsentPromptStored = (ConsentState & { v?: number }) | null

export type ShouldShowConsentPromptArgs = {
  stored: ConsentPromptStored
  decidedAt: number | null
  lastShownAt: number | null
  dismissedThisSession: boolean
  newSession: boolean
  restricted: boolean
  gpc: boolean
  now: number
}

export function isConsentDecline(
  stored: ConsentPromptStored,
): stored is ConsentState & { v?: number } {
  return stored !== null && stored.analytics === false && stored.marketing === false
}

export function isConsentAccept(
  stored: ConsentPromptStored,
): stored is ConsentState & { v?: number } {
  return stored !== null && (stored.analytics === true || stored.marketing === true)
}

/**
 * Whether the first-layer bar may show. The banner paints that bar as soon as
 * this returns true. There is no chip and no scroll gate.
 *
 * GPC: never. Same-session X: never. Accept: only if purposes version changed.
 * Decline: after 90 days (US) or 183 days (restricted). No answer: next session,
 * at most once per 24h since it was last shown. A same-tab reload is not a new
 * session, so the daily cap does not hide an unanswered notice on refresh.
 * React Strict Mode sets the session key on the first effect pass; skipping the
 * cap when newSession is false keeps that second pass from hiding the bar.
 */
export function shouldShowConsentPrompt({
  stored,
  decidedAt,
  lastShownAt,
  dismissedThisSession,
  newSession,
  restricted,
  gpc,
  now,
}: ShouldShowConsentPromptArgs): boolean {
  if (gpc) return false
  if (dismissedThisSession) return false

  let eligible = false
  if (isConsentAccept(stored)) {
    const version = stored.v ?? CONSENT_PURPOSES_VERSION
    eligible = version !== CONSENT_PURPOSES_VERSION
  } else if (isConsentDecline(stored)) {
    if (decidedAt == null) eligible = false
    else {
      const waitDays = restricted ? RESTRICTED_DECLINE_REPROMPT_DAYS : US_DECLINE_REPROMPT_DAYS
      eligible = now - decidedAt >= waitDays * MS_PER_DAY
    }
  } else {
    eligible = true
  }

  if (!eligible) return false
  if (newSession && lastShownAt != null && now - lastShownAt < MS_PER_DAY) return false
  return true
}

/**
 * One extra first-layer ask, once per browser, for US visitors with no answer.
 * Ignores the once-a-day cap. Never under GPC, in restricted regions, or after an answer.
 */
export function shouldShowContextualConsentAsk(args: {
  stored: ConsentPromptStored
  gpc: boolean
  restricted: boolean
  contextualAskUsed: boolean
}): boolean {
  if (args.gpc || args.restricted || args.contextualAskUsed) return false
  if (args.stored !== null) return false
  return true
}

export type PromptBookkeeping = {
  lastShownAt: number | null
  contextualAskUsed: boolean
}

export function parsePromptBookkeeping(raw: string | null | undefined): PromptBookkeeping {
  if (!raw) return { lastShownAt: null, contextualAskUsed: false }
  try {
    const parsed = JSON.parse(raw) as { lastShownAt?: unknown; contextualAskUsed?: unknown }
    const lastShownAt =
      typeof parsed.lastShownAt === 'number' && Number.isFinite(parsed.lastShownAt)
        ? parsed.lastShownAt
        : null
    return { lastShownAt, contextualAskUsed: parsed.contextualAskUsed === true }
  } catch {
    return { lastShownAt: null, contextualAskUsed: false }
  }
}

export function serializePromptBookkeeping(state: PromptBookkeeping): string {
  return JSON.stringify({
    lastShownAt: state.lastShownAt,
    contextualAskUsed: state.contextualAskUsed,
  })
}

/** Extra cookie JSON fields the identity parser ignores. */
export function parseConsentDecisionMeta(raw: string | null | undefined): {
  ts: number | null
  v: number | null
} {
  if (!raw) return { ts: null, v: null }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { ts?: unknown; v?: unknown }
    const ts = typeof parsed.ts === 'number' && Number.isFinite(parsed.ts) ? parsed.ts : null
    const v = typeof parsed.v === 'number' && Number.isFinite(parsed.v) ? parsed.v : null
    return { ts, v }
  } catch {
    return { ts: null, v: null }
  }
}
