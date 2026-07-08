/**
 * DashboardDeliveryAttention — the Home dashboard's "Email delivery" section
 * (WS4 delivery observability, admin consolidation 2026-07-07): alert and
 * market-report sends that look wrong, each with a plain-English fix and a
 * link to the person, plus the superuser-gated Hot leads shortcut.
 *
 * Server component: the dashboard page fetches getGlobalDeliverySummary and
 * passes the result in (null when the read failed — the section then renders
 * only the Hot leads card, or nothing for brokers).
 */
import Link from 'next/link'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { GlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'

const MAX_ITEMS = 5

export default function DashboardDeliveryAttention({
  summary,
  isSuperuser,
}: {
  summary: GlobalDeliverySummary | null
  isSuperuser: boolean
}) {
  if (!summary && !isSuperuser) return null

  return (
    <section data-tour="dash-delivery">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email delivery</h2>
        <Link href="/admin/crm/subscriptions" className="shrink-0 text-xs font-medium text-primary hover:underline">
          Alerts &amp; reports
        </Link>
      </div>
      <div className={cn('grid grid-cols-1 gap-4', isSuperuser && 'lg:grid-cols-[3fr_1fr]')}>
        {summary ? (
          <Card className="overflow-hidden">
            {summary.attention.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <p className="text-sm text-muted-foreground">
                  Alerts and market reports are going out normally. Nothing needs a fix.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {summary.attention.slice(0, MAX_ITEMS).map((item, i) => (
                  <div key={`d-${i}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        'shrink-0 rounded-md border px-2 py-1 text-xs font-semibold',
                        item.severity === 'problem'
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : 'border-warning/30 bg-warning/10 text-warning',
                      )}
                    >
                      {item.severity === 'problem' ? 'Fix' : 'Watch'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{item.headline}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.fix}</p>
                    </div>
                    <Link
                      href={item.fixHref}
                      className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {item.fixLabel} <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
                {summary.attention.length > MAX_ITEMS ? (
                  <Link
                    href="/admin/crm/subscriptions"
                    className="block px-4 py-2.5 text-xs font-medium text-primary hover:underline"
                  >
                    {summary.attention.length - MAX_ITEMS} more on the Delivery tab →
                  </Link>
                ) : null}
              </div>
            )}
          </Card>
        ) : null}
        {isSuperuser ? (
          <Link href="/admin/analytics/action-required" className="group block">
            <Card className="h-full overflow-hidden p-4 transition-colors group-hover:bg-muted/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hot leads</p>
              <p className="mt-1 text-sm text-foreground">
                Website visitors showing buying signals right now, ranked by engagement.
              </p>
              <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-primary">
                Open Hot leads <ChevronRight className="h-4 w-4" />
              </span>
            </Card>
          </Link>
        ) : null}
      </div>
    </section>
  )
}
