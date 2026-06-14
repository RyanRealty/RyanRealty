// @no-parity — internal admin tool (principal broker sign-off queue)
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { getPrincipalSignOffQueue, type SignOffDeal } from '@/app/actions/tc-signoff'
import type { ReviewDeadline } from '@/lib/tc/banking-days'
import { cn } from '@/lib/utils'
import { SignOffControls } from './SignOffControls'

function DeadlinePill({ deadline }: { deadline: ReviewDeadline | null }) {
  if (!deadline) {
    return <Badge variant="outline" className="text-[11px] text-muted-foreground">no acceptance date</Badge>
  }
  const n = deadline.bankingDaysRemaining
  if (deadline.overdue) {
    return (
      <Badge className="bg-destructive/15 text-[11px] tabular-nums text-destructive">
        {Math.abs(n)} day{Math.abs(n) === 1 ? '' : 's'} overdue
      </Badge>
    )
  }
  const tone = n <= 2 ? 'bg-warning/20 text-warning-foreground' : 'bg-muted text-muted-foreground'
  return (
    <Badge className={cn('text-[11px] tabular-nums', tone)}>
      due in {n} day{n === 1 ? '' : 's'}
    </Badge>
  )
}

export const dynamic = 'force-dynamic'

const STAGE_LABEL: Record<string, string> = {
  pending: 'Under contract',
  pre_contract: 'Pre-contract',
  active_listing: 'Active listing',
}

/** Lowest deadline first; overdue and soonest float to the top of a deal. */
function deadlineRank(deadline: ReviewDeadline | null): number {
  if (!deadline) return Number.MAX_SAFE_INTEGER - 1 // no date — after dated items, before nothing
  return deadline.bankingDaysRemaining
}

function dealHasOverdue(deal: SignOffDeal): boolean {
  return deal.items.some((i) => i.deadline?.overdue)
}

function soonestRank(deal: SignOffDeal): number {
  return Math.min(...deal.items.map((i) => deadlineRank(i.deadline)))
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'destructive' }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p
          className={cn(
            'text-2xl font-bold tabular-nums',
            tone === 'destructive' && value > 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function DealCard({ deal }: { deal: SignOffDeal }) {
  const overdue = dealHasOverdue(deal)
  // Most urgent item first within the deal.
  const items = [...deal.items].sort((a, b) => deadlineRank(a.deadline) - deadlineRank(b.deadline))
  return (
    <Card className={cn(overdue && 'border-destructive/40')}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <Link
            href={`/admin/deals/${encodeURIComponent(deal.propertyKey)}`}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {deal.address}
          </Link>
          <span className="text-xs text-muted-foreground">
            {deal.broker ?? '—'} · {STAGE_LABEL[deal.stage] ?? deal.stage}
          </span>
        </div>
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.itemId}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {item.name}
                  <DeadlinePill deadline={item.deadline} />
                </p>
                {item.docs.length ? (
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    {item.docs.map((doc) =>
                      doc.thumbUrl ? (
                        <HoverCard key={doc.id} openDelay={150} closeDelay={80}>
                          <HoverCardTrigger asChild>
                            <span className="cursor-zoom-in truncate text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                              {doc.name}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-auto max-w-[480px] p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                            <img
                              src={doc.thumbUrl}
                              alt={`Signature page of ${doc.name}`}
                              className="max-h-[440px] w-auto rounded-md border border-border bg-card"
                            />
                          </HoverCardContent>
                        </HoverCard>
                      ) : (
                        <span key={doc.id} className="truncate text-xs text-muted-foreground">
                          {doc.name}
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="mt-1 border-warning text-foreground">
                    no document attached
                  </Badge>
                )}
              </div>
              <SignOffControls itemId={item.itemId} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

const MAX_DEALS = 6

export default async function SignOffPage() {
  const queue = await getPrincipalSignOffQueue()

  if (!queue.authorized) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Sign-off queue</h1>
        <p className="text-sm text-muted-foreground">
          This is the principal broker&apos;s review queue. You don&apos;t have access.
        </p>
      </main>
    )
  }

  // Prioritize: deals with an overdue item first, then by soonest deadline.
  const sortedDeals = [...queue.deals].sort((a, b) => {
    const aOver = dealHasOverdue(a)
    const bOver = dealHasOverdue(b)
    if (aOver !== bOver) return aOver ? -1 : 1
    return soonestRank(a) - soonestRank(b)
  })
  const visibleDeals = sortedDeals.slice(0, MAX_DEALS)
  const hiddenCount = sortedDeals.length - visibleDeals.length

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Sign-off queue</h1>
        <p className="text-sm text-muted-foreground">
          Documents awaiting your principal-broker review across every broker&apos;s live deals.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Items pending" value={queue.totalItems} />
        <Stat label="Past 7-day deadline" value={queue.overdueItems} tone="destructive" />
        <Stat label="Deals" value={queue.deals.length} />
      </div>

      {queue.deals.length === 0 ? (
        <Card>
          <CardContent className="space-y-1 py-12 text-center">
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground">Nothing is awaiting your sign-off.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {queue.overdueItems > 0 ? 'Most urgent first' : 'Awaiting review'}
            </h2>
            <Link href="/admin/deals" className="text-xs font-medium text-primary hover:underline">
              All deals →
            </Link>
          </div>

          {visibleDeals.map((deal) => (
            <DealCard key={deal.propertyKey} deal={deal} />
          ))}

          {hiddenCount > 0 ? (
            <Link
              href="/admin/deals"
              className="flex h-11 items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-primary transition-colors hover:bg-muted"
            >
              See all {sortedDeals.length} deals →
            </Link>
          ) : null}
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Oregon requires review of each document of agreement within 7 banking days (OAR 863-015-0140).
        Signing off here records your name and the review date.
      </p>
    </main>
  )
}
