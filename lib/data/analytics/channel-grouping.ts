/**
 * First-party channel grouping — where a visit actually came from.
 *
 * WHY THIS EXISTS. /admin/analytics "Acquisition" reads GA4, and GA4 cannot
 * answer this question for us. 99.5% of visitors never answer the cookie
 * banner, so Consent Mode sends a cookieless ping that carries NO traffic
 * source: measured 2026-08-26, GA4 reported `(not set)` for 15,188 of ~15,600
 * sessions. That is not a misconfiguration and no amount of GA4 tuning fixes
 * it — it is what a denied-consent ping is allowed to contain.
 *
 * Our own `visitor_sessions` table does have the answer, because a referrer and
 * a campaign tag describe the LINK, not the person, and are recorded at every
 * consent tier: 11,197 of the same 90 days carry a referrer.
 *
 * This module is the classifier only — pure, no I/O — so the rules that decide
 * "this was social" can be read and tested without a database.
 *
 * The groupings follow the standard definitions (paid beats source, source
 * beats referrer, referrer beats nothing) so the words mean what a marketer
 * expects them to mean.
 */

export type ChannelGroup =
  | 'Paid Search'
  | 'Paid Social'
  | 'Google Business Profile'
  | 'Organic Search'
  | 'Organic Social'
  | 'Email'
  | 'SMS'
  | 'AI Assistant'
  | 'Referral'
  | 'Direct'
  | 'Other Campaign'

export type SessionSignals = {
  referrer?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  fbclid?: string | null
}

const SOCIAL_HOSTS =
  /(^|\.)(facebook|instagram|linkedin|tiktok|youtube|pinterest|threads|nextdoor|reddit|x|twitter)\.com$|^t\.co$|^lnkd\.in$|^fb\.me$|^l\.instagram\.com$|^m\.facebook\.com$/i

const SEARCH_HOSTS =
  /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|startpage)\.[a-z.]+$/i

/** Assistants send real referral traffic now and are worth their own bucket. */
const AI_HOSTS = /(^|\.)(chatgpt|openai|perplexity|claude|gemini|copilot)\.[a-z.]+$/i

/**
 * Our Google Business Profile links carry utm_source=gbp (lib/analytics/utm.ts,
 * medium organic). A profile click is local search, but it is the one search
 * door we own, so it gets its own group instead of hiding inside Organic Search.
 */
const GBP_SOURCE = /^(gbp|gmb|google_business_profile|google-business-profile|googlebusinessprofile)$/i

const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid_search|paid_social|paidsocial|display|banner|retargeting)$/i
const EMAIL_MEDIUM = /^(email|e-mail|newsletter)$/i
const SMS_MEDIUM = /^(sms|text|mms)$/i
const SOCIAL_MEDIUM = /^(social|organic_social|social-network|social_media|sm)$/i

function hostOf(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Our own site is not a referrer — an internal hop is still the original visit. */
function isSelfReferral(host: string | null): boolean {
  return !!host && /(^|\.)ryan-realty\.com$/i.test(host)
}

/**
 * The browser tracker stamps a visit that arrived with no tag and no referrer
 * as utm_source=direct, utm_medium=none (lib/analytics/visitor-session.ts), so
 * the row always has a source. That stamp says "we saw nothing", not "a
 * campaign": read as a tag, it filed every direct visit under Other Campaign
 * and the Direct share read 0% (measured 2026-10-14, 7 days: 2,264 of 2,447
 * sessions). It is treated as no tag at all.
 */
function isNoSourceStamp(source: string, medium: string, campaign: string): boolean {
  return source === 'direct' && (medium === '' || medium === 'none' || medium === '(none)') && campaign === ''
}

/**
 * The tracker also copies the referring site into utm_source when the link
 * carried no tag (medium referral, or portal for Zillow / Realtor.com /
 * Trulia). That is the referrer again, not a campaign we ran.
 */
function isInferredFromReferrer(source: string, medium: string, host: string): boolean {
  if (medium === 'referral' || medium === 'portal') return true
  const bare = host.replace(/^www\./, '')
  return source === host || source === bare || source === bare.split('.')[0]
}

export function classifyChannel(s: SessionSignals): ChannelGroup {
  const host = hostOf(s.referrer)
  let source = (s.utmSource ?? '').trim().toLowerCase()
  let medium = (s.utmMedium ?? '').trim().toLowerCase()
  const campaign = (s.utmCampaign ?? '').trim()

  // 0. The tracker's "no source" stamp is not a tag.
  if (isNoSourceStamp(source, medium, campaign)) {
    source = ''
    medium = ''
  }

  // 1. PAID always wins. A click id or a paid medium means money bought this
  //    visit, whatever else is attached to it.
  const looksSocialSource = SOCIAL_HOSTS.test(`${source}.com`) || /facebook|instagram|meta|tiktok|linkedin|pinterest/i.test(source)
  if (s.fbclid) return 'Paid Social'
  if (PAID_MEDIUM.test(medium)) {
    if (looksSocialSource) return 'Paid Social'
    return 'Paid Search'
  }

  // 2. Our Business Profile links, then an explicit medium we set ourselves.
  if (GBP_SOURCE.test(source)) return 'Google Business Profile'
  if (EMAIL_MEDIUM.test(medium)) return 'Email'
  if (SMS_MEDIUM.test(medium)) return 'SMS'
  if (SOCIAL_MEDIUM.test(medium)) return 'Organic Social'

  // 3. The referring host, when we did not tag the link.
  if (host && !isSelfReferral(host)) {
    if (AI_HOSTS.test(host)) return 'AI Assistant'
    if (SOCIAL_HOSTS.test(host)) return 'Organic Social'
    if (SEARCH_HOSTS.test(host)) return 'Organic Search'
    // The tracker's copy of the referrer is still just the referrer.
    if (!source || isInferredFromReferrer(source, medium, host)) return 'Referral'
    // A tagged link from a site we do not otherwise recognise is still a campaign.
    return 'Other Campaign'
  }

  // 4. No usable referrer, but the tag names an AI assistant (ChatGPT adds
  //    utm_source=chatgpt.com to the links it shows) or a search engine.
  if (source && AI_HOSTS.test(source.includes('.') ? source : `${source}.com`)) return 'AI Assistant'
  if (source && medium === 'organic' && SEARCH_HOSTS.test(source.includes('.') ? source : `${source}.com`)) {
    return 'Organic Search'
  }

  // 5. Tagged, but nothing above matched — our own campaign, unclassified.
  if (source || medium || campaign) return 'Other Campaign'

  // 6. Nothing at all. Genuinely direct, OR a referrer the browser withheld.
  //    Both look identical here and neither can be recovered.
  return 'Direct'
}

/**
 * The label a human sees for the specific origin inside a group — the actual
 * host or the campaign tag, so "Organic Social" can be broken down into which
 * network, and a campaign can be traced to the post that carried it.
 */
export function originLabel(s: SessionSignals): string {
  const campaign = (s.utmCampaign ?? '').trim()
  const rawSource = (s.utmSource ?? '').trim()
  const medium = (s.utmMedium ?? '').trim().toLowerCase()
  const source = isNoSourceStamp(rawSource.toLowerCase(), medium, campaign) ? '' : rawSource
  if (source && campaign) return `${source} / ${campaign}`
  if (source) return source
  const host = hostOf(s.referrer)
  if (host && !isSelfReferral(host)) return host
  return '(none)'
}
