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
  pricePathFromFinalCycle,
  pricePathFromListing,
  type PricePath,
} from '@/lib/cma/price-path'
import { collapseExpiredPeerCycles, peerMatchesSubject } from '@/lib/cma/market-status'
import { readAskOutcome } from '@/lib/cma/market-area-chapters'
import { FAILED_ASK_BACKTEST, askAgainstRangeSentence } from '@/lib/cma/expired-audit'
import { subjectDomDays, subjectListingFailed } from '@/lib/cma/comp-matrix'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

export const DID_NOT_SELL_HEADING = 'The listings near you that did not sell.'

/** At most this many stories. Past it the chapter is a list again. */
const MAX_STORIES = 5

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
}): string {
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
 * The same closed sales chapter 3 prints, at their own sale price over their
 * own living area — nothing adjusted, because the comparison the sentence
 * makes is against an ASK, and an ask was never adjusted either.
 */
export function soldPpsfRange(
  comps: readonly CmaAdjustedComp[],
): { low: number; high: number; n: number } | null {
  const values = comps
    .map((c) =>
      c.closePrice != null && c.closePrice > 0 && c.sqft != null && c.sqft > 0
        ? c.closePrice / c.sqft
        : null,
    )
    .filter((v): v is number => v != null)
  if (values.length < 2) return null
  return { low: Math.round(Math.min(...values)), high: Math.round(Math.max(...values)), n: values.length }
}

/** "Asked $456 a foot. Homes like it closed at $274 to $320 a foot." */
export function askAgainstSoldSentence(input: {
  ask: number | null
  sqft: number | null
  range: { low: number; high: number } | null
}): string {
  const { ask, sqft, range } = input
  if (ask == null || !(ask > 0) || sqft == null || !(sqft > 0) || !range) return ''
  const ppsf = Math.round(ask / sqft)
  // Inside the range is not one answer. A home asking at the very top of what
  // its peers closed at is a different story from one asking at the bottom,
  // and "inside" alone flattens the two into the same sentence.
  const span = Math.max(range.high - range.low, 1)
  const position = (ppsf - range.low) / span
  // Name the measure. "That is at the top of what they closed at" sitting
  // under chapter 1's "15.3 percent above the top of the range" reads as two
  // answers to one question; a foot at a time is a different question, and
  // saying so is the whole fix.
  const where =
    ppsf > range.high
      ? 'A foot at a time, that is above every one of them.'
      : ppsf < range.low
        ? 'A foot at a time, that is below every one of them.'
        : position >= 2 / 3
          ? 'A foot at a time, that is at the top of what they closed at.'
          : position <= 1 / 3
            ? 'A foot at a time, that is at the bottom of what they closed at.'
            : 'A foot at a time, that is in the middle of what they closed at.'
  // "unadjusted" is the whole point of the word: chapter 1's shaded zone is
  // the range adjusted for date and size, and this line is the same homes at
  // their own sale price over their own feet. One phrase, "homes like yours",
  // was carrying both readings (tasteReview round two, §3.B), so each printed
  // range now says which of the two it is where the reader meets it.
  return `Asked ${usd(ask)} for ${int(sqft)} sqft, ${usd(ppsf)} a foot. Homes like it closed at ${usd(
    range.low,
  )} to ${usd(range.high)} a foot, unadjusted. ${where}`
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
  yearBuilt?: number | null
}): string {
  return [
    f.sqft != null && f.sqft > 0 ? `${int(f.sqft)} sqft` : null,
    f.beds != null ? `${int(f.beds)} bd` : null,
    f.baths != null ? `${f.baths % 1 === 0 ? int(f.baths) : f.baths.toFixed(1)} ba` : null,
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
    const path =
      pricePathFromFinalCycle(a.finalCycle ?? null, s.streetAddress) ??
      pricePathFromListing({
        address: s.streetAddress,
        listPrice: s.lastListPrice,
        originalListPrice: s.lastListPrice,
        onMarketDate: s.lastListDate,
        daysOnMarket: subjectDomDays(s),
        status: s.standardStatus,
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
        : askAgainstRangeSentence(s.lastListPrice ?? null, a.rangeLow ?? null, a.rangeHigh ?? null),
    })
  }
  const peers = collapseExpiredPeerCycles(
    (a.peers ?? []).filter((p) => p.address.trim() && p.listPrice > 0 && !peerMatchesSubject(p, s)),
  )
  for (const p of peers.slice(0, MAX_STORIES)) {
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
        originalListPrice: p.originalListPrice,
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
      ${priceHistoryLineHtml(story.path, story.id)}
      ${reading ? `<p class="dns-read">${esc(reading)}</p>` : ''}
    </div>
  </article>`
}

/** The chapter body, shared by the letter page and its immersive twin. */
export function didNotSellBodyHtml(a: DidNotSellArgs): string {
  const stories = didNotSellStories(a)
  if (stories.length === 0) return ''
  const range = soldPpsfRange(a.comps)
  const lead = didNotSellLeadSentence({ market: a.market, city: a.subject.city })
  const cards = stories.map((story) => storyCard(story, range)).join('\n    ')
  const legend = range
    ? `<p class="small">${esc(
        `The dollars a foot come from the ${int(range.n)} closed sales in this report, at their own sale price over their own living area.`,
      )}</p>`
    : ''
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
