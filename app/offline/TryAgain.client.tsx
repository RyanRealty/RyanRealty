'use client'

/**
 * Offline retry. Clock and navigator stay in the click handler, not render
 * (hydration-safe on the call line).
 */
import { V3Button } from '@/components/site/v3'

export function TryAgainButton() {
  return (
    <V3Button
      type="button"
      variant="ghost"
      onClick={() => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          window.location.reload()
        }
      }}
    >
      Try again
    </V3Button>
  )
}
