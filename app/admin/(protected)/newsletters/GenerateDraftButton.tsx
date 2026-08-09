'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/v2'
import { adminGenerateNewsletterDraftAction } from '@/app/actions/newsletter'

/**
 * "Generate draft from live data" — runs the curation producer, then routes to
 * the new draft for review. Draft-first: this only WRITES a draft, it never sends.
 *
 * Admin v2 (11F): the shadcn Button was replaced by the locked admin language —
 * variant="outline" maps to "quiet", the same bordered secondary weight — and
 * the error line's shadcn destructive colour to var(--a-danger). Presentation
 * only: same
 * server action, same routing, same strings.
 */
export function GenerateDraftButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const res = await adminGenerateNewsletterDraftAction()
      // M7: on ok OR when a draft for this month already exists, route to that draft
      // (don't create a duplicate row).
      if (res.id && (res.ok || res.error === 'draft_exists')) {
        router.push(`/admin/newsletters/${res.id}`)
      } else {
        setError(res.error ?? 'Could not generate a draft.')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="quiet" onClick={onClick} disabled={pending}>
        {pending ? 'Generating…' : 'Generate draft from live data'}
      </Button>
      {error ? (
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</span>
      ) : null}
    </div>
  )
}
