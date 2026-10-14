/**
 * Visit-level broker attribution for GA4.
 *
 * CRM outbound already stamps `?agent=` (lead routing via rr_agent_attribution).
 * GA visits historically only received `assigned_broker` / `broker_slug` on
 * `generate_lead` (`fireLeadGenerated`). This module is the single resolver
 * for those same GA Admin custom-definition names on page_view / listing_view.
 *
 * UTM convention (lib/analytics/utm.ts):
 *   - Channel defaults when missing: utm_source=crm, utm_medium=email
 *   - Broker identity: utm_content=agent-<slug> when content is free.
 *     utm_term is paid-keyword only (never an agent tag).
 *   - Existing channel UTMs are rebuilt through buildTrackedUrl so there is
 *     exactly one set, remapped onto the closed vocab (email-click → crm,
 *     doc → document, per-property campaign → cma-letter + rr_doc).
 */
import {
  AGENT_ATTRIB_COOKIE,
  normalizeAgentSlug,
  parseAgentAttributionCookie,
  type BrokerSlug,
} from '@/lib/agent-attribution'
import {
  buildTrackedUrl,
  CMA_DOC_PARAM,
  isCmaDocumentSlug,
  readExistingUtms,
} from '@/lib/analytics/utm'

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `?`, raw `&`, and HTML `&amp;` are all separators. A link written into an
 * email attribute is `utm_source=cma&amp;utm_medium=document`, and a check
 * that only sees `&` will miss the param and append a second one.
 */
export function hasQueryParam(url: string, name: string): boolean {
  return new RegExp(`(?:\\?|&(?:amp;)?)${escapeRegExp(name)}=`, 'i').test(url)
}

export function queryParamValue(url: string, name: string): string | null {
  const normalized = /&amp;/i.test(url) ? url.replace(/&amp;/gi, '&') : url
  try {
    return new URL(normalized).searchParams.get(name)
  } catch {
    const m = normalized.match(new RegExp(`[?&]${escapeRegExp(name)}=([^&#]*)`, 'i'))
    if (!m) return null
    try {
      return decodeURIComponent(m[1])
    } catch {
      return m[1]
    }
  }
}

/** When the URL is HTML-escaped, the new separator is `&amp;` too. */
export function appendQueryParam(url: string, name: string, value: string): string {
  if (hasQueryParam(url, name)) return url
  const hashAt = url.indexOf('#')
  const base = hashAt === -1 ? url : url.slice(0, hashAt)
  const fragment = hashAt === -1 ? '' : url.slice(hashAt)
  const sep = base.includes('?') ? (/&amp;/i.test(base) ? '&amp;' : '&') : '?'
  return `${base}${sep}${name}=${encodeURIComponent(value)}${fragment}`
}

/**
 * Stamp CRM channel + broker UTMs onto a destination URL. Rebuilds through
 * buildTrackedUrl so there is exactly one UTM set on the vocab. A link that
 * already carries source/medium/campaign keeps them (after alias remap).
 */
export function stampCrmOutboundUtms(
  url: string,
  brokerSlug: string | null | undefined,
  opts?: { test?: boolean },
): string {
  const existing = readExistingUtms(url)
  const source = existing.source || CRM_OUTBOUND_UTM_SOURCE
  const medium = existing.medium || CRM_OUTBOUND_UTM_MEDIUM
  const extraParams: Record<string, string> = {}
  const doc = existing.extraDoc?.trim().toLowerCase()
  if (doc) extraParams[CMA_DOC_PARAM] = doc
  else if (existing.campaign && isCmaDocumentSlug(existing.campaign)) {
    extraParams[CMA_DOC_PARAM] = existing.campaign.trim().toLowerCase()
  }
  let content = existing.content
  const slug = (brokerSlug ?? '').trim()
  if (slug && !content) content = agentUtmTag(slug)
  let term = existing.term
  if (term && term.toLowerCase().startsWith(AGENT_UTM_PREFIX)) term = undefined
  return buildTrackedUrl(url, {
    source,
    medium,
    campaign: existing.campaign || undefined,
    content: content || undefined,
    term: term || undefined,
    test: opts?.test,
    extraParams: Object.keys(extraParams).length ? extraParams : undefined,
  })
}
