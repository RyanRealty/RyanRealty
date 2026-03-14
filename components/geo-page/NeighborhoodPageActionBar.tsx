'use client'

import PageActionBar from './PageActionBar'

type Props = {
  neighborhoodName: string
  cityName: string
  shareUrl: string
  /** 'bar' = full-width below hero (default). 'overlay' = compact in hero top-right. */
  variant?: 'bar' | 'overlay'
}

/** Neighborhood pages: share only (no save/like for neighborhood entity yet). */
export default function NeighborhoodPageActionBar({
  neighborhoodName,
  cityName,
  shareUrl,
  variant = 'bar',
}: Props) {
  return (
    <PageActionBar
      shareUrl={shareUrl}
      shareTitle={`${neighborhoodName} in ${cityName}, Oregon | Homes for sale | Ryan Realty`}
      shareText={`Explore ${neighborhoodName} in ${cityName}, Oregon — homes for sale.`}
      signedIn={true}
      variant={variant}
    />
  )
}
