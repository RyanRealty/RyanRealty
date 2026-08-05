// @no-parity — internal admin surface, no public mockup contract
// Closings (P9 roll:remaining-families, IA lock 2026-08-05): get accepted
// offers to closed, compliantly — the ONE deal list rooted in TC truth
// (tc_deals), per the one-deal-entity lock (deal-track MERGE→tc-close).
// Named for the outcome, not "deals" — a word two dead systems fought over.
// Lenses by stage; each row opens the full TC deal page (docs, signing,
// commissions, checklist) which stays at /admin/deals/[key]. The legacy
// skyslope-mirror LIST at /admin/deals is absorbed (redirect bridge, same
// commit); the pre-contract CRM pipeline board stays one tap away until the
// person-stage migration (P3 lock: pre-close interest = person stage + tasks).
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getClosingsBoard, type ClosingDealRow } from '@/lib/data/tc/closings'
import { formatDate } from '@/lib/format/date'
import { QueueRow, QuietRow, VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

function price(n: number | null): string | null {
  return n == null ? null : `$${Math.round(n).toLocaleString('en-US')}`
}

function daysUntil(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const d = Math.ceil((new Date(iso + 'T00:00:00').getTime() - nowMs) / 86_400_000)
  return Number.isFinite(d) ? d : null
}

function dealHref(d: ClosingDealRow): string {
  return `/admin/deals/${encodeURIComponent(d.propertyKey)}`
}

function rowContext(d: ClosingDealRow, nowMs: number): string {
  const bits: string[] = []
  if (d.brokerName) bits.push(d.brokerName)
  const p = price(d.salePrice ?? d.listingPrice)
  if (p) bits.push(p)
  if (d.stage === 'pending') {
    const days = daysUntil(d.escrowClosingDate, nowMs)
    if (days != null)
      bits.push(days >= 0 ? `closes ${formatDate(d.escrowClosingDate)} (${days}d)` : `close date ${formatDate(d.escrowClosingDate)} passed`)
    if (d.itemsInReview > 0) bits.push(`${d.itemsInReview} item${d.itemsInReview === 1 ? '' : 's'} in review`)
  } else if (d.stage === 'active_listing') {
    bits.push('active listing')
    if (d.itemsInReview > 0) bits.push(`${d.itemsInReview} item${d.itemsInReview === 1 ? '' : 's'} in review`)
  }
  return bits.join(' · ')
}

export default async function ClosingsPage() {
  await requireAdminPage('transactions.view')
  const nowMs = Date.now()
  const board = await getClosingsBoard()

  const inEscrow = board.deals.filter((d) => d.stage === 'pending')
  const activeListings = board.deals.filter((d) => d.stage === 'active_listing')
  const closed = board.deals
    .filter((d) => d.stage === 'closed')
    .sort((a, b) => String(b.actualClosingDate ?? '').localeCompare(String(a.actualClosingDate ?? '')))
  const dead = board.deals.filter((d) => d.stage === 'dead')
  // LIVE deals only — closed/dead deals carry stale in_review rows (first
  // render counted 248 vs the true 17; a verdict must equal its lanes' sum).
  const signoffWaits = [...inEscrow, ...activeListings].reduce((n, d) => n + d.itemsInReview, 0)
  const inFlight = inEscrow.length + activeListings.length

  return (
    <main className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        {board.unreadable ? (
          <VerdictLine tone="attention">
            <b>The deal store is unreadable right now.</b> Do not assume anything below is complete.
          </VerdictLine>
        ) : (
          <VerdictLine tone={inFlight > 0 || signoffWaits > 0 ? 'attention' : 'ok'}>
            {inFlight > 0 ? (
              <>
                <b>
                  {inFlight} deal{inFlight === 1 ? '' : 's'} in flight.
                </b>{' '}
                {signoffWaits > 0
                  ? `${signoffWaits} checklist item${signoffWaits === 1 ? '' : 's'} await${signoffWaits === 1 ? 's' : ''} sign-off.`
                  : 'No checklist items wait on you.'}
              </>
            ) : (
              <>
                <b>Nothing in flight.</b> {closed.length} closed on record.
              </>
            )}
          </VerdictLine>
        )}
      </div>

      {inEscrow.length > 0 && (
        <section aria-label="In escrow">
          <h2 className="av2-lane-head">In escrow</h2>
          <ul className="av2-queue">
            {inEscrow.map((d) => (
              <QueueRow
                key={d.id}
                kind={d.itemsInReview > 0 ? 'Sign-off' : 'Escrow'}
                kindTone={d.itemsInReview > 0 ? 'slow' : 'accent'}
                title={d.address}
                context={rowContext(d, nowMs)}
                action={
                  <Link href={dealHref(d)} className="av2-btn" style={{ textDecoration: 'none' }}>
                    Open deal
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      )}

      {activeListings.length > 0 && (
        <section aria-label="Active listings">
          <h2 className="av2-lane-head">Active listings</h2>
          <ul className="av2-queue">
            {activeListings.map((d) => (
              <QueueRow
                key={d.id}
                kind="Listing"
                kindTone="waiting"
                title={d.address}
                context={rowContext(d, nowMs)}
                action={
                  <Link href={dealHref(d)} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                    Open deal
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Closed">
        <h2 className="av2-lane-head">Closed</h2>
        {closed.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>None on record.</p>
        ) : (
          <ul className="av2-quietlist">
            {closed.slice(0, 10).map((d) => (
              <li key={d.id} className="av2-quiet">
                <Link href={dealHref(d)} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                  {d.address}
                </Link>
                <span className="av2-quiet__ok">closed</span>
                <span className="av2-quiet__fig">
                  {[price(d.salePrice), formatDate(d.actualClosingDate)].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
        {closed.length > 10 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 8 }}>
            {closed.length - 10} more closed · {dead.length} dead
          </p>
        ) : dead.length > 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 8 }}>{dead.length} dead</p>
        ) : null}
      </section>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginTop: 24 }}>
        All tools:{' '}
        <Link href="/admin/sign-off" style={{ color: 'var(--a-accent)' }}>
          Sign-off queue
        </Link>
        {' · '}
        <Link href="/admin/commissions" style={{ color: 'var(--a-accent)' }}>
          Commissions
        </Link>
        {' · '}
        <Link href="/admin/financials" style={{ color: 'var(--a-accent)' }}>
          Financials
        </Link>
        {' · '}
        <Link href="/admin/forms" style={{ color: 'var(--a-accent)' }}>
          Forms
        </Link>
        {' · '}
        <Link href="/admin/crm/deals" style={{ color: 'var(--a-accent)' }}>
          Pre-contract pipeline
        </Link>
      </p>
    </main>
  )
}
