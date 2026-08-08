'use client'

/**
 * ThreadHeader — the persistent action bar at the top of the reading pane
 * (spec §08 §5.1, §8). Contact name (or raw number for unknown callers), the
 * assignee picker (Me / Company → agent list, AC-12), and the mutually
 * exclusive Close (destructive) / Reopen (outline) buttons (AC-11).
 *
 * Also implements AC-07 auto-read: when the open thread is still 'unread', it
 * fires the state action once to flip it to read — the folder-rail unread count
 * decrements on the refresh. State only — never a send path.
 *
 * Admin v2 language (design_system/admin/ADMIN_UI.md): no DropdownMenu
 * primitive exists yet, so the assignee menu — which had no current-selection
 * indicator even in the old DropdownMenu — is a ToolbarSelect: pick a name and
 * it fires the same assignAction immediately.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, SectionHead, ToolbarSelect } from '@/components/admin/v2'
import type { ConversationStatus } from '@/lib/data/crm/getInboxQueue'

/** Sentinel <option> value for "Company (unassigned)" — never collides with a real broker slug. */
const COMPANY_VALUE = '__company__'

export default function ThreadHeader({
  personId,
  name,
  status,
  assigneeLabel,
  canAssign,
  brokers,
  setStatusAction,
  assignAction,
}: {
  personId: number
  name: string
  status: ConversationStatus
  /** 'Me' | 'Company' | broker display name — the assignee control's current-state text. */
  assigneeLabel: string
  /** Superuser only — re-assigning a conversation is an owner action. */
  canAssign: boolean
  brokers: Array<{ slug: string; name: string }>
  setStatusAction: (status: ConversationStatus) => Promise<{ ok: boolean; error?: string }>
  assignAction: (broker: string | null) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // AC-07 auto-read on open — fire once per opened thread.
  const autoReadFor = useRef<number | null>(null)
  useEffect(() => {
    if (status !== 'unread' || autoReadFor.current === personId) return
    autoReadFor.current = personId
    void setStatusAction('open').then((res) => {
      if (res.ok) router.refresh()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, status])

  const run = (next: ConversationStatus) => {
    setError(null)
    startTransition(async () => {
      const res = await setStatusAction(next)
      if (!res.ok) {
        setError(res.error ?? 'Could not update the conversation')
        return
      }
      router.refresh()
    })
  }

  const assign = (broker: string | null) => {
    setError(null)
    startTransition(async () => {
      const res = await assignAction(broker)
      if (!res.ok) {
        setError(res.error ?? 'Could not re-assign the conversation')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-3" style={{ borderBottom: '1px solid var(--a-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0" style={{ marginTop: 'calc(var(--a-s5) * -1)', marginBottom: 'calc(var(--a-s2) * -1)' }}>
          <SectionHead>
            <Link
              href={`/admin/people/${personId}`}
              className="block truncate hover:underline"
              style={{
                fontSize: 'var(--a-text-lg)',
                fontWeight: 500,
                color: 'var(--a-text)',
                textTransform: 'none',
                letterSpacing: 'normal',
              }}
            >
              {name}
            </Link>
          </SectionHead>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Assignee (spec §8.1) */}
          {canAssign ? (
            <ToolbarSelect
              aria-label="Assign conversation"
              disabled={pending}
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                assign(v === COMPANY_VALUE ? null : v)
              }}
            >
              <option value="" disabled>
                {assigneeLabel}
              </option>
              {brokers.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
              <option value={COMPANY_VALUE}>Company (unassigned)</option>
            </ToolbarSelect>
          ) : (
            <span
              title="Only an owner can re-assign"
              style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text-2)' }}
            >
              {assigneeLabel}
            </span>
          )}

          {/* Close / Reopen — mutually exclusive (AC-11) */}
          {status === 'closed' ? (
            <Button variant="quiet" disabled={pending} onClick={() => run('open')}>
              Reopen
            </Button>
          ) : (
            <Button variant="danger" disabled={pending} onClick={() => run('closed')}>
              Close
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p style={{ fontSize: 'var(--a-text-xs)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}
    </div>
  )
}
