/**
 * Server-only data fetchers for /lp/listings/[mls_slug]/ pages.
 *
 * Each page is a dynamic Next.js route with ISR (revalidate=3600). Every
 * figure on the page traces to a live Supabase query at server-render time
 * per CLAUDE.md §0 Data Accuracy mandate.
 *
 * Spec: marketing_brain_skills/producers/site-listing-page/SKILL.md
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type ListingRow = {
  ListingKey: string | null
  ListNumber: string | null
  ListPrice: number | null
  OriginalListPrice: number | null
  ClosePrice: number | null
  StandardStatus: string | null
  PropertyType: string | null
  PropertySubType: string | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  StateOrProvince: string | null
  PostalCode: string | null
  Latitude: number | null
  Longitude: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  LotSizeAcres: number | null
  year_built: number | null
  GarageSpaces: number | null
  PublicRemarks: string | null
  CumulativeDaysOnMarket: number | null
  DaysOnMarket: number | null
  AssociationFee: number | null
  AssociationFeeFrequency: string | null
  TaxAnnualAmount: number | null
  ListingAgentFullName: string | null
  ListAgentEmail: string | null
  ListOfficeName: string | null
  PhotoURL: string | null
  SubdivisionName: string | null
  ModificationTimestamp: string | null
  OnMarketDate: string | null
  VirtualTourURLUnbranded: string | null
  VirtualTourURLBranded: string | null
}

export type Comp = {
  ListingKey: string | null
  ListNumber: string | null
  ClosePrice: number | null
  CloseDate: string | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  StreetNumber: string | null
  StreetName: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
}

/** Look up a listing by its MLS number (ListNumber field). */
export async function getListingByMlsNumber(mlsNumber: string): Promise<ListingRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listings')
    .select(
      [
        'ListingKey',
        'ListNumber',
        'ListPrice',
        'OriginalListPrice',
        'ClosePrice',
        'StandardStatus',
        'PropertyType',
        'PropertySubType',
        'StreetNumber',
        'StreetName',
        'City',
        'StateOrProvince',
        'PostalCode',
        'Latitude',
        'Longitude',
        'BedroomsTotal',
        'BathroomsTotal',
        'TotalLivingAreaSqFt',
        'LotSizeAcres',
        'year_built',
        'GarageSpaces',
        'PublicRemarks',
        'CumulativeDaysOnMarket',
        'DaysOnMarket',
        'AssociationFee',
        'AssociationFeeFrequency',
        'TaxAnnualAmount',
        'ListingAgentFullName',
        'ListAgentEmail',
        'ListOfficeName',
        'PhotoURL',
        'SubdivisionName',
        'ModificationTimestamp',
        'OnMarketDate',
        'VirtualTourURLUnbranded',
        'VirtualTourURLBranded',
      ].join(','),
    )
    .eq('ListNumber', mlsNumber)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[listing-page/data] lookup failed:', error.message)
    return null
  }
  return (data as unknown as ListingRow) ?? null
}

/**
 * Find recent comparable closings in the same sub-plat or city. Widens the
 * search progressively if the tight criteria return < 3 comps.
 */
export async function getRecentComps(listing: ListingRow): Promise<Comp[]> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  async function runQuery(opts: {
    bedTolerance: number
    sqftTolerance: number
    useSubdivision: boolean
  }): Promise<Comp[]> {
    let q = supabase
      .from('listings')
      .select(
        'ListingKey, ListNumber, ClosePrice, CloseDate, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, StreetNumber, StreetName, SubdivisionName, PhotoURL',
      )
      .in('StandardStatus', ['Closed', 'Sold'])
      .eq('PropertyType', listing.PropertyType ?? 'A')
      .gte('CloseDate', since)
      .order('CloseDate', { ascending: false })
      .limit(8)
    if (opts.useSubdivision && listing.SubdivisionName) {
      q = q.eq('SubdivisionName', listing.SubdivisionName)
    } else if (listing.City) {
      q = q.eq('City', listing.City)
    }
    if (listing.BedroomsTotal && opts.bedTolerance > 0) {
      q = q
        .gte('BedroomsTotal', listing.BedroomsTotal - opts.bedTolerance)
        .lte('BedroomsTotal', listing.BedroomsTotal + opts.bedTolerance)
    }
    if (listing.TotalLivingAreaSqFt && opts.sqftTolerance > 0) {
      q = q
        .gte('TotalLivingAreaSqFt', Math.max(0, listing.TotalLivingAreaSqFt - opts.sqftTolerance))
        .lte('TotalLivingAreaSqFt', listing.TotalLivingAreaSqFt + opts.sqftTolerance)
    }
    const { data, error } = await q
    if (error) {
      console.warn('[listing-page/data] comp query failed:', error.message)
      return []
    }
    return (data ?? []) as Comp[]
  }

  // Tight pass: same sub-plat, ±1 bedroom, ±600 sqft
  let comps = await runQuery({ bedTolerance: 1, sqftTolerance: 600, useSubdivision: true })
  if (comps.length >= 3) return comps

  // Widen: drop bed tolerance
  comps = await runQuery({ bedTolerance: 2, sqftTolerance: 1000, useSubdivision: true })
  if (comps.length >= 3) return comps

  // Widen: drop sub-plat, keep city
  comps = await runQuery({ bedTolerance: 1, sqftTolerance: 800, useSubdivision: false })
  return comps
}

/**
 * Determine whether this listing belongs to Ryan Realty (our listing) or
 * another brokerage (OPM — Other People's Money / listings).
 *
 * Per Oregon RMLS IDX rules, every listing displayed must attribute the
 * listing brokerage + listing agent name on the page. For OPM listings we
 * route the showing CTA to our buyer's agent; for our listings we route
 * directly to the listing agent.
 */
export function isOurListing(listing: ListingRow): boolean {
  const email = (listing.ListAgentEmail ?? '').toLowerCase()
  const office = (listing.ListOfficeName ?? '').toLowerCase()
  if (email.endsWith('@ryan-realty.com')) return true
  if (office.includes('ryan realty')) return true
  return false
}

/**
 * Determine the parent community slug for a listing based on its
 * SubdivisionName. Returns null if the listing isn't inside a tracked
 * resort community in `data/resort-community-*.json`.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

type ResortCommunityAliases = {
  slug: string
  name: string
  subdivision_aliases?: string[]
}

let _communityAliasCache: { loadedAt: number; communities: ResortCommunityAliases[] } | null = null
const ALIAS_TTL_MS = 5 * 60 * 1000

async function loadCommunitiesIndex(): Promise<ResortCommunityAliases[]> {
  if (_communityAliasCache && Date.now() - _communityAliasCache.loadedAt < ALIAS_TTL_MS) {
    return _communityAliasCache.communities
  }
  const out: ResortCommunityAliases[] = []
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const entries = await fs.readdir(dataDir, { withFileTypes: true })
    for (const ent of entries) {
      if (!ent.isFile()) continue
      if (!ent.name.startsWith('resort-community-') || !ent.name.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(dataDir, ent.name), 'utf8')
        const parsed = JSON.parse(raw) as Partial<ResortCommunityAliases>
        if (parsed?.slug) out.push({ slug: parsed.slug, name: parsed.name ?? parsed.slug, subdivision_aliases: parsed.subdivision_aliases ?? [] })
      } catch {
        // skip malformed
      }
    }
  } catch {
    // no data dir
  }
  _communityAliasCache = { loadedAt: Date.now(), communities: out }
  return out
}

export async function resolveParentCommunity(listing: ListingRow): Promise<{ slug: string; name: string } | null> {
  if (!listing.SubdivisionName) return null
  const communities = await loadCommunitiesIndex()
  const sub = listing.SubdivisionName.trim()
  for (const c of communities) {
    if (sub === c.slug) return { slug: c.slug, name: c.name }
    if ((c.subdivision_aliases ?? []).includes(sub)) return { slug: c.slug, name: c.name }
  }
  return null
}
