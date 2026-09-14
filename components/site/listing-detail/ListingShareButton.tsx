'use client'

import { useState } from 'react'
import { V3Button } from '@/components/site/v3'
import { V3ActionSwapText } from '@/components/site/v3/V3ActionSwap'

/**
 * Share on the listing-detail PriceCtaStrip. Named so ci:mockup-parity can
 * fail if the control disappears (SITE-99 / Matt 2026-09-12). SITE-21: stays
 * on off-market homes too. Share→Shared is beUI action-swap.
 */
export function ListingShareButton({
  onShare,
  ariaLabel,
}: {
  onShare: () => void
  ariaLabel: string
}) {
  const [shared, setShared] = useState(false)
  return (
    <V3Button
      type="button"
      variant="ghost"
      onClick={() => {
        onShare()
        setShared(true)
        window.setTimeout(() => setShared(false), 2000)
      }}
      ariaLabel={ariaLabel}
    >
      <V3ActionSwapText value={shared ? 'shared' : 'share'}>{shared ? 'Shared' : 'Share'}</V3ActionSwapText>
    </V3Button>
  )
}
