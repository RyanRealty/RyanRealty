// @no-parity — internal admin surface, no public mockup contract.
/**
 * The four lanes as one funnel: built → ready → sent → opened → clicked →
 * visited → replied.
 *
 * A table plus one bar per stage, no chart library. The bar is scaled to the
 * lane's own BUILT count so the shape reads as attrition down the lane rather
 * than as a comparison between lanes of different sizes — a 2-of-2 FSBO lane
 * must not draw a taller bar than a 40-of-400 expired lane.
 *
 * §0: a rate over zero sends is rendered as an em dash, never as 0%. "Nobody
 * has tried this lane" and "this lane fails" are opposite instructions to a
 * broker, and a 0% would be the wrong one.
 *
 * Server component. The page passes an already-read funnel; nothing here
 * computes a figure.
 */
import { ReportGrid, type ReportGridRow } from '@/components/admin/v2'
import type { CmaLaneFunnel as CmaLaneFunnelData, CmaLaneFunnelRow } from '@/lib/data/cma/outcomes'

const STAGES = [
  { key: 'built', label: 'Built' },
  { key: 'ready', label: 'Ready' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'visited', label: 'Visited' },
  { key: 'replied', label: 'Replied' },
] as const

type StageKey = (typeof STAGES)[number]['key']

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`
}

/** One stage's figure with its share of the lane drawn under it. */
function StageCell({ value, of }: { value: number; of: number }) {
  const width = of > 0 ? Math.max(0, Math.min(100, (value / of) * 100)) : 0
  return (
    <span style={{ display: 'inline-block', minWidth: 44 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          height: 3,
          marginTop: 3,
          borderRadius: 'var(--a-r-sm)',
          background: 'var(--a-inset)',
        }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${width}%`,
            borderRadius: 'var(--a-r-sm)',
            background: value > 0 ? 'var(--a-accent)' : 'transparent',
          }}
        />
      </span>
    </span>
  )
}

function rowFor(lane: CmaLaneFunnelRow, isTotal: boolean): ReportGridRow {
  const exceptions = lane.bounced + lane.unsubscribed
  return {
    key: isTotal ? 'total' : lane.origin,
    total: isTotal,
    cells: [
      <span key="lane" style={{ fontWeight: isTotal ? 600 : 400 }}>
        {lane.label}
      </span>,
      ...STAGES.map((s) => (
        <StageCell key={s.key} value={lane[s.key as StageKey]} of={lane.built} />
      )),
      <span key="open-rate" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {pct(lane.openRate)}
      </span>,
      <span key="reply-rate" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {pct(lane.replyRate)}
      </span>,
      <span
        key="exceptions"
        style={{
          fontVariantNumeric: 'tabular-nums',
          // The one exception accent: a bounce or an unsubscribe. Zero is not
          // an exception, so it stays ordinary.
          color: exceptions > 0 ? 'var(--a-danger)' : 'var(--a-text-2)',
        }}
      >
        {exceptions}
      </span>,
    ],
  }
}

export function CmaLaneFunnel({ funnel }: { funnel: CmaLaneFunnelData }) {
  const rows: ReportGridRow[] = funnel.lanes.map((l) => rowFor(l, false))
  if (funnel.lanes.length > 1) rows.push(rowFor(funnel.totals, true))

  return (
    <ReportGrid
      label="CMA funnel by lane"
      minWidth={880}
      template="minmax(120px, 1.4fr) repeat(7, minmax(56px, 0.8fr)) repeat(3, minmax(64px, 0.7fr))"
      columns={[
        { key: 'lane', label: 'Lane' },
        ...STAGES.map((s) => ({ key: s.key, label: s.label, numeric: true })),
        { key: 'open-rate', label: 'Open', numeric: true },
        { key: 'reply-rate', label: 'Reply', numeric: true },
        { key: 'exceptions', label: 'Bad', numeric: true },
      ]}
      rows={rows}
      empty="No documents yet. Build one from a prospect row or from New CMA."
    />
  )
}

export default CmaLaneFunnel
