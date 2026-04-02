import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { ListingHistoryEvent } from '@/app/actions/listing-detail'

type Props = {
  events: ListingHistoryEvent[]
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return s
  }
}

function eventIcon(type: ListingHistoryEvent['event_type']): string {
  switch (type) {
    case 'new_listing':
      return '🏠'
    case 'price_change':
      return '💲'
    case 'status_change':
      return '📋'
    case 'back_on_market':
      return '🔄'
    case 'closed':
      return '🔑'
    default:
      return '•'
  }
}

function eventBadgeVariant(
  type: ListingHistoryEvent['event_type'],
  changePct: number | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'new_listing':
      return 'default'
    case 'price_change':
      return changePct != null && changePct < 0 ? 'secondary' : 'destructive'
    case 'closed':
      return 'default'
    case 'back_on_market':
      return 'outline'
    case 'status_change':
      return 'secondary'
    default:
      return 'outline'
  }
}

/**
 * ListingTimeline — shows the full lifecycle of a listing.
 *
 * Displays events chronologically: new listing, price changes, status transitions,
 * close events. Each event gets a date, icon, label, and optional percentage badge.
 *
 * Data source: listing_history table (2M+ rows), processed in listing-detail.ts
 */
export default function ListingTimeline({ events }: Props) {
  if (!events || events.length === 0) return null

  // Show chronologically (oldest first)
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  )

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Listing timeline</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full history of this property on the market
        </p>
        <Separator className="my-4" />
        <div className="relative space-y-0">
          {sorted.map((evt, idx) => {
            const isLast = idx === sorted.length - 1
            return (
              <div key={evt.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Vertical timeline line */}
                {!isLast && (
                  <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                )}
                {/* Icon circle */}
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm',
                    evt.event_type === 'closed'
                      ? 'bg-primary text-primary-foreground'
                      : evt.event_type === 'new_listing'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  <span aria-hidden>{eventIcon(evt.event_type)}</span>
                </div>
                {/* Content */}
                <div className="flex flex-1 flex-col gap-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {evt.label}
                    </span>
                    {evt.change_pct != null && Math.abs(evt.change_pct) >= 0.1 && (
                      <Badge variant={eventBadgeVariant(evt.event_type, evt.change_pct)}>
                        {evt.change_pct > 0 ? '+' : ''}
                        {evt.change_pct.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(evt.event_date)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
