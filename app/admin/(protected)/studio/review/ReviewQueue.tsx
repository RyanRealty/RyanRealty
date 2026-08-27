'use client'

/**
 * One draft at a time, two decisions, thumb-reachable.
 *
 * WHY THIS EXISTS. 477 drafts sat at `ready` and not one had ever been approved
 * or published. Matt's answer when asked why: "I've never seen them." The studio
 * page listed 40 of them mixed in with killed rows and had no bulk actions, so
 * it was a gallery, not a queue.
 *
 * The design follows from that. One draft fills the screen, because a clip judged
 * as a thumbnail is judged wrong. The two buttons are large, fixed to the bottom
 * and far apart, because this gets used one-handed on a phone. The count is
 * always visible so a 477-deep backlog feels finite.
 *
 * Approving still means approving — this posts nothing. It marks the draft
 * approved for the publisher sweep, which is the §1 human stamp, one draft at a
 * time. There is deliberately no "approve all".
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/admin/v2'
import { approveStudioDraftAction, killStudioDraftAction } from '../actions'
import type { DraftCardModel } from '../DraftCard'

export function ReviewQueue({ drafts, remaining }: { drafts: DraftCardModel[]; remaining: number }) {
  const [index, setIndex] = useState(0)
  const [decided, setDecided] = useState<Record<string, 'approved' | 'killed'>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const draft = drafts[index]
  const done = Object.keys(decided).length

  if (!draft) {
    return (
      <div className="av2-empty" style={{ padding: '2rem', textAlign: 'center' }}>
        {done > 0 ? `Done — ${done} decided this pass.` : 'Nothing waiting for review.'}
        {remaining > drafts.length ? (
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/admin/studio/review">Load the next batch ({remaining - drafts.length} still waiting)</a>
          </div>
        ) : null}
      </div>
    )
  }

  function decide(kind: 'approved' | 'killed') {
    setError(null)
    startTransition(async () => {
      const res =
        kind === 'approved'
          ? await approveStudioDraftAction({ draftId: draft.id })
          : await killStudioDraftAction({ draftId: draft.id, reason: 'Killed from review.' })
      if (res.error) {
        setError(res.error)
        return
      }
      setDecided((d) => ({ ...d, [draft.id]: kind }))
      setIndex((i) => i + 1)
    })
  }

  return (
    <div style={{ paddingBottom: '6rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.75rem',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <strong>{draft.label}</strong>
        <span style={{ color: 'var(--a-text-2)' }}>
          {index + 1} of {drafts.length}
          {remaining > drafts.length ? ` · ${remaining} waiting` : ''}
        </span>
      </div>

      {draft.mediaUrl ? (
        draft.mediaKind === 'video' ? (
          <video
            key={draft.id}
            src={draft.mediaUrl}
            poster={draft.posterUrl ?? undefined}
            controls
            playsInline
            muted
            style={{ width: '100%', maxHeight: '62vh', borderRadius: 14, background: '#000' }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={draft.id}
            src={draft.mediaUrl}
            alt={draft.label}
            style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', borderRadius: 14 }}
          />
        )
      ) : (
        <div className="av2-empty">This draft has no media.</div>
      )}

      {draft.caption ? (
        <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.85rem', lineHeight: 1.5 }}>{draft.caption}</p>
      ) : null}

      <p style={{ color: 'var(--a-text-2)', fontVariantNumeric: 'tabular-nums', marginTop: '0.5rem' }}>
        {draft.formatLabel}
        {draft.platforms.length ? ` · ${draft.platforms.join(', ')}` : ''}
        {draft.qaScore != null ? ` · QA ${draft.qaScore}` : ''}
        {draft.spendUsd != null ? ` · $${draft.spendUsd.toFixed(2)}` : ''}
      </p>

      {error ? <p className="av2-note" role="alert">{error}</p> : null}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          gap: '0.75rem',
          padding: '0.75rem max(0.75rem, env(safe-area-inset-left)) max(0.75rem, env(safe-area-inset-bottom))',
          background: 'var(--a-bg)',
          borderTop: '1px solid var(--a-border)',
        }}
      >
        <Button
          variant="quiet"
          onClick={() => decide('killed')}
          disabled={pending}
          style={{ flex: 1, minHeight: 52 }}
        >
          Kill
        </Button>
        <Button onClick={() => decide('approved')} disabled={pending} style={{ flex: 1, minHeight: 52 }}>
          {pending ? 'Saving…' : 'Approve'}
        </Button>
      </div>
    </div>
  )
}
