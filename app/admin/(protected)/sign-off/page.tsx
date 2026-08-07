// @no-parity — internal admin tool (principal broker sign-off queue)
//
// Sign-off queue — 11E: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only. The stamp itself lives
// in SignOffControls → recordPrincipalReview and was not touched.
//
// Carried over verbatim: getPrincipalSignOffQueue, the authorized branch, the
// overdue-then-soonest sort, MAX_DEALS = 6 with the "see all" spill link, the
// per-item SignOffControls mount, every href, and the OAR 863-015-0140 note.
//
// Shape changed, data did not: both page-title h1s are gone (the nav names the
// page, and the unauthorized branch answers in one line), KpiStrip became the
// v2 numbers strip with the same three figures, each checklist item is a queue
// row whose kind word IS its deadline state, and a document name now LINKS to
// its signature page instead of revealing it on hover — same signed URL, but a
// door instead of a hover-only affordance (ADMIN_UI §3 rule 4), and reachable
// by keyboard and on a phone.
import Link from 'next/link'
import {
  QueueRow,
  ReportError,
  ReportNumbers,
  SectionHead,
  StateWord,
  VerdictLine,
} from '@/components/admin/v2'
import { getPrincipalSignOffQueue, type SignOffDeal } from '@/app/actions/tc-signoff'
import type { ReviewDeadline } from '@/lib/tc/banking-days'
import { SignOffControls } from './SignOffControls'

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

/** The deadline as the row's kind word + age text (ADMIN_UI pattern 1). */
function deadlineWords(deadline: ReviewDeadline | null): {
  kind: string
  tone: 'down' | 'slow' | 'waiting'
  age: string
  hot: boolean
} {
  if (!deadline) return { kind: 'No date', tone: 'waiting', age: 'no acceptance date', hot: false }
  const n = deadline.bankingDaysRemaining
  if (deadline.overdue) {
    const d = Math.abs(n)
    return { kind: 'Overdue', tone: 'down', age: `${d} day${d === 1 ? '' : 's'} overdue`, hot: true }
  }
  return {
    kind: n <= 2 ? 'Due soon' : 'Waiting',
    tone: n <= 2 ? 'slow' : 'waiting',
    age: `due in ${n} day${n === 1 ? '' : 's'}`,
    hot: false,
  }
}

const MAX_DEALS = 6
const SCOPE: React.CSSProperties = { maxWidth: 860, margin: '0 auto', padding: 16 }
const DEALHEAD: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: 8,
  margin: '16px 0 6px',
}
const LANE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
}

export default async function SignOffPage() {
  const queue = await getPrincipalSignOffQueue().catch(() => null)

  if (queue === null) {
    return (
      <div className="av2-scope" style={SCOPE}>
        <VerdictLine tone="attention">
          <b>The sign-off queue could not be read. Nothing below is the queue.</b>
        </VerdictLine>
        <ReportError what="The sign-off queue" href="/admin/sign-off" />
      </div>
    )
  }

  if (!queue.authorized) {
    return (
      <div className="av2-scope" style={SCOPE}>
        <VerdictLine tone="attention">
          <b>This is the principal broker&apos;s review queue.</b> Your account cannot open it.
        </VerdictLine>
      </div>
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
    <div className="av2-scope" style={SCOPE}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={queue.totalItems > 0 ? 'attention' : 'ok'}>
          {queue.totalItems === 0 ? (
            <b>Nothing is waiting on your sign-off.</b>
          ) : (
            <>
              <b>
                {queue.totalItems} item{queue.totalItems === 1 ? '' : 's'} waiting on your review
                across {queue.deals.length} deal{queue.deals.length === 1 ? '' : 's'}.
              </b>{' '}
              {queue.overdueItems > 0
                ? `${queue.overdueItems} past the 7-banking-day deadline.`
                : 'None past the 7-banking-day deadline.'}
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'pending', label: 'Items pending', value: String(queue.totalItems) },
          { key: 'overdue', label: 'Past the 7-banking-day deadline', value: String(queue.overdueItems) },
          { key: 'deals', label: 'Deals', value: String(queue.deals.length) },
        ]}
      />

      {queue.deals.length === 0 ? null : (
        <>
          <div style={LANE}>
            <SectionHead>{queue.overdueItems > 0 ? 'Most urgent first' : 'Awaiting review'}</SectionHead>
            <Link href="/admin/deals" style={{ color: 'var(--a-accent)', fontSize: 'var(--a-text-xs)' }}>
              All deals
            </Link>
          </div>

          {visibleDeals.map((deal) => {
            // Most urgent item first within the deal.
            const items = [...deal.items].sort(
              (a, b) => deadlineRank(a.deadline) - deadlineRank(b.deadline),
            )
            return (
              <section key={deal.propertyKey} aria-label={deal.address}>
                <p style={DEALHEAD}>
                  <Link
                    href={`/admin/deals/${encodeURIComponent(deal.propertyKey)}`}
                    style={{ color: 'var(--a-accent)', fontWeight: 600 }}
                  >
                    {deal.address}
                  </Link>
                  <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                    {deal.broker ?? '—'} · {STAGE_LABEL[deal.stage] ?? deal.stage}
                  </span>
                </p>
                <ul className="av2-queue">
                  {items.map((item) => {
                    const w = deadlineWords(item.deadline)
                    return (
                      <QueueRow
                        key={item.itemId}
                        kind={w.kind}
                        kindTone={w.tone}
                        age={w.age}
                        hot={w.hot}
                        title={item.name}
                        context={
                          item.docs.length ? (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                              {item.docs.map((doc) =>
                                doc.thumbUrl ? (
                                  <a
                                    key={doc.id}
                                    href={doc.thumbUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: 'var(--a-accent)' }}
                                  >
                                    {doc.name}
                                  </a>
                                ) : (
                                  <span key={doc.id}>{doc.name}</span>
                                ),
                              )}
                            </span>
                          ) : (
                            <StateWord state="slow">No document attached</StateWord>
                          )
                        }
                        action={<SignOffControls itemId={item.itemId} />}
                      />
                    )
                  })}
                </ul>
              </section>
            )
          })}

          {hiddenCount > 0 ? (
            <p>
              <Link href="/admin/deals" style={{ color: 'var(--a-accent)' }}>
                See all {sortedDeals.length} deals
              </Link>
            </p>
          ) : null}
        </>
      )}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 24 }}>
        This queue holds every broker&apos;s live deals — pre-contract, active listing, and under
        contract. Oregon requires review of each document of agreement within 7 banking days (OAR
        863-015-0140). Signing off here records your name and the review date.
      </p>
    </div>
  )
}
