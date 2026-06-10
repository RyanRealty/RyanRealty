'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { getTcDocumentUrl, setTcDocumentArchived } from '@/app/actions/tc'

export function DownloadButton({ documentId, disabled }: { documentId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true)
        try {
          const { url, error } = await getTcDocumentUrl(documentId)
          if (url) window.open(url, '_blank', 'noopener')
          else if (error) window.alert(error)
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? 'Opening…' : 'Open'}
    </Button>
  )
}

export function ArchiveToggle({
  documentId,
  archived,
  docName,
}: {
  documentId: string
  archived: boolean
  docName: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant={archived ? 'secondary' : 'outline'}
      size="sm"
      disabled={pending}
      onClick={() => {
        let reason: string | null = null
        if (!archived) {
          reason = window.prompt(`Archive reason for:\n${docName}`, 'superseded')
          if (reason === null) return
        }
        startTransition(async () => {
          const res = await setTcDocumentArchived(documentId, !archived, reason)
          if (!res.ok) window.alert(res.error || 'Failed')
          else window.location.reload()
        })
      }}
    >
      {pending ? '…' : archived ? 'Unarchive' : 'Archive'}
    </Button>
  )
}
