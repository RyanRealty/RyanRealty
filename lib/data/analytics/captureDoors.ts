/**
 * Capture-door catalog — every attributable inbound path that can create a
 * CRM person, plus manual entry (tagged, never a marketing win).
 *
 * Pure. Source strings are the crm_people.source / marketing_assignments.source
 * values observed in production plus the kebab labels live pipelines write.
 * Outreach lists (Farm / Import / Sphere / expired-listing-cron / FSBO lists)
 * are classified so callers can exclude them. They are not doors.
 */

import {
  classifyLeadSource,
  normalizeSource,
} from '@/lib/data/crm/leadSourceTaxonomy'

export type FunnelAudience = 'seller' | 'buyer' | 'recruit'

export type DoorAudience = FunnelAudience | 'either' | 'outreach'

export type CaptureDoorId =
  | 'home-valuation'
  | 'seller-lp'
  | 'buyer-lp'
  | 'expired-lp'
  | 'fsbo-lp'
  | 'contact-form'
  | 'listing-alert'
  | 'open-house'
  | 'cma-download'
  | 'meta-lead'
  | 'inbound-call'
  | 'inbound-sms'
  | 'portal-zillow'
  | 'portal-realtor'
  | 'portal-other'
  | 'agent-referral'
  | 'newsletter'
  | 'exit-intent'
  | 'rental-calculator'
  | 'page-cta'
  | 'showing-request'
  | 'join-team'
  | 'website-other'
  | 'manual'
  | 'outreach'
  | 'unspecified'

export type CaptureDoor = {
  id: CaptureDoorId
  label: string
  audience: DoorAudience
}

const DOORS: Record<CaptureDoorId, CaptureDoor> = {
  'home-valuation': { id: 'home-valuation', label: 'Home valuation / CMA request', audience: 'seller' },
  'seller-lp': { id: 'seller-lp', label: 'Seller landing page', audience: 'seller' },
  'buyer-lp': { id: 'buyer-lp', label: 'Buyer landing page', audience: 'buyer' },
  'expired-lp': { id: 'expired-lp', label: 'Expired-listing landing page', audience: 'seller' },
  'fsbo-lp': { id: 'fsbo-lp', label: 'FSBO landing page', audience: 'seller' },
  'contact-form': { id: 'contact-form', label: 'Contact form', audience: 'either' },
  'listing-alert': { id: 'listing-alert', label: 'Listing alert / saved search', audience: 'buyer' },
  'open-house': { id: 'open-house', label: 'Open house RSVP', audience: 'buyer' },
  'cma-download': { id: 'cma-download', label: 'CMA download', audience: 'seller' },
  'meta-lead': { id: 'meta-lead', label: 'Meta / social', audience: 'either' },
  'inbound-call': { id: 'inbound-call', label: 'Inbound call', audience: 'either' },
  'inbound-sms': { id: 'inbound-sms', label: 'Inbound text', audience: 'either' },
  'portal-zillow': { id: 'portal-zillow', label: 'Zillow / Trulia', audience: 'buyer' },
  'portal-realtor': { id: 'portal-realtor', label: 'Realtor.com', audience: 'buyer' },
  'portal-other': { id: 'portal-other', label: 'Other listing portal', audience: 'buyer' },
  'agent-referral': { id: 'agent-referral', label: 'Referral', audience: 'either' },
  'newsletter': { id: 'newsletter', label: 'Newsletter / content signup', audience: 'either' },
  'exit-intent': { id: 'exit-intent', label: 'Exit-intent capture', audience: 'either' },
  'rental-calculator': { id: 'rental-calculator', label: 'Rental calculator', audience: 'either' },
  'page-cta': { id: 'page-cta', label: 'Page CTA', audience: 'either' },
  'showing-request': { id: 'showing-request', label: 'Showing / tour request', audience: 'buyer' },
  'join-team': { id: 'join-team', label: 'Join the brokerage', audience: 'recruit' },
  'website-other': { id: 'website-other', label: 'Website / search (other)', audience: 'either' },
  'manual': { id: 'manual', label: 'Manual entry', audience: 'either' },
  'outreach': { id: 'outreach', label: 'Outreach list (not a lead)', audience: 'outreach' },
  'unspecified': { id: 'unspecified', label: 'Unspecified source', audience: 'either' },
}

const RULES: Array<{ test: (s: string) => boolean; id: CaptureDoorId }> = [
  { id: 'outreach', test: (s) => /\bfarm\b|assessor/.test(s) },
  { id: 'outreach', test: (s) => /\bexpired listing cron\b|\bexpired-listing-cron\b/.test(s) },
  { id: 'expired-lp', test: (s) => /\bexpired lp\b|\bexpired-lp\b/.test(s) },
  { id: 'outreach', test: (s) => /\bexpired\b/.test(s) },
  { id: 'fsbo-lp', test: (s) => /\bfsbo lp\b|\bfsbo-lp\b/.test(s) },
  { id: 'outreach', test: (s) => /\bfsbo\b|for sale by owner/.test(s) },
  // Matches lead_source text on records imported from the retired vendor CRM.
  // This is data we hold, not a tool we point anyone at; dropping the literal
  // stops classifying those historical leads.
  { id: 'outreach', test: (s) => /\bimport\b|migration|follow up boss|followupboss|\bfub\b|\bsphere\b/.test(s) }, // canon-allow: vendor-literal legacy lead_source values
  { id: 'join-team', test: (s) => /\bjoin\b|\brecruit\b|\bcareer\b|\bagent application\b/.test(s) },
  { id: 'home-valuation', test: (s) => /home valuation|cma request|cma-request|valuation/.test(s) },
  { id: 'cma-download', test: (s) => /\bcma download\b|\bcma-download\b/.test(s) },
  { id: 'seller-lp', test: (s) => /seller lp|seller-lp|fb ads seller|tetherow/.test(s) },
  { id: 'buyer-lp', test: (s) => /buyer lp|buyer-lp|fb ads buyer/.test(s) },
  { id: 'listing-alert', test: (s) => /listing alert|saved search|idx registration|idx-registration|buyer listing/.test(s) },
  { id: 'contact-form', test: (s) => /contact form|contact-form/.test(s) },
  { id: 'open-house', test: (s) => /open house/.test(s) },
  { id: 'meta-lead', test: (s) => /meta lead|lead form|facebook lead/.test(s) },
  { id: 'inbound-call', test: (s) => /inbound call|sign call|cold call/.test(s) },
  { id: 'inbound-sms', test: (s) => /inbound text|\bsms\b/.test(s) },
  { id: 'portal-realtor', test: (s) => /realtor com|realtorcom/.test(s) },
  { id: 'portal-zillow', test: (s) => /\bzillow\b|\btrulia\b/.test(s) },
  { id: 'portal-other', test: (s) => /homes com/.test(s) },
  { id: 'agent-referral', test: (s) => /word of mouth|referr|past client|repeat client/.test(s) },
  { id: 'newsletter', test: (s) => /newsletter|blog email|blog-email/.test(s) },
  { id: 'exit-intent', test: (s) => /exit intent/.test(s) },
  { id: 'rental-calculator', test: (s) => /rental calculator/.test(s) },
  { id: 'showing-request', test: (s) => /showing|schedule tour|calendly|tour request/.test(s) },
  { id: 'page-cta', test: (s) => /homepage cta|page cta|homepage-cta/.test(s) },
  { id: 'manual', test: (s) => /\bmanual\b/.test(s) },
  { id: 'inbound-call', test: (s) => /\bcall\b|\bphone\b/.test(s) },
  { id: 'meta-lead', test: (s) => /facebook|instagram|\bmeta\b|\bfb\b|\big\b|tiktok|linkedin|youtube|social/.test(s) },
  { id: 'website-other', test: (s) => /website|web site|ryan realty|\bgoogle\b|\borganic\b|\bsearch\b|\blp\b|landing/.test(s) },
]

export function captureDoorById(id: CaptureDoorId): CaptureDoor {
  return DOORS[id]
}

export function isCaptureDoorId(value: string | null | undefined): value is CaptureDoorId {
  return Boolean(value && value in DOORS)
}

export function classifyCaptureDoor(source: string | null | undefined): CaptureDoor {
  const s = normalizeSource(source)
  if (!s) return DOORS.unspecified
  for (const rule of RULES) {
    if (rule.test(s)) return DOORS[rule.id]
  }
  return DOORS.unspecified
}

const RECRUIT_TAGS = new Set(['recruit:join', 'audience:recruit', 'audience:join', 'segment:recruit'])

export function isRecruitTagged(tags: string[] | null | undefined): boolean {
  return (tags ?? []).some((t) => RECRUIT_TAGS.has(t.toLowerCase()))
}

/** Tags win: a Join-the-team contact form is the recruit door, not a consumer form. */
export function doorForPerson(
  source: string | null | undefined,
  tags: string[] | null | undefined,
): CaptureDoor {
  if (isRecruitTagged(tags)) return DOORS['join-team']
  return classifyCaptureDoor(source)
}

export function isDoorOnFunnelBoard(door: CaptureDoor): boolean {
  return door.audience !== 'outreach'
}

/**
 * Which audience toggles a CRM person belongs on.
 * Tags win. If tags are silent, the capture door decides.
 * A person tagged both seller and buyer appears on both toggles.
 */
export function personAppearsInAudience(
  tags: string[] | null | undefined,
  source: string | null | undefined,
  audience: FunnelAudience,
): boolean {
  const lower = (tags ?? []).map((t) => t.toLowerCase())
  const hasSeller =
    lower.includes('audience:seller') ||
    lower.some((t) => t.startsWith('seller:') && t !== 'seller:fsbo' && !t.startsWith('seller:expired'))
  const hasBuyer =
    lower.includes('audience:buyer') || lower.some((t) => t.startsWith('buyer:'))
  const hasRecruit = isRecruitTagged(tags)
  const door = classifyCaptureDoor(source)

  if (audience === 'recruit') {
    return hasRecruit || door.audience === 'recruit'
  }
  if (audience === 'seller') {
    if (hasSeller) return true
    if (hasBuyer || hasRecruit) return false
    return door.audience === 'seller' || door.audience === 'either'
  }
  if (hasBuyer) return true
  if (hasSeller || hasRecruit) return false
  return door.audience === 'buyer' || door.audience === 'either'
}

export function sessionAppearsInAudience(
  intentTags: string[] | null | undefined,
  audience: FunnelAudience,
  landingPage?: string | null,
): boolean {
  const tags = intentTags ?? []
  if (audience === 'recruit') {
    return /\/join|\/careers|join-the|recruit/i.test(landingPage ?? '')
  }
  const seller = tags.includes('seller_intent')
  const buyer = tags.includes('buyer_intent')
  if (audience === 'seller') return seller
  return buyer
}

/** Phone/text capture is itself a broker touch. Those leads start in WORKING. */
export function doorIsImmediateWorking(door: CaptureDoor): boolean {
  return door.id === 'inbound-call' || door.id === 'inbound-sms'
}

export function isAttributableDoorSource(source: string | null | undefined): boolean {
  const cls = classifyLeadSource(source)
  return cls.attributable
}

export function isManualDoorSource(source: string | null | undefined): boolean {
  return classifyCaptureDoor(source).id === 'manual'
}
