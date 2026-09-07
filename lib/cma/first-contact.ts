/**
 * First-contact copy for a delivered CMA, by origin (Matt 2026-09-04, letter
 * lock 2026-09-05, personalization + de-pandering pass 2026-09-07).
 *
 * Pricing is identical across origins. Only the opening changes, and only to
 * say truthfully why we are writing. Expired and FSBO get a full letter:
 * who we are, why we wrote, the numbers, an offer to walk through them, the
 * site, and a place page when we have one. Asked reports skip the relist
 * ask because they already came to us.
 *
 * The opener carries the subject's own listingHistoryLine (dated list price,
 * cuts, days on market — lib/cma/listing-history-line.ts) when the MLS row
 * has it, so the letter proves we looked at THIS listing instead of stating
 * a generic fact that fits any expired home. Missing data omits the clause;
 * never invented (CLAUDE.md §0).
 *
 * Voice: marketing_brain_skills/brand-voice/VOICE.md. Write to one person,
 * say the fact, stop. Zero mannered prose / corporate syrup. No stock
 * apology, no "we hope to earn your business" — Matt 2026-09-07: state
 * what happened, make a direct first-person ask. No em dash, no semicolon,
 * no exclamation. We after the signed intro. No prior-agent blame. Never
 * print CMA.
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
  /** Subject's dated list/cut/off-market history line (lib/cma/listing-history-line.ts).
   *  Never invented — null when the MLS row lacked the facts to build one. */
  listingHistoryLine?: string | null
}

/** The one close every origin shares. The send rail appends the report URL to it. */
const CLOSE = 'The report is attached as a PDF.'

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
    return 'This is Matt Ryan, owner of Ryan Realty in Bend.'
  }
  return `This is ${name} with Ryan Realty in Bend.`
}

/** listingHistoryLine joins its DOM clause with ' · ' for table display. In
 *  letter prose that reads as a data artifact, so it becomes a comma clause. */
function proseHistoryLine(historyLine: string | null): string | null {
  const t = trim(historyLine)
  return t ? t.replace(' · ', ', ') : null
}

function planFor(origin: CmaOrigin, named: string, historyLine: string | null): string {
  if (origin === 'expired') {
    // Matt directive 2026-09-07: the specific facts ARE the authenticity —
    // no stock apology, no empathy theater. State what actually happened.
    const line = proseHistoryLine(historyLine)
    if (line) return `${named}: ${line} It did not sell.`
    return `${named} came off the market without a sale.`
  }
  if (origin === 'fsbo') {
    const line = proseHistoryLine(historyLine)
    if (line) return `${named}: ${line} You are listing it yourself.`
    return `You are selling ${named} yourself.`
  }
  return `The number for ${named}, and the sales that set it.`
}

function closeFor(): string {
  return CLOSE
}

function offerFor(origin: CmaOrigin): string {
  // Matt directive 2026-09-07: no "we hope to earn your business" — plain
  // first-person ask, the way a broker who actually wants the listing talks.
  if (origin === 'expired') {
    return 'I would like a shot at this one. Reply or call and I will walk you through the numbers.'
  }
  if (origin === 'fsbo') {
    return 'I would like the chance to help you sell it. Reply or call and I will walk you through the numbers.'
  }
  return 'Reply or call to walk through the numbers.'
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
  return `${place.label}: ${publicHref(place.href)}.`
}

function resourceParagraphs(origin: CmaOrigin, facts: CmaFirstContactFacts): string[] {
  const out: string[] = []
  if (!isAskedOrigin(origin)) {
    out.push(`You can read reviews and see who we are at ${REVIEWS_HREF} and ${ABOUT_HREF}.`)
  }
  const area = areaLine(facts)
  if (area) out.push(area)
  return out
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
  const plan = planFor(origin, named, facts.listingHistoryLine ?? null)
  // The plan sentence already names the final list price when it draws on
  // listingHistoryLine (expired/fsbo). Restating it as "Last list was $X" in
  // the numbers clause repeats the same figure two sentences apart.
  const planStatedPrice = (origin === 'expired' || origin === 'fsbo') && Boolean(proseHistoryLine(facts.listingHistoryLine ?? null))
  const numbers = composeInboundNumbersClause(planStatedPrice ? { ...facts, lastListPrice: null } : facts)
  const close = closeFor()
  const offer = offerFor(origin)
  const bodyText = [
    greeting,
    intro,
    plan,
    numbers,
    close,
    offer,
    ...resourceParagraphs(origin, facts),
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
    listingHistoryLine: strField(subject?.listingHistoryLine),
  }
}
