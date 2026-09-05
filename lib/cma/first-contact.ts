/**
 * First-contact copy for a delivered CMA, by origin (Matt 2026-09-04, letter
 * lock 2026-09-05).
 *
 * Pricing is identical across origins. Only the opening changes, and only to
 * say truthfully why we are writing. Expired and FSBO get a full letter:
 * who we are, why we wrote, the numbers, an offer to walk through them, the
 * site, and a place page when we have one. Asked reports skip the relist
 * ask because they already came to us.
 *
 * Voice: marketing_brain_skills/brand-voice/VOICE.md. Write to one person,
 * say the fact, stop. No em dash, no semicolon, no exclamation. We after
 * the signed intro. No prior-agent blame. Never print CMA.
 */

import { composeInboundNumbersClause, type InboundPacketFacts, type InboundValuationCopy } from '@/lib/cma/inbound-packet'
import { primaryCmaPlaceLink } from '@/lib/cma/cma-place-links'
import { isAskedOrigin, type CmaOrigin } from '@/lib/cma/origin'

const PUBLIC_SITE = 'https://ryan-realty.com'
const ABOUT_HREF = `${PUBLIC_SITE}/about`
const REVIEWS_HREF = `${PUBLIC_SITE}/reviews`

function publicHref(href: string): string {
  try {
    const u = new URL(href)
    return `${PUBLIC_SITE}${u.pathname}${u.search}`
  } catch {
    return href
  }
}

function trim(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s || null
}

export type CmaFirstContactFacts = InboundPacketFacts & {
  brokerName?: string | null
  city?: string | null
  subdivision?: string | null
  neighborhoodName?: string | null
  neighborhoodSlug?: string | null
}

/** The one close every origin shares. The send rail appends the report URL to it. */
const CLOSE_ASKED = 'The report is attached as a PDF. You can also read it online.'
const CLOSE_EXPIRED =
  'The report is attached as a PDF. It covers the sales that set the number, what happened on the listing, and what you would net at the recommended list.'
const CLOSE_FSBO =
  'The report is attached as a PDF. It covers the sales that set the number and the homes competing with yours right now.'

export function composeCmaFirstContactSubject(origin: CmaOrigin, address: string | null): string {
  const named = trim(address)
  if (!named) return 'Your report on this home'
  if (origin === 'expired') return `${named}, and what sold while it was listed`
  if (origin === 'fsbo') return `${named}, and what it is competing with`
  return `Your report on ${named}`
}

function introFor(brokerName: string | null): string {
  const name = trim(brokerName) ?? 'Matt Ryan'
  if (/^matt ryan$/i.test(name)) {
    return 'This is Matt Ryan, owner of Ryan Realty in Bend. We are a boutique brokerage.'
  }
  return `This is ${name} with Ryan Realty in Bend. We are a boutique brokerage.`
}

function planFor(origin: CmaOrigin, named: string): string {
  if (origin === 'expired') {
    return `Your listing on ${named} came off the market without a sale. We spent time on why, and on what the closed sales nearby support now.`
  }
  if (origin === 'fsbo') {
    return `You are selling ${named} yourself. We built a read on what the closed sales support, and what a buyer shopping that price is seeing instead.`
  }
  return `The number for ${named}, and the sales that set it.`
}

function closeFor(origin: CmaOrigin): string {
  if (origin === 'expired') return CLOSE_EXPIRED
  if (origin === 'fsbo') return CLOSE_FSBO
  return CLOSE_ASKED
}

function offerFor(origin: CmaOrigin): string {
  if (origin === 'expired') {
    return 'If you list again we would like the work. If anything in those numbers is unclear, reply or call and we will walk through how we got there.'
  }
  if (origin === 'fsbo') {
    return 'If you decide to list with us we would like the work. If anything in those numbers is unclear, reply or call and we will walk through how we got there.'
  }
  return 'If anything in those numbers is unclear, reply or call and we will walk through how we got there.'
}

function areaLine(facts: CmaFirstContactFacts): string | null {
  const city = trim(facts.city)
  const nName = trim(facts.neighborhoodName)
  const nSlug = trim(facts.neighborhoodSlug)
  const citySlug = city ? city.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
  const nKey = nSlug ? nSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
  const inNabe = Boolean(city && nName && nKey && nKey !== citySlug)
  const place = primaryCmaPlaceLink({
    city,
    subdivisionName: facts.subdivision,
    neighborhoodName: inNabe ? nName : null,
    neighborhoodSlug: inNabe ? nSlug : null,
    inMappedNeighborhood: inNabe,
  })
  if (!place) return null
  return `If you want to see what is selling in ${place.label}, that page is ${publicHref(place.href)}.`
}

function resourceParagraphs(origin: CmaOrigin, facts: CmaFirstContactFacts): string[] {
  const out: string[] = []
  if (!isAskedOrigin(origin)) {
    out.push(`Reviews are at ${REVIEWS_HREF}. Who we are is at ${ABOUT_HREF}.`)
  }
  const area = areaLine(facts)
  if (area) out.push(area)
  return out
}

function wishFor(origin: CmaOrigin): string {
  if (origin === 'expired' || origin === 'fsbo') {
    return 'Call anytime if you want to talk about the report or how we sell homes. We wish you the best with the house either way.'
  }
  return 'Call anytime if you want to talk about the report or how we sell homes.'
}

export function cmaFirstContactPreview(origin: CmaOrigin, address: string | null): string {
  const named = trim(address) ?? 'this home'
  if (origin === 'expired') return `${named}: the number now, and what sold while it was listed.`
  if (origin === 'fsbo') return `${named}: the number, and what it is competing with.`
  return `${named}: the number, then the sales that set it.`
}

/**
 * Origin-aware first-contact copy, shaped so `close` stays a distinct string
 * that appears verbatim in `bodyText` — the rail splices the report URL onto it.
 */
export function composeCmaFirstContact(
  origin: CmaOrigin,
  facts: CmaFirstContactFacts,
): InboundValuationCopy {
  const first = trim(facts.firstName) ?? 'there'
  const greeting = `Hi ${first},`
  const named = trim(facts.address) ?? 'this home'
  const intro = introFor(facts.brokerName ?? null)
  const plan = planFor(origin, named)
  const numbers = composeInboundNumbersClause(facts)
  const close = closeFor(origin)
  const offer = offerFor(origin)
  const wish = wishFor(origin)
  const bodyText = [
    greeting,
    intro,
    plan,
    numbers,
    close,
    offer,
    ...resourceParagraphs(origin, facts),
    wish,
  ]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join('\n\n')
    .trim()

  return {
    subject: composeCmaFirstContactSubject(origin, facts.address),
    previewText: cmaFirstContactPreview(origin, facts.address),
    mastheadLine: 'THIS HOME',
    greeting,
    plan,
    numbers,
    close,
    bodyText,
  }
}

/** True when the recipient asked for this value, so the copy may assume it. */
export function firstContactAssumesRequest(origin: CmaOrigin): boolean {
  return isAskedOrigin(origin)
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function strField(v: unknown): string | null {
  return trim(typeof v === 'string' ? v : v == null ? '' : String(v))
}

function moneyField(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Pull letter merge fields off a cmas row without inventing a place. */
export function cmaFirstContactFactsFromRow(
  row: Record<string, unknown>,
  extra?: { brokerName?: string | null; firstName?: string | null; lastListPrice?: number | null },
): CmaFirstContactFacts {
  const args = asRecord(row.render_args)
  const subject = asRecord(args?.subject)
  const market = asRecord(args?.market)
  const clientName = strField(row.client_name)
  return {
    address: strField(row.subject_address),
    firstName: extra?.firstName ?? (clientName ? clientName.split(/\s+/)[0] ?? null : null),
    valueLow: moneyField(row.value_low),
    valueHigh: moneyField(row.value_high),
    recommendedList: moneyField(row.recommended_list),
    lastListPrice: extra?.lastListPrice ?? null,
    brokerName: extra?.brokerName ?? null,
    city: strField(row.subject_city) ?? strField(subject?.city),
    subdivision: strField(row.subject_subdivision) ?? strField(subject?.subdivision),
    neighborhoodName: strField(market?.geoLabel),
    neighborhoodSlug: strField(market?.geoSlug),
  }
}
