/**
 * Apply earliest-list closed-comp DOM onto a CmaComp. Pure — no DB.
 */
import {
  closedSaleDaysToOffer,
  closedSaleDomTotal,
  earliestClosedCompListDate,
  listingHistoryLine as buildListingHistoryLine,
} from '@/lib/cma/listing-history-line'
import type { CmaComp } from '@/lib/cma/types'

export type ClosedCompListStartExtras = {
  onMarketDate?: string | null
  listDate?: string | null
  originalEntryTimestamp?: string | null
  originalOnMarketTimestamp?: string | null
  historyListDates?: readonly string[]
}

export function stampClosedCompDom(comp: CmaComp, extras: ClosedCompListStartExtras): CmaComp {
  const start = earliestClosedCompListDate({
    onMarketDate: extras.onMarketDate ?? comp.onMarketDate,
    listDate: extras.listDate,
    originalEntryTimestamp: extras.originalEntryTimestamp,
    originalOnMarketTimestamp: extras.originalOnMarketTimestamp,
    historyListDates: extras.historyListDates,
  })
  const closeDate = comp.closeDate
  const domTotal = closedSaleDomTotal({
    daysOnMarket: comp.domTotal,
    onMarketDate: start,
    closeDate,
    listDate: extras.listDate,
    originalEntryTimestamp: extras.originalEntryTimestamp,
    originalOnMarketTimestamp: extras.originalOnMarketTimestamp,
    historyListDates: extras.historyListDates,
  })
  if (start == null && domTotal == null) return comp
  const listingHistoryLine = buildListingHistoryLine({
    listPrice: comp.listPrice,
    originalListPrice: comp.originalListPrice,
    closePrice: comp.closePrice,
    status: 'Closed',
    onMarketDate: start ?? comp.onMarketDate,
    closeDate,
    daysOnMarket: domTotal,
  })
  // The record's days-to-offer counted from the comp's on-market date as it
  // arrived (the relist day, when there was one). Move it to the first list
  // so "offer in N days" and the days on market share one start.
  const daysToOffer = closedSaleDaysToOffer({
    daysToOffer: comp.daysToOffer,
    measuredFrom: comp.onMarketDate,
    firstListDate: start,
    domTotal,
    closeDate,
  })
  return {
    ...comp,
    onMarketDate: start ?? comp.onMarketDate,
    domTotal,
    daysToOffer,
    listingHistoryLine: listingHistoryLine ?? comp.listingHistoryLine,
  }
}
