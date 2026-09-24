'use client'

/**
 * Download — mints a short-lived signed URL for a document the client is
 * allowed to see (their signed envelopes or documents shared with them; see
 * clientDocumentUrl() in lib/data/tc/client-transactions.ts) and opens it in
 * a new tab, so the client never loses their place on the portal page.
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { getMyDocumentLink } from '@/app/actions/client-transactions'

export function DownloadDocumentButton({ dealId, documentId }: { dealId: string; documentId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await getMyDocumentLink(dealId, documentId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button type="button" variant="outline" disabled={pending} onClick={onClick} className="h-11 px-5">
        {pending ? 'Preparing…' : 'Download'}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="status">
          {error}
        </p>
      ) : null}
    </div>
  )
}
