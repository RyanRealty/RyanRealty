// @no-parity — internal admin surface, no public mockup contract
//
// /admin/cmas — THE CMA queue. Every origin, one list.
// Review is the numbers on the row plus one action. Filters are compact
// selects (address, city, origin, date, recommended price).
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listCmaQueue, type CmaQueueRow, type CmaQueueState } from '@/lib/data'
import { CMA_ORIGIN_LABEL, type CmaOrigin } from '@/lib/cma/origin'
import { approveAndDeliverCma } from '@/app/actions/cma-queue'
import { QueueRow, SectionHead, VerdictLine } from '@/components/admin/v2'
import { QueueAction } from '@/app/admin/(protected)/cmas/_components/queue/QueueAction.client'
import { QueueFilters } from '@/app/admin/(protected)/cmas/_components/queue/QueueFilters.client'
import type { AdminState } from '@/components/admin/v2'
import {
  cmaQueueMoneyLine,
  filterCmaQueueRows,
  sortCmaQueueRows,
  type CmaCreatedWindow,
  type CmaQueueSort,
  type CmaQueueViewFilters,
  type CmaQueueViewRow,
  type CmaQueueViewState,
  type CmaRecBand,
} from '@/lib/cma/queue-view'

export const dynamic = 'force-dynamic'

const WINDOW = 500

const STATE_LABEL: Record<CmaQueueState, string> = {
  ready: 'Ready',
  unvetted: 'Unvetted',
  flagged: 'Flagged',
  'audit-failed': 'Audit failed',
  failed: 'Build failed',
  building: 'Building',
  queued: 'In drip',
  sent: 'Sent',
  archived: 'Archived',
}

const STATE_TONE: Record<CmaQueueState, AdminState> = {
  ready: 'ok',
  unvetted: 'waiting',
  flagged: 'waiting',
  'audit-failed': 'down',
  failed: 'down',
  building: 'waiting',
  queued: 'accent',
  sent: 'ok',
  archived: 'waiting',
}

const ORIGIN_ORDER: CmaOrigin[] = [
  'expired',
  'fsbo',
  'seller-valuation',
  'lead-form',
  'broker',
  'internal',
  'unknown',
]

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const t = s?.trim()
  return t || undefined
}

function age(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return ''
  if (days === 0) return 'today'
  if (days < 31) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

function whyLine(r: CmaQueueRow): string | null {
  if (r.state === 'audit-failed') {
    const n = r.auditCriticalCount
    const head = n > 0 ? `Audit failed. ${n} critical` : 'Audit failed'
    return r.auditSummary ? `${head}. ${r.auditSummary.slice(0, 140)}` : head
  }
  if (r.state === 'unvetted') return 'Audit did not run. Nothing has checked this one.'
  if (r.state === 'failed') return r.buildError ? `Build failed: ${r.buildError.slice(0, 140)}` : 'Build failed.'
  if (r.state === 'flagged') return r.reviewReason ? r.reviewReason.slice(0, 140) : 'Flagged for review.'
  if (r.state === 'queued') return 'Approved. Waiting its turn in the weekday drip.'
  return null
}

function actionLabelFor(r: CmaQueueRow): string | null {
  if (r.state !== 'ready') return null
  if (!r.contactEmail) return null
  if (r.sendMode === 'now') return 'Approve & send'
  if (r.sendMode === 'drip') return 'Approve & queue'
  return 'Approve'
}

function asView(r: CmaQueueRow): CmaQueueViewRow {
  return {
    id: r.id,
    address: r.address,
    city: r.city,
    origin: r.origin,
    state: r.state,
    recommendedList: r.recommendedList,
    valueLow: r.valueLow,
    valueHigh: r.valueHigh,
    theirPrice: r.theirPrice,
    theirPriceLabel: r.theirPriceLabel,
    theirPriceDelta: r.theirPriceDelta,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    createdAt: r.createdAt,
  }
}

export default async function CmaQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')
  const sp = await searchParams
  const filters: CmaQueueViewFilters = {
    q: str(sp.q),
    city: str(sp.city),
    origin: str(sp.origin) as CmaOrigin | 'all' | undefined,
    state: (str(sp.state) as CmaQueueViewState | 'all' | 'work' | undefined) ?? 'work',
    created: str(sp.created) as CmaCreatedWindow | undefined,
    rec: str(sp.rec) as CmaRecBand | undefined,
    sort: str(sp.sort) as CmaQueueSort | undefined,
  }

  const { rows, total } = await listCmaQueue({ limit: WINDOW })

  const counts = {
    ready: rows.filter((r) => r.state === 'ready').length,
    auditFailed: rows.filter((r) => r.state === 'audit-failed').length,
    unvetted: rows.filter((r) => r.state === 'unvetted').length,
    queued: rows.filter((r) => r.state === 'queued').length,
    sent: rows.filter((r) => r.state === 'sent').length,
  }
  const stateCounts = new Map<CmaQueueState, number>()
  for (const r of rows) stateCounts.set(r.state, (stateCounts.get(r.state) ?? 0) + 1)
  const originCounts = new Map<CmaOrigin, number>()
  for (const r of rows) originCounts.set(r.origin, (originCounts.get(r.origin) ?? 0) + 1)
  const cities = [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b),
  )

  const byId = new Map(rows.map((r) => [r.id, r]))
  const visible = sortCmaQueueRows(filterCmaQueueRows(rows.map(asView), filters), filters.sort)
    .map((v) => byId.get(v.id))
    .filter((r): r is CmaQueueRow => !!r)

  return (
    <>
      <VerdictLine tone={counts.auditFailed > counts.ready ? 'attention' : 'ok'}>
        {counts.ready} ready to send, {counts.sent} sent, {counts.auditFailed} failed audit, {counts.unvetted}{' '}
        unvetted
        {counts.queued > 0 ? `, ${counts.queued} in the drip` : ''}. {total} CMAs.
      </VerdictLine>

      <QueueFilters
        filters={filters}
        cities={cities}
        stateOptions={(Object.keys(STATE_LABEL) as CmaQueueState[])
          .filter((s) => (stateCounts.get(s) ?? 0) > 0)
          .map((s) => ({ value: s, label: STATE_LABEL[s], count: stateCounts.get(s) }))}
        originOptions={ORIGIN_ORDER.filter((o) => (originCounts.get(o) ?? 0) > 0).map((o) => ({
          value: o,
          label: CMA_ORIGIN_LABEL[o],
          count: originCounts.get(o),
        }))}
      />

      <SectionHead>
        {visible.length} shown
        {' · '}
        <Link className="av2-btn av2-btn--quiet av2-btn--touch" href="/admin/cmas/new">
          Build CMA
        </Link>
      </SectionHead>

      <ul className="av2-queue">
        {visible.map((r) => {
          const label = actionLabelFor(r)
          const why = whyLine(r)
          const who = r.contactName ?? r.contactEmail ?? 'no contact on file'
          return (
            <QueueRow
              key={r.id}
              kind={CMA_ORIGIN_LABEL[r.origin]}
              kindTone={STATE_TONE[r.state]}
              title={
                <Link href={`/admin/cmas/${r.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {r.address || r.slug}
                </Link>
              }
              context={
                <>
                  <span>{cmaQueueMoneyLine(r)}</span>
                  {r.city ? (
                    <>
                      {' · '}
                      <span>{r.city}</span>
                    </>
                  ) : null}
                  {' · '}
                  <span>{who}</span>
                  {!r.contactEmail ? ' · no email' : ''}
                  {why ? (
                    <>
                      <br />
                      <span>{why}</span>
                    </>
                  ) : null}
                </>
              }
              age={age(r.createdAt)}
              hot={r.state === 'audit-failed' || r.state === 'failed'}
              action={
                label ? (
                  <QueueAction slug={r.slug} label={label} approve={approveAndDeliverCma} />
                ) : (
                  <Link className="av2-btn av2-btn--quiet av2-btn--touch" href={`/admin/cmas/${r.slug}`}>
                    Review
                  </Link>
                )
              }
            />
          )
        })}
      </ul>

      {visible.length === 0 ? <p>Nothing matches that filter.</p> : null}
    </>
  )
}
