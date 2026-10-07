/**
 * First-contact email for a CMA, by origin.
 *
 * Matt, 2026-10-06: an expired letter is his template. The assigned broker
 * introduces it. Matt owns Ryan Realty. Any other broker works here and does
 * not say they own it. The greeting uses a first name when one is safe. The
 * 3% concession line is his illustration, not this house's measured
 * concession. The letter does not print the sales range, the last ask, the
 * months of supply, the recommended list price, or the acronym CMA. The
 * system signature is the sign-off, so the letter does not add a first name
 * after the close. The report button sits on its own run and reads
 * "See the full market analysis".
 *
 * Every figure is off the cmas row or the city pulse. Nothing in here
 * estimates. Voice: marketing_brain_skills/brand-voice/VOICE.md.
 */

import { type InboundPacketFacts, type InboundValuationCopy } from '@/lib/cma/inbound-packet'
import type { FirstContactPlace } from '@/lib/cma/first-contact-place'
import { isAskedOrigin, type CmaOrigin } from '@/lib/cma/origin'
import { formatFirstTouchUsd } from '@/lib/crm/first-touch-copy'
import { isPlaceholderLeadName, isPlausibleFirstName } from '@/lib/crm/merge'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict } from '@/lib/market/classify'
import {
  EXPIRED_ANALYSIS_BUTTON,
  paragraphsToMarkers,
  paragraphsToPlain,
  type FirstContactRun,
} from '@/lib/cma/first-contact-render'

function trim(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s || null
}

/** A trust, a company, or a placeholder is not a person we greet by name. */
const NOT_A_PERSON =
  /\b(?:LLC|TRUSTEE|TRUST|INC|CORP|LLP|LP|PARTNERSHIP|PROPERTIES|HOLDINGS|ESTATE|BANK|HOA|ASSOC|REVOCABLE|LIVING)\b/i

const NOT_A_GREETING = new Set([
  'owner',
  'owners',
  'homeowner',
  'seller',
  'client',
  'resident',
  'occupant',
  'the',
  'and',
  'mr',
  'mrs',
  'ms',
  'dr',
])

/**
 * A greeting name, or null. "First Last" uses the first word. "LAST, FIRST"
 * uses the word after the comma. A trust, a placeholder lead, or a generic
 * word ("owner", "seller") stays unnamed so the letter says "Hi there,".
 */
export function greetingFirstName(name: string | null | undefined): string | null {
  const raw = (name ?? '').trim().replace(/\s+/g, ' ')
  if (!raw || isPlaceholderLeadName(raw) || NOT_A_PERSON.test(raw)) return null
  const comma = raw.indexOf(',')
  const side = comma >= 0 ? raw.slice(comma + 1) : raw
  const word = (side.trim().split(/\s+/)[0] ?? '').replace(/\.+$/g, '')
  if (!word || NOT_A_GREETING.has(word.toLowerCase())) return null
  if (!isPlausibleFirstName(word)) return null
  return word
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
  /**
   * Served city pulse, `market_pulse_live.months_of_supply` for property type A.
   * Absent means the email does not guess a market.
   */
  monthsOfSupply?: number | null
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
  if (origin === 'expired') return named ? `An analysis of your home at ${named}` : 'An analysis of your home'
  if (!named) return 'Your report on this home'
  if (origin === 'fsbo') return `A market analysis for ${named}`
  if (origin === 'place-page') return `Your ${named} valuation`
  return `Your report on ${named}`
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

function honestNote(origin: CmaOrigin): string | null {
  if (!isAskedOrigin(origin)) return null
  return 'The range is what the sales support, not a promise. The right list price also depends on the condition of the home, and we would want to walk it before putting a number in front of a buyer.'
}

/**
 * Inbox preview. The sold range, when the letter will actually print it.
 * An expired letter does not print the range, so its preview does not either.
 * The recommended list price stays out. An FSBO preview stays free of a dollar.
 */
function salesPreview(named: string, count: number | null, lo: number, hi: number): string {
  const range = `${formatFirstTouchUsd(lo)} to ${formatFirstTouchUsd(hi)}`
  if (count == null) return `${named}: sales support ${range}.`
  const noun = count === 1 ? 'sale' : 'sales'
  const word = countWord(count)
  const head = /^\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
  const verb = count === 1 ? 'supports' : 'support'
  return `${head} ${noun} on ${named} ${verb} ${range}.`
}

export function cmaFirstContactPreview(
  origin: CmaOrigin,
  address: string | null,
  recommendedList?: number | null,
  closedSalesCount?: number | null,
  band?: { valueLow?: number | null; valueHigh?: number | null } | null,
): string {
  const named = streetOnly(address) ?? 'this home'
  const rec = finiteMoney(recommendedList)
  if (origin === 'expired') {
    return 'What nearby homes sold for after concessions, and the homes you would be competing with.'
  }
  if (origin === 'fsbo') {
    return rec != null
      ? `A second look at ${named}, no charge and no strings.`
      : `A second set of numbers for ${named}, no charge and no strings.`
  }
  const lo = finiteMoney(band?.valueLow)
  const hi = finiteMoney(band?.valueHigh)
  if (rec != null && lo != null && hi != null) {
    return salesPreview(named, saleCount(closedSalesCount), lo, hi)
  }
  if (rec == null) {
    return `${named}: the number, and the sales behind it.`
  }
  return `${named}: the report is attached.`
}

function saleCount(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

/**
 * The city pulse, in the same words the market pages use.
 * `formatMonthsOfSupply` is what keeps 4.05 from printing as a seller's market.
 */
export function citySupplySentence(city: string | null | undefined, months: number | null | undefined): string | null {
  const place = trim(city)
  if (!place || months == null || !Number.isFinite(months) || months <= 0) return null
  const verdict = marketVerdict(months)
  if (verdict.kind === 'unknown') return null
  return `${place} has ${formatMonthsOfSupply(months)} months of supply right now. That is a ${verdict.label}.`
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
 * What the attached report holds. One sentence, above the button.
 * It must not say "our price": that phrase switches the button to a teaser.
 */
const REPORT_HOLDS =
  'The full report is attached. It has the price we would list at, the homes you would be competing with, and what happened to nearby homes that did not sell.'

/**
 * Expired letter, Matt 2026-10-06. The 3% line is his illustration of how a
 * concession works. It is not this house's measured concession.
 */
const EXPIRED_SHIFT =
  'The market has shifted this year. Price reductions are up, but the bigger change is seller concessions, where the seller pays money back to the buyer at closing for things like closing costs, repairs, or a lower interest rate. The recorded sale price stays the same, so values can look steadier than they are. A home that sells at full price with a 3% concession leaves the seller with 3% less than the record shows.'

const EXPIRED_REPORT =
  "Our report accounts for that. It shows where your listing sat against the competition, what nearby homes actually sold for after concessions, the homes you'd be competing with today, and where we'd price it."

const EXPIRED_QUESTIONS_EARN =
  "Please let me know if you have any questions about the numbers or how we put this together. If you consider selling in the future, we'd love the opportunity to earn your business, and we're here anytime."

const EXPIRED_CHOSEN_BROKER =
  "If you've already chosen a broker for your next step, please consider this information only. We hope it goes well for you."

const OWNER_BROKER_SLUGS = new Set(['matt', 'matthew', 'matthew-ryan'])

/**
 * What we did. The recommended price itself stays in the report.
 */
function workFor(origin: CmaOrigin, named: string, facts: CmaFirstContactFacts): string {
  if (origin === 'fsbo') {
    return `We noticed your home at ${named} is for sale by owner. We put a second set of numbers together from the MLS, no charge and no strings.`
  }
  if (isAskedOrigin(origin) || origin === 'place-page') {
    return `Thank you for asking what ${named} is worth. We spent time in the MLS and put this report together for you.`
  }
  return `We went through the homes and the sales ${scopePhrase(facts)} and put this report together. We thought you might find it useful, and we're happy to go through the numbers with you.`
}

/**
 * The sales, and where the last price sat against them. The opener already
 * said we did the work. The list price is not repeated here.
 */
function emailEvidence(origin: CmaOrigin, facts: CmaFirstContactFacts): string | null {
  const full = composeFirstContactNumbers(origin, facts)
  if (!full) return null
  const trimmed = full
    .replace(/^We researched your property and the comparable sales to see what we would do to get a better result\. /, '')
    .replace(/ We would recommend listing at \$[\d,]+\.$/, '')
    .trim()
  return trimmed || null
}

function reportSentence(_origin: CmaOrigin, named: string, hasPrice: boolean): string {
  if (hasPrice) return REPORT_HOLDS
  return `The full report on ${named} is attached as a PDF.`
}

function emailClose(origin: CmaOrigin): string[] {
  if (origin === 'fsbo') {
    return [
      'If at some point you would rather have someone handle the showings, the paperwork and the negotiation, we would love the opportunity to earn your business.',
      'Please let me know if you have any questions. Best of luck with the sale.',
    ]
  }
  return [
    'We would love the opportunity to earn your business.',
    'Please let me know if you have any questions.',
  ]
}

function cameOffSentence(street: string | null): string {
  if (street) {
    return `Your home at ${street} came off the market recently, so we put together an analysis we thought might be useful.`
  }
  return 'Your home came off the market recently, so we put together an analysis we thought might be useful.'
}

/**
 * Matt owns the brokerage. A missing broker is his, because the send path
 * already falls back to him. Anyone else works at Ryan Realty. The system
 * signature carries the name, so this line is the introduction only.
 */
function brokerIntro(facts: CmaFirstContactFacts): string {
  const slug = (facts.brokerSlug ?? '').trim().toLowerCase()
  const name = trim(facts.brokerName)
  const ownerName = name != null && /^(matt|matthew)\s+ryan$/i.test(name)
  const owner = OWNER_BROKER_SLUGS.has(slug) || (!slug && (ownerName || !name))
  if (owner) return 'My name is Matt Ryan, and I own Ryan Realty here in Bend.'
  if (name) return `My name is ${name}, and I'm a broker at Ryan Realty here in Bend.`
  return "I'm a broker at Ryan Realty here in Bend."
}

function composeExpiredFirstContact(facts: CmaFirstContactFacts): CmaFirstContactCopy {
  const street = streetOnly(facts.address)
  const greeted = greetingFirstName(facts.firstName)
  const greeting = greeted ? `Hi ${greeted},` : 'Hi there,'
  const plan = `${brokerIntro(facts)} We're a small brokerage, and we spend our days studying this market closely. ${cameOffSentence(street)}`
  const paragraphs: FirstContactRun[][] = []
  pushParagraph(paragraphs, [greeting])
  pushParagraph(paragraphs, [plan])
  pushParagraph(paragraphs, [EXPIRED_SHIFT])
  pushParagraph(paragraphs, [EXPIRED_REPORT])
  pushParagraph(paragraphs, [EXPIRED_ANALYSIS_BUTTON])
  pushParagraph(paragraphs, [EXPIRED_QUESTIONS_EARN])
  pushParagraph(paragraphs, [EXPIRED_CHOSEN_BROKER])
  const bodyText = paragraphsToPlain(paragraphs)
  return {
    subject: composeCmaFirstContactSubject('expired', facts.address),
    previewText: cmaFirstContactPreview(
      'expired',
      facts.address,
      facts.recommendedList,
      facts.closedSalesCount,
      facts,
    ),
    mastheadLine: 'MARKET ANALYSIS',
    greeting,
    plan,
    numbers: composeFirstContactNumbers('expired', facts),
    close: EXPIRED_QUESTIONS_EARN,
    bodyText,
    paragraphs,
    bodyMarkers: paragraphsToMarkers(paragraphs),
  }
}

export function composeCmaFirstContact(
  origin: CmaOrigin,
  facts: CmaFirstContactFacts,
): CmaFirstContactCopy {
  if (origin === 'expired') return composeExpiredFirstContact(facts)
  const greeting = 'Hi there,'
  const named = streetOnly(facts.address) ?? 'this home'
  const plan = workFor(origin, named, facts)
  const numbers = composeFirstContactNumbers(origin, facts)
  const hasPrice = finiteMoney(facts.recommendedList) != null
  const close = reportSentence(origin, named, hasPrice)
  const paragraphs: FirstContactRun[][] = []
  pushParagraph(paragraphs, [greeting])
  pushParagraph(paragraphs, [plan])
  pushParagraph(paragraphs, emailEvidence(origin, facts) ? [emailEvidence(origin, facts)!] : null)
  const supply = citySupplySentence(facts.city, facts.monthsOfSupply)
  if (supply) pushParagraph(paragraphs, [supply])
  pushParagraph(paragraphs, [close])
  const note = honestNote(origin)
  if (note) pushParagraph(paragraphs, [note])
  for (const line of emailClose(origin)) pushParagraph(paragraphs, [line])
  const bodyText = paragraphsToPlain(paragraphs)
  return {
    subject: composeCmaFirstContactSubject(origin, facts.address),
    previewText: cmaFirstContactPreview(
      origin,
      facts.address,
      facts.recommendedList,
      facts.closedSalesCount,
      facts,
    ),
    mastheadLine: 'MARKET ANALYSIS',
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

const LOCAL_TIER = /^(subdivision-|adjacent-subdivision-|neighborhood-|similar-sub-)/
const NEARBY_MILES = /^nearby-(\d+(?:\.\d+)?)mi-/

function isLocalTier(tier: string): boolean {
  if (LOCAL_TIER.test(tier)) return true
  const miles = NEARBY_MILES.exec(tier)
  if (!miles) return false
  const n = Number(miles[1])
  return n > 0 && n <= 2
}

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
  if (tiers.every((t) => isLocalTier(t))) return 'near'
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
