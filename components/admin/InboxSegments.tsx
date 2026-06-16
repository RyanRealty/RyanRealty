'use client'

/**
 * InboxSegments — the segmented CRM inbox (docs/MOBILE_CRM_FUB_PARITY.md #2).
 *
 * FUB's mobile inbox segments into Inbox / Assigned / Sent / Closed + an unread
 * count. We ship the three segments crm_timeline can back honestly — Inbox
 * (inbound), Assigned (inbound for the acting broker), Sent (outbound) — each
 * with a live count. Closed and the unread badge are deliberately omitted: there
 * is no read/closed state on the timeline to drive them, and an always-empty tab
 * is worse than no tab. They land when a conversation-status column does.
 *
 * Presentation only — rows are pre-shaped on the server; this switches segments.
 */

import Link from 'next/link'
import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type InboxItem = {
  id: number
  personId: number
  name: string
  stage: string
  kind: string
  kindLabel: string
  title: string | null
  preview: string | null
  ts: string
}

type SegKey = 'inbox' | 'assigned' | 'sent'
type MsgType = 'email' | 'text' | 'call'

const TYPE_OF: Record<string, MsgType> = {
  email_in: 'email', email_out: 'email',
  sms_in: 'text', sms_out: 'text',
  call: 'call', voicemail: 'call',
}
const TYPE_LABEL: Record<MsgType, string> = { email: 'Emails', text: 'Texts', call: 'Calls' }

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}

export default function InboxSegments({
  inbox,
  assigned,
  sent,
}: {
  inbox: InboxItem[]
  assigned: InboxItem[]
  sent: InboxItem[]
}) {
  const [seg, setSeg] = useState<SegKey>('inbox')
  const [types, setTypes] = useState<Set<MsgType>>(new Set(['email', 'text', 'call']))
  const [filterOpen, setFilterOpen] = useState(false)
  const lists: Record<SegKey, InboxItem[]> = { inbox, assigned, sent }
  const segRows = lists[seg]
  // Type filter (FUB-parity #5: the filter bottom-sheet). All three on = no filter.
  const allTypes = types.size === 3
  const rows = allTypes ? segRows : segRows.filter((r) => types.has(TYPE_OF[r.kind] ?? 'email'))
  const tabs: { key: SegKey; label: string; count: number }[] = [
    { key: 'inbox', label: 'Inbox', count: inbox.length },
    { key: 'assigned', label: 'Assigned', count: assigned.length },
    { key: 'sent', label: 'Sent', count: sent.length },
  ]
  const toggleType = (t: MsgType) =>
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      // Never let the filter empty out to "nothing" — re-enable all instead.
      return next.size === 0 ? new Set<MsgType>(['email', 'text', 'call']) : next
    })

  return (
    <div className="space-y-3">
      {/* Segment chips + filter trigger */}
      <div className="flex items-center gap-2">
        <div className="no-scrollbar -mx-1 flex flex-1 gap-1 overflow-x-auto px-1" role="tablist" aria-label="Inbox segments">
          {tabs.map((t) => (
            <Button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={seg === t.key}
              variant={seg === t.key ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setSeg(t.key)}
              className="shrink-0 gap-1.5 whitespace-nowrap rounded-full"
            >
              {t.label}
              <span className={cn('tabular-nums', seg === t.key ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>{t.count}</span>
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setFilterOpen(true)} className="shrink-0 gap-1.5" aria-label="Filter">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {allTypes ? null : <span className="tabular-nums">{types.size}</span>}
        </Button>
      </div>

      {/* Filter bottom-sheet — type filter (Emails / Texts / Calls) */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4">
          <SheetTitle className="text-base">Filter</SheetTitle>
          <div className="mt-3 space-y-1">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Types</div>
            {(['email', 'text', 'call'] as MsgType[]).map((t) => (
              <Label key={t} htmlFor={`type-${t}`} className="flex items-center justify-between rounded-lg px-1 py-2.5 text-sm font-medium text-foreground">
                {TYPE_LABEL[t]}
                <Checkbox id={`type-${t}`} checked={types.has(t)} onCheckedChange={() => toggleType(t)} />
              </Label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setTypes(new Set(['email', 'text', 'call']))}>All types</Button>
            <Button type="button" className="flex-1" onClick={() => setFilterOpen(false)}>Apply</Button>
          </div>
        </SheetContent>
      </Sheet>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {!allTypes && segRows.length > 0
            ? 'No messages match the filter.'
            : seg === 'sent'
              ? 'No sent messages yet.'
              : seg === 'assigned'
                ? 'Nothing assigned to you yet.'
                : 'No inbound communications yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start gap-3 px-3 py-3 sm:gap-4 sm:px-4">
                <div className="shrink-0 text-sm sm:w-24">{r.kindLabel}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/admin/crm/${r.personId}`} className="text-sm font-medium text-foreground hover:underline">{r.name}</Link>
                    {r.stage ? <Badge variant="secondary" className="text-xs">{r.stage}</Badge> : null}
                    <span className="text-xs tabular-nums text-muted-foreground">{fmt(r.ts)}</span>
                  </div>
                  {r.title ? <div className="mt-0.5 truncate text-sm text-foreground">{r.title}</div> : null}
                  {r.preview ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.preview}</p> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
