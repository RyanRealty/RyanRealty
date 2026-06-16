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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type InboxItem = {
  id: number
  personId: number
  name: string
  stage: string
  kindLabel: string
  title: string | null
  preview: string | null
  ts: string
}

type SegKey = 'inbox' | 'assigned' | 'sent'

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
  const lists: Record<SegKey, InboxItem[]> = { inbox, assigned, sent }
  const tabs: { key: SegKey; label: string; count: number }[] = [
    { key: 'inbox', label: 'Inbox', count: inbox.length },
    { key: 'assigned', label: 'Assigned', count: assigned.length },
    { key: 'sent', label: 'Sent', count: sent.length },
  ]
  const rows = lists[seg]

  return (
    <div className="space-y-3">
      {/* Segment chips */}
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Inbox segments">
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

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {seg === 'sent' ? 'No sent messages yet.' : seg === 'assigned' ? 'Nothing assigned to you yet.' : 'No inbound communications yet.'}
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
