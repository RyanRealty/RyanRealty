// @no-parity — private /account subtree page (no public mockup contract; matches
// the sibling /account/saved-homes composition, not a ui_kits mockup)
import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTACT } from '@/lib/brand/contact'
import { getClientIdentity, listClientDeals } from '@/lib/data/tc/client-transactions'
import { AccountFrame } from '@/app/account/_v3/AccountFrame'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format/date'

export const metadata: Metadata = {
  title: 'Your transactions',
  description: 'Track your home purchase or sale with Ryan Realty: stage, next steps, documents, and your team.',
}

export const dynamic = 'force-dynamic'

/**
 * /account/transactions — a signed-in buyer or seller's own file(s).
 *
 * Identity and every row here come from lib/data/tc/client-transactions.ts:
 * the signed-in Supabase email, confirmed, matched to a CRM person, matched
 * to tc_deal_people. A null identity is not an error — it just means this
 * sign-in email is not (yet) linked to a file — so the page explains that
 * calmly instead of erroring or showing a blank screen.
 */
export default async function TransactionsPage() {
  const identity = await getClientIdentity()
  const deals = identity ? await listClientDeals(identity) : []

  return (
    <AccountFrame>
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Where every file stands, right now.</p>
        </header>

        {!identity ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">We can&apos;t find a file for this sign-in.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Sign in with the email your broker has on file. If you&apos;re already using that email, your broker
              just hasn&apos;t opened your file yet — it will show up here as soon as they do.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" className="h-11 px-5">
                <a href={`tel:${CONTACT.phoneDirectTel}`}>Call us</a>
              </Button>
              <Button asChild className="h-11 px-5">
                <a href={`mailto:${CONTACT.email.primary}`}>Email us</a>
              </Button>
            </div>
          </Card>
        ) : deals.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">Nothing here yet.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              As soon as your broker opens your file, it will show up here.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {deals.map((deal) => (
              <li key={deal.dealId}>
                <Link href={`/account/transactions/${deal.dealId}`}>
                  <Card className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{deal.address}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {`You're the ${deal.role}`} · {deal.stageLabel}
                      </p>
                      {deal.nextDate ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {deal.nextDate.label}: {formatDate(deal.nextDate.date)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {deal.waitingOnYou > 0 ? (
                        <Badge variant="warning">Waiting on you: {deal.waitingOnYou}</Badge>
                      ) : null}
                      <span className="text-sm font-medium text-primary">View →</span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AccountFrame>
  )
}
