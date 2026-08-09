'use client'

/**
 * EmailPreviewDialog — renders the ACTUAL email a subscription would send,
 * visually, in a sandboxed iframe (Matt directive: see the email, never raw
 * HTML). The parent passes a loader that calls the matching preview server
 * action (previewAlertEmailAction / previewReportEmailAction), which runs the
 * same builder functions the send path uses on the subscription's current data.
 *
 * P11F: on the LOCKED admin v2 language — the shadcn Dialog became the v2
 * Dialog (the platform's <dialog>, so the focus trap, Esc and top-layer
 * stacking come from the browser), at the 'work' width because a rendered
 * email needs the room. The shadcn Skeletons became report-grid.css's
 * av2-rskel rows.
 */

import { useEffect, useState } from 'react'
import { Dialog } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'

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
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="work"
      description={
        state === 'ready'
          ? <>Subject: <span className="font-medium" style={{ color: 'var(--a-text)' }}>{subject}</span></>
          : 'Rendered exactly as the recipient receives it.'
      }
    >
      {note && state === 'ready' ? (
        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>{note}</p>
      ) : null}
      <div
        className="min-h-0 flex-1 overflow-hidden rounded-lg"
        style={{ border: '1px solid var(--a-border)' }}
      >
        {state === 'loading' ? (
          <div className="space-y-3 p-4" aria-hidden="true">
            <div className="av2-rskel__row w-2/3" style={{ height: 32, margin: 0 }} />
            <div className="av2-rskel__row" style={{ height: 160, margin: 0 }} />
            <div className="av2-rskel__row" style={{ height: 160, margin: 0 }} />
          </div>
        ) : state === 'error' ? (
          <p className="p-4 text-sm" style={{ color: 'var(--a-danger)' }} role="alert">{error}</p>
        ) : (
          <iframe
            title={`${title} preview`}
            srcDoc={html}
            sandbox=""
            className="w-full"
            style={{ height: '65vh', background: 'var(--a-bg)' }}
          />
        )}
      </div>
    </Dialog>
  )
}
