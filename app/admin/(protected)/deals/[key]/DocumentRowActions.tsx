'use client'

// @no-parity — internal admin tool (TC document row actions)
//
// 11F: off shadcn, onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only — every server action,
// prompt string, alert, reload and disabled condition is carried over byte for
// byte.
//
// Both controls are `quiet`. shadcn's `outline` and `secondary` are two shades
// of "secondary control" and v2 has one such variant, so the archive/unarchive
// distinction is carried where it always actually lived: in the LABEL, which
// flips between "Archive" and "Unarchive". Status is text, never fill alone.
import { useState, useTransition } from 'react'
import { Button } from '@/components/admin/v2'
import { getTcDocumentUrl, setTcDocumentArchived } from '@/app/actions/tc'

export function DownloadButton({ documentId, disabled }: { documentId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="quiet"
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
      variant="quiet"
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
