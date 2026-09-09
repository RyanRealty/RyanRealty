/**
 * First-contact copy for a delivered CMA, by origin.
 *
 * Matt, 2026-09-09, after two clipped drafts: "We're professionals. We're
 * sorry their home didn't sell. This is a big deal. This is someone's home.
 * We're not going to say, 'Hey, your home came off the market. Here's what we
 * got.'" His own expired letter is the register for every lane: who we are,
 * sorry it did not sell, the pricing philosophy, the most knowledgeable
 * brokers in Central Oregon, the analysis, the ask to earn their business,
 * a sit-down about how we sell homes, a premium product, the reviews, best
 * of luck. The numbers paragraph, the report paragraph and the place page
 * are what he kept from the 2026-09-09 draft.
 *
 * Every figure is off the cmas row (value range, recommended list, the count
 * of priced sales and the tier they came from, the last list price). Nothing
 * in here estimates. No mannered prose, no phrasing no one says. The report
 * is described only as what it holds: the sales that set the number, the
 * listings near you that did not sell, and who you are competing with.
 *
 * Voice: marketing_brain_skills/brand-voice/VOICE.md.
 */

import { type InboundPacketFacts, type InboundValuationCopy } from '@/lib/cma/inbound-packet'
import { primaryCmaPlaceLink } from '@/lib/cma/cma-place-links'
import { isAskedOrigin, type CmaOrigin } from '@/lib/cma/origin'
import { formatFirstTouchUsd } from '@/lib/crm/first-touch-copy'

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

/** "2465 7th, Redmond, OR 97756" reads as "2465 7th" inside a sentence. */
export function streetOnly(address: string | null | undefined): string | null {
  const s = trim(address)
  if (!s) return null
  return trim(s.split(',')[0]) ?? s
}

/** Where the priced sales came from, read off the build summary's tier counts. */
export type CmaSalesScope = 'subdivision' | 'near' | 'area'

export type CmaFirstContactFacts = InboundPacketFacts & {
  brokerName?: string | null
  brokerPhone?: string | null
  city?: string | null
  subdivision?: string | null
  neighborhoodName?: string | null
  neighborhoodSlug?: string | null
  /** Priced closed sales in the document (`cmas.comps_count`). */
  closedSalesCount?: number | null
  salesScope?: CmaSalesScope | null
}

/** The one close every origin shares. The send rail appends the report URL to it. */
const CLOSE = 'The full report is attached as a PDF.'

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

export function composeCmaFirstContactSubject(origin: CmaOrigin, address: string | null): string {
  const named = streetOnly(address)
  if (!named) return 'Your report on this home'
  if (origin === 'expired' || origin === 'fsbo') return `A market analysis for ${named}`
  if (origin === 'place-page') return `Your ${named} valuation`
  return `Your report on ${named}`
}

function introFor(brokerName: string | null): string {
  const name = trim(brokerName) ?? 'Matt Ryan'
  if (/^matt ryan$/i.test(name)) {
    return 'My name is Matt Ryan, owner and principal broker of Ryan Realty in Bend.'
  }
  return `My name is ${name}, a broker with Ryan Realty in Bend.`
}

/** Why we are writing. Expired and FSBO say it with respect. Asked reports say thank you. */
function planFor(origin: CmaOrigin, named: string): string {
  if (origin === 'expired') {
    return `We keep tabs on the MLS and noticed your home at ${named} came off the market recently without selling. We're sorry it didn't sell, and we would like the opportunity to earn your business should you decide to relist.`
  }
  if (origin === 'fsbo') {
    return `We noticed your home at ${named} is for sale by owner. We respect that, and a lot of people who sell on their own still want a second set of numbers, so we put one together for you, no charge and no strings.`
  }
  if (origin === 'place-page') {
    return `Thank you for asking what ${named} would sell for. We researched your property and the comparable sales, and here is what we found.`
  }
  return `Thank you for asking what ${named} is worth. We researched your property and the comparable sales, and here is what we found.`
}

function finiteMoney(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

function scopePhrase(facts: CmaFirstContactFacts): string {
  const sub = trim(facts.subdivision)
  if (facts.salesScope === 'subdivision' && sub && !/^n\/a$/i.test(sub)) return `in ${sub}`
  if (facts.salesScope === 'near') return 'near you'
  return 'in your area'
}

/**
 * The numbers, every one off the row. The count and where the sales came from
 * open it when the row carries them. The last list price is set against the
 * range only when it sits above it, and gently: the gap, and that it says
 * nothing bad about the house.
 */
export function composeFirstContactNumbers(origin: CmaOrigin, facts: CmaFirstContactFacts): string | null {
  const lo = finiteMoney(facts.valueLow)
  const hi = finiteMoney(facts.valueHigh)
  const rec = finiteMoney(facts.recommendedList)
  if (lo == null || hi == null || rec == null) return null
  const count = typeof facts.closedSalesCount === 'number' && facts.closedSalesCount > 0 ? facts.closedSalesCount : null
  const range = `${formatFirstTouchUsd(lo)} to ${formatFirstTouchUsd(hi)}`
  let lead: string
  if (count == null) lead = `Closed sales ${scopePhrase(facts)} support ${range}.`
  else if (count === 1) lead = `We found one sale of a home like yours ${scopePhrase(facts)}, and it supports ${range}.`
  else lead = `We found ${countWord(count)} sales of homes like yours ${scopePhrase(facts)}, and they support ${range}.`
  const sentences = [origin === 'expired' || origin === 'fsbo' ? 'We researched your property and the comparable sales to see what we would do to get a better result.' : null, lead]
  const last = finiteMoney(facts.lastListPrice)
  if (last != null) {
    const pct = Math.round((last / hi - 1) * 100)
    const asked = origin === 'fsbo' ? 'You are asking' : 'The last listing asked'
    if (pct >= 5) {
      sentences.push(`${asked} ${formatFirstTouchUsd(last)}, about ${pct}% above what those sales support.`)
      sentences.push(
        origin === 'fsbo'
          ? 'That is worth knowing before an offer comes in.'
          : 'That gap is usually the whole story, and it says nothing bad about the house.',
      )
    } else if (pct >= 1) {
      sentences.push(`${asked} ${formatFirstTouchUsd(last)}, a little above what those sales support.`)
    } else {
      sentences.push(`${asked} ${formatFirstTouchUsd(last)}, inside what those sales support.`)
    }
  }
  sentences.push(`We would recommend listing at ${formatFirstTouchUsd(rec)}.`)
  return sentences.filter((s): s is string => Boolean(s)).join(' ')
}

/** Matt's pricing philosophy, in his words, on every lane and in every letter we send. */
export const CMA_PRICING_PHILOSOPHY =
  'One of the most important things in today\'s market is nailing the price. Price too high and the home sits, and the longer it sits the harder it is to negotiate. There is no such thing as pricing too low. You want it priced just right so it draws enough activity to bring, hopefully, multiple offers. It is a fine line, and it takes real expertise on what is going on in the market. We feel we have the most knowledgeable brokers in Central Oregon when it comes to market performance, and that is what went into the analysis attached.'

function reportParagraph(origin: CmaOrigin): string {
  const rivals =
    origin === 'fsbo' ? 'who you are competing with right now at that price' : 'who you would be competing with right now at that price'
  return `${CLOSE} It walks through each of those sales, the listings near you that did not sell and what happened to their prices, and ${rivals}. Every address in it links back to our site if you want to look closer.`
}

function whatYouGet(facts: CmaFirstContactFacts): string {
  const city = trim(facts.city)
  const where = city ? `${city} street by street` : 'Central Oregon street by street'
  return `We feel we offer a premium product: local brokers who know ${where}, current market data behind every decision, careful negotiation, and a broker with you from the first conversation through closing.`
}

function askFor(origin: CmaOrigin, facts: CmaFirstContactFacts): string {
  const sitDown = 'We could sit down, or take fifteen minutes on the phone, and talk about how we sell homes.'
  const proof = `${whatYouGet(facts)} You can read our reviews at ${REVIEWS_HREF} and see who we are at ${ABOUT_HREF}.`
  if (origin === 'expired') {
    return `Again, we are sorry your home did not sell. If you are ever considering selling in the future, we would love the opportunity to earn your business. ${sitDown} ${proof}`
  }
  if (origin === 'fsbo') {
    return `If at some point you would rather have someone handle the showings, the paperwork and the negotiation, we would love the opportunity to earn your business. ${sitDown} ${proof}`
  }
  return `If you are considering selling, we would love the opportunity to earn your business. ${sitDown} ${proof}`
}

function honestNote(origin: CmaOrigin): string | null {
  if (!isAskedOrigin(origin)) return null
  return 'The range is what the sales support, not a promise. The right list price also depends on the condition of the home, and we would want to walk it before putting a number in front of a buyer.'
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
  return `Our page on ${place.label} is at ${publicHref(place.href)}.`
}

function closingFor(origin: CmaOrigin, facts: CmaFirstContactFacts): string {
  const phone = trim(facts.brokerPhone)
  const reach = phone ? `Reply to this email or call or text me at ${phone}.` : 'Reply to this email or give me a call.'
  if (origin === 'expired') return `Please let me know if you have any questions. ${reach} Best of luck in the future.`
  if (origin === 'fsbo') return `Please let me know if you have any questions. ${reach} Best of luck with the sale.`
  return `Please let me know if you have any questions. ${reach}`
}

export function cmaFirstContactPreview(origin: CmaOrigin, address: string | null): string {
  const named = streetOnly(address) ?? 'this home'
  if (origin === 'expired') return `We're sorry your home didn't sell. Our market analysis for ${named} is inside.`
  if (origin === 'fsbo') return `A second set of numbers for ${named}, no charge and no strings.`
  return `${named}: the number, and the sales behind it.`
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
  const named = streetOnly(facts.address) ?? 'this home'
  const intro = introFor(facts.brokerName ?? null)
  const plan = planFor(origin, named)
  const numbers = composeFirstContactNumbers(origin, facts)
  const close = CLOSE
  const bodyText = [
    greeting,
    `${intro} ${plan}`,
    numbers,
    CMA_PRICING_PHILOSOPHY,
    reportParagraph(origin),
    honestNote(origin),
    askFor(origin, facts),
    areaLine(facts),
    closingFor(origin, facts),
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

function countField(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const LOCAL_TIER = /^(subdivision-|adjacent-subdivision-|neighborhood-|similar-sub-|nearby-[12]mi-)/

/**
 * Where the priced sales came from, off `build_summary.comp_selection.final_tier_counts`
 * (the tier of each PRICED comp, recomputed after the judge and the repair pass).
 * All subdivision rungs → the subdivision by name. All within the local rungs
 * (subdivision, adjacent, neighborhood, similar sub, two miles) → near you.
 * Anything wider → your area. No counts → null, and the sentence falls back.
 */
export function salesScopeFromTierCounts(counts: unknown): CmaSalesScope | null {
  const rec = asRecord(counts)
  if (!rec) return null
  const tiers = Object.entries(rec)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .map(([k]) => k)
  if (!tiers.length) return null
  if (tiers.every((t) => t.startsWith('subdivision-'))) return 'subdivision'
  if (tiers.every((t) => LOCAL_TIER.test(t))) return 'near'
  return 'area'
}

/** Pull letter merge fields off a cmas row without inventing a place. */
export function cmaFirstContactFactsFromRow(
  row: Record<string, unknown>,
  extra?: { brokerName?: string | null; brokerPhone?: string | null; firstName?: string | null; lastListPrice?: number | null },
): CmaFirstContactFacts {
  const args = asRecord(row.render_args)
  const subject = asRecord(args?.subject)
  const market = asRecord(args?.market)
  const summary = asRecord(row.build_summary)
  const selection = asRecord(summary?.comp_selection)
  const clientName = strField(row.client_name)
  return {
    address: strField(row.subject_address),
    firstName: extra?.firstName ?? (clientName ? clientName.split(/\s+/)[0] ?? null : null),
    valueLow: moneyField(row.value_low),
    valueHigh: moneyField(row.value_high),
    recommendedList: moneyField(row.recommended_list),
    lastListPrice: extra?.lastListPrice ?? null,
    brokerName: extra?.brokerName ?? null,
    brokerPhone: extra?.brokerPhone ?? null,
    city: strField(row.subject_city) ?? strField(subject?.city),
    subdivision: strField(row.subject_subdivision) ?? strField(subject?.subdivision),
    neighborhoodName: strField(market?.geoLabel),
    neighborhoodSlug: strField(market?.geoSlug),
    closedSalesCount: countField(row.comps_count),
    salesScope: salesScopeFromTierCounts(selection?.final_tier_counts),
  }
}
