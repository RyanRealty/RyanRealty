'use client'

/**
 * InboxThreadList — the center thread-list panel of the FUB three-panel inbox
 * (spec §08 §4). Toolbar: All/Unread toggle (AC-04), channel Filter disclosure
 * with Emails/Texts/Calls checkboxes + count badge (AC-05, §12.2), and a
 * Select toggle for bulk mode (AC-29: mark read / mark unread / close / reopen /
 * assign). Rows (AC-06): unread dot, avatar, name, preview, timestamp, and a
 * call-duration label on call/voicemail threads. Folder-appropriate empty states
 * (AC-30) including the Assigned onboarding card.
 *
 * Presentation + selection only — every mutation routes through the pre-bound,
 * suppression-safe triage actions (state only, never a send path).
 *
 * Admin v2 language (design_system/admin/ADMIN_UI.md): no DropdownMenu
 * primitive exists yet, so the channel filter is a native <details>/<summary>
 * disclosure (Radix's auto-close-on-outside-click is the one behavior this
 * does not reproduce) and the bulk "Assign" menu is a ToolbarSelect.
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListFilter, UserRound } from 'lucide-react'
import { Button, ToolbarCheck, ToolbarSelect } from '@/components/admin/v2'
import { cleanContactName } from '@/lib/crm/display-name'
import type {
  ConversationStatus,
  InboxChannel,
  InboxConversation,
  InboxFolderKey,
  InboxScopeKey,
} from '@/lib/data/crm/getInboxQueue'
import { inboxHref } from './inbox-url'

export type ThreadListRow = InboxConversation & { tsLabel: string }

const CHANNEL_FILTERS: Array<{ key: InboxChannel; label: string }> = [
  { key: 'email', label: 'Emails' },
  { key: 'text', label: 'Texts' },
  { key: 'call', label: 'Calls' },
]

/** MM:SS duration label for call/voicemail rows (spec §4.1). */
function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const chars = (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')
  return chars.toUpperCase() || '#'
}

/** Folder-appropriate empty states — AC-30. */
function EmptyState({ folder, view }: { folder: InboxFolderKey; view: 'all' | 'unread' }) {
  if (view === 'unread') {
    return (
      <p className="px-4 py-10 text-center" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        No unread conversations. You are caught up.
      </p>
    )
  }
  if (folder === 'assigned') {
    return (
      <div className="px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <UserRound style={{ width: 32, height: 32, color: 'var(--a-text-2)', opacity: 0.6 }} aria-hidden />
          <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>Assigned is empty.</p>
        </div>
        {/* Onboarding card (spec §4.3) */}
        <div className="av2-pane mt-4">
          <div
            className="flex items-center justify-center"
            style={{
              height: 80,
              borderRadius: 'var(--a-r-md)',
              background: 'var(--a-inset)',
              fontSize: 'var(--a-text-xs)',
              color: 'var(--a-text-2)',
            }}
          >
            Inbox overview
          </div>
          <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>Get Started Today</p>
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            How the Inbox helps you never miss important conversations
          </p>
          <Link href="/admin/crm" className="av2-btn av2-btn--quiet" style={{ alignSelf: 'flex-start' }}>
            How It Works
          </Link>
        </div>
      </div>
    )
  }
  const copy: Record<InboxFolderKey, string> = {
    inbox: 'Inbox zero. Inbound texts, emails, and calls land here the moment they arrive.',
    assigned: 'Assigned is empty.',
    drafts: 'No drafts. Start a reply and save it to pick it up later.',
    sent: 'Nothing sent yet from this inbox.',
    closed: 'No closed conversations. Close a thread to archive it here.',
  }
  return (
    <p className="px-4 py-10 text-center" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
      {copy[folder]}
    </p>
  )
}

export default function InboxThreadList({
  conversations,
  activePersonId,
  scopeKey,
  folder,
  view,
  canAssign,
  brokers,
  bulkAction,
  bulkAssignAction,
}: {
  conversations: ThreadListRow[]
  activePersonId: number | null
  scopeKey: InboxScopeKey
  folder: InboxFolderKey
  view: 'all' | 'unread'
  /** Superuser only — enables the bulk Assign menu. */
  canAssign: boolean
  brokers: Array<{ slug: string; name: string }>
  bulkAction: (personIds: number[], status: ConversationStatus) => Promise<{ ok: boolean; error?: string }>
  bulkAssignAction: (personIds: number[], broker: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [channels, setChannels] = useState<Set<InboxChannel>>(new Set(['email', 'text', 'call']))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const activeFilterCount = 3 - channels.size

  const visible = useMemo(() => {
    if (channels.size === 3) return conversations
    return conversations.filter((c) => c.channels.length === 0 || c.channels.some((ch) => channels.has(ch)))
  }, [conversations, channels])

  const toggleChannel = (ch: InboxChannel) =>
    setChannels((prev) => {
      const next = new Set(prev)
      if (next.has(ch)) next.delete(ch)
      else next.add(ch)
      return next
    })

  const toggleRow = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const runBulk = (status: ConversationStatus) => {
    const ids = [...selected]
    if (ids.length === 0) return
    setError(null)
    startTransition(async () => {
      const res = await bulkAction(ids, status)
      if (!res.ok) {
        setError(res.error ?? 'Could not update the selected conversations')
        return
      }
      setSelected(new Set())
      setSelectMode(false)
      router.refresh()
    })
  }

  const runBulkAssign = (broker: string) => {
    const ids = [...selected]
    if (ids.length === 0) return
    setError(null)
    startTransition(async () => {
      const res = await bulkAssignAction(ids, broker)
      if (!res.ok) {
        setError(res.error ?? 'Could not assign the selected conversations')
        return
      }
      setSelected(new Set())
      setSelectMode(false)
      router.refresh()
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Toolbar: All/Unread toggle · Filter · Select (spec §4.2) ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--a-border)' }}>
        <div className="flex items-center gap-1" role="tablist" aria-label="Read state">
          <Link
            href={inboxHref({ scope: scopeKey, folder, view: 'all', c: activePersonId })}
            className="av2-btn av2-btn--quiet"
            style={view === 'all' ? { background: 'var(--a-accent-wash)', color: 'var(--a-accent)' } : undefined}
          >
            All
          </Link>
          <Link
            href={inboxHref({ scope: scopeKey, folder, view: 'unread', c: activePersonId })}
            className="av2-btn av2-btn--quiet"
            style={view === 'unread' ? { background: 'var(--a-accent-wash)', color: 'var(--a-accent)' } : undefined}
          >
            Unread
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <details style={{ position: 'relative' }}>
            <summary className="av2-btn av2-btn--quiet">
              <ListFilter style={{ width: 14, height: 14 }} aria-hidden />
              Filter
              {activeFilterCount > 0 ? (
                <span className="a-num" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-accent)', fontWeight: 700 }}>
                  {activeFilterCount}
                </span>
              ) : null}
            </summary>
            <div
              role="group"
              aria-label="Channels"
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                zIndex: 20,
                minWidth: 168,
                background: 'var(--a-bg)',
                border: '1px solid var(--a-border)',
                borderRadius: 'var(--a-r-md)',
                padding: 'var(--a-s2)',
                boxShadow: 'var(--a-shadow-overlay)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  padding: '2px 4px',
                  fontSize: 'var(--a-text-xs)',
                  fontWeight: 600,
                  color: 'var(--a-text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                }}
              >
                Channels
              </span>
              {CHANNEL_FILTERS.map((f) => (
                <ToolbarCheck key={f.key} label={f.label} checked={channels.has(f.key)} onChange={() => toggleChannel(f.key)} />
              ))}
            </div>
          </details>
          <Button
            variant="quiet"
            style={selectMode ? { background: 'var(--a-accent-wash)', color: 'var(--a-accent)' } : undefined}
            onClick={() => {
              setSelectMode((v) => !v)
              setSelected(new Set())
            }}
          >
            Select
          </Button>
        </div>
      </div>

      {/* ── Bulk action bar (AC-29) ── */}
      {selectMode && selected.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1.5 px-3 py-1.5"
          style={{ borderBottom: '1px solid var(--a-border)', background: 'var(--a-inset)' }}
        >
          <span className="a-num" style={{ fontSize: 'var(--a-text-xs)', fontWeight: 500, color: 'var(--a-text)' }}>
            {selected.size} selected
          </span>
          <Button variant="quiet" disabled={pending} onClick={() => runBulk('open')}>
            Mark read
          </Button>
          <Button variant="quiet" disabled={pending} onClick={() => runBulk('unread')}>
            Mark unread
          </Button>
          <Button variant="quiet" disabled={pending} onClick={() => runBulk('closed')}>
            Close
          </Button>
          <Button variant="quiet" disabled={pending} onClick={() => runBulk('open')}>
            Reopen
          </Button>
          {canAssign ? (
            <ToolbarSelect
              aria-label="Assign to"
              disabled={pending}
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (v) runBulkAssign(v)
              }}
            >
              <option value="" disabled>
                Assign to
              </option>
              {brokers.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </ToolbarSelect>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="px-3 py-1" style={{ fontSize: 'var(--a-text-xs)', fontWeight: 500, color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}

      {/* ── Thread rows (spec §4.1) ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState folder={folder} view={view} />
        ) : (
          visible.map((c) => {
            const name = cleanContactName(c.name, c.personId)
            const isActive = c.personId === activePersonId
            const isUnread = c.status === 'unread'
            const preview = (c.lastDirection === 'out' ? 'You: ' : '') + (c.snippet ?? 'No message body')
            return (
              <div
                key={c.conversationId}
                className="flex items-start gap-2.5 px-3 py-2.5"
                style={{
                  borderBottom: '1px solid var(--a-border)',
                  background: isActive ? 'var(--a-accent-wash)' : undefined,
                }}
              >
                {selectMode ? (
                  <div className="pt-2">
                    <ToolbarCheck
                      label=""
                      aria-label={`Select ${name}`}
                      checked={selected.has(c.personId)}
                      onChange={() => toggleRow(c.personId)}
                    />
                  </div>
                ) : (
                  <div className="flex w-2 shrink-0 justify-center pt-3.5">
                    {isUnread ? <span className="av2-conv__unread" aria-label="Unread" /> : null}
                  </div>
                )}
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full"
                  style={{ background: 'var(--a-inset)' }}
                >
                  {c.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.pictureUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition: 'top' }}
                    />
                  ) : (
                    <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                      {scopeKey === 'company' && !c.assignedBroker ? 'C' : initials(name)}
                    </span>
                  )}
                </div>
                <Link
                  href={inboxHref({ scope: scopeKey, folder, view, c: c.personId })}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="av2-conv__name truncate"
                      style={!isUnread ? { fontWeight: 500 } : undefined}
                    >
                      {name}
                    </span>
                    <span className="av2-conv__ts shrink-0">{c.tsLabel}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="av2-conv__snippet min-w-0 flex-1">{preview}</span>
                    {c.lastCallDurationSec != null ? (
                      <span
                        className="shrink-0 a-num"
                        style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                      >
                        {mmss(c.lastCallDurationSec)}
                      </span>
                    ) : null}
                    {c.hasDraft ? (
                      <span
                        className="shrink-0"
                        style={{
                          fontSize: 'var(--a-text-xs)',
                          color: 'var(--a-text-2)',
                          border: '1px solid var(--a-border)',
                          borderRadius: 'var(--a-r-sm)',
                          padding: '0 4px',
                        }}
                      >
                        Draft
                      </span>
                    ) : null}
                  </div>
                </Link>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
