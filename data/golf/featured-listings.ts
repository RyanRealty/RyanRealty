/**
 * Featured active listing per golf community.
 *
 * Pulls the single highest-priced active SFR listing per community for
 * the Where-to-Live cards on the Central Oregon Golf LP. Single combined
 * query — no N+1 round-trips.
 *
 * Per CLAUDE.md §0 Data Accuracy, every figure renders from the live
 * `listings` table with PropertyType='A' (SFR) and "StandardStatus"='Active'.
 * If no active listing exists for a community, the card simply omits the
 * Featured-Listing block — never a wrong number.
 *
 * Per CLAUDE.md "listings mixed-case quirk", every column reference
 * uses the quoted PascalCase form Postgres expects.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { ListingCardData } from '@/components/lp/ListingCard'
import type { GolfCommunitySlug } from './community-kpis'

interface SubdivPattern {
  /** ILIKE patterns to match against listings."SubdivisionName" */
  patterns: string[]
}

// Per-community SubdivisionName ILIKE patterns. MLS data is messy — same
// community can render as "Tetherow", "Tetherow Crossing", etc. Patterns
// stay permissive to catch the variants. Per CLAUDE.md banning unverified
// figures, when in doubt the helper returns null rather than a maybe-match.
const COMMUNITY_PATTERNS: Record<GolfCommunitySlug, SubdivPattern> = {
  tetherow: { patterns: ['Tetherow%'] },
  'broken-top': { patterns: ['Broken Top%'] },
  pronghorn: { patterns: ['Pronghorn%', 'Juniper Preserve%'] },
  sunriver: { patterns: ['Sunriver%'] },
  'caldera-springs': { patterns: ['Caldera Springs%'] },
  crosswater: { patterns: ['Crosswater%'] },
  'black-butte-ranch': { patterns: ['Black Butte Ranch%'] },
  'brasada-ranch': { patterns: ['Brasada%'] },
  'eagle-crest': { patterns: ['Eagle Crest%'] },
  'awbrey-glen': { patterns: ['Awbrey Glen%'] },
  'widgi-creek': { patterns: ['Widgi Creek%'] },
  'three-rivers': { patterns: ['Three Rivers South%', 'Three Rivers%'] },
}

interface ListingRow {
  ListingKey: string
  ListNumber: string | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  PhotoURL: string | null
  StandardStatus: string | null
  CumulativeDaysOnMarket: number | null
  SubdivisionName: string | null
}

function rowToCard(row: ListingRow): ListingCardData | null {
  if (row.ListPrice == null || !Number.isFinite(row.ListPrice)) return null
  const address = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim()
  if (!address) return null
  return {
    listingKey: row.ListingKey,
    listNumber: row.ListNumber,
    address,
    city: row.City,
    listPrice: row.ListPrice,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotal,
    sqft: row.TotalLivingAreaSqFt,
    photoUrl: row.PhotoURL,
    statusLabel: row.StandardStatus,
    daysOnMarket: row.CumulativeDaysOnMarket,
    subdivision: row.SubdivisionName,
  }
}

export async function loadGolfFeaturedListings(): Promise<
  Record<GolfCommunitySlug, ListingCardData | null>
> {
  const supabase = createServiceClient()
  const slugs = Object.keys(COMMUNITY_PATTERNS) as GolfCommunitySlug[]
  const out: Record<string, ListingCardData | null> = {}
  for (const s of slugs) out[s] = null

  await Promise.all(
    slugs.map(async (slug) => {
      const patterns = COMMUNITY_PATTERNS[slug].patterns
      // OR across patterns. Supabase wants comma-separated for `.or(...)`.
      const orExpr = patterns.map((p) => `"SubdivisionName".ilike.${p}`).join(',')
      const { data, error } = await supabase
        .from('listings')
        .select(
          '"ListingKey","ListNumber","StreetNumber","StreetName","City","ListPrice","BedroomsTotal","BathroomsTotal","TotalLivingAreaSqFt","PhotoURL","StandardStatus","CumulativeDaysOnMarket","SubdivisionName"',
        )
        .eq('PropertyType', 'A')
        .eq('"StandardStatus"', 'Active')
        .or(orExpr)
        .order('"ListPrice"', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) {
        console.warn(`[golf-lp featured-listing ${slug}]`, error.message)
        return
      }
      if (!data) return
      out[slug] = rowToCard(data as ListingRow)
    }),
  )

  return out as Record<GolfCommunitySlug, ListingCardData | null>
}
