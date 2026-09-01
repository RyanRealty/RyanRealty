// @no-parity — internal admin surface, no public mockup contract
// Closings (P9 roll:remaining-families, IA lock 2026-08-05): get accepted
// offers to closed, compliantly — the ONE deal list rooted in TC truth
// (tc_deals), per the one-deal-entity lock (deal-track MERGE→tc-close).
// Named for the outcome, not "deals" — a word two dead systems fought over.
// Lenses by stage; each row opens the full TC deal page (docs, signing,
// commissions, checklist) which stays at /admin/deals/[key]. The legacy
// skyslope-mirror LIST at /admin/deals and the CRM kanban at /admin/crm/deals*
// are redirect bridges here (P3: one deal entity). SkySlope stays the live
// file until cutover.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import {
  closingMatchesQuery,
  getClosingsBoard,
  incompleteInFlight,
  type ClosingDealRow,
} from '@/lib/data/tc/closings'
import { getSkySlopeMirrorFreshness } from '@/lib/data/tc/skyslope-mirror'
import { formatDate } from '@/lib/format/date'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { Button, HiddenField, QueueRow, SectionHead, TextField, VerdictLine } from '@/components/admin/v2'
import { NewFileForm } from './NewFileForm'

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
  if (d.partyNames.length) bits.push(d.partyNames.join(', '))
  if (d.brokerName) bits.push(d.brokerName)
  if (d.mlsNumber) bits.push(`MLS ${d.mlsNumber}`)
  if (d.escrowNumber) bits.push(`escrow ${d.escrowNumber}`)
  const p = price(d.salePrice ?? d.listingPrice)
  if (p) bits.push(p)
  if (d.itemsRequired > 0) bits.push(`${d.itemsRequired} required`)
  if (d.stage === 'pending') {
    const days = daysUntil(d.escrowClosingDate, nowMs)
    if (days != null)
      bits.push(days >= 0 ? `closes ${formatDate(d.escrowClosingDate)} (${days}d)` : `close date ${formatDate(d.escrowClosingDate)} passed`)
    if (d.itemsInReview > 0) bits.push(`${d.itemsInReview} item${d.itemsInReview === 1 ? '' : 's'} in review`)
  } else if (d.stage === 'active_listing') {
    const days = daysUntil(d.expirationDate, nowMs)
    if (days != null) {
      bits.push(
        days >= 0
          ? `expires ${formatDate(d.expirationDate)} (${days}d)`
          : `expired ${formatDate(d.expirationDate)}`,
      )
    } else {
      bits.push('active listing')
    }
    if (d.itemsInReview > 0) bits.push(`${d.itemsInReview} item${d.itemsInReview === 1 ? '' : 's'} in review`)
  }
  return bits.join(' · ')
}

export default async function ClosingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mine?: string }>
}) {
  const ctx = await requireAdminPage('transactions.view')
  const { q, mine } = await searchParams
  const nowMs = Date.now()
  const [board, mirror] = await Promise.all([getClosingsBoard(), getSkySlopeMirrorFreshness()])
  const mineOnly = ctx.role === 'superuser' && mine === '1'
  const scoped = board.deals.filter((d) =>
    dealVisibleToBroker({
      role: mineOnly ? 'broker' : ctx.role,
      brokerSlug: ctx.brokerSlug,
      dealBrokerName: d.brokerName,
    }),
  )
  const visible = q?.trim() ? scoped.filter((d) => closingMatchesQuery(d, q)) : scoped

  const incomplete = incompleteInFlight(visible)
  const inEscrow = visible.filter((d) => d.stage === 'pending' || d.stage === 'pre_contract')
  const activeListings = visible
    .filter((d) => d.stage === 'active_listing')
    .sort((a, b) => String(a.expirationDate ?? '9999').localeCompare(String(b.expirationDate ?? '9999')))
  const closed = visible
    .filter((d) => d.stage === 'closed')
    .sort((a, b) => String(b.actualClosingDate ?? '').localeCompare(String(a.actualClosingDate ?? '')))
  const dead = visible.filter((d) => d.stage === 'dead')
  // LIVE deals only — closed/dead deals carry stale in_review rows (first
  // render counted 248 vs the true 17; a verdict must equal its lanes' sum).
  const signoffWaits = [...inEscrow, ...activeListings].reduce((n, d) => n + d.itemsInReview, 0)
  const inFlight = inEscrow.length + activeListings.length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
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
        {mirror.status === 'unreadable' ? (
          <VerdictLine tone="attention">
            SkySlope recon mirror is unreadable. Closings still read Vault.
          </VerdictLine>
        ) : (
          <VerdictLine tone={mirror.current ? 'ok' : 'attention'}>
            {mirror.current ? (
              <>
                SkySlope recon mirror is current ({mirror.rowCount} properties). Vault is the deal
                list.
              </>
            ) : (
              <>
                SkySlope recon mirror is stale
                {mirror.latestSyncedAt
                  ? ` (synced ${mirror.latestSyncedAt.slice(0, 10)}, ${mirror.ageHours != null ? `${Math.round(mirror.ageHours / 24)}d` : 'age unknown'})`
                  : ''}
                . Closings still read Vault. Inbound refresh is /api/cron/skyslope-mirror-refresh.
              </>
            )}
          </VerdictLine>
        )}
      </div>

      {ctx.role === 'superuser' ? (
        <p style={{ fontSize: 'var(--a-text-sm)', margin: '0 0 14px' }}>
          {mineOnly ? (
            <>
              Showing your files.{' '}
              <Link href={q?.trim() ? `/admin/closings?q=${encodeURIComponent(q.trim())}` : '/admin/closings'} style={{ color: 'var(--a-accent)' }}>
                All brokers
              </Link>
            </>
          ) : (
            <>
              Showing every file.{' '}
              <Link
                href={q?.trim() ? `/admin/closings?mine=1&q=${encodeURIComponent(q.trim())}` : '/admin/closings?mine=1'}
                style={{ color: 'var(--a-accent)' }}
              >
                Mine only
              </Link>
            </>
          )}
        </p>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, margin: '0 0 14px' }}>
        <form method="GET" className="av2-rfilters" style={{ flex: 1, margin: 0 }}>
          {mineOnly ? <HiddenField name="mine" value="1" /> : null}
          <TextField
            label="Search deals"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Address, MLS, escrow, agent, or party…"
          />
          <Button type="submit" touch style={{ alignSelf: 'flex-end' }}>
            Search
          </Button>
        </form>
        <NewFileForm />
      </div>
      {q?.trim() ? (
        <p style={{ fontSize: 'var(--a-text-sm)', margin: '0 0 14px' }}>
          {visible.length} match{visible.length === 1 ? '' : 'es'} for “{q.trim()}”.{' '}
          <Link href="/admin/closings" style={{ color: 'var(--a-accent)' }}>
            Clear
          </Link>
        </p>
      ) : null}

      {incomplete.length > 0 && (
        <section aria-label="Incomplete checklists">
          <SectionHead>Incomplete checklists</SectionHead>
          <ul className="av2-queue">
            {incomplete.map((d) => (
              <QueueRow
                key={`inc-${d.id}`}
                kind="Incomplete"
                kindTone="slow"
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

      {inEscrow.length > 0 && (
        <section aria-label="In escrow">
          <SectionHead>In escrow</SectionHead>
          <ul className="av2-queue">
            {inEscrow.map((d) => (
              <QueueRow
                key={d.id}
                kind={d.itemsInReview > 0 ? 'Sign-off' : d.stage === 'pre_contract' ? 'Pre-contract' : 'Escrow'}
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
          <SectionHead>Active listings</SectionHead>
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

      {closed.filter((d) => d.itemsRequired > 0).length > 0 && (
        <section aria-label="Closed with incomplete checklist">
          <SectionHead>Closed — incomplete</SectionHead>
          <ul className="av2-queue">
            {closed
              .filter((d) => d.itemsRequired > 0)
              .map((d) => (
                <QueueRow
                  key={`inc-closed-${d.id}`}
                  kind="Archive"
                  kindTone="slow"
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
        <SectionHead>Closed</SectionHead>
        {closed.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>None on record.</p>
        ) : (
          <ul className="av2-quietlist">
            {closed.map((d) => (
              <li key={d.id} className="av2-quiet">
                <Link href={dealHref(d)} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                  {d.address}
                </Link>
                <span className="av2-quiet__ok">closed</span>
                <span className="av2-quiet__fig">
                  {[d.partyNames.join(', ') || null, price(d.salePrice), formatDate(d.actualClosingDate)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Dead deals">
        <SectionHead>Dead deals</SectionHead>
        {dead.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>None on record.</p>
        ) : (
          <ul className="av2-quietlist">
            {dead.map((d) => (
              <li key={d.id} className="av2-quiet">
                <Link href={dealHref(d)} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                  {d.address}
                </Link>
                <span className="av2-quiet__ok">dead</span>
                <span className="av2-quiet__fig">
                  {[d.partyNames.join(', ') || d.brokerName, d.mlsNumber ? `MLS ${d.mlsNumber}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
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
      </p>
    </div>
  )
}
