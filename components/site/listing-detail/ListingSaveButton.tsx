'use client'

import { ActionSwapText } from '@/components/motion/action-swap'
import { Button } from '@/components/ui/button'

export type ListingSaveState = 'idle' | 'saving' | 'saved'

/**
 * Save on the listing-detail PriceCtaStrip. Named so ci:mockup-parity can
 * fail if the control disappears (SITE-99 / Matt 2026-09-12). Search tiles
 * stay no-heart (Matt 2026-06-03). Label swap is the installed beUI action-swap.
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
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="rounded-none first:rounded-l-lg last:rounded-r-lg"
      onClick={onSave}
      disabled={saveState === 'saving'}
      aria-pressed={saveState === 'saved'}
      aria-label={ariaLabel}
    >
      <ActionSwapText value={saveState}>{label}</ActionSwapText>
    </Button>
  )
}
