'use client'

/**
 * MobileInbox — the §26-A/B/C/D mobile inbox list (< md), FUB-iOS structure
 * re-skinned to Ryan Realty tokens.
 *
 * Regions (top → bottom, per the §26 y-band table):
 *   navy header bar (agent avatar · "My Inbox ▾" scope cluster · bell · search)
 *   sub-tab strip (Inbox / Assigned / Sent / Closed pills + filter icon — no
 *     Drafts tab on mobile per AC-26A-02)
 *   unread count bar ("N Unread conversations")
 *   conversation list (welcome system banner + swipeable rows)
 * The bottom tab bar + Inbox badge are the global CrmMobileTabBar (§23 shell).
 * The FAB + compose sheet are MobileComposeSheet, rendered by the page.
 *
 * URL-driven: sub-tabs and the scope picker navigate via inboxHref, so the
 * server page reloads the right queue. Search + channel filter are client-side
 * over the loaded rows.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, Inbox as InboxIcon, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import { inboxHref } from '@/components/admin/crm/inbox/inbox-url'
import type { InboxFolderKey, InboxScopeKey } from '@/lib/data/crm/getInboxQueue'
import MobileInboxRow, { type MobileConvRow } from './MobileInboxRow'

/** The four mobile sub-tabs — Drafts is desktop-only (FUB docs §22 / AC-26A-02). */
const MOBILE_TABS: Array<{ key: InboxFolderKey; label: string }> = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'sent', label: 'Sent' },
  { key: 'closed', label: 'Closed' },
]

type Channel = 'email' | 'text' | 'call'
const CHANNEL_LABELS: Array<{ key: Channel; label: string }> = [
  { key: 'email', label: 'Emails' },
  { key: 'text', label: 'Texts' },
  { key: 'call', label: 'Calls' },
]

export default function MobileInbox({
  rows,
  scopeKey,
  folder,
  view,
  unreadTotal,
  brokerName,
  brokerHeadshotUrl,
  canAssign,
  brokers,
  setStatusAction,
  assignAction,
}: {
  rows: MobileConvRow[]
  scopeKey: InboxScopeKey
  folder: InboxFolderKey
  view: 'all' | 'unread'
  unreadTotal: number
  brokerName: string
  brokerHeadshotUrl: string | null
  canAssign: boolean
  brokers: Array<{ slug: string; name: string }>
  setStatusAction: (personId: number, status: 'unread' | 'open' | 'handled' | 'closed') => Promise<{ ok: boolean; error?: string }>
  assignAction: (personId: number, broker: string | null) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [scopeOpen, setScopeOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [channelsOn, setChannelsOn] = useState<Set<Channel>>(new Set(['email', 'text', 'call']))
  const [assignFor, setAssignFor] = useState<number | null>(null)
  const filtered = channelsOn.size < 3

  const visible = useMemo(() => {
    let out = rows
    if (filtered) {
      out = out.filter((r) => r.channels.length === 0 || r.channels.some((c) => channelsOn.has(c)))
    }
    const needle = q.trim().toLowerCase()
    if (needle) {
      out = out.filter((r) =>
        [r.name, r.subject ?? '', r.snippet ?? ''].some((s) => s.toLowerCase().includes(needle)),
      )
    }
    return out
  }, [rows, filtered, channelsOn, q])

  const scopeLabel = scopeKey === 'me' ? 'My Inbox' : 'Company'

  return (
    <div className="flex flex-col">
      {/* ── Nav / header bar (navy) ─────────────────────────────────────── */}
      <div className="flex h-[60px] items-center justify-between bg-primary px-4">
        <Link href="/admin/settings" aria-label="Account settings" className="shrink-0">
          <CrmAvatar name={brokerName} src={brokerHeadshotUrl} size={36} />
        </Link>
        <button
          type="button"
          onClick={() => setScopeOpen(true)}
          className="flex items-center gap-1 text-[17px] font-semibold text-primary-foreground"
        >
          {scopeLabel}
          <span aria-hidden className="text-xs">▾</span>
        </button>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/admin/crm/activity" aria-label="Activity notifications">
            <Bell className="h-[22px] w-[22px] text-primary-foreground" strokeWidth={1.9} />
          </Link>
          <button
            type="button"
            aria-label={searchOpen ? 'Close search' : 'Search conversations'}
            onClick={() => {
              setSearchOpen((v) => !v)
              setQ('')
            }}
          >
            {searchOpen ? (
              <X className="h-[22px] w-[22px] text-primary-foreground" strokeWidth={1.9} />
            ) : (
              <Search className="h-[22px] w-[22px] text-primary-foreground" strokeWidth={1.9} />
            )}
          </button>
        </div>
      </div>

      {/* ── Sub-tab strip (or inline search when active) ────────────────── */}
      <div className="flex h-11 items-center gap-1 bg-primary px-2 pb-1.5">
        {searchOpen ? (
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search loaded conversations"
            className="h-8 border-0 bg-primary-foreground/95 text-sm"
          />
        ) : (
          <>
            <div className="flex flex-1 items-center gap-1" role="tablist" aria-label="Inbox folders">
              {MOBILE_TABS.map((t) => {
                const active = t.key === folder
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => router.push(inboxHref({ scope: scopeKey, folder: t.key, view }))}
                    className={cn(
                      'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200',
                      active ? 'bg-primary-foreground text-foreground' : 'text-primary-foreground/60',
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              aria-label="Filter conversations"
              onClick={() => setFilterOpen(true)}
              className="relative px-2"
            >
              <SlidersHorizontal className="h-[22px] w-[22px] text-primary-foreground/70" strokeWidth={1.9} />
              {filtered ? (
                <span className="absolute right-0.5 top-0 h-2 w-2 rounded-full bg-destructive" aria-hidden />
              ) : null}
            </button>
          </>
        )}
      </div>

      {/* ── Unread count bar ─────────────────────────────────────────────── */}
      <div className="bg-muted px-4 py-1 text-[15px] text-foreground">
        <span className="font-bold tabular-nums">{unreadTotal}</span> Unread conversations
      </div>

      {/* ── Conversation list ────────────────────────────────────────────── */}
      <div className="divide-y divide-border bg-background pb-24">
        {/* System welcome banner (AC-26A-14 — static onboarding copy, Inbox tab only) */}
        {folder === 'inbox' && !q ? (
          <div className="flex min-h-[76px] items-center gap-3 bg-card py-2.5 pl-2 pr-3">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-transparent" />
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
              <InboxIcon className="h-5 w-5 text-primary-foreground" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px] font-semibold text-foreground">Welcome to your inbox!</span>
                <span className="shrink-0 text-xs text-muted-foreground">just now</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                Emails and text messages show up here. Swipe them when you are done with them.
              </p>
            </div>
          </div>
        ) : null}

        {visible.map((row) => (
          <MobileInboxRow
            key={row.personId}
            row={row}
            closedFolder={folder === 'closed'}
            canAssign={canAssign}
            onClose={(id) => setStatusAction(id, 'closed')}
            onReopen={(id) => setStatusAction(id, 'open')}
            onAssign={(id) => setAssignFor(id)}
          />
        ))}

        {visible.length === 0 ? (
          folder === 'assigned' ? (
            /* §26-D Assigned empty state */
            <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
              <UserRound className="h-10 w-10 text-muted-foreground/60" aria-hidden />
              <p className="text-[17px] font-semibold text-foreground">Assigned is empty.</p>
              <p className="text-sm text-muted-foreground">
                Conversations delegated to you from the team inbox land here. Swipe right on any
                Inbox conversation to assign it.
              </p>
            </div>
          ) : (
            <p className="px-8 py-16 text-center text-sm text-muted-foreground">
              {q ? 'No conversations match your search.' : 'No conversations in this folder.'}
            </p>
          )
        ) : null}
      </div>

      {/* ── 26-L Inbox scope picker sheet ────────────────────────────────── */}
      <Sheet open={scopeOpen} onOpenChange={setScopeOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Inbox</SheetTitle>
          </SheetHeader>
          <div className="mt-2 divide-y divide-border">
            {(
              [
                { key: 'me' as const, label: 'My Inbox', hint: 'Conversations assigned to you' },
                { key: 'company' as const, label: 'Company', hint: 'The shared team inbox' },
              ]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setScopeOpen(false)
                  router.push(inboxHref({ scope: opt.key, folder, view }))
                }}
                className="flex w-full items-center justify-between py-3.5 text-left"
              >
                <span>
                  <span className="block text-[15px] font-medium text-foreground">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </span>
                {scopeKey === opt.key ? <Check className="h-4 w-4 text-primary" aria-label="Active" /> : null}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── 26-K Filter sheet ─────────────────────────────────────────────── */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Filter conversations</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-3">
            {CHANNEL_LABELS.map((c) => (
              <label key={c.key} className="flex items-center gap-2.5">
                <Checkbox
                  checked={channelsOn.has(c.key)}
                  onCheckedChange={(v) => {
                    setChannelsOn((prev) => {
                      const next = new Set(prev)
                      if (v) next.add(c.key)
                      else next.delete(c.key)
                      return next
                    })
                  }}
                />
                <Label className="text-[15px] font-normal">{c.label}</Label>
              </label>
            ))}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => setFilterOpen(false)}>
                Apply
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setChannelsOn(new Set(['email', 'text', 'call']))}
              >
                Reset
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Assign-to picker (swipe-right target, AC-26A-09) ─────────────── */}
      <Sheet open={assignFor != null} onOpenChange={(v) => !v && setAssignFor(null)}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Assign conversation</SheetTitle>
          </SheetHeader>
          <div className="mt-2 divide-y divide-border">
            {brokers.map((b) => (
              <button
                key={b.slug}
                type="button"
                onClick={async () => {
                  const id = assignFor
                  setAssignFor(null)
                  if (id != null) {
                    await assignAction(id, b.slug)
                    router.refresh()
                  }
                }}
                className="flex w-full items-center gap-3 py-3 text-left text-[15px] font-medium text-foreground"
              >
                <CrmAvatar name={b.name} size={32} />
                {b.name}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
