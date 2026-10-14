/**
 * Which link gets the credit for a buyer lead (Matt 2026-10-09, "Visit they
 * signed up in"): saved searches, search alerts, listing saves, price-drop
 * watches and the /buy forms are tagged with the link that started the visit
 * they happen in.
 *
 * The visit answers first: the landing link of the live session the form names,
 * read from visitor_sessions (lib/data/identity/visitCampaign.ts). It answers
 * even when its link carried no campaign, and even when the page's address
 * carries utm_*: a link inside the site keeps its tags (a CMA's comp links say
 * utm_source=cma) without starting a new visit, while a new campaign arriving
 * from outside does start one, so the visit already holds it. The page's own
 * link (the form's lpContext, the page query or the Referer) answers only when
 * there is no live visit: tracking declined or GPC, or a visit the tracker has
 * not written yet.
 *
 * No campaign either way, no tags: a sign-up days later in an untagged visit
 * stays uncredited, as Matt chose. A tab left open on an ad's own landing
 * address still carries that ad's link; the tracker records a visit resumed
 * there under the same address, as GA4's own attribution does.
 */
import 'server-only'
import { cookies, headers } from 'next/headers'
import { readLiveVisit } from '@/lib/data/identity/visitCampaign'
import { resolvePaidAttributionTags } from '@/lib/crm/lead-source'
import { attributionParamsFromSearch } from '@/lib/lead-tracking'

export type SignupUtm = { source: string; medium?: string; campaign?: string; content?: string }

/** A page's link as a door reads it; utm_source is required for it to count. */
export type SignupPageLink = Partial<SignupUtm>

export type SignupAttribution = {
  /** channel: / campaign: / ad-content: tags for canonicallyTagLead's extraTags. */
  tags: string[]
  /** The link that earned them, for the person's origin context; null with no tags. */
  utm: SignupUtm | null
}

/** No credit: a fresh value, so a caller that extends its tags never shares them. */
export function noSignupAttribution(): SignupAttribution {
  return { tags: [], utm: null }
}

function credit(utm: SignupUtm): SignupAttribution {
  const tags = resolvePaidAttributionTags({
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    utmContent: utm.content,
  })
  return { tags, utm }
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
  /** The page's own link, when the door reads one. Used only with no live visit. */
  page?: SignupPageLink | null
  /** The VisitTracker session id the form sent, read on the client. */
  sessionId?: string | null
}): Promise<SignupAttribution> {
  let rrVid: string | null = null
  try {
    rrVid = (await cookies()).get('rr_vid')?.value ?? null
  } catch {
    rrVid = null
  }
  const visit = await readLiveVisit({ sessionId: input.sessionId, rrVid })
  if (visit) {
    const c = visit.campaign
    if (!c) return noSignupAttribution()
    return credit({
      source: c.source,
      medium: c.medium ?? undefined,
      campaign: c.campaign ?? undefined,
      content: c.content ?? undefined,
    })
  }
  const pageSource = input.page?.source?.trim()
  if (!pageSource) return noSignupAttribution()
  return credit({
    source: pageSource,
    medium: input.page?.medium || undefined,
    campaign: input.page?.campaign || undefined,
    content: input.page?.content || undefined,
  })
}
