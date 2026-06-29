/**
 * ContactBehaviorPanel — the at-a-glance website behavior + intent picture for
 * the Contact-360 view (CONTACT360 Phase 2.6: "see what they are looking at on
 * the website").
 *
 * Server component. Renders the typed output of getContactBehaviorSummary as
 * props (the page fetches; this component only renders):
 *   - a header with last-seen (relative) + sessions in the last 30 days
 *   - intentSignals as Badge chips
 *   - topListingsViewed as a compact list (address + view count, linked to the
 *     public listing when an MLS key is present)
 *   - topSearches as labeled rows with counts
 *
 * Empty state when there is no behavior yet. Mobile-first stack.
 */
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ContactBehaviorSummary } from '@/lib/data/crm/getContactBehaviorSummary'

/** Relative last-seen label, mirroring the console's fmtAgo idiom. */
function lastSeenLabel(iso: string | null): string {
  if (!iso) return 'never seen on the site'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'never seen on the site'
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'last seen just now'
  if (mins < 60) return `last seen ${mins}m ago`
  if (mins < 1440) return `last seen ${Math.round(mins / 60)}h ago`
  const days = Math.round(mins / 1440)
  return `last seen ${days} ${days === 1 ? 'day' : 'days'} ago`
}

export default function ContactBehaviorPanel({
  summary,
}: {
  summary: ContactBehaviorSummary
}) {
  const { lastSeenAt, sessions30d, topSearches, intentSignals } = summary

  const hasAnything =
    Boolean(lastSeenAt) ||
    sessions30d > 0 ||
    topSearches.length > 0 ||
    intentSignals.length > 0

  return (
    <ConsoleSection title="On the website" count={lastSeenLabel(lastSeenAt)}>
      {!hasAnything ? (
        <p className="text-sm text-muted-foreground">No website activity captured yet.</p>
      ) : (
        <div className="space-y-4">
          {/* Sessions in the last 30 days */}
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-lg font-semibold tabular-nums text-foreground">{sessions30d}</span>
            <span className="text-muted-foreground">
              {sessions30d === 1 ? 'session' : 'sessions'} in the last 30 days
            </span>
          </div>

          {/* Intent signals as chips */}
          {intentSignals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {intentSignals.map((signal) => (
                <Badge key={signal} variant="soft-hot" className="text-xs">
                  {signal}
                </Badge>
              ))}
            </div>
          ) : null}

          {/* Homes viewed now render as FUB-style property cards in the Homes
              tab's Activity section (ViewedHomeCard) — no duplicate list here. */}

          {/* Searches they ran */}
          {topSearches.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Searches
              </div>
              <ul className="space-y-1.5">
                {topSearches.map((s) => (
                  <li
                    key={s.label}
                    className={cn(
                      'flex min-h-11 items-center justify-between gap-3',
                      'rounded-lg border border-border px-3 py-2 sm:min-h-0',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {s.count} {s.count === 1 ? 'time' : 'times'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </ConsoleSection>
  )
}
