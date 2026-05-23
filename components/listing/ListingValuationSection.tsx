import { createClient } from '@supabase/supabase-js'
import { getCachedCMA, computeCMA } from '@/lib/cma'
import ListingValuation from './ListingValuation'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

type Props = {
  listingKey: string
  signedIn: boolean
  propertyId?: string | null
}

/**
 * Fetches valuation for a listing. Looks up the property by matching address,
 * then checks for cached CMA or computes one.
 */
export default async function ListingValuationSection({
  listingKey,
  signedIn,
  propertyId: propIdFromParent,
}: Props) {
  void getServiceSupabase
  let propertyId = propIdFromParent ?? null

  if (!propertyId) {
    const { getListingTiles, findPropertiesByAddressFilter } = await import('@/lib/data')
    const tiles = await getListingTiles({ listingKeys: [listingKey], status: 'all', limit: 1 })
    const tile = tiles[0]
    if (!tile?.city) return null
    const props = await findPropertiesByAddressFilter({
      city: tile.city,
      postalCode: tile.postalCode ?? null,
      limit: 5,
    })
    const exact = tile.streetNumber
      ? props.find((p) => String(p as Record<string, unknown>['street_number'] ?? '') === String(tile.streetNumber))
      : props[0]
    propertyId = (exact?.id) ?? props[0]?.id ?? null
  }

  if (!propertyId) return null

  let cma = await getCachedCMA(propertyId)
  if (!cma) {
    try {
      cma = await computeCMA(propertyId)
    } catch {
      return null
    }
  }
  if (!cma || cma.comps.length === 0) return null

  return (
    <ListingValuation
      listingKey={listingKey}
      propertyId={propertyId}
      valuation={{
        estimatedValue: cma.estimatedValue,
        valueLow: cma.valueLow,
        valueHigh: cma.valueHigh,
        confidence: cma.confidence,
        compCount: cma.comps.length,
        methodology: cma.methodology,
      }}
      signedIn={signedIn}
    />
  )
}
