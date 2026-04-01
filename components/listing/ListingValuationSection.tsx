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
  const supabase = getServiceSupabase()
  if (!supabase) return null

  let propertyId = propIdFromParent ?? null

  if (!propertyId) {
    const { data: listing } = await supabase
      .from('listings')
      .select('StreetNumber, StreetName, City, PostalCode')
      .eq('ListingKey', listingKey)
      .limit(1)
      .maybeSingle()

    if (!listing) return null
    const row = listing as { StreetNumber?: string; StreetName?: string; City?: string; PostalCode?: string }
    if (!row.City) return null

    let query = supabase
      .from('properties')
      .select('id')
      .ilike('city', row.City)
    if (row.StreetNumber) query = query.eq('street_number', row.StreetNumber)
    if (row.PostalCode) query = query.eq('postal_code', row.PostalCode)
    const { data: props } = await query.limit(1)
    propertyId = (props as { id: string }[] | null)?.[0]?.id ?? null
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
