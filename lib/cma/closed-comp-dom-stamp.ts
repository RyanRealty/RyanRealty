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
  mergeStatusChanges,
  offerRun,
  pacificDay,
  statusKind,
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
}

/** The day the listing left Coming Soon, when the status log shows it did. */
function comingSoonUntil(changes: readonly ListingStatusChange[]): string | null {
  const exit = mergeStatusChanges(changes).find((c) => statusKind(c.from) === 'pre' && statusKind(c.to) !== 'pre')
  return exit ? pacificDay(exit.at) : null
}

export function stampClosedCompDom(comp: CmaComp, extras: ClosedCompListStartExtras): CmaComp {
  const changes = extras.statusChanges ?? []
  const preUntil = comingSoonUntil(changes)
  const start = earliestClosedCompListDate({
    onMarketDate: extras.onMarketDate ?? comp.onMarketDate,
    listDate: extras.listDate,
    originalEntryTimestamp: extras.originalEntryTimestamp,
    originalOnMarketTimestamp: extras.originalOnMarketTimestamp,
    historyListDates: extras.historyListDates,
    comingSoonUntil: preUntil,
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
    comingSoonUntil: preUntil,
  })
  // DAYS TO AN OFFER ARE COUNTED ON THE LISTING PERIOD THAT PRODUCED THE SALE
  // (reader review 2026-10-08): Active to Pending, from the status log, else
  // the row's on-market day to its pending timestamp, else days_to_pending.
  // Never from the first list and never from a Coming Soon entry.
  const offer = offerRun({
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
    listingHistoryLine: listingHistoryLine ?? comp.listingHistoryLine,
  }
}
