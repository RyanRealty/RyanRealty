/**
 * WHAT AN OFF-MARKET LISTING PAGE PUBLISHES INSTEAD OF AN ASK (SITE-21).
 *
 * FOUNDING CASE, verified live 2026-09-08 on ryan-realty.com. On Closed MLS
 * 220219603 the header already read $1,100,000 under a "Closed Sep 2026" pill
 * — SITE-20 had made the price status-aware — while the page around it still
 * sold the house: `<div id="payment">` computed principal and interest on the
 * $1,250,000 ASK, the market instrument printed "This home's price sits 32.0%
 * over the Bend median list · $1,250,000 this price", and Tour / Call / Text
 * ran in the strip, in the broker card and in the phone's sticky bar. Two
 * prices for one home, and three asks a broker cannot fulfil: nobody can tour
 * it, nobody can offer on it, and the payment is a loan on a number that is no
 * longer true. The same shape reproduced on Closed 220215680 and Expired
 * 220169791.
 *
 * MASTER_SPEC §4.9 has specified the replacement since it was written: the
 * last-known facts, three or four similar ACTIVE listings, and a saved-search
 * CTA. This file is the "last-known facts" half — the pure publisher for the
 * sold instrument, so every figure on it is one function's answer and can be
 * checked against the row it came from.
 *
 * WHAT IT WILL NOT PUBLISH (§0):
 *  - A sale-to-list ratio for anything but a Closed row. Expired, Canceled and
 *    Withdrawn homes did not sell; there is no sale to compare to a list.
 *  - A sale-to-list ratio built on a missing or zero operand.
 *  - A day count to today. Days on market ends at the close (days-live.ts,
 *    daysOnMarketToClose); a home that never closed publishes no day count.
 *  - A "sold for" line with no close price. A Closed row whose ClosePrice the
 *    feed withholds says it is off the market and stops, which is §0.7.
 *
 * The status list is not defined here. It is OFF_MARKET_STATUSES in
 * publish-listing-published-price.ts, the same set that decides which price the
 * page publishes, reached through lib/listing-status-public.ts on public
 * surfaces. A second list is how Coming Soon reached the site.
 */

import { formatCalendarDay } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { closeCivilDay, daysOnMarketToClose } from '@/lib/listing/days-live'
import {
  listingPublishesClosePrice,
  publishListingStatusWord,
} from '@/lib/listing/publish-listing-published-price'

/**
 * The close date as a reader reads it: "September 8, 2026".
 *
 * The civil day comes from days-live.ts (closeCivilDay), the same function the
 * day count ends on, so the date on the page and the date the count reaches
 * cannot come apart. Formatting is lib/format's, never a hand-rolled Intl call.
 */
export function publishCloseDay(closeDate: string | null | undefined): string | null {
  const day = closeCivilDay(closeDate)
  if (!day) return null
  const printed = formatCalendarDay(day, { month: 'long', day: 'numeric', year: 'numeric' })
  return printed || null
}

/**
 * Sale-to-list, as a percent of the FINAL list price: what the buyer paid for
 * every dollar the seller last asked. 100 means it sold at the ask.
 *
 * The final ask, not the original: the original is the price-cut story, which
 * the page already tells through publishListingDrop, and mixing the two into
 * one ratio would publish a discount the seller never had on the table at the
 * end. The trace beside the figure says "final list price" for that reason.
 */
export function publishSaleToListPct(
  closePrice: number | null | undefined,
  listPrice: number | null | undefined,
): number | null {
  if (closePrice == null || listPrice == null) return null
  if (!(closePrice > 0) || !(listPrice > 0)) return null
  return (closePrice / listPrice) * 100
}

/**
 * The ratio as a display numeral: "97.4%". One tenth, and NOTHING ELSE in the
 * value.
 *
 * It carried its own words once ("97.4% of asking"), and the first render of
 * the sold instrument at 1440 showed why that is wrong: an Instrument figure
 * value is set in the display face at figure size, so a value with a phrase in
 * it ran straight through the next column and collided with the day count.
 * The words belong in the label, which is what a label is for.
 */
export function formatSaleToList(pct: number | null): string | null {
  if (pct == null || !Number.isFinite(pct)) return null
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`
}

export type ListingOffMarketSubject = {
  /** MLS StandardStatus, verbatim. */
  status: string | null | undefined
  closePrice: number | null | undefined
  closeDate: string | null | undefined
  /** The final ask. The sale-to-list denominator, never the headline figure. */
  listPrice: number | null | undefined
  onMarketDate: string | null | undefined
  /** The already-published whole-property price, or null when withheld. */
  publishedPrice: number | null
}

export type ListingOffMarketFigure = {
  value: string
  label: string
}

export type ListingOffMarketFacts = {
  /** "Sold" for Closed, "Off market" for Expired / Canceled / Withdrawn. */
  statusWord: string
  /** The one sentence the section is. */
  headline: string
  eyebrow: string
  figures: ListingOffMarketFigure[]
  /** The §0 trace for every figure above it. */
  source: string
}

/**
 * The sold instrument's claim, or null when the row is not off market.
 *
 * The headline is the sentence; the figures are the operands under it, and
 * every one of them is withheld individually rather than filled. A Closed row
 * with a close price and a date reads "Sold for $900,000 on September 8, 2026";
 * a Closed row missing the price reads "This home sold and is no longer on the
 * market"; an Expired row reads "This home came off the market without
 * selling", which is what Expired, Canceled and Withdrawn all mean to a reader
 * and is the only claim the record supports for all three.
 */
export function publishListingOffMarketFacts(
  subject: ListingOffMarketSubject,
): ListingOffMarketFacts | null {
  const statusWord = publishListingStatusWord(subject.status)
  if (statusWord == null) return null

  const sold = listingPublishesClosePrice(subject.status)
  const soldPrice = sold ? subject.publishedPrice : null
  const soldDay = sold ? publishCloseDay(subject.closeDate) : null
  const saleToList = sold ? publishSaleToListPct(subject.closePrice, subject.listPrice) : null
  const marketDays = sold ? daysOnMarketToClose(subject.onMarketDate, subject.closeDate) : null

  const headline =
    soldPrice != null && soldDay
      ? `Sold for ${formatPriceExact(soldPrice)} on ${soldDay}`
      : soldPrice != null
        ? `Sold for ${formatPriceExact(soldPrice)}`
        : sold
          ? 'This home sold and is no longer on the market'
          : 'This home came off the market without selling'

  // NOTHING THE HEADLINE ALREADY SAYS BECOMES A FIGURE. The sale price is
  // printed by the page's H1, then by this sentence; a third print as a "sold
  // for" tile inside the same 200px is the stacked-restatement TASTE.md calls
  // out, not a figure set. The figures carry only what the sentence does not:
  // what the seller last asked, how the sale compares to it, and how long the
  // home waited. Same rule for the close date.
  const figures: ListingOffMarketFigure[] = []
  if (soldPrice == null && sold) {
    // No sale price to head the sentence, so the date is a figure rather than a
    // clause, and it is all the record supports.
    if (soldDay) figures.push({ value: soldDay, label: 'closed' })
  }
  // The ask publishes ONLY beside the sale it is being compared to. SITE-20's
  // rule is that a Closed listing publishes its close price or no price at
  // all: a sold home whose ClosePrice the feed withholds would otherwise print
  // its list price as the one figure on the section, which is the defect that
  // file exists to end, wearing a "last asked" label.
  if (soldPrice != null && subject.listPrice != null && subject.listPrice > 0) {
    figures.push({ value: formatPriceExact(subject.listPrice), label: 'last asked' })
  }
  const ratio = formatSaleToList(saleToList)
  if (ratio) figures.push({ value: ratio, label: 'of the asking price' })
  if (marketDays != null) {
    figures.push({
      value: marketDays.toLocaleString('en-US'),
      label: marketDays === 1 ? 'day on market' : 'days on market',
    })
  }

  const source = sold
    ? 'This listing’s MLS close record: ClosePrice, CloseDate, the final ListPrice and OnMarketDate on the row. The percentage is the close price over the FINAL list price. Days on market are calendar days from the on-market date to the close.'
    : 'This listing’s MLS status record. It ended without a recorded sale, so no sale price, no percentage of asking and no close date publish.'

  return { statusWord, headline, eyebrow: statusWord, figures, source }
}
