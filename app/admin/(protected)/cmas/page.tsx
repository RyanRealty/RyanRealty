// @no-parity — internal admin surface, no public mockup contract
//
// /admin/cmas — THE CMA queue. Every origin, one list (Matt 2026-09-04).
//
// What this replaced: approving a CMA meant knowing which of four screens owned
// it. /admin/cmas filtered doc_type='cma' and deliberately excluded expired
// audits; /admin/prospecting owned expired + FSBO behind a different detail
// page with a different set of buttons; /admin/valuations held inbound
// requests; /cma-drafts was a dead prototype. Same build engine underneath the
// whole time (buildCma → selectComps) — only the surfaces were split, which is
// why the same job felt like four jobs.
//
// The row carries what its origin makes relevant, so the list answers the
// question without a click: an expired row shows the price they last listed at
// against ours and the gap between them; an FSBO row shows what they are asking
// today; a requested row shows who asked and when. One action per row, and its
// label says what it will do — "Approve & send" goes now, "Approve & queue"
// joins the weekday cold drip.
//
// The audit is the load-bearing signal, not a footnote. It failed 210 of 418
// live rows on 2026-09-04 for real defects, so `audit-failed` gets its own
// state, its own filter, and no action at all — approveAndDeliverCma refuses
// it server-side too (§0: a failed audit means the numbers or the narrative do
// not hold up, and it is not going to a homeowner from here).
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listCmaQueue, type CmaQueueRow, type CmaQueueState } from '@/lib/data'
import { CMA_ORIGIN_LABEL, type CmaOrigin } from '@/lib/cma/origin'
import { approveAndDeliverCma } from '@/app/actions/cma-queue'
import { QueueRow, SectionHead, VerdictLine } from '@/components/admin/v2'
import { QueueAction } from '@/app/admin/(protected)/cmas/_components/queue/QueueAction.client'
import { QueueFilters } from '@/app/admin/(protected)/cmas/_components/queue/QueueFilters.client'
import type { AdminState } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const WINDOW = 500


/** Work-first order: what needs a person, then what is already moving. */
const STATE_ORDER: CmaQueueState[] = [
  'ready',
  'unvetted',
  'flagged',
  'audit-failed',
  'failed',
  'building',
  'queued',
  'sent',
]

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

function usd(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${Math.round(n / 1000)}k`
}

function pct(d: number | null): string | null {
  if (d == null) return null
  const p = Math.round(d * 100)
  if (p === 0) return 'same'
  return `${p > 0 ? '+' : ''}${p}%`
}

function age(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return ''
  if (days === 0) return 'today'
  if (days < 31) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

/**
 * The money line — the reason this page exists. For an expired or FSBO row it
 * is the comparison Matt asked for: what they had it at against what we say,
 * and the gap. For a requested valuation there is no asking price, so it shows
 * our range instead of a fake comparison.
 */
function moneyLine(r: CmaQueueRow): string {
  const ours = usd(r.recommendedList)
  if (r.theirPrice != null && r.theirPriceLabel) {
    const delta = pct(r.theirPriceDelta)
    return `${r.theirPriceLabel} ${usd(r.theirPrice)} → ours ${ours}${delta ? ` (${delta})` : ''}`
  }
  if (r.valueLow != null && r.valueHigh != null) {
    return `Our range ${usd(r.valueLow)}–${usd(r.valueHigh)} · rec ${ours}`
  }
  return `Our rec ${ours}`
}

/** One line of why, when the state is something other than plain ready. */
function whyLine(r: CmaQueueRow): string | null {
  if (r.state === 'audit-failed') {
    const n = r.auditCriticalCount
    const head = n > 0 ? `Audit failed — ${n} critical` : 'Audit failed'
    return r.auditSummary ? `${head}. ${r.auditSummary.slice(0, 140)}` : head
  }
  if (r.state === 'unvetted') return 'Audit did not run — nothing has checked this one.'
  if (r.state === 'failed') return r.buildError ? `Build failed: ${r.buildError.slice(0, 140)}` : 'Build failed.'
  if (r.state === 'flagged') return r.reviewReason ? r.reviewReason.slice(0, 140) : 'Flagged for review.'
  if (r.state === 'queued') return 'Approved — waiting its turn in the weekday drip.'
  return null
}

/** The row's one action, or null when there is nothing a click should do. */
function actionLabelFor(r: CmaQueueRow): string | null {
  if (r.state !== 'ready') return null
  if (!r.contactEmail) return null
  if (r.sendMode === 'now') return 'Approve & send'
  if (r.sendMode === 'drip') return 'Approve & queue'
  return 'Approve'
}

export default async function CmaQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')
  const sp = await searchParams
  const stateFilter = str(sp.state) as CmaQueueState | 'all' | undefined
  const originFilter = str(sp.origin) as CmaOrigin | 'all' | undefined

  const { rows, total } = await listCmaQueue({ limit: WINDOW })

  const counts = {
    ready: rows.filter((r) => r.state === 'ready').length,
    auditFailed: rows.filter((r) => r.state === 'audit-failed').length,
    unvetted: rows.filter((r) => r.state === 'unvetted').length,
    queued: rows.filter((r) => r.state === 'queued').length,
  }
  const stateCounts = new Map<CmaQueueState, number>()
  for (const r of rows) stateCounts.set(r.state, (stateCounts.get(r.state) ?? 0) + 1)
  const originCounts = new Map<CmaOrigin, number>()
  for (const r of rows) originCounts.set(r.origin, (originCounts.get(r.origin) ?? 0) + 1)

  let visible = rows
  if (stateFilter && stateFilter !== 'all') visible = visible.filter((r) => r.state === stateFilter)
  if (originFilter && originFilter !== 'all') visible = visible.filter((r) => r.origin === originFilter)

  // Work-first: readiness decides the order, recency breaks ties.
  visible = [...visible].sort((a, b) => {
    const ai = STATE_ORDER.indexOf(a.state)
    const bi = STATE_ORDER.indexOf(b.state)
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })


  return (
    <>
      <VerdictLine tone={counts.auditFailed > counts.ready ? 'attention' : 'ok'}>
        {counts.ready} ready to send, {counts.auditFailed} failed audit, {counts.unvetted} unvetted
        {counts.queued > 0 ? `, ${counts.queued} in the drip` : ''} — {total} CMAs in one queue.
      </VerdictLine>

      <QueueFilters
        param="state"
        basePath="/admin/cmas"
        allLabel={`All ${rows.length}`}
        active={stateFilter}
        otherParams={{ origin: originFilter && originFilter !== 'all' ? originFilter : undefined }}
        options={STATE_ORDER.filter((s) => (stateCounts.get(s) ?? 0) > 0).map((s) => ({
          value: s,
          label: STATE_LABEL[s],
          count: stateCounts.get(s),
        }))}
      />

      <QueueFilters
        param="origin"
        basePath="/admin/cmas"
        allLabel="Every origin"
        active={originFilter}
        otherParams={{ state: stateFilter && stateFilter !== 'all' ? stateFilter : undefined }}
        options={ORIGIN_ORDER.filter((o) => (originCounts.get(o) ?? 0) > 0).map((o) => ({
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
                <a href={`/admin/cmas/${r.slug}/view`} target="_blank" rel="noreferrer">
                  {r.address || r.slug}
                </a>
              }
              context={
                <>
                  <span>{moneyLine(r)}</span>
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
                    Open
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
