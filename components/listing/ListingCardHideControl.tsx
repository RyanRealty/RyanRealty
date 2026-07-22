'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { ViewOffSlashIcon } from '@hugeicons/core-free-icons'
import { hideListing, unhideListing } from '@/app/actions/hidden-listings'
import { cn } from '@/lib/utils'

type Props = {
  /** Listing identifier (ListingKey or MLS ListNumber — the action canonicalizes). */
  listingKey: string
  /** Short label for the toast, e.g. "2732 NW Ordway Ave". */
  addressLine?: string
  /** Parent sync: called optimistically on hide and again on undo/failure revert. */
  onVisibilityChange?: (listingKey: string, hidden: boolean) => void
  className?: string
}

/**
 * Subtle hide affordance for listing result cards. Rendered as an overlay by
 * the RESULTS layer (not inside ListingCard — the canonical card stays lean,
 * per the no-favorite-on-tiles directive) and revealed on hover/focus. Hiding
 * is optimistic with a toast undo. Signed-out clicks surface a sign-in nudge
 * instead of silently failing.
 */
export default function ListingCardHideControl({
  listingKey,
  addressLine,
  onVisibilityChange,
  className,
}: Props) {
  const [pending, startTransition] = useTransition()

  function handleHide(event: React.MouseEvent) {
    // The control floats above the card's <Link> — never navigate on hide.
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    startTransition(async () => {
      // Optimistic: drop the card immediately, revert if the server declines.
      onVisibilityChange?.(listingKey, true)
      const { error } = await hideListing(listingKey)
      if (error === 'Not signed in') {
        onVisibilityChange?.(listingKey, false)
        toast('Sign in to hide homes', {
          description: 'Hidden homes stay out of your results and alert emails.',
        })
        return
      }
      if (error) {
        onVisibilityChange?.(listingKey, false)
        toast.error('Could not hide this home. Please try again.')
        return
      }
      toast(addressLine ? `Hidden ${addressLine}` : 'Home hidden', {
        description: 'It will not appear in your results or alert emails.',
        action: {
          label: 'Undo',
          onClick: () => {
            onVisibilityChange?.(listingKey, false)
            void unhideListing(listingKey)
          },
        },
      })
    })
  }

  return (
    <button
      type="button"
      onClick={handleHide}
      disabled={pending}
      aria-label={addressLine ? `Hide ${addressLine} from your results` : 'Hide this home from your results'}
      title="Hide this home"
      className={cn(
        // Hover/focus-revealed, matching the card's quiet interaction register.
        // Uses the NAMED group `group/hide` (set by the results-layer wrapper)
        // so it never entangles with ListingCard's own internal `group` styles.
        // Always visible on touch (no hover) via the coarse-pointer class below.
        'absolute top-2.5 right-2.5 z-10 inline-flex size-8 items-center justify-center rounded-full',
        'bg-card/90 text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm',
        'opacity-0 transition-opacity duration-200',
        'group-hover/hide:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:text-foreground hover:bg-card',
        '[@media(pointer:coarse)]:opacity-100',
        'disabled:opacity-50',
        className,
      )}
    >
      <HugeiconsIcon icon={ViewOffSlashIcon} strokeWidth={1.8} className="size-4" />
    </button>
  )
}
