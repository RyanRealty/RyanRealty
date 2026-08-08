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
 *
 * Admin v2 re-skin (P11F): the header/tab-strip's old solid navy fill was the
 * PUBLIC brand (blacklisted as design input for the admin — ADMIN_UI.md §1);
 * it reads as neutral chrome now (var(--a-surface) + a hairline), matching
 * RailNav/TabBar elsewhere in the admin. The three FUB-style bottom sheets are
 * the admin's one overlay primitive (Dialog) — there is no v2 sheet.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Check, Inbox as InboxIcon, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { Button, IconButton, Sheet, TextField, ToolbarCheck } from '@/components/admin/v2'
import { inboxHref } from '../inbox-url'
import type { InboxFolderKey, InboxScopeKey } from '@/lib/data/crm/getInboxQueue'
import MobileInboxRow, { MobileAvatar, type MobileConvRow } from './MobileInboxRow'

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
      {/* ── Nav / header bar ──────────────────────────────────────────────── */}
      <div className="flex h-[60px] items-center justify-between px-4" style={{ background: 'var(--a-surface)' }}>
        <Link href="/admin/settings" aria-label="Account settings" className="shrink-0">
          <MobileAvatar name={brokerName} src={brokerHeadshotUrl} size={36} />
        </Link>
        <Button
          variant="quiet"
          onClick={() => setScopeOpen(true)}
          className="inline-flex items-center gap-1"
          style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 'auto', color: 'var(--a-text)', fontWeight: 600, fontSize: 'var(--a-text-lg)' }}
        >
          {scopeLabel}
          <span aria-hidden style={{ fontSize: 'var(--a-text-xs)' }}>▾</span>
        </Button>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/admin/crm/activity" aria-label="Activity notifications">
            <Bell className="h-[22px] w-[22px]" style={{ color: 'var(--a-text-2)' }} strokeWidth={1.9} />
          </Link>
          <IconButton
            label={searchOpen ? 'Close search' : 'Search conversations'}
            onClick={() => {
              setSearchOpen((v) => !v)
              setQ('')
            }}
          >
            {searchOpen ? (
              <X className="h-[22px] w-[22px]" style={{ color: 'var(--a-text-2)' }} strokeWidth={1.9} />
            ) : (
              <Search className="h-[22px] w-[22px]" style={{ color: 'var(--a-text-2)' }} strokeWidth={1.9} />
            )}
          </IconButton>
        </div>
      </div>

      {/* ── Sub-tab strip (or inline search when active) ────────────────── */}
      <div
        className="flex items-center gap-1 px-2"
        style={{
          background: 'var(--a-surface)',
          borderBottom: '1px solid var(--a-border)',
          minHeight: searchOpen ? undefined : '44px',
          paddingTop: searchOpen ? 6 : 0,
          paddingBottom: searchOpen ? 8 : 6,
        }}
      >
        {searchOpen ? (
          <div className="flex-1">
            <TextField
              label="Search conversations"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search loaded conversations"
            />
          </div>
        ) : (
          <>
            <div className="flex flex-1 items-center gap-1" role="tablist" aria-label="Inbox folders">
              {MOBILE_TABS.map((t) => {
                const active = t.key === folder
                return (
                  <Button
                    key={t.key}
                    variant="quiet"
                    role="tab"
                    aria-selected={active}
                    onClick={() => router.push(inboxHref({ scope: scopeKey, folder: t.key, view }))}
                    className="px-3.5 py-1.5"
                    style={{
                      minHeight: 'auto',
                      border: 'none',
                      fontSize: 'var(--a-text-sm)',
                      fontWeight: 500,
                      background: active ? 'var(--a-accent-wash)' : 'transparent',
                      color: active ? 'var(--a-accent)' : 'var(--a-text-2)',
                    }}
                  >
                    {t.label}
                  </Button>
                )
              })}
            </div>
            <IconButton label="Filter conversations" onClick={() => setFilterOpen(true)} style={{ position: 'relative' }}>
              <SlidersHorizontal className="h-[22px] w-[22px]" style={{ color: 'var(--a-text-2)' }} strokeWidth={1.9} />
              {filtered ? (
                <span className="absolute right-0.5 top-0 h-2 w-2 rounded-full" style={{ background: 'var(--a-danger)' }} aria-hidden />
              ) : null}
            </IconButton>
          </>
        )}
      </div>

      {/* ── Unread count bar ─────────────────────────────────────────────── */}
      <div className="px-4 py-1" style={{ background: 'var(--a-inset)', color: 'var(--a-text)', fontSize: 'var(--a-text-md)' }}>
        <span className="a-num font-bold">{unreadTotal}</span> Unread conversations
      </div>

      {/* ── Conversation list ────────────────────────────────────────────── */}
      <div className="pb-24" style={{ background: 'var(--a-bg)' }}>
        {/* System welcome banner (AC-26A-14 — static onboarding copy, Inbox tab only) */}
        {folder === 'inbox' && !q ? (
          <div
            className="flex min-h-[76px] items-center gap-3 py-2.5 pl-2 pr-3"
            style={{ background: 'var(--a-bg)', borderBottom: '1px solid var(--a-border)' }}
          >
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'transparent' }} />
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--a-accent-wash)' }}
            >
              <InboxIcon className="h-5 w-5" style={{ color: 'var(--a-accent)' }} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold" style={{ fontSize: 'var(--a-text-lg)', color: 'var(--a-text)' }}>
                  Welcome to your inbox!
                </span>
                <span className="shrink-0" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  just now
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 leading-snug" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                Emails and text messages show up here. Swipe them when you are done with them.
              </p>
            </div>
          </div>
        ) : null}

        {visible.map((row) => (
          <MobileInboxRow
            key={row.conversationId}
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
              <UserRound className="h-10 w-10" style={{ color: 'var(--a-text-2)' }} aria-hidden />
              <p className="font-semibold" style={{ fontSize: 'var(--a-text-lg)', color: 'var(--a-text)' }}>
                Assigned is empty.
              </p>
              <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                Conversations delegated to you from the team inbox land here. Swipe right on any
                Inbox conversation to assign it.
              </p>
            </div>
          ) : (
            <p className="px-8 py-16 text-center" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {q ? 'No conversations match your search.' : 'No conversations in this folder.'}
            </p>
          )
        ) : null}
      </div>

      {/* ── 26-L Inbox scope picker ──────────────────────────────────────── */}
      <Sheet open={scopeOpen} onClose={() => setScopeOpen(false)} title="Inbox">
        <div>
          {(
            [
              { key: 'me' as const, label: 'My Inbox', hint: 'Conversations assigned to you' },
              { key: 'company' as const, label: 'Company', hint: 'The shared team inbox' },
            ]
          ).map((opt) => (
            <Button
              key={opt.key}
              variant="quiet"
              onClick={() => {
                setScopeOpen(false)
                router.push(inboxHref({ scope: opt.key, folder, view }))
              }}
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--a-border)',
                borderRadius: 0,
                minHeight: 'var(--a-touch)',
                padding: 'var(--a-s3) var(--a-s1)',
              }}
            >
              <span>
                <span className="block font-medium" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
                  {opt.label}
                </span>
                <span className="block" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {opt.hint}
                </span>
              </span>
              {scopeKey === opt.key ? <Check className="h-4 w-4" style={{ color: 'var(--a-accent)' }} aria-label="Active" /> : null}
            </Button>
          ))}
        </div>
      </Sheet>

      {/* ── 26-K Filter sheet ─────────────────────────────────────────────── */}
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter conversations">
        <div className="space-y-3">
          {CHANNEL_LABELS.map((c) => (
            <ToolbarCheck
              key={c.key}
              checked={channelsOn.has(c.key)}
              onChange={(e) => {
                const v = e.target.checked
                setChannelsOn((prev) => {
                  const next = new Set(prev)
                  if (v) next.add(c.key)
                  else next.delete(c.key)
                  return next
                })
              }}
              label={c.label}
            />
          ))}
          <div className="flex gap-2 pt-2">
            <Button touch className="flex-1" onClick={() => setFilterOpen(false)}>
              Apply
            </Button>
            <Button touch variant="quiet" className="flex-1" onClick={() => setChannelsOn(new Set(['email', 'text', 'call']))}>
              Reset
            </Button>
          </div>
        </div>
      </Sheet>

      {/* ── Assign-to picker (swipe-right target, AC-26A-09) ─────────────── */}
      <Sheet open={assignFor != null} onClose={() => setAssignFor(null)} title="Assign conversation">
        <div>
          {brokers.map((b) => (
            <Button
              key={b.slug}
              variant="quiet"
              onClick={async () => {
                const id = assignFor
                setAssignFor(null)
                if (id != null) {
                  await assignAction(id, b.slug)
                  router.refresh()
                }
              }}
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--a-border)',
                borderRadius: 0,
                minHeight: 'var(--a-touch)',
                padding: 'var(--a-s3) var(--a-s1)',
                fontWeight: 500,
                fontSize: 'var(--a-text-md)',
                color: 'var(--a-text)',
              }}
            >
              <MobileAvatar name={b.name} size={32} />
              {b.name}
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
