/**
 * Stamp a closed comp's days from its MLS record: the first day it was on the
 * market, first list to close, and the days to an accepted offer on the
 * listing period that produced the sale. Pure — no DB.
 */
import {
  closedSaleDaysToOffer,
  closedSaleDomTotal,
  earliestClosedCompListDate,
  listingHistoryLine as buildListingHistoryLine,
} from '@/lib/cma/listing-history-line'
import {
  listingStretch,
  mergeStatusChanges,
  offerRunTimed,
  pacificDay,
  statusKind,
  type AskChange,
  type ListingStatusChange,
} from '@/lib/cma/listing-status'
import type { CmaComp } from '@/lib/cma/types'

export type ClosedCompListStartExtras = {
  /** The listing row's OnMarketDate: the day its current Active period began. */
  onMarketDate?: string | null
  listDate?: string | null
  /** The entry timestamp: a list start only without `originalOnMarketTimestamp` (an entry can be Coming Soon). */
  originalEntryTimestamp?: string | null
  originalOnMarketTimestamp?: string | null
  historyListDates?: readonly string[]
  /** Every MLS status change on the listing (listing_history + status_history). */
  statusChanges?: readonly ListingStatusChange[]
  /** The listing row's pending_timestamp. */
  pendingTimestamp?: string | null
  /** The listing row's days_to_pending, counted from its OnMarketDate. */
  daysToPending?: number | null
  /** The listing row's own DaysOnMarket, before any first-list correction. */
  mlsDaysOnMarket?: number | null
  /** Every recorded ask change on the listing, with its timestamp. */
  askChanges?: readonly AskChange[]
  /** MLS OriginalListPrice / ListPrice off the listing row, when read. */
  originalListPrice?: number | null
  listPrice?: number | null
}

/** The day the listing left Coming Soon, when the status log shows it did. */
function preMarketUntil(changes: readonly ListingStatusChange[]): string | null {
  const exit = mergeStatusChanges(changes).find((c) => statusKind(c.from) === 'pre' && statusKind(c.to) !== 'pre')
  return exit ? pacificDay(exit.at) : null
}

export function stampClosedCompDom(comp: CmaComp, extras: ClosedCompListStartExtras): CmaComp {
  const changes = extras.statusChanges ?? []
  const preUntil = preMarketUntil(changes)
  const start = earliestClosedCompListDate({
    onMarketDate: extras.onMarketDate ?? comp.onMarketDate,
    listDate: extras.listDate,
    originalEntryTimestamp: extras.originalEntryTimestamp,
    originalOnMarketTimestamp: extras.originalOnMarketTimestamp,
    historyListDates: extras.historyListDates,
    preMarketUntil: preUntil,
  })
  const closeDate = comp.closeDate
  const domTotal = closedSaleDomTotal({
    daysOnMarket: extras.mlsDaysOnMarket !== undefined ? extras.mlsDaysOnMarket : comp.domTotal,
    onMarketDate: start,
    closeDate,
    listDate: extras.listDate,
    originalEntryTimestamp: extras.originalEntryTimestamp,
    originalOnMarketTimestamp: extras.originalOnMarketTimestamp,
    historyListDates: extras.historyListDates,
    preMarketUntil: preUntil,
  })
  // DAYS TO AN OFFER ARE COUNTED ON THE LISTING PERIOD THAT PRODUCED THE SALE
  // (reader review 2026-10-08): Active to Pending, from the status log, else
  // the row's on-market day to its pending timestamp, else days_to_pending.
  // Never from the first list and never from a Coming Soon entry.
  const offer = offerRunTimed({
    changes,
    onMarketDate: extras.onMarketDate ?? null,
    firstOnMarketAt: extras.originalOnMarketTimestamp ?? null,
    pendingAt: extras.pendingTimestamp ?? null,
    mlsDaysToPending: extras.daysToPending ?? null,
    closeDate,
  })
  const daysToOffer = closedSaleDaysToOffer({
    daysToOffer: offer ? offer.days : comp.daysToOffer,
    measuredFrom: offer ? offer.from : (comp.offerFrom ?? null),
    firstListDate: start,
    domTotal,
    closeDate,
  })
  const offerFrom = daysToOffer == null ? null : offer ? offer.from : (comp.offerFrom ?? null)
  // ONE CLOCK: THE LAST STRETCH (Matt 2026-10-08). The first ask printed for
  // the sale is the ask in effect the moment its offer clock started, and the
  // row says when that stretch was not the listing's first. 61197 Cottonwood
  // came back Nov 13 at $774,900; its April listing opened at $849,900.
  const stretch =
    offer && offer.fromAt
      ? listingStretch({
          startAt: offer.fromAt,
          changes,
          firstOnMarketAt: extras.originalOnMarketTimestamp ?? null,
          listedAt: extras.onMarketDate ?? null,
          askChanges: extras.askChanges ?? [],
          openingAsk: extras.originalListPrice ?? comp.originalListPrice ?? null,
          currentAsk: extras.listPrice ?? comp.listPrice ?? null,
        })
      : null
  if (start == null && domTotal == null && !offer) return comp
  const listingHistoryLine = buildListingHistoryLine({
    listPrice: comp.listPrice,
    originalListPrice: comp.originalListPrice,
    closePrice: comp.closePrice,
    status: 'Closed',
    onMarketDate: start ?? comp.onMarketDate,
    closeDate,
    daysOnMarket: domTotal,
  })
  return {
    ...comp,
    onMarketDate: start ?? comp.onMarketDate,
    domTotal,
    daysToOffer,
    offerFrom,
    ...(stretch ? { stretch } : {}),
    listingHistoryLine: listingHistoryLine ?? comp.listingHistoryLine,
  }
}
