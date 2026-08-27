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

export function classifyChannel(s: SessionSignals): ChannelGroup {
  const host = hostOf(s.referrer)
  const source = (s.utmSource ?? '').trim().toLowerCase()
  const medium = (s.utmMedium ?? '').trim().toLowerCase()

  // 1. PAID always wins. A click id or a paid medium means money bought this
  //    visit, whatever else is attached to it.
  const looksSocialSource = SOCIAL_HOSTS.test(`${source}.com`) || /facebook|instagram|meta|tiktok|linkedin|pinterest/i.test(source)
  if (s.fbclid) return 'Paid Social'
  if (PAID_MEDIUM.test(medium)) {
    if (looksSocialSource) return 'Paid Social'
    return 'Paid Search'
  }

  // 2. An explicit medium we set ourselves.
  if (EMAIL_MEDIUM.test(medium)) return 'Email'
  if (SMS_MEDIUM.test(medium)) return 'SMS'
  if (SOCIAL_MEDIUM.test(medium)) return 'Organic Social'

  // 3. The referring host, when we did not tag the link.
  if (host && !isSelfReferral(host)) {
    if (AI_HOSTS.test(host)) return 'AI Assistant'
    if (SOCIAL_HOSTS.test(host)) return 'Organic Social'
    if (SEARCH_HOSTS.test(host)) return 'Organic Search'
    // A tagged link from a site we do not otherwise recognise is still a campaign.
    if (source) return 'Other Campaign'
    return 'Referral'
  }

  // 4. Tagged, but nothing above matched — our own campaign, unclassified.
  if (source || medium || s.utmCampaign) return 'Other Campaign'

  // 5. Nothing at all. Genuinely direct, OR a referrer the browser withheld.
  //    Both look identical here and neither can be recovered.
  return 'Direct'
}

/**
 * The label a human sees for the specific origin inside a group — the actual
 * host or the campaign tag, so "Organic Social" can be broken down into which
 * network, and a campaign can be traced to the post that carried it.
 */
export function originLabel(s: SessionSignals): string {
  const source = (s.utmSource ?? '').trim()
  const campaign = (s.utmCampaign ?? '').trim()
  if (source && campaign) return `${source} / ${campaign}`
  if (source) return source
  const host = hostOf(s.referrer)
  if (host && !isSelfReferral(host)) return host
  return '(none)'
}
