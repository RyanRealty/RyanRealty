'use client'

import { V3Button } from '@/components/site/v3'
import { V3ActionSwapText } from '@/components/site/v3/V3ActionSwap'

export type ListingSaveState = 'idle' | 'saving' | 'saved'

/**
 * Save on the listing-detail PriceCtaStrip. Named so ci:mockup-parity can
 * fail if the control disappears (SITE-99 / Matt 2026-09-12). Search tiles
 * stay no-heart (Matt 2026-06-03). Label swap is beUI action-swap.
 */
export function ListingSaveButton({
  saveState,
  onSave,
  ariaLabel,
}: {
  saveState: ListingSaveState
  onSave: () => void
  ariaLabel: string
}) {
  const label = saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Save'
  return (
    <V3Button
      type="button"
      variant="ghost"
      onClick={onSave}
      disabled={saveState === 'saving'}
      ariaPressed={saveState === 'saved'}
      ariaLabel={ariaLabel}
    >
      <V3ActionSwapText value={saveState}>{label}</V3ActionSwapText>
    </V3Button>
  )
}
