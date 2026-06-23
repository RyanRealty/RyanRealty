/**
 * ContactActivityFeed — the unified communications + activity stream for the
 * Contact-360 view (CONTACT360 Phase 2.1). Renders getContactActivityFeed's
 * output as a thoughtfully-laid-out chronological timeline: a category icon per
 * row, the human label, an inbound/outbound indicator, a muted snippet, the
 * broker, and a short relative timestamp. Items are grouped under subtle day
 * dividers. Newest first.
 *
 * Server component — no interactivity. Takes the reader's typed output as a
 * prop; the page does the fetch.
 */
import type * as React from 'react'
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Globe,
  Mail,
  MailOpen,
  MessageSquare,
  Milestone,
  Phone,
  Voicemail,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityCategory, ActivityFeedItem } from '@/lib/data/crm/getContactActivityFeed'
import { groupByDay, relativeTime } from '@/lib/format/activity-feed'

/** One icon per category, plus a couple of kind-level overrides for nicer reads. */
function iconFor(item: ActivityFeedItem): LucideIcon {
  if (item.kind === 'voicemail') return Voicemail
  if (item.kind === 'email_open') return MailOpen
  const byCategory: Record<ActivityCategory, LucideIcon> = {
    message: MessageSquare,
    email: Mail,
    call: Phone,
    note: FileText,
    system: Activity,
    milestone: Milestone,
    web: Globe,
    other: Activity,
  }
  return byCategory[item.category]
}

/**
 * Direction tints the icon chip with a design token. Inbound (the contact
 * reaching us) reads as success, outbound (us reaching them) reads as primary,
 * everything else is neutral. Tokens only, never hex.
 */
function chipClass(direction: ActivityFeedItem['direction']): string {
  if (direction === 'in') return 'border-success/30 bg-success/10 text-success'
  if (direction === 'out') return 'border-primary/20 bg-primary/10 text-primary'
  return 'border-border bg-muted text-muted-foreground'
}

function DirectionTag({ direction }: { direction: ActivityFeedItem['direction'] }) {
  if (direction === 'in') {
    return (
      <span className="inline-flex items-center gap-0.5 text-success">
        <ArrowDownLeft className="h-3 w-3" aria-hidden />
        In
      </span>
    )
  }
  if (direction === 'out') {
    return (
      <span className="inline-flex items-center gap-0.5 text-primary">
        <ArrowUpRight className="h-3 w-3" aria-hidden />
        Out
      </span>
    )
  }
  return null
}

export default function ContactActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
  }

  // Server-rendered once per request; a single `now` keeps every relative stamp
  // and day label consistent across the whole feed.
  const now = Date.now()
  const groups = groupByDay(items, now)

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-2.5 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {group.items.length} {group.items.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          <ol className="space-y-1">
            {group.items.map((item) => {
              const Icon = iconFor(item)
              const stamp = relativeTime(item.ts, now)
              return (
                <li key={item.id} className="flex min-h-11 gap-3 rounded-lg px-1 py-1.5">
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                      chipClass(item.direction),
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{stamp}</span>
                    </div>

                    {item.snippet ? (
                      <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {item.snippet}
                      </p>
                    ) : null}

                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                      {(() => {
                        const parts: React.ReactNode[] = []
                        if (item.direction) parts.push(<DirectionTag key="dir" direction={item.direction} />)
                        if (item.broker) parts.push(<span key="broker">{item.broker}</span>)
                        parts.push(
                          <span key="cat" className="capitalize">
                            {item.category}
                          </span>,
                        )
                        return parts.flatMap((node, idx) =>
                          idx === 0
                            ? [node]
                            : [
                                <span key={`sep-${idx}`} aria-hidden>
                                  ·
                                </span>,
                                node,
                              ],
                        )
                      })()}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
