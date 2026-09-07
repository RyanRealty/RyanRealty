// @no-parity — internal admin surface, no public mockup contract
//
// /admin/cmas — THE CMA queue. Every origin, one list.
// Review is the numbers on the row plus one action. Filters are compact
// selects (address, city, origin, date, recommended price).
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listCmaQueue, type CmaQueueRow, type CmaQueueState } from '@/lib/data'
import { CMA_ORIGIN_LABEL, type CmaOrigin } from '@/lib/cma/origin'
import { approveAndDeliverCma, setCmaLaneAutoSendAction } from '@/app/actions/cma-queue'
import { getLaneSettings, AUTO_SEND_LANES } from '@/lib/data/cma/lane-settings'
import { isColdOrigin } from '@/lib/cma/origin'
import { hasCapability } from '@/lib/admin/capabilities'
import { LaneAutoSendSwitch } from '@/app/admin/(protected)/cmas/_components/queue/LaneAutoSendSwitch.client'
import { QueueRow, SectionHead, VerdictLine } from '@/components/admin/v2'
import { QueueAction } from '@/app/admin/(protected)/cmas/_components/queue/QueueAction.client'
import { DripQueueActions } from '@/app/admin/(protected)/cmas/_components/queue/DripQueueActions.client'
import { dripEtaFor, DRIP_CADENCE_LINE } from '@/lib/cma/drip-eta'
import { QueueFilters } from '@/app/admin/(protected)/cmas/_components/queue/QueueFilters.client'
import type { AdminState } from '@/components/admin/v2'
import {
  CMA_QUEUE_DEFAULT_STATE,
  cmaQueueHref,
  cmaQueueMoneyLine,
  cmaQueueWhoLine,
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
  ready: 'waiting',
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
  'bpo',
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
  if (r.state === 'queued') return null // filled with ETA at render
  return null
}

function actionLabelFor(r: CmaQueueRow): string | null {
  // A BPO is finalized and sent from /admin/bpo/[slug], which is the only path
  // that can resolve its recipient (a linked CRM person). Offering an approve
  // button here would be a button that cannot do its job.
  if (r.docKind !== 'cma') return null
  if (r.state !== 'ready') return null
  if (!r.contactEmail) return null
  if (r.sendMode === 'now') return 'Send now'
  if (r.sendMode === 'drip') return 'Schedule'
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

/**
 * The lane strip: one card per lane, its work in numbers, and the Auto-send
 * switch that decides whether that lane still needs a per-document tap.
 *
 * Every lane renders whether or not it has documents today — the control has to
 * be findable before the first one arrives. `internal` and `unknown` have no
 * card: both classify to sendMode 'manual', so a switch there would be a
 * control with nothing behind it.
 */
function LaneStrip({
  rows,
  settings,
  canFlip,
}: {
  rows: CmaQueueRow[]
  settings: Awaited<ReturnType<typeof getLaneSettings>>
  canFlip: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(228px, 1fr))',
        gap: 8,
        margin: '0 0 12px',
      }}
    >
      {AUTO_SEND_LANES.map((lane) => {
        const mine = rows.filter((r) => r.origin === lane)
        const n = (s: CmaQueueState) => mine.filter((r) => r.state === s).length
        const setting = settings[lane]
        const cold = isColdOrigin(lane)
        // A BPO is the brokerage's own opinion of value, read by a broker, and
        // its send path needs a linked CRM person. The switch exists in the
        // vocabulary and has nothing behind it — say so rather than arm it.
        const disabledReason = lane === 'bpo' ? 'Sent from the BPO page' : null
        return (
          <div
            key={lane}
            style={{
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-md)',
              background: 'var(--a-surface)',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minWidth: 0,
            }}
          >
            <Link
              href={cmaQueueHref({ origin: lane, state: 'all' })}
              style={{ color: 'var(--a-text)', textDecoration: 'none', fontWeight: 600 }}
            >
              {CMA_ORIGIN_LABEL[lane]}{' '}
              <span style={{ color: 'var(--a-text-2)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
                {mine.length}
              </span>
            </Link>
            <span
              style={{
                color: 'var(--a-text-2)',
                fontSize: 'var(--a-text-xs)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n('ready')} ready · {n('flagged')} flagged · {n('failed')} failed · {n('queued')} in drip ·{' '}
              {n('sent')} sent
            </span>
            {canFlip ? (
              <LaneAutoSendSwitch
                lane={lane}
                laneLabel={CMA_ORIGIN_LABEL[lane]}
                on={setting.autoSend}
                cold={cold}
                disabledReason={disabledReason}
                setAutoSend={setCmaLaneAutoSendAction}
              />
            ) : (
              <span style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-xs)' }}>
                Auto-send {setting.autoSend ? 'on' : 'off'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default async function CmaQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const admin = await requireAdminPage('prospecting.view')
  const sp = await searchParams
  const filters: CmaQueueViewFilters = {
    q: str(sp.q),
    city: str(sp.city),
    origin: str(sp.origin) as CmaOrigin | 'all' | undefined,
    state: (str(sp.state) as CmaQueueViewState | 'all' | 'work' | undefined) ?? CMA_QUEUE_DEFAULT_STATE,
    created: str(sp.created) as CmaCreatedWindow | undefined,
    rec: str(sp.rec) as CmaRecBand | undefined,
    sort: str(sp.sort) as CmaQueueSort | undefined,
  }

  const [{ rows, total }, laneSettings] = await Promise.all([
    listCmaQueue({ limit: WINDOW }),
    getLaneSettings(),
  ])

  const { listQueuedFirstTouch, getLastDripSentAt } = await import('@/lib/data/prospecting/drip-queue')
  const [dripQueued, lastDripSentAt] = await Promise.all([
    listQueuedFirstTouch(500),
    getLastDripSentAt(),
  ])
  const now = new Date()
  const dripEtaByKey = new Map<string, string>()
  for (const item of dripQueued) {
    const eta = dripEtaFor({
      queued: dripQueued,
      lastDripSentAt,
      now,
      target: { kind: item.kind, id: item.id },
    })
    if (eta) dripEtaByKey.set(`${item.kind}:${item.id}`, eta.label)
  }

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

  const door = (href: string, label: string) => (
    <Link href={href} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
      {label}
    </Link>
  )

  return (
    <div style={{ paddingBottom: 88 }}>
      <VerdictLine tone={counts.auditFailed > counts.ready ? 'attention' : 'ok'}>
        {door(cmaQueueHref({ state: 'ready' }), String(counts.ready))} Ready ·{' '}
        {door(cmaQueueHref({ state: 'queued' }), String(counts.queued))} In drip ·{' '}
        {door(cmaQueueHref({ state: 'sent' }), String(counts.sent))} sent ·{' '}
        {door(cmaQueueHref({ state: 'audit-failed' }), String(counts.auditFailed))} failed audit ·{' '}
        {door(cmaQueueHref({ state: 'unvetted' }), String(counts.unvetted))} unvetted ·{' '}
        {door(cmaQueueHref({ state: 'all' }), String(total))} CMAs.
        {' · '}
        <Link href="/admin/prospecting" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Prospecting
        </Link>
      </VerdictLine>

      <LaneStrip
        rows={rows}
        settings={laneSettings}
        canFlip={hasCapability(admin, 'settings.compliance')}
      />

      <QueueFilters
        filters={filters}
        cities={cities}
        stateOptions={(Object.keys(STATE_LABEL) as CmaQueueState[])
          .filter((s) => s === 'ready' || s === 'queued' || (stateCounts.get(s) ?? 0) > 0)
          .map((s) => ({ value: s, label: STATE_LABEL[s], count: stateCounts.get(s) ?? 0 }))}
        originOptions={ORIGIN_ORDER.filter((o) => (originCounts.get(o) ?? 0) > 0).map((o) => ({
          value: o,
          label: CMA_ORIGIN_LABEL[o],
          count: originCounts.get(o),
        }))}
      />

      <SectionHead>
        {visible.length} shown
        {' · '}
        {door(cmaQueueHref({ state: 'ready' }), 'Ready')}
        {' · '}
        {door(cmaQueueHref({ state: 'queued' }), 'In drip')}
        {' · '}
        <Link className="av2-btn av2-btn--quiet av2-btn--touch" href="/admin/prospecting">
          Prospecting
        </Link>
        {' · '}
        <Link className="av2-btn av2-btn--quiet av2-btn--touch" href="/admin/cmas/new">
          Build CMA
        </Link>
      </SectionHead>

      <ul className="av2-queue">
        {visible.map((r) => {
          const label = actionLabelFor(r)
          let why = whyLine(r)
          if (r.state === 'queued' && r.prospectKind && r.prospectId) {
            const etaLabel = dripEtaByKey.get(`${r.prospectKind}:${r.prospectId}`)
            why = etaLabel
              ? `${etaLabel} · ${DRIP_CADENCE_LINE}`
              : `In drip · ${DRIP_CADENCE_LINE}`
          } else if (r.state === 'queued') {
            why = `In drip · ${DRIP_CADENCE_LINE}`
          }
          const money = cmaQueueMoneyLine(r)
          const recBit = money.split(' · ')[0]
          const restBit = money.split(' · ').slice(1).join(' · ')
          return (
            <QueueRow
              key={r.id}
              kind={r.state === 'queued' ? STATE_LABEL.queued : CMA_ORIGIN_LABEL[r.origin]}
              kindTone={STATE_TONE[r.state]}
              title={
                <Link href={r.detailHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {r.address || r.slug}
                </Link>
              }
              context={
                <>
                  <span>
                    <span style={{ color: 'var(--a-text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {recBit}
                    </span>
                    {restBit ? ` · ${restBit}` : ''}
                  </span>
                  {' · '}
                  <span>{cmaQueueWhoLine(r)}</span>
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
                r.state === 'queued' ? (
                  <DripQueueActions slug={r.slug} />
                ) : label ? (
                  <QueueAction slug={r.slug} label={label} approve={approveAndDeliverCma} />
                ) : (
                  <Link className="av2-btn av2-btn--quiet av2-btn--touch" href={r.detailHref}>
                    Review
                  </Link>
                )
              }
            />
          )
        })}
      </ul>

      {visible.length === 0 ? <p>Nothing matches that filter.</p> : null}
    </div>
  )
}
