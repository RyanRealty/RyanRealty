'use client'

/**
 * Save heart for a Field photograph. Lives in the barrel so a photo door can
 * carry the same save control without importing the shadcn tile bar.
 */
import { useState, useTransition } from 'react'
import { toggleSavedListing } from '@/app/actions/saved-listings'
import { redirectToLoginForSave } from '@/lib/pending-save'
import { useResumePendingSave } from '@/lib/hooks/useResumePendingSave'
import { cn } from '@/lib/utils'

export function V3SaveHeart({
  listingKey,
  saved = false,
}: {
  listingKey: string
  saved?: boolean
}) {
  const [on, setOn] = useState(saved)
  const [pending, start] = useTransition()

  useResumePendingSave({
    listingKey,
    alreadySaved: on,
    onSaved: () => setOn(true),
  })

  return (
    <button
      type="button"
      className={cn('v3-field__save', on && 'is-saved')}
      aria-pressed={on}
      aria-label={on ? 'Remove from saved homes' : 'Save this home'}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        start(async () => {
          const result = await toggleSavedListing(listingKey)
          if (result.error === 'Not signed in') {
            redirectToLoginForSave(listingKey)
            return
          }
          if (result.error) return
          setOn(result.saved)
        })
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20.4s-7.2-4.5-9.4-8.7C.8 8.4 2.3 5 5.8 5c1.9 0 3.2 1.1 4 2.3C10.6 6.1 11.9 5 13.8 5c3.5 0 5 3.4 3.2 6.7C19.2 15.9 12 20.4 12 20.4z"
          fill={on ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
