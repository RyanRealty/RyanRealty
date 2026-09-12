'use client'

import { V3Button } from '@/components/site/v3'

export type ListingSaveState = 'idle' | 'saving' | 'saved'

/**
 * Save on the listing-detail PriceCtaStrip. Named so ci:mockup-parity can
 * fail if the control disappears (SITE-99 / Matt 2026-09-12). Search tiles
 * stay no-heart (Matt 2026-06-03).
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
  return (
    <V3Button
      type="button"
      variant="ghost"
      onClick={onSave}
      disabled={saveState === 'saving'}
      ariaPressed={saveState === 'saved'}
      ariaLabel={ariaLabel}
    >
      {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Save'}
    </V3Button>
  )
}
