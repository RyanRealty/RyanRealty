'use client'

/**
 * EmailPreviewDialog — renders the ACTUAL email a subscription would send,
 * visually, in a sandboxed iframe (Matt directive: see the email, never raw
 * HTML). The parent passes a loader that calls the matching preview server
 * action (previewAlertEmailAction / previewReportEmailAction), which runs the
 * same builder functions the send path uses on the subscription's current data.
 */

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export type EmailPreviewResult = {
  data: { subject: string, html: string, note: string | null } | null
  error: string | null
}

export default function EmailPreviewDialog({
  open,
  title,
  load,
  onClose,
}: {
  open: boolean
  /** Dialog heading, e.g. "Listing alert email" / "Market report email". */
  title: string
  /** Called when the dialog opens; renders the returned HTML in the iframe. */
  load: () => Promise<EmailPreviewResult>
  onClose: () => void
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setState('loading')
    void (async () => {
      const res = await load()
      if (cancelled) return
      if (!res.data) {
        setError(res.error ?? 'Could not render the email preview')
        setState('error')
        return
      }
      setSubject(res.data.subject)
      setHtml(res.data.html)
      setNote(res.data.note)
      setState('ready')
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex flex-col sm:max-w-3xl" style={{ maxHeight: '90vh' }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state === 'ready'
              ? <>Subject: <span className="font-medium text-foreground">{subject}</span></>
              : 'Rendered exactly as the recipient receives it.'}
          </DialogDescription>
        </DialogHeader>
        {note && state === 'ready' ? (
          <p className="text-xs text-muted-foreground">{note}</p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          {state === 'loading' ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : state === 'error' ? (
            <p className="p-4 text-sm text-destructive" role="alert">{error}</p>
          ) : (
            <iframe
              title={`${title} preview`}
              srcDoc={html}
              sandbox=""
              style={{ height: '65vh' }}
              className="w-full bg-background"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
