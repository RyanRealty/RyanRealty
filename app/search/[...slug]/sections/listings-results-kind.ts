/** Which empty/grid surface ListingsResults should paint. Timeout/error is
 *  never "no homes" — unknown inventory is not zero (§0). */
export function listingsResultsKind(input: {
  city: string | undefined
  hasFilterOnly: boolean
  listingCount: number
  degraded?: boolean
}): 'no-scope' | 'degraded' | 'empty' | 'grid' {
  if (!input.city && !input.hasFilterOnly) return 'no-scope'
  if (input.degraded && input.listingCount === 0) return 'degraded'
  if (input.listingCount === 0) return 'empty'
  return 'grid'
}
