/**
 * Chapter 2. The listings near you that did not sell.
 *
 * Matt, 2026-09-07 (Delta 1): "we need to show ... failed listings that did not
 * sell that were overpriced. we need to clearly tell the story of those
 * listings that did not sell."
 *
 * One STORY per failed listing, never a matrix. The twelve-row side-by-side
 * table this replaces asked a reader to compare a bathroom count across five
 * homes that share exactly one fact: none of them sold. Each card carries the
 * photo, the address as a tracked link, the whole price path drawn as a line,
 * the days it ran, how it came off, and one sentence putting its final ask
 * against what homes like it actually closed at, a square foot at a time.
 *
 * The seller's own listing is the FIRST card. It is the one story they already
 * know, and putting it at the head of the row is what makes the rest of the
 * row legible without a single sentence telling them they were wrong.
 *
 * Every figure is off `render_args`. The dollars-a-foot range is the closed
 * sales already printed in chapter 3, divided by their own living area — the
 * same sale prices, so a reader can check the range against the table.
 */

import { UNADDRESSED_DOC_LINKS, escapeHtml, int, sparkPhotoAt, usd } from '@/lib/cma/render-blocks'
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import {
  priceHistoryLineHtml,
  pricePathFromListing,
  subjectPricePath,
  type PricePath,
} from '@/lib/cma/price-path'
import { collapseExpiredPeerCycles, peerMatchesSubject } from '@/lib/cma/market-status'
import { listingStretchRead } from '@/lib/cma/last-stretch'
import { readAskOutcome } from '@/lib/cma/market-area-chapters'
import { FAILED_ASK_BACKTEST, askAgainstRangeSentence } from '@/lib/cma/expired-audit'
import { measuresLastOfSeveralAsks } from '@/lib/cma/ask-story'
import { SOLD_PPSF_NET_ROW_LABEL, subjectDomDays, subjectListingFailed } from '@/lib/cma/comp-matrix'
import { salesAreaIsBounded } from '@/lib/pricing/comp-area'
import { comparisonSalePrice, concessionOnSale } from '@/lib/pricing/seller-net'
import { printedBaths } from '@/lib/pricing/bath-count'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

export const DID_NOT_SELL_HEADING = 'The listings near you that did not sell.'

/**
 * The chapter's heading, never plural over nothing.
 *
 * "The listings near you that did not sell." over a page that showed no
 * listing (3037 Purcell, 2382 Jackson, reader review 2026-10-08) named a set
 * the reader could not find. With no peer drawn the heading says so: "other"
 * when the seller's own listing is the one that came off, and "like yours"
 * because the search reads the subject's own type and price band, and an
 * area can hold unsold homes that are not like it (Jackson's two).
 *
 * When the chapter's sentence counts homes that did come off unsold and are
 * not like this one, the heading says that, not that none came off: 1355
 * Jacksonville printed "No other listing like yours near you came off
 * unsold." directly over "One home ... came off the market without selling"
 * (reader review 2026-10-08), which read as a contradiction.
 */
export function didNotSellHeading(input: { shown: number; ownFailed: boolean; unlikeCount?: number }): string {
  if (input.shown > 0) return DID_NOT_SELL_HEADING
  const other = input.ownFailed ? 'other ' : ''
  const unlike = input.unlikeCount ?? 0
  if (unlike === 1) return `The ${other}listing near you that did not sell is not like yours.`
  if (unlike > 1) return `The ${other}listings near you that did not sell are not like yours.`
  return `No ${other}listing like yours near you came off unsold.`
}

/**
 * `render_args.market.localFailedThenSold`, validated.
 *
 * The city's OWN failed-then-sold pairs. Preferred over the regional backtest
 * whenever it holds enough pairs to mean something — a Redmond seller is owed
 * the Redmond figure, and the regional one is named as regional when it is all
 * we have (blueprint, Delta 1).
 */
export type LocalFailedThenSold = {
  city: string
  windowMonths: number
  n: number
  medianShareOfFailedAsk: number
}

/** Below this the local pairs are too few to publish and the region stands in. */
export const LOCAL_PAIRS_MIN_N = 10

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function readLocalFailedThenSold(
  market: CmaMarketContext | null | undefined,
): LocalFailedThenSold | null {
  const raw = (market as unknown as { localFailedThenSold?: unknown } | null)?.localFailedThenSold
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const city = typeof o.city === 'string' ? o.city.trim() : ''
  const n = num(o.n)
  const share = num(o.medianShareOfFailedAsk)
  const windowMonths = num(o.windowMonths) ?? 24
  if (!city || n == null || n < LOCAL_PAIRS_MIN_N || share == null || !(share > 0)) return null
  return { city, windowMonths, n, medianShareOfFailedAsk: share }
}

/**
 * The sentence over the chapter: how many came off unsold here, how many of
 * those later sold, and at what share of the ask that failed.
 *
 * Local when the city's own pairs carry it; otherwise the Central Oregon
 * backtest, said in the words "Across Central Oregon" so nobody reads a
 * regional figure as a Redmond one.
 */
export function didNotSellLeadSentence(input: {
  market: CmaMarketContext | null
  city: string
  /** When the sales sit in a plat, a polygon, or a radius, do not print a citywide came-off count. */
  compArea?: { kind?: string | null } | null
}): string {
  if (salesAreaIsBounded(input.compArea)) return ''
  const outcome = readAskOutcome(input.market)
  const failed = outcome?.groups.find((g) => g.key === 'did-not-sell') ?? null
  const local = readLocalFailedThenSold(input.market)
  const bits: string[] = []
  if (failed && outcome) {
    const period =
      outcome.windowMonths === 12 ? 'the last 12 months' : `the last ${int(outcome.windowMonths)} months`
    bits.push(
      `${int(failed.n)} single-family homes in ${outcome.city} came off the market without selling in ${period}.`,
    )
  }
  if (local) {
    bits.push(
      `Over ${int(local.windowMonths)} months, ${int(local.n)} ${
        local.city
      } listings that failed came back and sold, at a median ${local.medianShareOfFailedAsk.toFixed(
        1,
      )} percent of the ask that failed.`,
    )
  } else {
    const b = FAILED_ASK_BACKTEST
    bits.push(
      `Across Central Oregon, ${int(b.pairs)} homes came off unsold and then sold between 2023 and 2026, at a median ${(
        b.closeMedianRatio * 100
      ).toFixed(1)} percent of the ask that failed.`,
    )
  }
  return bits.join(' ')
}

/**
 * What homes like these actually closed at, a square foot at a time.
 *
 * The same figure the sales table's "Sold $/sqft" row prints for each sale:
 * the sale price less any recorded seller concession, over its own living
 * area, rounded to the dollar (`soldPpsfCell`, lib/cma/comp-matrix.ts).
 * Nothing adjusted for date or size, because the comparison the sentence
 * makes is against an ASK, and an ask was never adjusted either.
 *
 * It was close price over living area, before the concession, so the prose
 * said $318 to $359 under a table that printed $317 to $357 (3037 Purcell,
 * reader review 2026-10-07). One basis now, and the per-sale values ride
 * along so a sentence can count sales rather than guess a position.
 */
export function soldPpsfRange(
  comps: readonly CmaAdjustedComp[],
): { low: number; high: number; n: number; values: number[]; credit: boolean } | null {
  const rated = comps.filter(
    (c) => c.closePrice != null && c.closePrice > 0 && c.sqft != null && c.sqft > 0,
  )
  const values = rated.map((c) =>
    Math.round(comparisonSalePrice(c.closePrice, concessionOnSale(c)) / c.sqft!),
  )
  if (values.length < 2) return null
  // Whether any of these rates had a credit come off: the sales table then
  // names its row for that, and the legend names the row it means.
  const credit = rated.some((c) => (concessionOnSale(c) ?? 0) > 0)
  return { low: Math.min(...values), high: Math.max(...values), n: values.length, values, credit }
}

/**
 * The legend under a set of dollars-a-foot sentences: which figure, which
 * sales. It names the sales table's row by the words that row prints, which
 * carry "after concessions" when a sale on it had a credit.
 */
export function soldPpsfLegend(n: number, credit = false): string {
  const row = credit ? SOLD_PPSF_NET_ROW_LABEL : 'Sold $/sqft'
  return `The dollars a foot are the ${row} row of the ${int(n)} closed sales in this report: each sale price, less any recorded seller concession, over its own living area.`
}

/** "Asked $456 a foot. Homes like it closed at $274 to $320 a foot." */
export function askAgainstSoldSentence(input: {
  ask: number | null
  sqft: number | null
  range: { low: number; high: number; values?: readonly number[] } | null
}): string {
  const { ask, sqft, range } = input
  if (ask == null || !(ask > 0) || sqft == null || !(sqft > 0) || !range) return ''
  const ppsf = Math.round(ask / sqft)
  // Name the measure. "That is at the top of what they closed at" sitting
  // under chapter 1's "15.3 percent above the top of the range" reads as two
  // answers to one question; a foot at a time is a different question, and
  // saying so is the whole fix.
  //
  // Inside the range, COUNT. "At the top of what they closed at" printed for
  // $351 a foot when the top was $375 (20676 Wild Rose, reader review
  // 2026-10-07). How many of the printed sales closed higher is a fact the
  // reader can check against the row; a position word was not.
  const values = range.values ?? []
  const higher = values.filter((v) => v > ppsf).length
  const where =
    ppsf > range.high
      ? 'A foot at a time, that is above every one of them.'
      : ppsf < range.low
        ? 'A foot at a time, that is below every one of them.'
        : ppsf === range.high
          ? 'A foot at a time, that is level with the highest of them.'
          : ppsf === range.low
            ? 'A foot at a time, that is level with the lowest of them.'
            : values.length > 0
              ? `A foot at a time, ${int(higher)} of the ${int(values.length)} closed higher.`
              : 'A foot at a time, that is inside what they closed at.'
  return `Asked ${usd(ask)} for ${int(sqft)} sqft, ${usd(ppsf)} a foot. Homes like it closed at ${usd(
    range.low,
  )} to ${usd(range.high)} a foot, net of seller concessions and not adjusted for date or size. ${where}`
}

type Story = {
  id: string
  title: string
  href: string | null
  photoUrl: string | null
  ask: number | null
  sqft: number | null
  facts: string
  path: PricePath | null
  isSubject: boolean
  /** Printed BEFORE the dollars-a-foot line. Only the seller's own card carries one. */
  lead?: string
}

function factsLine(f: {
  sqft?: number | null
  beds?: number | null
  baths?: number | null
  bathsFull?: number | null
  bathsHalf?: number | null
  yearBuilt?: number | null
}): string {
  // The bath count the sales table prints (2 full and 1 half is 2.5), never
  // BathroomsTotal raw, which counts the half bath whole.
  const baths = printedBaths(f)
  return [
    f.sqft != null && f.sqft > 0 ? `${int(f.sqft)} sqft` : null,
    f.beds != null ? `${int(f.beds)} bd` : null,
    baths != null ? `${baths % 1 === 0 ? int(baths) : baths.toFixed(1)} ba` : null,
    f.yearBuilt != null ? `built ${f.yearBuilt}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function streetNumberOf(address: string): string | null {
  return /^\s*(\d+[A-Za-z]?)\s/.exec(address)?.[1] ?? null
}

function streetNameOf(address: string): string | null {
  return address.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim() || null
}

export type DidNotSellArgs = {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  market: CmaMarketContext | null
  peers?: readonly CmaExpiredPeer[] | null
  finalCycle?: ExpiredFinalCycle | null
  docLinks?: TrackedDocLinkCtx | null
  /** What homes like this one sold for. Chapter 1 measures the ask against it. */
  rangeLow?: number | null
  rangeHigh?: number | null
  compArea?: { kind?: string | null } | null
  /**
   * True when chapter 1 renders in this document and already states where the
   * ask sat against that range. The subject card then carries the
   * dollars-a-foot reading alone.
   */
  askVerdictInChapterOne?: boolean
}

/**
 * The stories, subject first. Exported so both documents build the same set
 * and the chapter can decide whether there is one at all before it prints a
 * heading.
 */
export function didNotSellStories(a: DidNotSellArgs): Story[] {
  const stories: Story[] = []
  const s = a.subject
  if (subjectListingFailed(s)) {
    const path = subjectPricePath({
      cycle: a.finalCycle ?? null,
      label: s.streetAddress,
      lastListPrice: s.lastListPrice,
      onMarketDate: s.lastListDate,
      daysOnMarket: subjectDomDays(s),
      status: s.standardStatus,
      printableAsk: s.lastListPrice,
    })
    stories.push({
      id: 'yours',
      title: `Your home · ${s.streetAddress}`,
      href: null,
      photoUrl: s.photoUrl?.trim() || null,
      ask: s.lastListPrice ?? null,
      sqft: s.sqft ?? null,
      facts: factsLine(s),
      path,
      isSubject: true,
      // ONE VERDICT ON THE ASK, IN ONE PLACE. Chapter 1 draws the ask against
      // the adjusted range and states the percentage under the drawing; this
      // card states the dollars-a-foot reading. Printing both here put "15.3
      // percent above the top" and "at the top of what they closed at" four
      // lines apart in one paragraph — two answers to what a reader hears as
      // one question (tasteReview round two, §3.C). The sentence is kept only
      // when chapter 1 is not in this document to carry it.
      lead: a.askVerdictInChapterOne
        ? ''
        : askAgainstRangeSentence(s.lastListPrice ?? null, a.rangeLow ?? null, a.rangeHigh ?? null, {
            // Measured on the last ask: say so when the period opened at another price.
            lastOfSeveral: measuresLastOfSeveralAsks(s.lastListPrice ?? null, [
              ...(a.finalCycle?.initialAsk != null ? [a.finalCycle.initialAsk] : []),
              ...(a.finalCycle?.cuts ?? []).map((c) => c.ask),
            ]),
          }),
    })
  }
  const peers = collapseExpiredPeerCycles(
    (a.peers ?? []).filter((p) => p.address.trim() && p.listPrice > 0 && !peerMatchesSubject(p, s)),
  )
  for (const p of peers) {
    stories.push({
      id: p.listingKey || p.address,
      title: p.address,
      href: trackedDocLink(
        'listing',
        {
          listingKey: p.listingKey ?? null,
          streetNumber: streetNumberOf(p.address),
          streetName: streetNameOf(p.address),
          city: s.city,
          subdivisionName: s.subdivision,
        },
        a.docLinks ?? UNADDRESSED_DOC_LINKS,
      ),
      photoUrl: p.photoUrl?.trim() || null,
      ask: p.listPrice,
      sqft: p.sqft ?? null,
      facts: factsLine(p),
      path: pricePathFromListing({
        address: p.address,
        listPrice: p.listPrice,
        // The first ask of the stretch its days count (Matt 2026-10-08).
        originalListPrice: listingStretchRead(p).firstAsk,
        onMarketDate: p.onMarketDate,
        daysOnMarket: p.daysOnMarket,
        status: p.status,
      }),
      isSubject: false,
    })
  }
  return stories
}

function storyCard(story: Story, range: { low: number; high: number } | null): string {
  const photo = sparkPhotoAt(story.photoUrl, '480x360')
  const img = photo
    ? `<img class="dns-photo" src="${esc(photo)}" alt="${esc(story.title)}" loading="eager" referrerpolicy="no-referrer"/>`
    : `<div class="dns-photo is-empty" aria-hidden="true"></div>`
  const name = story.href
    ? `<a class="dns-addr" href="${esc(story.href)}" data-rr-track="cma-unsold-peer">${esc(story.title)}</a>`
    : `<span class="dns-addr">${esc(story.title)}</span>`
  const ppsf = askAgainstSoldSentence({ ask: story.ask, sqft: story.sqft, range })
  const reading = [story.lead, ppsf].filter((b) => b && b.trim()).join(' ')
  return `<article class="dns-card${story.isSubject ? ' is-yours' : ''}" data-story="${esc(story.id)}">
    ${img}
    <div class="dns-body">
      ${name}
      <div class="dns-ask">${story.ask != null ? `${usd(story.ask)} asked` : ''}</div>
      ${story.facts ? `<div class="dns-facts">${esc(story.facts)}</div>` : ''}
      ${reading ? `<p class="dns-read">${esc(reading)}</p>` : ''}
      <div class="comp-fold" data-fold-label="How this price moved">${priceHistoryLineHtml(
        story.path,
        story.id,
      )}</div>
    </div>
  </article>`
}

/** The chapter body, shared by the letter page and its immersive twin. */
export function didNotSellBodyHtml(a: DidNotSellArgs): string {
  const stories = didNotSellStories(a)
  if (stories.length === 0) return ''
  const range = soldPpsfRange(a.comps)
  const lead = didNotSellLeadSentence({ market: a.market, city: a.subject.city, compArea: a.compArea })
  const cards = stories.map((story) => storyCard(story, range)).join('\n    ')
  const legend = range ? `<p class="small">${esc(soldPpsfLegend(range.n, range.credit))}</p>` : ''
  return `${lead ? `<p class="chart-read">${esc(lead)}</p>` : ''}
  <div class="dns-set">
    ${cards}
  </div>
  ${legend}`
}

/** "The listings near you that did not sell." — or nothing to show. */
export function didNotSellHasContent(a: DidNotSellArgs): boolean {
  return didNotSellStories(a).length > 0
}
