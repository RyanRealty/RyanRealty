/**
 * Skinny listing pull for the CMA market-area chapters.
 * City + SFR only. Callers filter to the real comparable band in JS
 * so a ZIP that mixes cheap lots with luxury homes never becomes the grain.
 */

import 'server-only'
import type { ListingStatusChange } from '@/lib/cma/listing-status'
import { createServiceClient } from '@/lib/supabase/service'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type CmaMarketAreaRow = {
  ListingKey?: string | null
  /** Selected only by the area-scoped reads; the city-scoped ones already know the city. */
  City?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  PhotoURL?: string | null
  OriginalListPrice?: number | null
  Latitude?: number | null
  Longitude?: number | null
  StandardStatus: string
  ListPrice: number | null
  ClosePrice: number | null
  CloseDate: string | null
  ListDate: string | null
  OnMarketDate: string | null
  TotalLivingAreaSqFt: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  /**
   * MLS full / half bath split. BathroomsTotal counts a half bath whole
   * (lib/pricing/bath-count.ts), so a home is printed and room-tested from the
   * split, the way the sales are.
   */
  baths_full?: number | null
  baths_half?: number | null
  DaysOnMarket: number | null
  CumulativeDaysOnMarket: number | null
  status_change_timestamp: string | null
  SubdivisionName: string | null
  property_sub_type?: string | null
  year_built?: number | null
  lot_size_acres?: number | null
  /** Selected only by the area-scoped unsold read: the came-off fit reads it for the multi-unit and ADU walls (rule 24). */
  public_remarks?: string | null
  /** Selected only by the area-scoped unsold read: one house is one parcel when the relist test matches cycles. */
  parcel_number?: string | null
  /** Selected only by the area-scoped unsold read: the day the listing took its status of record. */
  off_market_date?: string | null
  /**
   * Attached only by the area-scoped unsold read: the listing's MLS status
   * changes, oldest first, so the days it was on the market end the day it
   * left Active (lib/cma/listing-status.ts), not the day it expired.
   */
  statusChanges?: ListingStatusChange[]
}

const COLS =
  'ListingKey, StreetNumber, StreetName, PhotoURL, OriginalListPrice, Latitude, Longitude, StandardStatus, ListPrice, ClosePrice, CloseDate, ListDate, OnMarketDate, TotalLivingAreaSqFt, BedroomsTotal, BathroomsTotal, baths_full, baths_half, DaysOnMarket, CumulativeDaysOnMarket, status_change_timestamp, SubdivisionName, property_sub_type, year_built, lot_size_acres'

type ListingQuery = {
  eq: (col: string, val: string) => ListingQuery
  in: (col: string, val: string[]) => ListingQuery
  gte: (col: string, val: string) => ListingQuery
  order: (col: string, opts: { ascending: boolean }) => ListingQuery
  range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
}

async function pageQuery(build: () => ListingQuery): Promise<CmaMarketAreaRow[]> {
  const out: CmaMarketAreaRow[] = []
  const SIZE = 1000
  for (let from = 0; from < 4000; from += SIZE) {
    const { data, error } = await build().range(from, from + SIZE - 1)
    if (error) {
      console.error('[getCmaMarketAreaRows]', error.message)
      return out
    }
    out.push(...((data ?? []) as CmaMarketAreaRow[]))
    if (!data || data.length < SIZE) break
  }
  return out
}

/**
 * Twelve-month city SFR rows for market-area chapters. Live inventory plus
 * recent closed and off-market cycles. Subdivision is not applied here —
 * computeMarketArea decides whether the street has enough sales to be the grain.
 */
export async function getCmaMarketAreaRows(city: string, sinceIso: string): Promise<CmaMarketAreaRow[]> {
  const sb = client()
  if (!sb || !city.trim()) return []
  const cityName = city.trim()
  const base = () =>
    sb.from('listings').select(COLS).eq('City', cityName).eq('PropertyType', 'A') as unknown as ListingQuery
  const [live, closed, off] = await Promise.all([
    pageQuery(() =>
      base().in('StandardStatus', ['Active', 'Pending']).order('ListingKey', { ascending: true }),
    ),
    pageQuery(() =>
      base().eq('StandardStatus', 'Closed').gte('CloseDate', sinceIso).order('ListingKey', { ascending: true }),
    ),
    pageQuery(() =>
      base()
        .in('StandardStatus', ['Expired', 'Withdrawn', 'Canceled'])
        .gte('status_change_timestamp', sinceIso)
        .order('ListingKey', { ascending: true }),
    ),
  ])
  return [...live, ...closed, ...off]
}
