/**
 * Twelve-month listings behind the parent-place pricing story.
 *
 * Place column: listings.boundary_neighborhood. DATABASE_FOR_AI_AGENTS.md
 * and the listings snapshot name boundary_city, boundary_neighborhood, and
 * boundary_subdivision. They do not name a community column. Bend districts
 * and resort communities are both boundaries.geo_type neighborhood, and the
 * tagger writes that label into boundary_neighborhood. A name that is not
 * that label matches nothing. This read then returns null. It does not fall
 * back to the city or to a price band.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import {
  resolvePlacePricingTarget,
  rowsToPlacePricingStory,
  type PlacePricingListingRow,
} from '@/lib/cma/place-pricing-aggregate'
import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'

const PAGE_CAP = 12_000

const COLUMNS =
  'ListingKey, StreetNumber, StreetName, StandardStatus, ListPrice, OriginalListPrice, ClosePrice, CloseDate, ListDate, OnMarketDate, off_market_date, concessions_amount, days_to_pending, property_sub_type, boundary_neighborhood'

type DbRow = {
  ListingKey: string | null
  StreetNumber: string | null
  StreetName: string | null
  StandardStatus: string | null
  ListPrice: number | string | null
  OriginalListPrice: number | string | null
  ClosePrice: number | string | null
  CloseDate: string | null
  ListDate: string | null
  OnMarketDate: string | null
  off_market_date: string | null
  concessions_amount: number | string | null
  days_to_pending: number | string | null
  property_sub_type: string | null
  boundary_neighborhood: string | null
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

function numOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function isoDay(value: string): string | null {
  const day = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

function shiftMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1 + months, d)).toISOString().slice(0, 10)
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10)
}

/** Inclusive calendar window. lt the next day so a timestamptz on asOf still counts. */
function windowOr(start: string, end: string): string {
  const after = nextDay(end)
  const span = (column: string) => `and(${column}.gte.${start},${column}.lt.${after})`
  return [
    span('ListDate'),
    span('OnMarketDate'),
    span('off_market_date'),
    span('CloseDate'),
  ].join(',')
}

function toStoryRow(row: DbRow): PlacePricingListingRow {
  return {
    streetNumber: row.StreetNumber,
    streetName: row.StreetName,
    status: row.StandardStatus,
    listPrice: numOrNull(row.ListPrice),
    originalListPrice: numOrNull(row.OriginalListPrice),
    closePrice: numOrNull(row.ClosePrice),
    closeDate: row.CloseDate,
    listDate: row.ListDate,
    onMarketDate: row.OnMarketDate,
    offMarketDate: row.off_market_date,
    concessionsAmount: numOrNull(row.concessions_amount),
    daysToPending: numOrNull(row.days_to_pending),
    propertySubType: row.property_sub_type,
  }
}

export async function readPlacePricingStory(input: {
  compArea: { kind?: string | null; names?: readonly string[] | null } | null | undefined
  latitude: number | null
  longitude: number | null
  propertySubType: string | null | undefined
  asOf: string
}): Promise<PlacePricingStory | null> {
  const subtype = input.propertySubType?.trim() ?? ''
  const end = isoDay(input.asOf)
  if (!subtype || !end) return null
  const place = resolvePlacePricingTarget({
    compArea: input.compArea,
    latitude: input.latitude,
    longitude: input.longitude,
  })
  if (!place) return null
  const sb = client()
  if (!sb) return null
  const since = shiftMonths(end, -12)
  const { rows, error } = await fetchPagedRows<DbRow>(
    (from, to) =>
      sb
        .from('listings')
        .select(COLUMNS)
        .eq('boundary_neighborhood', place.placeName)
        .eq('property_sub_type', subtype)
        .or(windowOr(since, end))
        .order('ListingKey', { ascending: true })
        .range(from, to),
    PAGE_CAP,
  )
  if (error) throw new Error(`readPlacePricingStory(${place.placeName}): ${error.message}`)
  if (rows.length >= PAGE_CAP) {
    console.error(`[readPlacePricingStory] ${place.placeName} hit ${PAGE_CAP} rows`)
    return null
  }
  const matched = rows.filter((row) => (row.boundary_neighborhood ?? '').trim() === place.placeName)
  if (matched.length === 0) return null
  return rowsToPlacePricingStory({
    placeName: place.placeName,
    placeKind: place.placeKind,
    propertySubType: subtype,
    asOf: end,
    rows: matched.map(toStoryRow),
  })
}
