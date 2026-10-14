/**
 * First-party UTM / click-id for listing-alert capture. Client lpContext wins
 * so a visitor who clicks around before submitting still carries the ad source
 * into CRM tags and generate_lead. Referer fills any key the client omitted.
 */
import {
  LEAD_ATTRIBUTION_QUERY_KEYS,
  attributionParamsFromSearch,
  type LeadAttributionParams,
} from '@/lib/lead-tracking'

export type ListingAlertLpContext = {
  lp_variant?: string
  lp_source?: string
  lp_medium?: string
  lp_campaign?: string
  lp_content?: string
  lp_term?: string
  gclid?: string
  fbclid?: string
}

export function listingAlertAttributionFromContext(
  ctx?: ListingAlertLpContext | null,
): LeadAttributionParams {
  if (!ctx) return {}
  const out: LeadAttributionParams = {}
  if (ctx.lp_source) out.lp_source = ctx.lp_source
  if (ctx.lp_medium) out.lp_medium = ctx.lp_medium
  if (ctx.lp_campaign) out.lp_campaign = ctx.lp_campaign
  if (ctx.lp_content) out.lp_content = ctx.lp_content
  if (ctx.lp_term) out.lp_term = ctx.lp_term
  if (ctx.gclid) out.gclid = ctx.gclid
  if (ctx.fbclid) out.fbclid = ctx.fbclid
  return out
}

export function mergeLeadAttribution(
  primary?: LeadAttributionParams | null,
  fallback?: LeadAttributionParams | null,
): LeadAttributionParams {
  const a = primary ?? {}
  const b = fallback ?? {}
  const out: LeadAttributionParams = {}
  const keys: (keyof LeadAttributionParams)[] = [
    'lp_source',
    'lp_medium',
    'lp_campaign',
    'lp_content',
    'lp_term',
    'gclid',
    'fbclid',
  ]
  for (const key of keys) {
    const value = a[key] ?? b[key]
    if (value) out[key] = value
  }
  return out
}

export function mergeListingAlertAttribution(
  client?: ListingAlertLpContext | null,
  referer?: string | null,
): LeadAttributionParams {
  let fromReferer: LeadAttributionParams = {}
  if (referer) {
    try {
      fromReferer = attributionParamsFromSearch(new URL(referer).searchParams)
    } catch {
      fromReferer = {}
    }
  }
  return mergeLeadAttribution(listingAlertAttributionFromContext(client), fromReferer)
}

const QUERY_FROM_ATTR: Record<(typeof LEAD_ATTRIBUTION_QUERY_KEYS)[number], keyof LeadAttributionParams> = {
  utm_source: 'lp_source',
  utm_medium: 'lp_medium',
  utm_campaign: 'lp_campaign',
  utm_content: 'lp_content',
  utm_term: 'lp_term',
  gclid: 'gclid',
  fbclid: 'fbclid',
}

/** Put allowlisted attribution on a source URL so CRM parsers can read it. */
export function appendListingAlertAttribution(url: string, attr: LeadAttributionParams): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  for (const key of LEAD_ATTRIBUTION_QUERY_KEYS) {
    const value = attr[QUERY_FROM_ATTR[key]]
    if (value) parsed.searchParams.set(key, value)
  }
  return parsed.toString()
}

export function listingAlertCampaign(attr: LeadAttributionParams): {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
} | undefined {
  if (!attr.lp_source && !attr.lp_medium && !attr.lp_campaign && !attr.lp_content && !attr.lp_term) {
    return undefined
  }
  return {
    ...(attr.lp_source ? { source: attr.lp_source } : {}),
    ...(attr.lp_medium ? { medium: attr.lp_medium } : {}),
    ...(attr.lp_campaign ? { campaign: attr.lp_campaign } : {}),
    ...(attr.lp_content ? { content: attr.lp_content } : {}),
    ...(attr.lp_term ? { term: attr.lp_term } : {}),
  }
}
