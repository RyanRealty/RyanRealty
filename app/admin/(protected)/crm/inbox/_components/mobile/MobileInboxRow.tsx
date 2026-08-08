'use client'

/**
 * MobileInboxRow — one §26-A conversation row with FUB swipe actions.
 *
 * Anatomy (spec §26 row anatomy, 390pt canvas): unread dot · 40pt avatar ·
 * name + message count · relative timestamp · channel icon + subject line ·
 * 2-line preview · reply-sent indicator · chevron. Swipe LEFT reveals Close
 * (Reopen in the Closed folder, AC-26A-08/AC-26C-01); swipe RIGHT reveals
 * Assign (AC-26A-09, only when the broker can assign).
 *
 * Touch-only gesture (mouse users get the buttons via the thread header) —
 * translateX capped at the action width, snaps open/closed on touchend.
 *
 * Admin v2 re-skin (P11F): colors draw from the admin tokens (design_system/
 * admin/ADMIN_UI.md), not the public brand. The avatar is reimplemented
 * locally (below) instead of importing CrmAvatar — components/admin/crm/* is
 * blacklisted as design input for the admin (amnesia), so this file draws
 * zero color from outside components/admin/v2.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, CornerUpLeft, Mail, MessageSquare, Phone } from 'lucide-react'
import { Button } from '@/components/admin/v2'

export type MobileConvRow = {
  /** The conversation this row represents (RC1). Distinct from personId: a contact's
   *  1:1 and a group they're in are separate rows. The list keys on this. */
  conversationId: string
  isGroup: boolean
  personId: number
  name: string
  pictureUrl: string | null
  unread: boolean
  status: 'unread' | 'open' | 'handled' | 'closed'
  messageCount: number
  tsLabel: string
  lastChannel: 'email' | 'text' | 'call' | null
  channels: Array<'email' | 'text' | 'call'>
  subject: string | null
  snippet: string | null
  outboundLast: boolean
  href: string
}

const ACTION_W = 88

/** Initials for the fallback avatar — same algorithm the retired CrmAvatar
 *  helper used, reimplemented so no color/logic is imported from outside v2. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * MobileAvatar — photo when available, else initials on the one accent wash
 * (never a per-name color hash: ADMIN_UI.md §1 reserves color for meaning,
 * so every avatar in the admin reads the same calm accent, not a rainbow).
 * Exported for MobileInbox (broker avatar in the header, assign-picker rows).
 */
export function MobileAvatar({ name, src, size = 44 }: { name: string; src?: string | null; size?: number }) {
  const dim = { width: size, height: size }
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className="shrink-0"
        style={{ ...dim, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }}
      />
    )
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ ...dim, background: 'var(--a-accent-wash)', color: 'var(--a-accent)' }}
    >
      <span style={{ fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>
    </span>
  )
}

function ChannelIcon({ channel }: { channel: MobileConvRow['lastChannel'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0'
  const style = { color: 'var(--a-accent)' }
  if (channel === 'text') return <MessageSquare className={cls} style={style} aria-label="Text" />
  if (channel === 'call') return <Phone className={cls} style={style} aria-label="Call" />
  if (channel === 'email') return <Mail className={cls} style={style} aria-label="Email" />
  return null
}

export default function MobileInboxRow({
  row,
  closedFolder,
  canAssign,
  onClose,
  onReopen,
  onAssign,
}: {
  row: MobileConvRow
  /** True in the Closed sub-tab — left swipe becomes Reopen (AC-26C-01). */
  closedFolder: boolean
  canAssign: boolean
  onClose: (personId: number) => Promise<{ ok: boolean; error?: string }>
  onReopen: (personId: number) => Promise<{ ok: boolean; error?: string }>
  onAssign: (personId: number) => void
}) {
  const router = useRouter()
  const [dx, setDx] = useState(0)
  const [pending, startTransition] = useTransition()
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const moved = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx }
    moved.current = false
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!start.current) return
    const ddx = e.touches[0].clientX - start.current.x
    const ddy = e.touches[0].clientY - start.current.y
    if (Math.abs(ddx) < 8 || Math.abs(ddy) > Math.abs(ddx)) return
    moved.current = true
    const max = canAssign && !closedFolder ? ACTION_W : 0
    setDx(Math.max(-ACTION_W, Math.min(max, start.current.base + ddx)))
  }
  function onTouchEnd() {
    setDx((v) => (v <= -ACTION_W / 2 ? -ACTION_W : v >= ACTION_W / 2 ? ACTION_W : 0))
    start.current = null
  }

  function runTriage(action: (id: number) => Promise<{ ok: boolean; error?: string }>) {
    setDx(0)
    startTransition(async () => {
      await action(row.personId)
      router.refresh()
    })
  }

  return (
    <div className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--a-border)' }}>
      {/* Behind-left: Close / Reopen (revealed by left swipe) */}
      <Button
        variant={closedFolder ? 'quiet' : 'danger'}
        disabled={pending}
        onClick={() => runTriage(closedFolder ? onReopen : onClose)}
        className="absolute inset-y-0 right-0"
        style={{ width: ACTION_W, height: '100%', borderRadius: 0, border: 'none' }}
      >
        {closedFolder ? 'Reopen' : 'Close'}
      </Button>
      {/* Behind-right: Assign (revealed by right swipe) */}
      {canAssign && !closedFolder ? (
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => {
            setDx(0)
            onAssign(row.personId)
          }}
          className="absolute inset-y-0 left-0"
          style={{ width: ACTION_W, height: '100%', borderRadius: 0 }}
        >
          Assign
        </Button>
      ) : null}

      <div
        role="link"
        tabIndex={0}
        onClick={() => {
          if (dx !== 0) {
            setDx(0)
            return
          }
          router.push(row.href)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') router.push(row.href)
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex min-h-[76px] cursor-pointer items-center gap-3 py-2.5 pl-2 pr-3 transition-transform"
        style={{
          transform: `translateX(${dx}px)`,
          transitionDuration: start.current ? '0ms' : '200ms',
          background: 'var(--a-bg)',
        }}
      >
        {/* Unread dot (8pt, left edge) */}
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: row.unread ? 'var(--a-accent)' : 'transparent' }}
        />
        <span className="relative shrink-0">
          <MobileAvatar name={row.name} src={row.pictureUrl} size={40} />
          {/* Reply-sent indicator — broker sent the most recent message [OBSERVED mob-07 row 7] */}
          {row.outboundLast ? (
            <span
              className="absolute -bottom-0.5 -left-1 flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: 'var(--a-inset)', boxShadow: '0 0 0 2px var(--a-bg)' }}
            >
              <CornerUpLeft className="h-2.5 w-2.5" style={{ color: 'var(--a-text-2)' }} aria-label="Replied" />
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">
              <span className="font-semibold" style={{ fontSize: 'var(--a-text-lg)', color: 'var(--a-text)' }}>
                {row.name}
              </span>
              {row.messageCount > 1 ? (
                <span className="ml-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                  {row.messageCount}
                </span>
              ) : null}
            </span>
            <span className="a-num shrink-0" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {row.tsLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <ChannelIcon channel={row.lastChannel} />
            <span className="truncate" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
              {row.subject ?? row.snippet ?? ''}
            </span>
          </div>
          {row.subject && row.snippet ? (
            <p className="mt-0.5 line-clamp-2 leading-snug" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {row.snippet}
            </p>
          ) : null}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
      </div>
    </div>
  )
}
