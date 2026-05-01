/**
 * Supabase row fetchers for the YouTube market report pipeline.
 *
 * Postgres aggregations such as PERCENTILE_CONT can't run via PostgREST so
 * these functions pull the raw rows that satisfy the universal residential
 * filters (UF1, UF2, UF3) and timezone correction, then aggregations.ts
 * computes medians, percentiles, and MoS in TypeScript.
 *
 * Universe sizes are bounded — Bend SFR closes ~200/month, ~5K over 24
 * months — so client-side aggregation is safe with paginated fetches.
 *
 * Hard rules enforced here (per skills/youtube-market-reports/query-rules.md):
 *   UF1: ClosePrice / ListPrice >= 10000 on every aggregation.
 *   UF2: sale_to_final_list_ratio in [0.5, 1.5] on every ratio aggregation.
 *   UF3: SFR filter applied at fetch time.
 *   C2:  CloseDate timezone shift to America/Los_Angeles (UTC midnight = 4pm
 *        Pacific previous day) handled via padded UTC fetch + post-fetch filter.
 *   C3:  Active inventory snapshot SFR-only — never read market_pulse_live.
 *   Days-to-pending: pre-computed `days_to_pending` column, never DaysOnMarket.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchAllRows } from '../supabase/paginate';
import {
  type DateWindow,
  type Market,
  type PropertySubType,
} from '../../video/market-report/src/VideoProps';
import {
  passesUf1,
  passesUf2,
  RESIDENTIAL_PRICE_FLOOR,
  SALE_TO_LIST_MAX,
  SALE_TO_LIST_MIN,
} from './aggregations';

// ---------------------------------------------------------------------------
// Market -> Supabase scope
// ---------------------------------------------------------------------------

export interface MarketScope {
  /** Cities to match via `.in('City', cities)` on the listings table. */
  cities?: readonly string[];
  /** County to match via `.eq('CountyOrParish', countyOrParish)`. */
  countyOrParish?: string;
}

/**
 * Map a Market enum to the Supabase filter shape. Cities use the listings
 * table's `City` column; counties use `CountyOrParish`. Aliases account for
 * MLS data-entry variations ("La Pine" / "Lapine", "Sunriver" / "Sun River").
 */
export function scopeForMarket(market: Market): MarketScope {
  switch (market) {
    case 'Bend':
      return { cities: ['Bend'] };
    case 'Redmond':
      return { cities: ['Redmond'] };
    case 'Sisters':
      return { cities: ['Sisters'] };
    case 'Sunriver':
      return { cities: ['Sunriver', 'Sun River'] };
    case 'La Pine':
      return { cities: ['La Pine', 'Lapine'] };
    case 'Jefferson County':
      return { countyOrParish: 'Jefferson' };
    case 'Crook County':
      return { countyOrParish: 'Crook' };
  }
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/** Shape returned to aggregations.ts for any closed-SFR aggregate. */
export interface ClosedSfrRow {
  ListingKey: string;
  ClosePrice: number;
  /** Raw stored CloseDate (midnight UTC). Pacific-correct date filtering happens client-side. */
  CloseDate: string;
  PostalCode: string | null;
  TotalLivingAreaSqFt: number | null;
  /** Pre-computed days_to_pending column — Beacon methodology. */
  days_to_pending: number | null;
  /** ClosePrice / ListPrice. UF2-clamped before reaching aggregations. */
  sale_to_final_list_ratio: number | null;
  /** ClosePrice / OriginalListPrice. */
  sale_to_list_ratio: number | null;
  /** ClosePrice / TotalLivingAreaSqFt. */
  close_price_per_sqft: number | null;
  /** Lowercase column. */
  property_sub_type: PropertySubType | string | null;
}

/** Active-listing snapshot row used for inventory + MoS. */
export interface ActiveSfrRow {
  ListingKey: string;
  ListPrice: number;
  OnMarketDate: string | null;
  property_sub_type: PropertySubType | string | null;
  /** A=Residential. */
  PropertyType: string | null;
}

/** Date window padded by one day on each side to absorb the CloseDate UTC offset. */
export function paddedUtcWindow(window: DateWindow): { gteIso: string; lteIso: string } {
  // CloseDate stored as UTC midnight = 4pm Pacific previous day. To capture
  // every Pacific-local close in [start, end], fetch UTC in [start, end+1].
  // Adding +/-1 day on each side gives a small buffer; precise filter happens
  // post-fetch in `inPacificWindow`.
  const start = new Date(`${window.start}T00:00:00Z`);
  const end = new Date(`${window.end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  end.setUTCDate(end.getUTCDate() + 2);
  return {
    gteIso: start.toISOString(),
    lteIso: end.toISOString(),
  };
}

/** True when a UTC-stored timestamp falls inside the Pacific-local date window. */
export function inPacificWindow(closeDateUtc: string, window: DateWindow): boolean {
  const ymdPt = pacificYmd(closeDateUtc);
  if (!ymdPt) return false;
  return ymdPt >= window.start && ymdPt <= window.end;
}

/** Convert a UTC timestamp string to a 'YYYY-MM-DD' Pacific date. */
export function pacificYmd(isoUtc: string): string | null {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return null;
  // Intl is reliable for fixed-offset conversion across DST.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d); // en-CA emits 'YYYY-MM-DD'
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

const CLOSED_SELECT = [
  'ListingKey',
  'ClosePrice',
  'CloseDate',
  'PostalCode',
  'TotalLivingAreaSqFt',
  'days_to_pending',
  'sale_to_final_list_ratio',
  'sale_to_list_ratio',
  'close_price_per_sqft',
  'property_sub_type',
].join(', ');

const ACTIVE_SELECT = [
  'ListingKey',
  'ListPrice',
  'OnMarketDate',
  'property_sub_type',
  'PropertyType',
].join(', ');

/**
 * Pull every closed SFR row for a market within a Pacific-local date window.
 * Applies UF1 + UF3 at query time; UF2 in TS post-fetch (so rows still come
 * through for non-ratio aggregations like medians).
 */
export async function fetchClosedSfrInWindow(
  client: SupabaseClient,
  market: Market,
  windowPt: DateWindow,
): Promise<ClosedSfrRow[]> {
  const scope = scopeForMarket(market);
  const { gteIso, lteIso } = paddedUtcWindow(windowPt);

  const rows = await fetchAllRows<ClosedSfrRow>(client, 'listings', CLOSED_SELECT, (q) => {
    let query = q
      .eq('PropertyType', 'A')                                       // UF3 (residential)
      .eq('property_sub_type', 'Single Family Residence')            // UF3 (SFR)
      .eq('StandardStatus', 'Closed')
      .gte('ClosePrice', RESIDENTIAL_PRICE_FLOOR)                    // UF1
      .gte('CloseDate', gteIso)
      .lte('CloseDate', lteIso);
    if (scope.cities) {
      query = query.in('City', scope.cities as string[]);
    } else if (scope.countyOrParish) {
      query = query.eq('CountyOrParish', scope.countyOrParish);
    }
    return query;
  });

  return rows.filter((row) => inPacificWindow(row.CloseDate, windowPt));
}

/**
 * Pull every active SFR row for a market — the inventory snapshot used by
 * Scene 4 and by Months of Supply. Applies UF1 + UF3.
 */
export async function fetchActiveSfrSnapshot(
  client: SupabaseClient,
  market: Market,
): Promise<ActiveSfrRow[]> {
  const scope = scopeForMarket(market);
  return fetchAllRows<ActiveSfrRow>(client, 'listings', ACTIVE_SELECT, (q) => {
    let query = q
      .eq('PropertyType', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .eq('StandardStatus', 'Active')
      .gte('ListPrice', RESIDENTIAL_PRICE_FLOOR);
    if (scope.cities) {
      query = query.in('City', scope.cities as string[]);
    } else if (scope.countyOrParish) {
      query = query.eq('CountyOrParish', scope.countyOrParish);
    }
    return query;
  });
}

/**
 * Pull active inventory broken out by sub-type — SFR, Condo/Townhouse, Land.
 * Used by Scene 4 Part A stacked area chart. Returns RAW listings for client
 * grouping rather than separate SQL calls per sub-type.
 */
export interface ActiveInventoryRow {
  ListingKey: string;
  OnMarketDate: string | null;
  ListPrice: number;
  PropertyType: string | null;
  property_sub_type: string | null;
}

export async function fetchActiveInventoryBySubType(
  client: SupabaseClient,
  market: Market,
): Promise<ActiveInventoryRow[]> {
  const scope = scopeForMarket(market);
  return fetchAllRows<ActiveInventoryRow>(
    client,
    'listings',
    'ListingKey, OnMarketDate, ListPrice, PropertyType, property_sub_type',
    (q) => {
      let query = q
        .eq('StandardStatus', 'Active')
        .gte('ListPrice', RESIDENTIAL_PRICE_FLOOR);
      if (scope.cities) {
        query = query.in('City', scope.cities as string[]);
      } else if (scope.countyOrParish) {
        query = query.eq('CountyOrParish', scope.countyOrParish);
      }
      return query;
    },
  );
}

// ---------------------------------------------------------------------------
// Post-fetch UF2 + sub-type splits for downstream aggregations
// ---------------------------------------------------------------------------

/** Apply UF2 in TS so rows missing the ratio aren't dropped from non-ratio queries. */
export function uf2Filter(rows: readonly ClosedSfrRow[]): ClosedSfrRow[] {
  return rows.filter((r) => r.sale_to_final_list_ratio === null || passesUf2(r.sale_to_final_list_ratio));
}

/** Convenience: rows with a numeric, UF1-passing ClosePrice. */
export function priceFilter(rows: readonly ClosedSfrRow[]): ClosedSfrRow[] {
  return rows.filter((r) => passesUf1(r.ClosePrice));
}

/** Bounds re-export for tests asserting alignment with aggregations.ts. */
export const RATIO_BOUNDS = { min: SALE_TO_LIST_MIN, max: SALE_TO_LIST_MAX } as const;
