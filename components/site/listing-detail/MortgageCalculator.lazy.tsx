import dynamic from 'next/dynamic'

/**
 * The listing payment calculator, code-split so its client bundle is not part
 * of the listing page's first load. Same props and markup as MortgageCalculator.
 */
export const MortgageCalculator = dynamic(() =>
  import('@/components/site/listing-detail/MortgageCalculator').then((m) => m.MortgageCalculator),
)
