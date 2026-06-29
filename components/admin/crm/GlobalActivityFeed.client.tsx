'use client'

/**
 * GlobalActivityFeed — the CRM-wide activity stream rendered for the Activity tab
 * (FUB "Activity" parity). Same visual language as ContactActivityFeed (category
 * chip + label + direction + snippet + relative time), with the contact's name
 * linking to their record, grouped under day dividers, newest first. "Load more"
 * fetches the next page through the loadGlobalActivity server action and appends.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowDownLeft, ArrowUpRight, EyeOff, FileText, Globe, Mail, MailOpen,
  MessageSquare, Milestone, Phone, UserPlus, Voicemail, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ActivityCategory } from '@/lib/data/crm/getContactActivityFeed'
import type { GlobalActivityItem, GlobalActivityFilter } from '@/lib/data/crm/getGlobalActivityFeed'
import { groupByDay, relativeTime } from '@/lib/format/activity-feed'
import { loadGlobalActivity } from '@/app/actions/crm-activity'

function iconFor(item: GlobalActivityItem): LucideIcon {
  if (item.kind === 'lead_created') return UserPlus
  if (item.kind === 'voicemail') return Voicemail
  if (item.kind === 'email_open') return MailOpen
  const byCategory: Record<ActivityCategory, LucideIcon> = {
    message: MessageSquare, email: Mail, call: Phone, note: FileText,
    system: Activity, milestone: Milestone, web: Globe, other: Activity,
  }
  return byCategory[item.category]
}

function chipClass(direction: GlobalActivityItem['direction']): string {
  if (direction === 'in') return 'border-success/30 bg-success/10 text-success'
  if (direction === 'out') return 'border-primary/20 bg-primary/10 text-primary'
  return 'border-border bg-muted text-muted-foreground'
}

function DirectionTag({ direction }: { direction: GlobalActivityItem['direction'] }) {
  if (direction === 'in') return <span className="inline-flex items-center gap-0.5 text-success"><ArrowDownLeft className="h-3 w-3" aria-hidden />In</span>
  if (direction === 'out') return <span className="inline-flex items-center gap-0.5 text-primary"><ArrowUpRight className="h-3 w-3" aria-hidden />Out</span>
  return null
}

export default function GlobalActivityFeed({
  initialItems,
  initialCursor,
  filter,
}: {
  initialItems: GlobalActivityItem[]
  initialCursor: string | null
  filter: GlobalActivityFilter
}) {
  const [items, setItems] = useState<GlobalActivityItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, startTransition] = useTransition()

  function loadMore() {
    if (!cursor) return
    startTransition(async () => {
      const res = await loadGlobalActivity({ filter, before: cursor })
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.nextCursor)
    })
  }

  if (items.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No activity yet.</p>
  }

  const now = Date.now()
  const groups = groupByDay(items, now)

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-2.5 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span className="text-xs tabular-nums text-muted-foreground">
              {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          <ol className="space-y-1">
            {(group.items as GlobalActivityItem[]).map((item) => {
              const Icon = iconFor(item)
              const stamp = relativeTime(item.ts, now)
              return (
                <li key={`${item.kind}-${item.id}`} className="flex min-h-11 gap-3 rounded-lg px-1 py-1.5 transition hover:bg-muted/40">
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border', chipClass(item.direction))}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Link href={item.href} className="text-sm font-semibold text-foreground underline-offset-2 hover:underline">
                        {item.personName}
                      </Link>
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{stamp}</span>
                    </div>

                    {item.snippet ? (
                      <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground">{item.snippet}</p>
                    ) : item.contentHidden ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs italic text-muted-foreground">
                        <EyeOff className="h-3 w-3" aria-hidden />
                        Content not synced from Follow Up Boss
                      </p>
                    ) : null}

                    {item.recordingSid ? (
                      <audio controls preload="none" src={`/api/admin/crm/recording/${item.recordingSid}`} className="mt-1.5 h-8 w-full max-w-xs">
                        <track kind="captions" />
                      </audio>
                    ) : null}

                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                      {item.direction ? <DirectionTag direction={item.direction} /> : null}
                      {item.direction ? <span aria-hidden>·</span> : null}
                      {item.broker ? <><span>{item.broker}</span><span aria-hidden>·</span></> : null}
                      <span className="capitalize">{item.category}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}

      {cursor ? (
        <div className="pt-2 text-center">
          <Button variant="outline" onClick={loadMore} disabled={pending}>
            {pending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : (
        <p className="pt-2 text-center text-xs text-muted-foreground">End of activity</p>
      )}
    </div>
  )
}
