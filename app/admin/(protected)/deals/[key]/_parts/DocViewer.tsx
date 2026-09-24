'use client'

// @no-parity — internal admin tool (file workspace: the document beside its checklist)
//
// The PDF itself, inline, next to the checklist (Matt picked "tabs + side-by-side
// docs" 2026-09-24). SkySlope opens every preview in a new browser tab; here the
// document stays beside the item it satisfies. The signed link comes from
// getTcDocumentUrl (admin + file-scope guarded) and expires after the TTL in
// lib/tc/document-urls.ts, so it is fetched when the document is opened.
import { useEffect, useState } from 'react'
import { getTcDocumentUrl } from '@/app/actions/tc'

export function DocViewer({ documentId, name, page }: { documentId: string; name: string; page?: number | null }) {
  const [state, setState] = useState<{ id: string; url: string | null; error: string | null }>({
    id: '',
    url: null,
    error: null,
  })

  useEffect(() => {
    let alive = true
    getTcDocumentUrl(documentId)
      .then((r) => {
        if (alive) setState({ id: documentId, url: r.url, error: r.url ? null : r.error ?? 'No stored file for this document' })
      })
      .catch(() => {
        if (alive) setState({ id: documentId, url: null, error: 'The document could not be opened. Try again.' })
      })
    return () => {
      alive = false
    }
  }, [documentId])

  const ready = state.id === documentId
  if (ready && state.error) return <div className="av2-viewer__empty">{state.error}</div>
  if (!ready || !state.url) return <div className="av2-viewer__empty">Opening the document…</div>
  return (
    <>
      <iframe className="av2-viewer__frame" src={`${state.url}#${page ? `page=${page}&` : ''}view=FitH`} title={name} />
      <p className="av2-viewer__meta" style={{ margin: 0, padding: '8px 16px' }}>
        <a href={state.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--a-accent)' }}>
          Open in a new tab
        </a>
      </p>
    </>
  )
}
