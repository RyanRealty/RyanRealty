'use client'

/**
 * CommentsThread — notes / change requests / approval notes on one action row.
 *
 * 11F: off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the same POST body
 * ({ body, type }), the same optimistic setComments + onCommentPosted, and every
 * visible string are carried over verbatim. A change_request type still flips
 * status server-side; this file does not invent a client status transition.
 *
 * Mapping: Textarea -> TextAreaField; Button -> the one primary (Post comment);
 * Select+… -> SelectField (native <select>); Badge + semantic border/bg washes
 * -> av2-chip + var(--a-*) washes. StateWord is NOT used for the type label:
 * .av2-state uppercases, and "Change request" is DATA the broker typed a
 * meaning for — same call ActionCard recorded for action_type.
 */

import { useState } from 'react'
import { Button, SelectField, TextAreaField } from '@/components/admin/v2'

export interface Comment {
  id: string
  author: string
  body: string
  posted_at: string
  type: 'change_request' | 'note' | 'approval_note'
}

interface CommentsThreadProps {
  actionId: string
  comments: Comment[]
  onCommentPosted?: (updated: Comment[]) => void
}

const TYPE_LABELS: Record<Comment['type'], string> = {
  note: 'Note',
  change_request: 'Change request',
  approval_note: 'Approval note',
}

/** Per-type wash. Color is status semantics only (ADMIN_UI §1). */
const TYPE_SHELL: Record<Comment['type'], React.CSSProperties> = {
  note: {
    border: '1px solid var(--a-border)',
    background: 'var(--a-surface)',
  },
  change_request: {
    border: '1px solid var(--a-danger)',
    background: 'var(--a-danger-wash)',
  },
  approval_note: {
    border: '1px solid var(--a-ok)',
    background: 'var(--a-ok-wash)',
  },
}

const TYPE_CHIP: Record<Comment['type'], React.CSSProperties> = {
  note: {},
  change_request: {
    borderColor: 'var(--a-danger)',
    color: 'var(--a-danger)',
    background: 'var(--a-danger-wash)',
  },
  approval_note: {
    borderColor: 'var(--a-ok)',
    color: 'var(--a-ok)',
    background: 'var(--a-ok-wash)',
  },
}

export function CommentsThread({
  actionId,
  comments: initialComments,
  onCommentPosted,
}: CommentsThreadProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [body, setBody] = useState('')
  const [type, setType] = useState<Comment['type']>('note')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/approval-queue/${actionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), type }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? `HTTP ${res.status}`)
      }
      const { comments: updated } = await res.json()
      setComments(updated)
      setBody('')
      onCommentPosted?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h4 style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
        Comments
      </h4>

      {comments.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          No comments yet.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="p-3"
              style={{
                borderRadius: 'var(--a-r-lg)',
                ...TYPE_SHELL[c.type],
              }}
            >
              <div className="mb-1 flex items-center gap-2">
                <span style={{ fontSize: 'var(--a-text-xs)', fontWeight: 500, color: 'var(--a-text)' }}>
                  {c.author}
                </span>
                <span
                  className="av2-chip"
                  style={{ cursor: 'default', fontSize: 'var(--a-text-xs)', ...TYPE_CHIP[c.type] }}
                >
                  {TYPE_LABELS[c.type]}
                </span>
                <span
                  className="ml-auto"
                  style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                >
                  {new Date(c.posted_at).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handlePost} className="space-y-2">
        <SelectField
          label="Comment type"
          value={type}
          onChange={(e) => setType(e.target.value as Comment['type'])}
        >
          <option value="note">Note</option>
          <option value="change_request">Change request</option>
          <option value="approval_note">Approval note</option>
        </SelectField>
        <TextAreaField
          label="Comment"
          placeholder={
            type === 'change_request'
              ? 'Describe what needs to change (this will flip status to needs_changes).'
              : 'Add a note...'
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        {error && (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting || !body.trim()}>
          {submitting ? 'Posting...' : 'Post comment'}
        </Button>
      </form>
    </div>
  )
}
