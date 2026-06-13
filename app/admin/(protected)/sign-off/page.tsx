// @no-parity — internal admin tool (principal broker sign-off queue)
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { getPrincipalSignOffQueue } from '@/app/actions/tc-signoff'
import type { ReviewDeadline } from '@/lib/tc/banking-days'
import { SignOffControls } from './SignOffControls'

function DeadlinePill({ deadline }: { deadline: ReviewDeadline | null }) {
  if (!deadline) {
    return <Badge variant="outline" className="text-[11px] text-muted-foreground">no acceptance date</Badge>
  }
  const n = deadline.bankingDaysRemaining
  if (deadline.overdue) {
    return (
      <Badge className="bg-destructive/15 text-[11px] text-destructive">
        {Math.abs(n)} banking day{Math.abs(n) === 1 ? '' : 's'} overdue
      </Badge>
    )
  }
  const tone = n <= 2 ? 'bg-warning/20 text-warning-foreground' : 'bg-muted text-muted-foreground'
  return (
    <Badge className={`text-[11px] ${tone}`}>
      due in {n} banking day{n === 1 ? '' : 's'}
    </Badge>
  )
}

export const dynamic = 'force-dynamic'

const STAGE_LABEL: Record<string, string> = {
  pending: 'Under contract',
  pre_contract: 'Pre-contract',
  active_listing: 'Active listing',
}

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

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Sign-off queue</h1>
        <p className="text-sm text-muted-foreground">
          Documents submitted for principal-broker review across all brokers&apos; live deals.
          Oregon requires you to review each document of agreement within 7 banking days
          (OAR 863-015-0140); signing off here records your name and the review date.{' '}
          {queue.totalItems} item{queue.totalItems === 1 ? '' : 's'} pending
          {queue.overdueItems > 0 ? (
            <span className="font-semibold text-destructive">, {queue.overdueItems} past the 7-day deadline</span>
          ) : null}
          .
        </p>
      </header>

      {queue.deals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing awaiting your sign-off. ✓
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.deals.map((deal) => (
            <Card key={deal.propertyKey}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/admin/deals/${encodeURIComponent(deal.propertyKey)}`} className="text-base font-semibold text-foreground hover:underline">
                    {deal.address}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {deal.broker ?? '—'} · {STAGE_LABEL[deal.stage] ?? deal.stage}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {deal.items.map((item) => (
                    <li key={item.itemId} className="flex items-start justify-between gap-3 py-2.5">
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
                                      className="max-h-[440px] w-auto rounded-md border border-border bg-white"
                                    />
                                  </HoverCardContent>
                                </HoverCard>
                              ) : (
                                <span key={doc.id} className="truncate text-xs text-muted-foreground">
                                  {doc.name}
                                </span>
                              )
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
          ))}
        </div>
      )}
    </main>
  )
}
