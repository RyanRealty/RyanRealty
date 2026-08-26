'use client'

/**
 * One draft, everything needed to judge it, two decisions.
 *
 * The media plays inline at the size it will actually be seen at, because a
 * clip judged as a thumbnail is a clip judged wrong. The QA line shows the
 * score the vision gate gave the frame, so a draft that squeaked through at
 * 73 does not look identical to one that came back at 94.
 */
import { useState, useTransition } from 'react'
import { Button, StateWord } from '@/components/admin/v2'
import { approveStudioDraftAction, killStudioDraftAction } from './actions'

export type DraftCardModel = {
  id: string
  label: string
  formatLabel: string
  status: string
  caption: string | null
  mediaUrl: string | null
  posterUrl: string | null
  mediaKind: 'image' | 'video'
  platforms: string[]
  qaScore: number | null
  spendUsd: number | null
  citationCount: number
  origin: string | null
  createdAt: string
}

function qaTone(score: number | null): string {
  if (score == null) return 'var(--a-text-2)'
  if (score >= 85) return 'var(--a-text)'
  return 'var(--a-warning, var(--a-text-2))'
}

export function DraftCard({ draft }: { draft: DraftCardModel }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const decided = draft.status !== 'ready' || done != null

  function approve() {
    setError(null)
    startTransition(async () => {
      const result = await approveStudioDraftAction({ draftId: draft.id })
      if (result.error) return setError(result.error)
      setDone('Approved. The publisher picks it up within ten minutes.')
    })
  }

  function kill() {
    setError(null)
    startTransition(async () => {
      const result = await killStudioDraftAction({ draftId: draft.id })
      if (result.error) return setError(result.error)
      setDone('Killed.')
    })
  }

  return (
    <article
      style={{
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-radius-lg, 10px)',
        padding: 14,
        marginBottom: 14,
        background: 'var(--a-surface)',
        opacity: decided ? 0.72 : 1,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <b style={{ color: 'var(--a-text)' }}>{draft.label}</b>
        <span style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>{draft.formatLabel}</span>
        <span style={{ marginLeft: 'auto' }}>
          <StateWord state={draft.status === 'ready' ? 'waiting' : 'ok'}>{draft.status}</StateWord>
        </span>
      </header>

      {draft.mediaUrl ? (
        <div style={{ maxWidth: 320, marginBottom: 10 }}>
          {draft.mediaKind === 'video' ? (
            <video
              src={draft.mediaUrl}
              poster={draft.posterUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              style={{ width: '100%', borderRadius: 8, display: 'block' }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.mediaUrl}
              alt={draft.label}
              style={{ width: '100%', borderRadius: 8, display: 'block' }}
            />
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>No media stored.</p>
      )}

      {draft.caption ? (
        <p style={{ margin: '0 0 10px', color: 'var(--a-text)', whiteSpace: 'pre-wrap' }}>{draft.caption}</p>
      ) : null}

      <p style={{ margin: '0 0 10px', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        {draft.platforms.join(', ') || 'no platforms'}
        {' · '}
        <span style={{ color: qaTone(draft.qaScore) }}>
          {draft.qaScore != null
            ? `frame ${draft.qaScore}/100`
            : draft.mediaUrl
              ? 'source photograph'
              : 'no frame'}
        </span>
        {' · '}
        {draft.citationCount} cited
        {draft.spendUsd != null ? ` · $${draft.spendUsd.toFixed(2)}` : ''}
        {draft.origin ? ` · ${draft.origin}` : ''}
      </p>

      {draft.status === 'ready' && !done ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" onClick={approve} disabled={pending}>
            {pending ? 'Working' : 'Approve and post'}
          </Button>
          <Button type="button" variant="quiet" onClick={kill} disabled={pending}>
            Kill
          </Button>
        </div>
      ) : null}

      {done ? (
        <p style={{ margin: '8px 0 0', color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>{done}</p>
      ) : null}
      {error ? (
        <p style={{ margin: '8px 0 0', color: 'var(--a-danger)', fontSize: 'var(--a-text-sm)' }}>{error}</p>
      ) : null}
    </article>
  )
}
