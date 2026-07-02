'use client'

/**
 * InboxThreadList — the center thread-list panel of the FUB three-panel inbox
 * (spec §08 §4). Toolbar: All/Unread toggle (AC-04), channel Filter dropdown
 * with Emails/Texts/Calls checkboxes + Filter (N) badge (AC-05, §12.2), and a
 * Select toggle for bulk mode (AC-29: mark read / mark unread / close / reopen /
 * assign). Rows (AC-06): unread dot, avatar, name, preview, timestamp, and a
 * call-duration label on call/voicemail threads. Folder-appropriate empty states
 * (AC-30) including the Assigned onboarding card.
 *
 * Presentation + selection only — every mutation routes through the pre-bound,
 * suppression-safe triage actions (state only, never a send path).
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListFilter, UserRound } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { cleanContactName } from '@/lib/crm/display-name'
import type {
  ConversationStatus,
  InboxChannel,
  InboxConversation,
  InboxFolderKey,
  InboxScopeKey,
} from '@/lib/data/crm/getInboxQueue'
import { inboxHref } from '@/components/admin/crm/inbox/inbox-url'

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
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No unread conversations. You are caught up.
      </p>
    )
  }
  if (folder === 'assigned') {
    return (
      <div className="px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <UserRound className="h-8 w-8 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium text-foreground">Assigned is empty.</p>
        </div>
        {/* Onboarding card (spec §4.3) */}
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex h-20 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              Inbox overview
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">Get Started Today</p>
            <p className="mt-1 text-xs text-muted-foreground">
              How the Inbox helps you never miss important conversations
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
              <Link href="/admin/crm">How It Works</Link>
            </Button>
          </CardContent>
        </Card>
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
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{copy[folder]}</p>
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
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Read state">
          <Button
            asChild
            size="sm"
            variant={view === 'all' ? 'secondary' : 'ghost'}
            className="h-7 px-2.5 text-xs"
          >
            <Link href={inboxHref({ scope: scopeKey, folder, view: 'all', c: activePersonId })}>All</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={view === 'unread' ? 'secondary' : 'ghost'}
            className="h-7 px-2.5 text-xs"
          >
            <Link href={inboxHref({ scope: scopeKey, folder, view: 'unread', c: activePersonId })}>Unread</Link>
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                <ListFilter className="h-3.5 w-3.5" aria-hidden />
                Filter
                {activeFilterCount > 0 ? (
                  <Badge variant="secondary" className="px-1 py-0 text-xs tabular-nums">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs">Channels</DropdownMenuLabel>
              {CHANNEL_FILTERS.map((f) => (
                <DropdownMenuItem
                  key={f.key}
                  onSelect={(e) => {
                    e.preventDefault()
                    toggleChannel(f.key)
                  }}
                  className="gap-2 text-sm"
                >
                  <Checkbox checked={channels.has(f.key)} aria-label={f.label} />
                  {f.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant={selectMode ? 'secondary' : 'ghost'}
            className="h-7 px-2 text-xs"
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
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5">
          <span className="text-xs font-medium text-foreground tabular-nums">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={pending} onClick={() => runBulk('open')}>
            Mark read
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={pending} onClick={() => runBulk('unread')}>
            Mark unread
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={pending} onClick={() => runBulk('closed')}>
            Close
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={pending} onClick={() => runBulk('open')}>
            Reopen
          </Button>
          {canAssign ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={pending}>
                  Assign
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {brokers.map((b) => (
                  <DropdownMenuItem key={b.slug} onSelect={() => runBulkAssign(b.slug)}>
                    {b.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="px-3 py-1 text-xs font-medium text-destructive">{error}</p> : null}

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
                key={c.personId}
                className={cn(
                  'flex items-start gap-2.5 border-b border-border px-3 py-2.5 transition-colors',
                  isActive ? 'bg-primary/5' : 'hover:bg-primary/5',
                )}
              >
                {selectMode ? (
                  <div className="pt-2">
                    <Checkbox
                      checked={selected.has(c.personId)}
                      onCheckedChange={() => toggleRow(c.personId)}
                      aria-label={`Select ${name}`}
                    />
                  </div>
                ) : (
                  <div className="flex w-2 shrink-0 justify-center pt-3.5">
                    {isUnread ? (
                      <span className="block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                    ) : null}
                  </div>
                )}
                <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                  {c.pictureUrl ? <AvatarImage src={c.pictureUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs">
                    {scopeKey === 'company' && !c.assignedBroker ? 'C' : initials(name)}
                  </AvatarFallback>
                </Avatar>
                <Link
                  href={inboxHref({ scope: scopeKey, folder, view, c: c.personId })}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-sm text-foreground',
                        isUnread ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{c.tsLabel}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{preview}</span>
                    {c.lastCallDurationSec != null ? (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        {mmss(c.lastCallDurationSec)}
                      </span>
                    ) : null}
                    {c.hasDraft ? (
                      <Badge variant="outline" className="shrink-0 px-1 py-0 text-xs">
                        Draft
                      </Badge>
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
