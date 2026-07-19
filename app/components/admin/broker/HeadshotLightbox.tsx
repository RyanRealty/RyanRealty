'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'

/**
 * Full-size headshot lightbox. Rendered nested inside the headshot section (not
 * as a top-level sibling) so it never inherits the parent form's space-y-6 top
 * margin, which would punch a gap at the top of the fixed, full-viewport overlay.
 */
export function HeadshotLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Headshot full size"
      onClick={onClose}
    >
      <Button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-card/90 p-2 text-foreground shadow hover:bg-card"
        aria-label="Close"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" />
      </Button>
      <div className="max-h-[90vh] max-w-[90vw] overflow-auto" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Lightbox: dynamic headshot URL in admin form */}
        <img src={url} alt="Headshot full size" className="max-h-[85vh] w-auto max-w-full object-contain" />
      </div>
    </div>
  )
}
