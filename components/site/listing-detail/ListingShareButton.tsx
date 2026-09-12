'use client'

import { V3Button } from '@/components/site/v3'

/**
 * Share on the listing-detail PriceCtaStrip. Named so ci:mockup-parity can
 * fail if the control disappears (SITE-99 / Matt 2026-09-12). SITE-21: stays
 * on off-market homes too.
 */
export function ListingShareButton({
  onShare,
  ariaLabel,
}: {
  onShare: () => void
  ariaLabel: string
}) {
  return (
    <V3Button type="button" variant="ghost" onClick={onShare} ariaLabel={ariaLabel}>
      Share
    </V3Button>
  )
}
