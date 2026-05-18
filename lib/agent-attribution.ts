/**
 * Agent attribution — bridge between the existing
 * `components/AgentAttributionBridge.tsx` (which captures `?agent=` into a
 * `rr_agent_attribution` cookie) and the LP form server actions that need
 * to assign a lead to a specific broker.
 *
 * Per Matt 2026-05-17:
 *   "if Rebecca or Paul have their ads point to their landing page on the
 *    website on ryan-realty.com, then by default those leads will be theirs.
 *    ... it's tracked with a hashtag and then their user name."
 *
 * URL pattern:  https://ryan-realty.com/lp/seller-home-value?agent=rebecca
 * Cookie:       rr_agent_attribution (JSON-encoded { slug, capturedAt }, 90d TTL)
 *               set by AgentAttributionBridge mounted in app/layout.tsx
 * Server read:  see app/actions/agent-attribution-read.ts
 *
 * Honors slug variants: matt, matt-ryan, rebecca, rebecca-peterson, paul,
 * paul-stevenson. Normalizes to canonical short slug { matt | rebecca | paul }.
 */

export const AGENT_ATTRIB_COOKIE = 'rr_agent_attribution'

// Canonical broker short slugs (used in FUB broker:* tags + assignment maps)
export type BrokerSlug = 'matt' | 'rebecca' | 'paul'

// URL slug → canonical short slug
const SLUG_NORMALIZE: Record<string, BrokerSlug> = {
  'matt': 'matt',
  'matt-ryan': 'matt',
  'rebecca': 'rebecca',
  'rebecca-peterson': 'rebecca',
  'paul': 'paul',
  'paul-stevenson': 'paul',
}

export function normalizeAgentSlug(raw: string | null | undefined): BrokerSlug | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  return SLUG_NORMALIZE[lower] ?? null
}

// FUB user IDs by canonical broker slug
export const FUB_USER_ID_BY_BROKER: Record<BrokerSlug, number> = {
  matt: 1,
  rebecca: 2,
  paul: 3,
}

export const BROKER_EMAIL_BY_SLUG: Record<BrokerSlug, string> = {
  matt: 'matt@ryan-realty.com',
  rebecca: 'rebeccapeterson@ryan-realty.com',
  paul: 'paul@ryan-realty.com',
}

/**
 * Parse the cookie payload that AgentAttributionBridge writes:
 * `rr_agent_attribution=<encoded JSON {slug, capturedAt}>`
 */
export function parseAgentAttributionCookie(cookieValue: string | undefined): BrokerSlug | null {
  if (!cookieValue) return null
  try {
    const decoded = decodeURIComponent(cookieValue)
    const payload = JSON.parse(decoded) as { slug?: string; capturedAt?: string }
    return normalizeAgentSlug(payload?.slug)
  } catch {
    // Fallback: cookie might be a plain slug (older format or manual)
    return normalizeAgentSlug(cookieValue)
  }
}
