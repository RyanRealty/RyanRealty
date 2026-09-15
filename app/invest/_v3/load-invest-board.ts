/**
 * One read for /invest metadata + page. React.cache so title and body share it.
 */
import { cache } from 'react'
import { getListingTiles } from '@/lib/data'
import {
  getPublicPlaceSegments,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { getLiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatDateTime } from '@/lib/format/date'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { composeInvestInsightPages, type InvestInsightPage } from './invest-insight'
import { composeInvestListings, type InvestListingRow } from './invest-listings'
import { composeInvestPulse } from './invest-pulse'
import { composeInvestSegmentRows, type InvestSegmentTableRow } from './invest-table'
import type { V3PulseProps } from '@/components/site/v3'

export type InvestBoard = {
  segments: PublicSegmentRow[]
  listings: InvestListingRow[]
  insightPages: InvestInsightPage[]
  segmentRows: InvestSegmentTableRow[]
  pulse: V3PulseProps | null
  liveRate: Awaited<ReturnType<typeof getLiveMortgageRate>> | null
  readStamp: string
  listingsOk: boolean
}

/**
 * MLS PropertyType letter codes for getListingTiles (max 4 chars).
 * Same map as PLACE_TYPE_COVER_SPECS: C multi-family, D land, E farm,
 * F commercial, H business. Browse slugs like `multi-family` fail Zod.
 */
export const INVEST_TILE_PULLS = [
  { propertyType: 'C', label: 'mf' },
  { propertyType: 'D', label: 'land' },
  { propertyType: 'E', label: 'farm' },
  { propertyType: 'F', label: 'commercial' },
  { propertyType: 'H', label: 'business' },
] as const

function listingPull(propertyType: string, label: string) {
  return withTimeoutFallbackResult<ListingTile[]>(
    getListingTiles({
      propertyType,
      status: 'active',
      sort: 'newest',
      limit: 8,
      scope: 'service-area',
    }),
    [],
    4500,
    `invest:listings:${label}`,
  )
}

export const loadInvestBoard = cache(async (): Promise<InvestBoard> => {
  const [segments, liveRate, listingResults] = await Promise.all([
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }),
      [],
      4500,
      'invest:segments',
    ),
    withTimeoutFallback(
      getLiveMortgageRate().catch(() => null),
      null,
      4500,
      'invest:rate',
    ),
    Promise.all(INVEST_TILE_PULLS.map((pull) => listingPull(pull.propertyType, pull.label))),
  ])

  const listingBuckets = listingResults.flatMap((result) => (result.ok ? [result.value] : []))
  const listingsOk = listingResults.some((result) => result.ok)
  const listings = listingsOk ? composeInvestListings(listingBuckets) : []
  const readStamp = formatDateTime(new Date())

  return {
    segments,
    listings,
    insightPages: composeInvestInsightPages(segments),
    segmentRows: composeInvestSegmentRows(segments),
    pulse: composeInvestPulse({ rows: segments, stamp: readStamp }),
    liveRate,
    readStamp,
    listingsOk,
  }
})
