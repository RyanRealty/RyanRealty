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
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, CornerUpLeft, Mail, MessageSquare, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'

export type MobileConvRow = {
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

function ChannelIcon({ channel }: { channel: MobileConvRow['lastChannel'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0 text-primary'
  if (channel === 'text') return <MessageSquare className={cls} aria-label="Text" />
  if (channel === 'call') return <Phone className={cls} aria-label="Call" />
  if (channel === 'email') return <Mail className={cls} aria-label="Email" />
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
    <div className="relative overflow-hidden bg-card">
      {/* Behind-left: Close / Reopen (revealed by left swipe) */}
      <button
        type="button"
        disabled={pending}
        onClick={() => runTriage(closedFolder ? onReopen : onClose)}
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-center text-sm font-semibold',
          closedFolder
            ? 'bg-muted text-foreground'
            : 'bg-destructive text-destructive-foreground',
        )}
        style={{ width: ACTION_W }}
      >
        {closedFolder ? 'Reopen' : 'Close'}
      </button>
      {/* Behind-right: Assign (revealed by right swipe) */}
      {canAssign && !closedFolder ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setDx(0)
            onAssign(row.personId)
          }}
          className="absolute inset-y-0 left-0 flex items-center justify-center bg-primary text-sm font-semibold text-primary-foreground"
          style={{ width: ACTION_W }}
        >
          Assign
        </button>
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
        className="relative flex min-h-[76px] cursor-pointer items-center gap-3 bg-card py-2.5 pl-2 pr-3 transition-transform active:bg-accent/50"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: start.current ? '0ms' : '200ms' }}
      >
        {/* Unread dot (8pt, left edge) */}
        <span
          aria-hidden
          className={cn('h-2 w-2 shrink-0 rounded-full', row.unread ? 'bg-primary' : 'bg-transparent')}
        />
        <span className="relative shrink-0">
          <CrmAvatar name={row.name} src={row.pictureUrl} size={40} />
          {/* Reply-sent indicator — broker sent the most recent message [OBSERVED mob-07 row 7] */}
          {row.outboundLast ? (
            <span className="absolute -bottom-0.5 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted ring-2 ring-card">
              <CornerUpLeft className="h-2.5 w-2.5 text-muted-foreground" aria-label="Replied" />
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">
              <span className="text-[15px] font-semibold text-foreground">{row.name}</span>
              {row.messageCount > 1 ? (
                <span className="ml-1 text-[13px] text-muted-foreground">{row.messageCount}</span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.tsLabel}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <ChannelIcon channel={row.lastChannel} />
            <span className="truncate text-sm text-foreground">
              {row.subject ?? row.snippet ?? ''}
            </span>
          </div>
          {row.subject && row.snippet ? (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{row.snippet}</p>
          ) : null}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
      </div>
    </div>
  )
}
