'use client'

/**
 * InboxQueue — the interactive triage list for the CRM inbox (Wave 7).
 *
 * Renders the conversation rows for the active scope tab with multi-select for
 * bulk triage (mark handled / closed / open) and a per-row status control. Row
 * selection drives the bulk bar; the action buttons call the suppression-safe
 * triage actions (state only, never a send path).
 *
 * Presentation + selection only. Rows are pre-shaped on the server. Clicking a
 * row navigates (via the parent Link) to the same page with ?c=<personId> so the
 * server renders the thread pane.
 *
 * Mobile (< md): FUB-style avatar list via CrmMobileKit.
 * Desktop (≥ md): existing Card rows unchanged.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { cleanContactName } from '@/lib/crm/display-name'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format/date'
import { CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import type { InboxConversation, ConversationStatus } from '@/lib/data/crm/getInboxQueue'
import { CrmList, CrmListRow } from '@/components/admin/crm/mobile/CrmMobileKit'

const STATUS_LABEL: Record<ConversationStatus, string> = {
  unread: 'Unread',
  open: 'Open',
  handled: 'Handled',
  closed: 'Closed',
}

const STATUS_TONE: Record<ConversationStatus, string> = {
  unread: 'bg-primary text-primary-foreground',
  open: 'bg-secondary text-secondary-foreground',
  handled: 'bg-success text-success-foreground',
  closed: 'bg-muted text-muted-foreground',
}

function brokerLabel(slug: string | null): string {
  if (!slug) return 'Unassigned'
  return CRM_BROKER_DISPLAY[slug as CrmBrokerSlug] ?? slug
}

export default function InboxQueue({
  conversations,
  activePersonId,
  hrefBase,
  bulkAction,
}: {
  conversations: InboxConversation[]
  activePersonId: number | null
  /** Query-string base the row links append &c=<personId> to. */
  hrefBase: string
  bulkAction: (personIds: number[], status: ConversationStatus) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const clearSelection = () => setSelected(new Set())

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
      clearSelection()
      router.refresh()
    })
  }

  if (conversations.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nothing here. Inbound texts and emails land in this queue the moment they arrive.
      </p>
    )
  }

  /* ── Shared bulk bar (shown in both mobile and desktop when items selected) ── */
  const bulkBar = selected.size > 0 ? (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
      <span className="px-1 text-sm font-medium text-foreground tabular-nums">{selected.size} selected</span>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk('handled')}>
        Mark handled
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runBulk('closed')}>
        Close
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => runBulk('open')}>
        Reopen
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={clearSelection}>
        Clear
      </Button>
    </div>
  ) : null

  const errorBanner = error ? <p className="text-sm font-medium text-destructive">{error}</p> : null

  return (
    <div className="space-y-3">
      {bulkBar}
      {errorBanner}

      {/* ── Mobile list (< md) — FUB-style avatar rows ──────────────────── */}
      <div className="md:hidden">
        <CrmList className="-mx-4 border-y border-border bg-card">
          {conversations.map((c) => {
            const name = cleanContactName(c.name, c.personId)
            const isActive = c.personId === activePersonId
            const isUnread = c.status === 'unread'
            const preview = (c.lastDirection === 'out' ? 'You: ' : '') + (c.snippet ?? 'No message body')

            /* Right column: timestamp + unread dot */
            const trailing = (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(c.lastMessageAt)}</span>
                <div className="flex items-center gap-1">
                  {isUnread ? (
                    <span
                      className="block h-2 w-2 rounded-full"
                      style={{ backgroundColor: 'hsl(var(--primary))' }}
                      aria-label="Unread"
                    />
                  ) : null}
                  {c.needsReply ? (
                    <span
                      className="block h-2 w-2 rounded-full"
                      style={{ backgroundColor: 'hsl(var(--warning))' }}
                      aria-label="Needs reply"
                    />
                  ) : null}
                </div>
              </div>
            )

            return (
              <div
                key={c.personId}
                className={cn(isActive && 'bg-accent/40')}
              >
                <CrmListRow
                  href={`${hrefBase}&c=${c.personId}`}
                  name={name}
                  title={
                    <span className={cn(isUnread && 'font-bold')}>{name}</span>
                  }
                  subtitle={preview}
                  trailing={trailing}
                />
              </div>
            )
          })}
        </CrmList>
      </div>

      {/* ── Desktop card list (≥ md) — unchanged ────────────────────────── */}
      <div className="hidden md:block">
        <div className="space-y-2">
          {conversations.map((c) => {
            const isActive = c.personId === activePersonId
            const isSelected = selected.has(c.personId)
            return (
              <Card
                key={c.personId}
                className={cn('transition-shadow hover:shadow-md', isActive && 'ring-2 ring-ring')}
              >
                <CardContent className="flex items-start gap-3 p-3 sm:p-4">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(c.personId)}
                      aria-label={`Select ${c.name ?? 'contact'}`}
                    />
                  </div>
                  <Link href={`${hrefBase}&c=${c.personId}`} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {cleanContactName(c.name, c.personId)}
                      </span>
                      <Badge className={cn('shrink-0', STATUS_TONE[c.status])}>{STATUS_LABEL[c.status]}</Badge>
                      {c.needsReply ? (
                        <Badge variant="outline" className="shrink-0 border-warning text-warning">
                          Needs reply
                        </Badge>
                      ) : null}
                      {c.hasDraft ? (
                        <Badge variant="outline" className="shrink-0">Draft</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">
                      {c.lastDirection === 'out' ? 'You: ' : ''}
                      {c.snippet ?? 'No message body'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {c.lastKindLabel ? <span>{c.lastKindLabel}</span> : null}
                      <span className="tabular-nums">{formatDateTime(c.lastMessageAt)}</span>
                      <span>{brokerLabel(c.assignedBroker)}</span>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
