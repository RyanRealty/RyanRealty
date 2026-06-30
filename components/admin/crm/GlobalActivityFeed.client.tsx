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
import { cleanContactName } from '@/lib/crm/display-name'
import {
  Activity, ArrowDownLeft, ArrowUpRight, ChevronDown, EyeOff, FileText, Globe, Mail, MailOpen,
  MessageSquare, Milestone, Phone, SlidersHorizontal, UserPlus, Users, Voicemail, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
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

type BrokerOption = { value: string; label: string }

export default function GlobalActivityFeed({
  initialItems,
  initialCursor,
  allTypes,
  initialSelected,
  brokerOptions = [],
  initialBroker = 'all',
}: {
  initialItems: GlobalActivityItem[]
  initialCursor: string | null
  allTypes: TypeChip[]
  initialSelected: string[]
  /** Broker scope options — empty for a restricted broker (locked to their leads). */
  brokerOptions?: BrokerOption[]
  initialBroker?: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))
  const [broker, setBroker] = useState<string>(initialBroker)
  const [items, setItems] = useState<GlobalActivityItem[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, startTransition] = useTransition()

  function refetch(nextTypes: Set<string>, nextBroker: string) {
    startTransition(async () => {
      const res = await loadGlobalActivity({ types: [...nextTypes], broker: nextBroker })
      setItems(res.items)
      setCursor(res.nextCursor)
    })
  }

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
    refetch(next, broker)
  }

  function setAll(on: boolean) {
    const next = on ? new Set(allTypes.map((t) => t.key)) : new Set<string>()
    setSelected(next)
    refetch(next, broker)
  }

  function pickBroker(value: string) {
    setBroker(value)
    refetch(selected, value)
  }

  function loadMore() {
    if (!cursor) return
    startTransition(async () => {
      const res = await loadGlobalActivity({ types: [...selected], broker, before: cursor })
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.nextCursor)
    })
  }

  const allOn = selected.size === allTypes.length
  const noneOn = selected.size === 0
  const typesLabel = noneOn ? 'No types' : allOn ? 'All types' : `${selected.size} type${selected.size === 1 ? '' : 's'}`
  const brokerLabel = brokerOptions.find((b) => b.value === broker)?.label ?? 'Everyone'
  const now = Date.now()
  const groups = groupByDay(items, now)

  return (
    <div>
      {/* Compact filter row: a multi-select Types dropdown + (owner only) a broker
          scope dropdown. Replaces the old chip sprawl. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={pending} className="gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
              {typesLabel}
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Activity types</DropdownMenuLabel>
            {allTypes.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.key}
                checked={selected.has(t.key)}
                onCheckedChange={() => toggle(t.key)}
                onSelect={(e) => e.preventDefault()}
              >
                {t.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAll(!allOn) }}>
              {allOn ? 'Clear all' : 'Select all'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {brokerOptions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={pending} className="gap-2">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                {brokerLabel}
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Show activity for</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={broker} onValueChange={pickBroker}>
                {brokerOptions.map((b) => (
                  <DropdownMenuRadioItem key={b.value} value={b.value}>{b.label}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
                            {cleanContactName(item.personName)}
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

                        {/* No per-row broker label: the feed is already scoped to the
                            selected agent's leads, and item.broker is who PERFORMED the
                            action (a teammate / blast), which reads as "everyone's
                            activity" on a scoped view. */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          {item.direction ? <DirectionTag direction={item.direction} /> : null}
                          {item.direction ? <span aria-hidden>·</span> : null}
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
