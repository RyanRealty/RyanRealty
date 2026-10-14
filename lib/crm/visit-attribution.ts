/**
 * Which link gets the credit for a buyer sign-up (Matt 2026-10-09, "Visit they
 * signed up in"): saved searches, search alerts, listing saves and price-drop
 * watches are tagged with the link that started the visit they happen in.
 *
 * The page's own link wins when it carries one (the form's lpContext, the page
 * query or the Referer: a new campaign's arrival starts a new visit, so it is
 * the same link). Otherwise the visit's recorded campaign answers, read from
 * visitor_sessions by the form's session id or the browser's rr_vid cookie
 * (lib/data/identity/visitCampaign.ts). That covers the buyer who arrived from
 * an ad, browsed a few pages and signed up on a page whose URL no longer
 * carries the link. No campaign either way, no tags: a sign-up days later in an
 * untagged visit stays uncredited, as Matt chose.
 */
import 'server-only'
import { cookies, headers } from 'next/headers'
import { readVisitCampaign } from '@/lib/data/identity/visitCampaign'
import { resolvePaidAttributionTags } from '@/lib/crm/lead-source'
import { attributionParamsFromSearch } from '@/lib/lead-tracking'

export type SignupUtm = { source: string; medium?: string; campaign?: string; content?: string }

export type SignupPageLink = { source?: string; medium?: string; campaign?: string; content?: string }

export type SignupAttribution = {
  /** channel: / campaign: / ad-content: tags for canonicallyTagLead's extraTags. */
  tags: string[]
  /** The link that earned them, for the person's origin context; null with no tags. */
  utm: SignupUtm | null
  from: 'page' | 'visit' | null
}

function tagsFor(utm: SignupUtm): string[] {
  return resolvePaidAttributionTags({
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    utmContent: utm.content,
  })
}

/**
 * The page's own link as the Referer carries it, for a door with no client
 * lpContext: a server action's Referer is the page it was called from, and the
 * site's strict-origin-when-cross-origin policy keeps the query on same-origin
 * requests (next.config.ts). null with no Referer or no utm_source on it.
 */
export async function pageLinkFromReferer(): Promise<SignupPageLink | null> {
  try {
    const referer = (await headers()).get('referer')
    if (!referer) return null
    const attr = attributionParamsFromSearch(new URL(referer).searchParams)
    if (!attr.lp_source) return null
    return { source: attr.lp_source, medium: attr.lp_medium, campaign: attr.lp_campaign, content: attr.lp_content }
  } catch {
    return null
  }
}

export async function signupAttribution(input: {
  /** The page's own link, when the door reads one (utm_source required). */
  page?: SignupPageLink | null
  /** The VisitTracker session id the form sent, read on the client. */
  sessionId?: string | null
}): Promise<SignupAttribution> {
  const pageSource = input.page?.source?.trim()
  if (pageSource) {
    const utm: SignupUtm = {
      source: pageSource,
      medium: input.page?.medium || undefined,
      campaign: input.page?.campaign || undefined,
      content: input.page?.content || undefined,
    }
    return { tags: tagsFor(utm), utm, from: 'page' }
  }
  let rrVid: string | null = null
  try {
    rrVid = (await cookies()).get('rr_vid')?.value ?? null
  } catch {
    rrVid = null
  }
  const visit = await readVisitCampaign({ sessionId: input.sessionId, rrVid })
  if (!visit) return { tags: [], utm: null, from: null }
  const utm: SignupUtm = {
    source: visit.source,
    medium: visit.medium ?? undefined,
    campaign: visit.campaign ?? undefined,
    content: visit.content ?? undefined,
  }
  return { tags: tagsFor(utm), utm, from: 'visit' }
}
