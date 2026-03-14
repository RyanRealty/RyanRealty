import { createClient } from '@supabase/supabase-js'
import { getCachedCMA } from '@/lib/cma'
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
  /** If provided, skip fetch (from parent). */
  propertyId?: string | null
  /** If provided, skip fetch (from parent). */
  vowAvmDisplayYn?: boolean | null
}

/** Fetches valuation and listing (vow flag). Renders ListingValuation only when valuation exists and vow_avm_display_yn is true. */
export default async function ListingValuationSection({
  listingKey,
  signedIn,
  propertyId: propIdFromParent,
  vowAvmDisplayYn: vowFromParent,
}: Props) {
  const supabase = getServiceSupabase()
  if (!supabase) return null

  let propertyId = propIdFromParent
  let vowAvmDisplayYn = vowFromParent
  if (propertyId == null || vowAvmDisplayYn == null) {
    const { data: listing } = await supabase
      .from('listings')
      .select('property_id, vow_avm_display_yn')
      .eq('listing_key', listingKey)
      .order('modification_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    const row = listing as { property_id?: string; vow_avm_display_yn?: boolean } | null
    if (propertyId == null) propertyId = row?.property_id ?? null
    if (vowAvmDisplayYn == null) vowAvmDisplayYn = row?.vow_avm_display_yn ?? false
  }

  if (!propertyId || !vowAvmDisplayYn) return null
  const cma = await getCachedCMA(propertyId)
  if (!cma) return null

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
