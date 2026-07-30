/**
 * ContactProspectHistoryCard — the structured expired/FSBO listing story on
 * the contact page, right-rail card (renders when the contact links to an
 * expired_listings/fsbo_listings row via getContactProspectStory). Each row:
 * status + date, MLS#, last/original price with the drop, days on market, the
 * prior agent, and a deep link to the prospect's own page at
 * /admin/prospecting/<kind>/<id> (the `?id=` drawer was deleted 2026-07-28).
 * Display-only server component — the actions live on the prospecting surface.
 */
import Link from 'next/link'
import { History } from 'lucide-react'
import { formatDate } from '@/lib/format/date'
import { formatPrice } from '@/lib/format/money'
import type { ContactProspectStory } from '@/lib/data/crm/getContactProspectStory'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function fmtDate(iso: string | null): string | null {
  return iso ? formatDate(iso, { month: 'short', day: 'numeric' }) : null
}

/** "$795,000 → $749,000 (↓ 5.8%)" when the price moved, else the last price. */
function priceLine(s: ContactProspectStory): string | null {
  const last = s.lastListPrice
  const original = s.originalListPrice
  if (last == null && original == null) return null
  if (original == null || last == null || original === last) return formatPrice(last ?? original)
  const pct = ((last - original) / original) * 100
  const arrow = pct < 0 ? '↓' : '↑'
  return `${formatPrice(original)} → ${formatPrice(last)} (${arrow} ${Math.abs(pct).toFixed(1)}%)`
}

export function ContactProspectHistoryCard({ stories }: { stories: ContactProspectStory[] }) {
  if (stories.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <History className="h-4 w-4 text-primary" aria-hidden />
          Listing history
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {stories.map((s) => {
          const date = fmtDate(s.statusDate)
          const price = priceLine(s)
          return (
            <div key={`${s.kind}-${s.prospectId}`} className="rounded-lg border border-border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground" title={s.streetAddress ?? undefined}>
                    {s.streetAddress ?? '—'}
                    {s.city ? `, ${s.city}` : ''}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {[price, s.daysOnMarket != null ? `${s.daysOnMarket} days on market` : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {s.status}
                  {date ? ` · ${date}` : ''}
                </Badge>
              </div>
              {s.mlsNumber || s.priorAgentName ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[
                    s.mlsNumber ? `MLS# ${s.mlsNumber}` : null,
                    s.priorAgentName
                      ? `Prior agent ${s.priorAgentName}${s.priorOfficeName ? ` · ${s.priorOfficeName}` : ''}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
              <div className="mt-2">
                <Button asChild type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Link href={s.detailHref}>Open in Prospecting</Link>
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
