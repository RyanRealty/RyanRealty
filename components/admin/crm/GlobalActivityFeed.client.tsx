'use client'

/**
 * GlobalActivityFeed — the CRM-wide activity stream for the Activity tab (FUB
 * "Activity" parity). The user includes/excludes activity TYPES (emails, texts,
 * website visits, calls, notes, new leads, updates) with independent toggle
 * chips; the feed re-fetches the union. Same visual language as
 * ContactActivityFeed, with the contact's name linking to their record, grouped
 * under day dividers, newest first. "Load more" pages through the same selection.
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
import type { GlobalActivityItem } from '@/lib/data/crm/getGlobalActivityFeed'
import { groupByDay, relativeTime } from '@/lib/format/activity-feed'
import { loadGlobalActivity } from '@/app/actions/crm-activity'

type TypeChip = { key: string; label: string }

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
  allTypes,
  initialSelected,
}: {
  initialItems: GlobalActivityItem[]
  initialCursor: string | null
  allTypes: TypeChip[]
  initialSelected: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))
  const [items, setItems] = useState<GlobalActivityItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, startTransition] = useTransition()

  function refetch(next: Set<string>) {
    startTransition(async () => {
      const res = await loadGlobalActivity({ types: [...next] })
      setItems(res.items)
      setCursor(res.nextCursor)
    })
  }

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
    refetch(next)
  }

  function setAll(on: boolean) {
    const next = on ? new Set(allTypes.map((t) => t.key)) : new Set<string>()
    setSelected(next)
    refetch(next)
  }

  function loadMore() {
    if (!cursor) return
    startTransition(async () => {
      const res = await loadGlobalActivity({ types: [...selected], before: cursor })
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.nextCursor)
    })
  }

  const allOn = selected.size === allTypes.length
  const noneOn = selected.size === 0
  const now = Date.now()
  const groups = groupByDay(items, now)

  return (
    <div>
      {/* Include / exclude activity types. Each chip is an independent toggle. */}
      <div className="mb-6 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {allTypes.map((t) => {
            const on = selected.has(t.key)
            return (
              <Button
                key={t.key}
                type="button"
                variant={on ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggle(t.key)}
                aria-pressed={on}
                disabled={pending}
                className={cn('gap-1.5 rounded-full', !on && 'text-muted-foreground')}
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-xs leading-none',
                    on ? 'border-primary-foreground/70 bg-primary-foreground/20' : 'border-border',
                  )}
                  aria-hidden
                >
                  {on ? '✓' : ''}
                </span>
                {t.label}
              </Button>
            )
          })}
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setAll(!allOn)}
            disabled={pending}
            className="ml-1 h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {allOn ? 'Clear all' : 'Select all'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {noneOn ? 'No types selected.' : allOn ? 'Showing all activity.' : `Showing ${selected.size} of ${allTypes.length} types.`}
        </p>
      </div>

      {noneOn ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Select at least one activity type above.</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{pending ? 'Loading…' : 'No activity for the selected types.'}</p>
      ) : (
        <div className={cn('space-y-5 transition-opacity', pending && 'opacity-60')}>
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
      )}
    </div>
  )
}
