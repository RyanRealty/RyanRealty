/**
 * First-contact copy for a delivered CMA, by origin.
 *
 * Matt, 2026-09-09, after two clipped drafts: "We're professionals. We're
 * sorry their home didn't sell. This is a big deal. This is someone's home.
 * We're not going to say, 'Hey, your home came off the market. Here's what we
 * got.'" His own expired letter is the register for every lane: who we are,
 * sorry it did not sell, the pricing philosophy, the most knowledgeable
 * brokers in Central Oregon, the analysis, the ask to earn their business,
 * and best of luck. The numbers paragraph, the report paragraph and the place
 * page are what he kept from the 2026-09-09 draft. Links in the letter are
 * words. Hrefs here are clean ryan-realty.com URLs, with no UTM params.
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
import type { FirstContactPlace } from '@/lib/cma/first-contact-place'
import { isAskedOrigin, type CmaOrigin } from '@/lib/cma/origin'
import { formatFirstTouchUsd } from '@/lib/crm/first-touch-copy'
import {
  cleanFirstPartyHref,
  paragraphsToMarkers,
  paragraphsToPlain,
  type FirstContactRun,
} from '@/lib/cma/first-contact-render'

const PUBLIC_SITE = 'https://ryan-realty.com'
const ABOUT_HREF = `${PUBLIC_SITE}/about`
const REVIEWS_HREF = `${PUBLIC_SITE}/reviews`
const SELL_HREF = `${PUBLIC_SITE}/sell?from=cma`

function publicHref(href: string): string {
  return cleanFirstPartyHref(href)
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
  city?: string | null
  subdivision?: string | null
  neighborhoodName?: string | null
  neighborhoodSlug?: string | null
  /** Priced closed sales in the document (`cmas.comps_count`). */
  closedSalesCount?: number | null
  salesScope?: CmaSalesScope | null
  /**
   * Resolved by `resolveFirstContactPlace` before composing: the subdivision page
   * only when the plat renders, with the counts that page prints, and the wider
   * place (neighborhood or city). Null or missing → no place links at all.
   */
  place?: FirstContactPlace | null
  /** Report path is /cma/<slug>. The email campaign is stamped at render, not here. */
  cmaSlug?: string | null
  brokerSlug?: string | null
  personId?: number | null
}

/**
 * The report's first sentence, and the words that link to /cma/<slug>.
 * Empty the line to drop it. The report button still carries the link.
 */
export const CMA_REPORT_ONLINE_LINK_PHRASE = 'read it online'
export const CMA_REPORT_ONLINE_LINE =
  'The full report is attached as a PDF, and you can also read it online.'

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

/**
 * Where the last ask sits against the same hero band the letter prints
 * (`valueLow` / `valueHigh`). Anything else called the ask "inside" as long
 * as it was not 1% above the high, which is how $725k under a $734k low
 * became "inside what those sales support".
 */
export function lastAskVersusHeroBand(
  last: number,
  valueLow: number,
  valueHigh: number,
): 'below' | 'inside' | 'above' {
  const lo = Math.min(valueLow, valueHigh)
  const hi = Math.max(valueLow, valueHigh)
  if (last < lo) return 'below'
  if (last > hi) return 'above'
  return 'inside'
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
    const asked = origin === 'fsbo' ? 'You are asking' : 'The last listing asked'
    const vs = lastAskVersusHeroBand(last, lo, hi)
    if (vs === 'below') {
      sentences.push(`${asked} ${formatFirstTouchUsd(last)}, below what those sales support.`)
      if (rec != null && rec <= last) {
        sentences.push('Price was not what held it back.')
      }
    } else if (vs === 'above') {
      const pct = Math.round((last / hi - 1) * 100)
      if (pct >= 5) {
        sentences.push(`${asked} ${formatFirstTouchUsd(last)}, about ${pct}% above what those sales support.`)
        sentences.push(
          origin === 'fsbo'
            ? 'That is worth knowing before an offer comes in.'
            : 'That gap is usually the whole story, and it says nothing bad about the house.',
        )
      } else {
        sentences.push(`${asked} ${formatFirstTouchUsd(last)}, a little above what those sales support.`)
      }
    } else {
      sentences.push(`${asked} ${formatFirstTouchUsd(last)}, inside what those sales support.`)
    }
  }
  sentences.push(`We would recommend listing at ${formatFirstTouchUsd(rec)}.`)
  return sentences.filter((s): s is string => Boolean(s)).join(' ')
}

/** Matt's pricing philosophy, in his words, on every lane and in every letter we send. */
export const CMA_PRICING_PHILOSOPHY =
  "In today's market, the price is everything. Priced too high, a home sits, and every week it sits weakens your position when an offer finally comes. Priced right, it draws real activity and often more than one offer, so pricing low is rarely the danger people think it is. That line is a fine one, and finding it takes brokers who know exactly what is happening around your home. We believe we are the most knowledgeable brokers in Central Oregon when it comes to market performance, and that is what went into this analysis."

export function firstContactReportRuns(
  origin: CmaOrigin,
  href: string | null,
  line: string = CMA_REPORT_ONLINE_LINE,
  phrase: string = CMA_REPORT_ONLINE_LINK_PHRASE,
): FirstContactRun[] {
  const rivals =
    origin === 'fsbo'
      ? 'who you are competing with right now at that price'
      : 'who you would be competing with right now at that price'
  const rest = `It walks through each of those sales, the listings near you that did not sell and what happened to their prices, and ${rivals}. Every address in it links back to our site if you want to look closer.`
  const lead = line.trim()
  const words = phrase.trim()
  if (!lead) return [rest]
  const at = words ? lead.indexOf(words) : -1
  if (at >= 0 && href) {
    return [lead.slice(0, at), { text: words, href }, `${lead.slice(at + words.length)} ${rest}`]
  }
  return [`${lead} ${rest}`]
}

function reportHref(facts: CmaFirstContactFacts): string | null {
  const slug = trim(facts.cmaSlug)
  return slug ? `${PUBLIC_SITE}/cma/${slug}` : null
}

const ASK_LINKS: FirstContactRun[] = [
  'You can ',
  { text: 'see how we sell homes', href: SELL_HREF },
  ', ',
  { text: 'read our reviews', href: REVIEWS_HREF },
  ', and ',
  { text: 'learn about our business', href: ABOUT_HREF },
  '.',
]

function askRuns(origin: CmaOrigin): FirstContactRun[] {
  if (origin === 'expired') {
    return [
      'Again, we are sorry your home did not sell. Nothing about that points to a problem with the house itself. Over the past few months the market has been shifting in a way that has been less favorable for sellers, and that has made it harder for good homes to sell at the prices they would have brought before. If you are ever considering selling in the future, we would love the opportunity to earn your business. ',
      ...ASK_LINKS,
    ]
  }
  if (origin === 'fsbo') {
    return [
      'If at some point you would rather have someone handle the showings, the paperwork and the negotiation, we would love the opportunity to earn your business. ',
      ...ASK_LINKS,
    ]
  }
  return ['If you are considering selling, we would love the opportunity to earn your business. ', ...ASK_LINKS]
}

function honestNote(origin: CmaOrigin): string | null {
  if (!isAskedOrigin(origin)) return null
  return 'The range is what the sales support, not a promise. The right list price also depends on the condition of the home, and we would want to walk it before putting a number in front of a buyer.'
}

/**
 * The subdivision, then the wider place. Matt 2026-09-09: show we are true market
 * experts by diving into the subdivision they are in, not just the neighborhood,
 * then the broader picture it sits in. Every count is the one the subdivision page
 * prints, and a subdivision link appears only when that page renders.
 */
function placeRuns(facts: CmaFirstContactFacts): FirstContactRun[] | null {
  const place = facts.place ?? null
  if (!place) return null
  const sub = place.subdivision
  const wider = place.wider
  const runs: FirstContactRun[] = []
  if (sub) {
    const counts: string[] = []
    // The instrument's twelve-month figures when the page publishes them; else
    // the "Closed sales in {name}" figures, this year to date and since the
    // first recorded year. Both are the page's own words for the same plat.
    if (sub.closed12mo != null && sub.closed12mo > 0) {
      counts.push(`${countWord(sub.closed12mo)} ${sub.closed12mo === 1 ? 'home' : 'homes'} sold in the last twelve months`)
    } else if (sub.history && sub.history.closedThisYear != null && sub.history.closedThisYear > 0) {
      counts.push(
        `${countWord(sub.history.closedThisYear)} ${sub.history.closedThisYear === 1 ? 'home has' : 'homes have'} sold so far in ${sub.history.thisYear}`,
      )
    }
    if (sub.history && sub.history.closedSince > 0 && (counts.length === 0 || sub.history.closedSince > (sub.history.closedThisYear ?? 0))) {
      counts.push(`${sub.history.closedSince.toLocaleString('en-US')} have closed there since ${sub.history.sinceYear}`)
    }
    if (sub.active != null && sub.active > 0) {
      counts.push(`${countWord(sub.active)} ${sub.active === 1 ? 'is' : 'are'} for sale right now`)
    }
    if (sub.pending != null && sub.pending > 0) {
      counts.push(`${countWord(sub.pending)} ${sub.pending === 1 ? 'is' : 'are'} under contract`)
    }
    // SITE-55: the half that matters most to a seller whose own listing came
    // off. Same MV the plat page reads, so the letter and the page cannot
    // disagree. Zero is worth saying out loud. It is the strongest version of
    // this sentence when it is true.
    if (sub.unsold12mo != null && sub.unsold12mo > 0) {
      counts.push(
        `${countWord(sub.unsold12mo)} came off the market without selling`,
      )
    }
    if (counts.length) {
      const joined = counts.length === 1 ? counts[0]! : `${counts.slice(0, -1).join(', ')}, and ${counts[counts.length - 1]!}`
      runs.push(`In ${sub.label} itself, ${joined}. `)
      if (sub.unsold12mo === 0) {
        runs.push('Every home that came off the market there in that stretch sold. ')
      }
      runs.push('Our ', { text: `${sub.label} page`, href: publicHref(sub.href) }, ' keeps the running picture, what is for sale there, what has sold, and what did not.')
    } else {
      runs.push('Our ', { text: `${sub.label} page`, href: publicHref(sub.href) }, ' has the running picture.')
    }
    if (wider) {
      runs.push(' The ', { text: `${wider.label} page`, href: publicHref(wider.href) }, ' shows the wider market it sits in.')
    }
    return runs
  }
  if (wider) {
    return ['Our ', { text: `${wider.label} page`, href: publicHref(wider.href) }, ' has the wider market.']
  }
  return null
}

/**
 * Matt 2026-09-09: "we will always use my signature from the system." The rail
 * appends `buildSignature` (Gmail-synced, else the broker's saved signature,
 * else the generated identity block, always with the Oregon pamphlet line), so
 * the letter never prints a phone, an email or a name of its own. The closing
 * is his: questions, and best of luck.
 */
function closingFor(origin: CmaOrigin): string {
  if (origin === 'expired') return 'Please let me know if you have any questions. Best of luck in the future.'
  if (origin === 'fsbo') return 'Please let me know if you have any questions. Best of luck with the sale.'
  return 'Please let me know if you have any questions.'
}

export function cmaFirstContactPreview(origin: CmaOrigin, address: string | null): string {
  const named = streetOnly(address) ?? 'this home'
  if (origin === 'expired') return `We're sorry your home didn't sell. Our market analysis for ${named} is inside.`
  if (origin === 'fsbo') return `A second set of numbers for ${named}, no charge and no strings.`
  return `${named}: the number, and the sales behind it.`
}

export type CmaFirstContactCopy = InboundValuationCopy & {
  /** Words and clean hrefs. bodyText is the plain reading of this. */
  paragraphs: FirstContactRun[][]
  /** Same letter with [words](href) markers, for a round trip through the renderer. */
  bodyMarkers: string
}

function pushParagraph(out: FirstContactRun[][], runs: FirstContactRun[] | null | undefined): void {
  if (!runs || !paragraphsToPlain([runs])) return
  out.push(runs)
}

/**
 * Origin-aware first-contact copy. bodyText is words only. The report URL is
 * a link on "read it online" when CMA_REPORT_ONLINE_LINE still contains that
 * phrase, and always the report button at send. The rail does not splice a URL.
 */
export function composeCmaFirstContact(
  origin: CmaOrigin,
  facts: CmaFirstContactFacts,
): CmaFirstContactCopy {
  const greeting = 'Hi there,'
  const named = streetOnly(facts.address) ?? 'this home'
  const intro = introFor(facts.brokerName ?? null)
  const plan = planFor(origin, named)
  const numbers = composeFirstContactNumbers(origin, facts)
  const close = CMA_REPORT_ONLINE_LINE.trim()
  const paragraphs: FirstContactRun[][] = []
  pushParagraph(paragraphs, [greeting])
  pushParagraph(paragraphs, [`${intro} ${plan}`])
  if (numbers) pushParagraph(paragraphs, [numbers])
  pushParagraph(paragraphs, [CMA_PRICING_PHILOSOPHY])
  pushParagraph(paragraphs, firstContactReportRuns(origin, reportHref(facts)))
  const note = honestNote(origin)
  if (note) pushParagraph(paragraphs, [note])
  pushParagraph(paragraphs, askRuns(origin))
  pushParagraph(paragraphs, placeRuns(facts))
  pushParagraph(paragraphs, [closingFor(origin)])
  const bodyText = paragraphsToPlain(paragraphs)
  return {
    subject: composeCmaFirstContactSubject(origin, facts.address),
    previewText: cmaFirstContactPreview(origin, facts.address),
    mastheadLine: 'THIS HOME',
    greeting,
    plan,
    numbers,
    close,
    bodyText,
    paragraphs,
    bodyMarkers: paragraphsToMarkers(paragraphs),
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
  extra?: {
    brokerName?: string | null
    firstName?: string | null
    lastListPrice?: number | null
    place?: FirstContactPlace | null
    brokerSlug?: string | null
    personId?: number | null
  },
): CmaFirstContactFacts {
  const args = asRecord(row.render_args)
  const subject = asRecord(args?.subject)
  const market = asRecord(args?.market)
  const summary = asRecord(row.build_summary)
  const selection = asRecord(summary?.comp_selection)
  return {
    address: strField(row.subject_address),
    firstName: extra?.firstName ?? null,
    valueLow: moneyField(row.value_low),
    valueHigh: moneyField(row.value_high),
    recommendedList: moneyField(row.recommended_list),
    lastListPrice: extra?.lastListPrice ?? null,
    brokerName: extra?.brokerName ?? null,
    city: strField(row.subject_city) ?? strField(subject?.city),
    subdivision: strField(row.subject_subdivision) ?? strField(subject?.subdivision),
    neighborhoodName: strField(market?.geoLabel),
    neighborhoodSlug: strField(market?.geoSlug),
    closedSalesCount: countField(row.comps_count),
    salesScope: salesScopeFromTierCounts(selection?.final_tier_counts),
    place: extra?.place ?? null,
    cmaSlug: strField(row.slug),
    brokerSlug: extra?.brokerSlug ?? null,
    personId: extra?.personId ?? null,
  }
}
