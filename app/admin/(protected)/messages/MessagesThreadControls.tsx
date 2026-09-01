'use client'

/**
 * MessagesThreadControls — the inbox's per-thread triage on the Messages
 * thread header (fold final slice, Matt lock 2026-09-01 #1): status as one
 * compact select (Unread / Open / Handled / Closed) and, for a superuser, an
 * assign select. Both submit through the same guarded inbox actions and
 * refresh the route so the queue's folder view stays truthful.
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ToolbarSelect } from '@/components/admin/v2'
import { setConversationStateAction, assignConversationAction } from '@/app/actions/crm-inbox'

const STATUSES = [
  ['unread', 'Unread'],
  ['open', 'Open'],
  ['handled', 'Handled'],
  ['closed', 'Closed'],
] as const

export function MessagesThreadControls({
  personId,
  status,
  assignee,
  brokerOptions,
  canAssign,
}: {
  personId: number
  status: string
  /** Explicit thread assignee slug, '' when unassigned. */
  assignee: string
  brokerOptions: Array<{ value: string; label: string }>
  canAssign: boolean
}) {
  const router = useRouter()
  const [, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'That did not save')
      else router.refresh()
    })
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <ToolbarSelect
        aria-label="Conversation status"
        value={status}
        onChange={(e) => run(() => setConversationStateAction(personId, e.target.value))}
      >
        {STATUSES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </ToolbarSelect>
      {canAssign ? (
        <ToolbarSelect
          aria-label="Assigned broker"
          value={assignee}
          onChange={(e) => run(() => assignConversationAction(personId, e.target.value || null))}
        >
          <option value="">Unassigned</option>
          {brokerOptions.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </ToolbarSelect>
      ) : null}
      {error ? (
        <span role="alert" style={{ color: 'var(--a-danger)', fontSize: 'var(--a-text-xs)' }}>
          {error}
        </span>
      ) : null}
    </span>
  )
}
