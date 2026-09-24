// @no-parity — private /account subtree page (no public mockup contract; matches
// the sibling /account/collections/[id] composition, not a ui_kits mockup)
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getClientDeal, getClientIdentity } from '@/lib/data/tc/client-transactions'
import { AccountFrame } from '@/app/account/_v3/AccountFrame'
import { TransactionDetailView } from '@/components/account/transactions/TransactionDetailView'

export const metadata: Metadata = {
  title: 'Your transaction',
  description: 'Your stage, next steps, documents, and team on this file.',
}

export const dynamic = 'force-dynamic'

/**
 * /account/transactions/[dealId] — one client's own file.
 *
 * getClientDeal() re-checks the signed-in identity against tc_deal_people
 * before returning anything; a deal id that is not this client's own comes
 * back null, which is notFound() here, not an error page (nothing about the
 * file — its existence included — leaks to a client it does not belong to).
 * Every field rendered below is exactly what lib/tc/client-portal.ts decided
 * a client may see; this page adds no other data source (CLAUDE.md §0).
 */
export default async function TransactionDetailPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params
  // No confirmed identity can own a file: same answer as someone else's file.
  const identity = await getClientIdentity()
  if (!identity) notFound()
  const deal = await getClientDeal(identity, dealId)
  if (!deal) notFound()
  return (
    <AccountFrame>
      <TransactionDetailView deal={deal} />
    </AccountFrame>
  )
}
