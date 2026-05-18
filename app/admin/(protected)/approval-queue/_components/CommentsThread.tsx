'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

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

const TYPE_BADGE_CLASSES: Record<Comment['type'], string> = {
  note: 'bg-secondary text-secondary-foreground',
  change_request: 'bg-destructive/10 text-destructive border-destructive/20',
  approval_note: 'bg-success/10 text-success border-success/20',
}

export function CommentsThread({ actionId, comments: initialComments, onCommentPosted }: CommentsThreadProps) {
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
      <h4 className="text-sm font-semibold text-foreground">Comments</h4>

      {/* Existing comments */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className={cn(
                'rounded-lg border p-3',
                c.type === 'change_request'
                  ? 'border-destructive/20 bg-destructive/5'
                  : c.type === 'approval_note'
                  ? 'border-success/20 bg-success/5'
                  : 'border-border bg-card',
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{c.author}</span>
                <Badge
                  variant="outline"
                  className={cn('text-xs', TYPE_BADGE_CLASSES[c.type])}
                >
                  {TYPE_LABELS[c.type]}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(c.posted_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handlePost} className="space-y-2">
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as Comment['type'])}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="change_request">Change request</SelectItem>
              <SelectItem value="approval_note">Approval note</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          placeholder={
            type === 'change_request'
              ? 'Describe what needs to change (this will flip status to needs_changes).'
              : 'Add a note...'
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
          {submitting ? 'Posting...' : 'Post comment'}
        </Button>
      </form>
    </div>
  )
}
