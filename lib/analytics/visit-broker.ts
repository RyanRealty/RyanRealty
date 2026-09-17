/**
 * Visit-level broker attribution for GA4.
 *
 * CRM outbound already stamps `?agent=` (lead routing via rr_agent_attribution).
 * GA visits historically only received `assigned_broker` / `broker_slug` on
 * `generate_lead` (`fireLeadGenerated`). This module is the single resolver
 * for those same GA Admin custom-definition names on page_view / listing_view.
 *
 * UTM convention (docs/UTM_TRACKING_CONVENTION.md + live CRM senders):
 *   - Channel defaults when missing: utm_source=crm, utm_medium=email
 *     (same pair as market-report / prospecting CRM links — do not invent
 *     a second source/medium vocabulary).
 *   - Broker identity: utm_content=agent-<slug> when content is free;
 *     otherwise utm_term=agent-<slug>. Never overwrite existing utm_*.
 */
import {
  AGENT_ATTRIB_COOKIE,
  normalizeAgentSlug,
  parseAgentAttributionCookie,
  type BrokerSlug,
} from '@/lib/agent-attribution'

/** Live CRM senders already use this pair (market-report, prospecting SMS). */
export const CRM_OUTBOUND_UTM_SOURCE = 'crm'
export const CRM_OUTBOUND_UTM_MEDIUM = 'email'

/** Prefix for broker identity in utm_content / utm_term. */
export const AGENT_UTM_PREFIX = 'agent-'

export function agentUtmTag(brokerSlug: string): string {
  return `${AGENT_UTM_PREFIX}${brokerSlug.trim().toLowerCase()}`
}

/**
 * Parse `agent-<slug>` from a UTM content/term value. Accepts the raw slug
 * we stamp (`matt-ryan`) and the canonical short slug (`matt`).
 */
export function brokerSlugFromAgentUtm(value: string | null | undefined): BrokerSlug | null {
  if (!value) return null
  const raw = value.trim().toLowerCase()
  if (!raw.startsWith(AGENT_UTM_PREFIX)) return null
  return normalizeAgentSlug(raw.slice(AGENT_UTM_PREFIX.length))
}

export function agentParamFromPageUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null
  try {
    return new URL(pageUrl).searchParams.get('agent')
  } catch {
    return null
  }
}

/** Cookie-header / document.cookie reader for rr_agent_attribution. */
export function agentAttributionCookieFromCookieString(
  cookieString: string | null | undefined,
): string | undefined {
  if (!cookieString) return undefined
  const re = new RegExp(`(?:^|;\\s*)${AGENT_ATTRIB_COOKIE}=([^;]*)`)
  const m = cookieString.match(re)
  return m?.[1] ? m[1] : undefined
}

export type VisitBrokerSources = {
  /** Raw `?agent=` value (any recognized slug variant). */
  agentParam?: string | null
  /** Raw rr_agent_attribution cookie value. */
  cookieValue?: string | null
  /** Full page URL — `?agent=` is read when agentParam is omitted. */
  pageUrl?: string | null
  /** First-touch utm_content (may be `agent-<slug>`). */
  utmContent?: string | null
  /** First-touch utm_term fallback when content already names a creative. */
  utmTerm?: string | null
}

/**
 * Resolve the canonical short broker slug for a visit.
 * Precedence: ?agent= → attribution cookie → utm_content → utm_term.
 * Unknown slugs are ignored (never invent a broker).
 */
export function resolveVisitBrokerSlug(input: VisitBrokerSources): BrokerSlug | null {
  const fromAgent = normalizeAgentSlug(input.agentParam ?? agentParamFromPageUrl(input.pageUrl))
  if (fromAgent) return fromAgent
  const fromCookie = parseAgentAttributionCookie(input.cookieValue ?? undefined)
  if (fromCookie) return fromCookie
  const fromContent = brokerSlugFromAgentUtm(input.utmContent)
  if (fromContent) return fromContent
  return brokerSlugFromAgentUtm(input.utmTerm)
}

/** Client-only: URL `?agent=` then the attribution cookie. */
export function resolveClientVisitBroker(): BrokerSlug | null {
  if (typeof window === 'undefined') return null
  const agentParam = new URLSearchParams(window.location.search || '').get('agent')
  const cookieValue = agentAttributionCookieFromCookieString(document.cookie)
  return resolveVisitBrokerSlug({ agentParam, cookieValue, pageUrl: window.location.href })
}

export type VisitBrokerGa4Fields = {
  eventParams: { broker_slug: BrokerSlug }
  userProperties: { assigned_broker: BrokerSlug }
}

/**
 * GA Admin custom definitions: `assigned_broker` (USER) + `broker_slug` (EVENT).
 * Same short slugs as fireLeadGenerated (matt | rebecca | paul).
 */
export function visitBrokerGa4Fields(slug: BrokerSlug | null | undefined): VisitBrokerGa4Fields | null {
  if (!slug) return null
  return {
    eventParams: { broker_slug: slug },
    userProperties: { assigned_broker: slug },
  }
}

export function hasQueryParam(url: string, name: string): boolean {
  return new RegExp(`[?&]${name}=`, 'i').test(url)
}

export function queryParamValue(url: string, name: string): string | null {
  try {
    return new URL(url).searchParams.get(name)
  } catch {
    const m = url.match(new RegExp(`[?&]${name}=([^&#]*)`, 'i'))
    if (!m) return null
    try {
      return decodeURIComponent(m[1])
    } catch {
      return m[1]
    }
  }
}

export function appendQueryParam(url: string, name: string, value: string): string {
  if (hasQueryParam(url, name)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${name}=${encodeURIComponent(value)}`
}

/**
 * Stamp CRM channel + broker UTMs onto a destination URL without wiping
 * existing utm_*. Used by attributeSiteLinks so every ryan-realty.com click
 * from a CRM send is a campaign session, not Direct.
 */
export function stampCrmOutboundUtms(url: string, brokerSlug: string | null | undefined): string {
  let out = url
  if (!hasQueryParam(out, 'utm_source')) {
    out = appendQueryParam(out, 'utm_source', CRM_OUTBOUND_UTM_SOURCE)
  }
  if (!hasQueryParam(out, 'utm_medium')) {
    out = appendQueryParam(out, 'utm_medium', CRM_OUTBOUND_UTM_MEDIUM)
  }
  const slug = (brokerSlug ?? '').trim()
  if (!slug) return out
  const tag = agentUtmTag(slug)
  const existingContent = queryParamValue(out, 'utm_content')
  if (!existingContent) {
    return appendQueryParam(out, 'utm_content', tag)
  }
  // Content already is a broker tag — a second pass must not also fill term.
  if (existingContent.toLowerCase().startsWith(AGENT_UTM_PREFIX)) return out
  if (!hasQueryParam(out, 'utm_term')) {
    return appendQueryParam(out, 'utm_term', tag)
  }
  return out
}
