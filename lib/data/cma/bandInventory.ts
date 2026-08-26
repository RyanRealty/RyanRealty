/**
 * Live competition in the subject's list-price band.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §4: PropertyType='A' is the MLS
 * residential bucket, not "detached house." Townhouses and condos sit
 * in A. Same property_sub_type only.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

const BAND_SELECT =
  'ListingKey, StreetNumber, StreetName, ListPrice, StandardStatus, DaysOnMarket, OnMarketDate, PhotoURL, Latitude, Longitude, property_sub_type'

// The band is one city, one property type, one status, inside a +/- price
// window, so it is bounded in practice. Page it rather than truncating: the
// medians downstream are only correct over the whole band. CEILING exists so a
// pathological band cannot pull the table; when it is hit, `truncated` says so
// and the CMA discloses it instead of quietly publishing a sample.
const PAGE_SIZE = 1000
const CEILING = 4000

export type CmaBandListingRow = {
  ListingKey: string
  StreetNumber: string | null
  StreetName: string | null
  ListPrice: number | null
  StandardStatus: string | null
  DaysOnMarket: number | null
  OnMarketDate: string | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  property_sub_type?: string | null
}

export type CmaBandInventory = {
  activeAsks: number[]
  activeDaysOnMarket: number[]
  /** Exact row counts from the database, NOT the length of the arrays above. */
  activeCount: number
  pendingCount: number
  /** True if the band exceeded CEILING and the rows are a prefix, not the band. */
  truncated: boolean
  activeRows: CmaBandListingRow[]
  pendingRows: CmaBandListingRow[]
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

function asRows(data: unknown): CmaBandListingRow[] {
  return (Array.isArray(data) ? data : []) as CmaBandListingRow[]
}

export async function getCmaBandInventory(
  city: string,
  lo: number,
  hi: number,
  subjectSubType?: string | null,
): Promise<CmaBandInventory | null> {
  const sb = client()
  if (!sb) return null
  const subType = subjectSubType?.trim() || null

  const scoped = (status: 'Active' | 'Pending', head: boolean) => {
    let q = sb
      .from('listings')
      .select(head ? 'ListingKey' : BAND_SELECT, { count: 'exact', head })
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('StandardStatus', status)
      .gte('ListPrice', lo)
      .lte('ListPrice', hi)
    if (subType) q = q.eq('property_sub_type', subType)
    return q
  }

  // Page the whole band. `.order()` is not decoration: an unordered range is
  // an arbitrary slice, so paging without it can repeat and skip rows.
  const readAll = async (status: 'Active' | 'Pending') => {
    const rows: CmaBandListingRow[] = []
    let truncated = false
    for (let offset = 0; offset < CEILING; offset += PAGE_SIZE) {
      const { data, error } = await scoped(status, false)
        .order('ListPrice', { ascending: true })
        .order('ListingKey', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = asRows(data)
      rows.push(...page)
      if (page.length < PAGE_SIZE) return { rows, truncated }
    }
    truncated = true
    return { rows, truncated }
  }

  try {
    const [activeHead, pendingHead, actives, pendings] = await Promise.all([
      scoped('Active', true),
      scoped('Pending', true),
      readAll('Active'),
      readAll('Pending'),
    ])
    if (activeHead.error || pendingHead.error) {
      throw new Error(activeHead.error?.message ?? pendingHead.error?.message)
    }
    const activeRows = actives.rows
    return {
      activeAsks: activeRows
        .map((r) => Number(r.ListPrice))
        .filter((n) => Number.isFinite(n) && n > 0),
      // Days on market derived from OnMarketDate, not the "DaysOnMarket"
      // column: docs/DATABASE_FOR_AI_AGENTS.md warns that column is
      // list-to-close. Measured on live Active rows 2026-08-26 it tracks
      // days-since-on-market to within 0-4 days (it lags the sync), so the
      // date arithmetic is both exact and free of the canon's objection.
      activeDaysOnMarket: activeRows
        .map((r) => daysOnMarket(r.OnMarketDate))
        .filter((n): n is number => n != null),
      activeCount: activeHead.count ?? activeRows.length,
      pendingCount: pendingHead.count ?? pendings.rows.length,
      truncated: actives.truncated || pendings.truncated,
      activeRows,
      pendingRows: pendings.rows,
    }
  } catch (e) {
    console.error('[getCmaBandInventory]', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Whole days between OnMarketDate and now. Null when the date is unusable. */
function daysOnMarket(onMarketDate: string | null): number | null {
  if (!onMarketDate) return null
  const then = new Date(onMarketDate)
  if (Number.isNaN(then.getTime())) return null
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}
