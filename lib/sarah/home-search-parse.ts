/**
 * Client-safe Sarah home-search parse, See-all href, and follow-up flow.
 * Keep this file off searchListingsAll / lib/data so the web panel can import it.
 */
import { parseSearchQuery, describeParsedSearch } from '@/lib/parse-search-query'
import { ALL_SEARCH_URL_PARAMS, SEARCH_FIELDS } from '@/lib/search/field-registry'
import { homesForSalePath, slugify } from '@/lib/slug'
import {
  looksLikeName,
  parseContactBits,
  type FlowAnswers,
  type FlowChip,
} from './intent-flow'
import { DEFAULT_DESK_BROKER_FIRST_NAME } from './scripts'

export const SEARCH_HOMES_TOOL = {
  type: 'function',
  name: 'search_homes',
  description:
    'Search active MLS homes by area, beds, baths, price, type, acreage, or features. Active listings only. Property criteria only. Never steer or describe neighborhood character.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Visitor words, e.g. three bedrooms in Sisters' },
    },
    required: ['query'],
  },
} as const

export const SARAH_SEARCH_ALERTS = 'Listing alerts'
export const SARAH_SEARCH_BROKER = 'Connect me'
export const SARAH_SEARCH_BOTH = 'Alerts and a broker'
export const SARAH_SEARCH_SKIP = 'No thanks'

export const HOME_SEARCH_CARD_MAX = 5

const PAGE_OWNED_PARAMS = new Set(['city', 'subdivision', 'status', 'propertyType', 'propertySubType', 'postalCode'])
const ALLOWED_SEE_ALL_PARAMS = new Set<string>([...ALL_SEARCH_URL_PARAMS, ...PAGE_OWNED_PARAMS])

const BOOLEAN_KEYS = new Set(SEARCH_FIELDS.filter((field) => field.kind === 'boolean').map((field) => field.key))
const CRIT_KEYS = new Set([
  'beds',
  'maxBeds',
  'baths',
  'maxBaths',
  'minPrice',
  'maxPrice',
  'minSqFt',
  'maxSqFt',
  'lotAcresMin',
  'lotAcresMax',
  'propertyType',
  'propertySubType',
  'propertySubTypes',
  'yearBuiltMin',
  'yearBuiltMax',
  'garageMin',
  ...BOOLEAN_KEYS,
])

const KEYWORD_FLUFF = new Set([
  'i',
  "i'm",
  'im',
  'id',
  'ive',
  "i've",
  'we',
  "we're",
  'looking',
  'look',
  'want',
  'need',
  'find',
  'show',
  'please',
  'just',
  'around',
  'maybe',
  'something',
  'homes',
  'home',
  'houses',
  'house',
  'listings',
  'listing',
])

const BUYER_LOOKING_RE =
  /look(?:ing)? for|find (?:me )?(?:a |some )?homes?|show me|search for|any homes|homes in/i

export const FAIR_HOUSING_BAN_RE =
  /\b(safe|family-friendly|quiet|up and coming|good schools|diverse|exclusive|prestigious|crime|demographics|who lives)\b/i

export type HomeSearchCard = {
  href: string
  photoUrl: string | null
  price: string
  beds: number | null
  baths: number | null
  sqft: number | null
  address: string
  city: string | null
  listNumber: string | null
}

export type HomeSearchCriteria = {
  parsed: Record<string, string>
  city?: string
  beds?: string
  baths?: string
  minPrice?: string
  maxPrice?: string
  areaLabel: string
}

export type HomeSearchAnswers = {
  budget?: string
  timeline?: string
  name?: string
  email?: string
  phone?: string
  alertsWanted?: boolean
  connectWanted?: boolean
}

export type HomeSearchStep = 'followup' | 'offers' | 'name' | 'contact' | 'done'

export type HomeSearchState = {
  step: HomeSearchStep
  followUp: 'budget' | 'timing'
  criteria: HomeSearchCriteria
  answers: HomeSearchAnswers
  totalCount: number
  seeAllHref: string
}

export type HomeSearchTurn = {
  reply: string
  voiceSummary: string
  cards: HomeSearchCard[]
  seeAll: { href: string; label: string } | null
  chips: FlowChip[] | null
  capture: boolean
  next: HomeSearchState
}

function brokerName(first: string): string {
  return first.trim() || DEFAULT_DESK_BROKER_FIRST_NAME
}

export function cleanHomeSearchParsed(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...raw }
  delete out.statusFilter
  delete out.status
  if (out.keywords) {
    const kept = out.keywords
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token && !KEYWORD_FLUFF.has(token.toLowerCase()))
    if (kept.length) out.keywords = kept.join(' ')
    else delete out.keywords
  }
  return out
}

export function parseHomeSearch(text: string): Record<string, string> {
  return cleanHomeSearchParsed(parseSearchQuery(text))
}

export function looksLikeHomeSearch(text: string): boolean {
  const q = text.trim()
  if (!q) return false
  const parsed = parseHomeSearch(q)
  const hasPlace = Boolean(parsed.city || parsed.subdivision)
  const hasCrit = Object.keys(parsed).some((key) => CRIT_KEYS.has(key))
  if (hasPlace && hasCrit) return true
  if (hasCrit && BUYER_LOOKING_RE.test(q)) return true
  if (hasPlace && BUYER_LOOKING_RE.test(q)) return true
  return false
}

export function homeSearchSeeAllHref(parsed: Record<string, string>): string {
  const cleaned = cleanHomeSearchParsed(parsed)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(cleaned)) {
    if (!value || !ALLOWED_SEE_ALL_PARAMS.has(key)) continue
    if (key === 'city' && cleaned.city) continue
    if (key === 'subdivision' && cleaned.city && cleaned.subdivision) continue
    params.set(key, value)
  }
  const path = cleaned.city ? homesForSalePath(cleaned.city, cleaned.subdivision) : '/homes-for-sale'
  const qs = params.toString()
  if (!qs) return cleaned.city ? homesForSalePath(cleaned.city) : '/homes-for-sale'
  return `${path}?${qs}`
}

export function criteriaLabel(parsed: Record<string, string>): string {
  const chips = describeParsedSearch(cleanHomeSearchParsed(parsed)).filter((chip) => !KEYWORD_FLUFF.has(chip.toLowerCase()))
  return chips.join(', ') || 'those filters'
}

export function criteriaFromParsed(parsed: Record<string, string>): HomeSearchCriteria {
  const cleaned = cleanHomeSearchParsed(parsed)
  return {
    parsed: cleaned,
    city: cleaned.city,
    beds: cleaned.beds,
    baths: cleaned.baths,
    minPrice: cleaned.minPrice,
    maxPrice: cleaned.maxPrice,
    areaLabel: cleaned.subdivision || cleaned.city || 'Central Oregon',
  }
}

export function followUpKind(parsed: Record<string, string>): 'budget' | 'timing' {
  return parsed.minPrice || parsed.maxPrice ? 'timing' : 'budget'
}

export function followUpAsk(kind: 'budget' | 'timing'): string {
  return kind === 'budget'
    ? "Rough budget, if you have one? Totally fine if you're still figuring that out."
    : 'Any sense of timing? This year, next year, or just looking around is all useful.'
}

function offerChips(): FlowChip[] {
  return [
    { id: 'search-alerts', label: SARAH_SEARCH_ALERTS },
    { id: 'search-broker', label: SARAH_SEARCH_BROKER },
    { id: 'search-both', label: SARAH_SEARCH_BOTH },
    { id: 'search-skip', label: SARAH_SEARCH_SKIP },
  ]
}

export function homesWord(n: number): string {
  return n === 1 ? 'home' : 'homes'
}

export function matchCopy(total: number, shown: number, label: string): { reply: string; voice: string } {
  if (total === 0) {
    return {
      reply: `I didn't find any active homes matching ${label}. We could widen the search, drop a filter, or look in another city.`,
      voice: `No active homes matched ${label}. We can widen the search.`,
    }
  }
  const shownBit = shown === 1 ? 'Here is the one I can show.' : `Here are ${shown}.`
  return {
    reply: `I found ${total} active ${homesWord(total)} matching ${label}. ${shownBit}`,
    voice: `${total} active ${homesWord(total)} matching ${label}. I'm showing ${shown}.`,
  }
}

export function assertFairHousingCopy(text: string): void {
  if (FAIR_HOUSING_BAN_RE.test(text)) {
    throw new Error('Sarah home search copy must stay on property criteria')
  }
  if (text.includes('\u2014') || text.includes('\u2013')) {
    throw new Error('Sarah home search copy must not use em or en dashes')
  }
}

export function applyHomeSearchTurn(
  state: HomeSearchState,
  visitorText: string,
  brokerFirstName = DEFAULT_DESK_BROKER_FIRST_NAME,
): HomeSearchTurn {
  const text = visitorText.trim()
  const broker = brokerName(brokerFirstName)
  const next: HomeSearchState = {
    ...state,
    answers: { ...state.answers },
  }
  const empty = { cards: [] as HomeSearchCard[], seeAll: null as HomeSearchTurn['seeAll'] }

  if (state.step === 'followup') {
    if (state.followUp === 'budget') next.answers.budget = text
    else next.answers.timeline = text
    next.step = 'offers'
    const reply = `Thanks. I can set up listing alerts for new matches, and I can connect you with ${broker}. What works?`
    return { reply, voiceSummary: reply, ...empty, chips: offerChips(), capture: false, next }
  }

  if (state.step === 'offers') {
    const alerts = text === SARAH_SEARCH_ALERTS || text === SARAH_SEARCH_BOTH || /alert/i.test(text)
    const connect = text === SARAH_SEARCH_BROKER || text === SARAH_SEARCH_BOTH || /connect|broker/i.test(text)
    const skip = text === SARAH_SEARCH_SKIP || /^(no|nope|not now|later|skip|nah|no thanks)\b/i.test(text)
    if (skip && !alerts && !connect) {
      next.step = 'done'
      const reply = `No problem. ${broker} can pick this up later if you want.`
      return { reply, voiceSummary: reply, ...empty, chips: null, capture: false, next }
    }
    next.answers.alertsWanted = alerts
    next.answers.connectWanted = connect || !alerts
    next.step = 'name'
    const reply = `Great. What's a good name for you?`
    return { reply, voiceSummary: reply, ...empty, chips: null, capture: false, next }
  }

  if (state.step === 'name') {
    if (!looksLikeName(text)) {
      const reply = 'Just a first name is fine.'
      return { reply, voiceSummary: reply, ...empty, chips: null, capture: false, next }
    }
    next.answers.name = text
    next.step = 'contact'
    const reply = `Thanks, ${text.split(/\s+/)[0]}. What's an email or phone ${broker} can use? Either one works.`
    return { reply, voiceSummary: reply, ...empty, chips: null, capture: false, next }
  }

  if (state.step === 'contact') {
    const bits = parseContactBits(text)
    if (!bits.email && !bits.phone) {
      const reply = `I need an email or a phone so ${broker} can follow up. Whichever you prefer.`
      return { reply, voiceSummary: reply, ...empty, chips: null, capture: false, next }
    }
    next.answers.email = bits.email ?? next.answers.email
    next.answers.phone = bits.phone ?? next.answers.phone
    next.step = 'done'
    const reply = `I've saved that for ${broker}. ${next.answers.alertsWanted ? 'We can set up those listing alerts from there. ' : ''}Want me to connect you now?`
    return {
      reply,
      voiceSummary: reply,
      ...empty,
      chips: [
        { id: 'handoff-call', label: 'Call' },
        { id: 'handoff-text', label: 'Text' },
        { id: 'handoff-email', label: 'Email' },
        { id: 'handoff-skip', label: SARAH_SEARCH_SKIP },
      ],
      capture: true,
      next,
    }
  }

  const reply = `I can keep looking, or ${broker} can follow up when you're ready.`
  next.step = 'done'
  return { reply, voiceSummary: reply, ...empty, chips: null, capture: false, next }
}

export function homeSearchFlowAnswers(state: HomeSearchState): FlowAnswers {
  return {
    area: state.criteria.areaLabel,
    beds: state.criteria.beds,
    budget: state.answers.budget ?? state.criteria.maxPrice ?? state.criteria.minPrice,
    timeline: state.answers.timeline,
    name: state.answers.name,
    email: state.answers.email,
    phone: state.answers.phone,
  }
}

export function homeSearchCaptureTags(state: HomeSearchState): string[] {
  const tags = [
    'source:sarah-chat',
    'captured:by-sarah',
    'sarah:intent-buyer',
    'audience:buyer',
    state.criteria.areaLabel ? `area:${slugify(state.criteria.areaLabel)}` : null,
    state.criteria.beds ? `beds:${state.criteria.beds}` : null,
    state.answers.budget || state.criteria.maxPrice
      ? `budget:${slugify(state.answers.budget ?? state.criteria.maxPrice ?? '')}`
      : null,
  ]
  return tags.filter((tag): tag is string => Boolean(tag))
}
