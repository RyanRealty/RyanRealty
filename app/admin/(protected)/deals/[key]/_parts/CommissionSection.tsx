// @no-parity — internal admin tool (file workspace: Money tab)
// Moved verbatim out of ../page.tsx when the file became tabs (Matt 2026-09-24).
import { SectionHead, StateWord } from '@/components/admin/v2'
import type { TcCommission } from '@/app/actions/tc-commissions'
import { CommissionEdit } from '../CommissionControls'
import { CdaButton } from '../CdaButton'
import { COMMISSION_STATUS, SIDE_LABEL } from '../_columns'

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—')
const tiny = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' } as const

/** Commission block per sale cycle (rung 11). Every figure expression here is
 *  carried from the pre-11D markup character for character. */
export function CommissionSection({
  rows,
  cycleId,
  propertyKey,
}: {
  rows: TcCommission[]
  cycleId: string
  propertyKey: string
}) {
  if (!rows.length) {
    return (
      <section aria-label="Commission">
        <SectionHead>
          Commission{' '}
          <CdaButton cycleId={cycleId} propertyKey={propertyKey} />
        </SectionHead>
        <p style={{ ...tiny, margin: 0 }}>No commission rows yet. Generate CDA still prints the file facts.</p>
      </section>
    )
  }
  return (
    <section aria-label="Commission">
      <SectionHead>
        Commission{' '}
        <CdaButton cycleId={cycleId} propertyKey={propertyKey} />
      </SectionHead>
      {rows.map((r) => {
        const st = COMMISSION_STATUS[r.status] ?? COMMISSION_STATUS.projected
        const fees = r.referral_fee + r.tc_fee + r.other_deductions
        return (
          <div
            key={r.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 2px',
              borderBottom: '1px solid var(--a-border)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--a-text-md)' }}>
                {r.broker_name}
                <span style={{ ...tiny, marginLeft: 8 }}>{SIDE_LABEL[r.side]}</span>
                {r.commission_percent != null ? (
                  <span style={{ ...tiny, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>
                    {Number(r.commission_percent.toFixed(2))}%
                  </span>
                ) : null}
              </p>
              <p style={{ ...tiny, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                Gross {money(r.gci)}
                {fees > 0 ? <> · fees {money(fees)}</> : null}
                {' · '}agent {money(r.agent_net)} ({Number(r.split_percent)}%)
                {' · '}brokerage {money(r.brokerage_net)}
                {r.paid_at ? <> · paid {d10(r.paid_at)}</> : null}
              </p>
              {r.notes ? <p style={{ ...tiny, margin: '2px 0 0' }}>{r.notes}</p> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StateWord state={st.state}>{st.label}</StateWord>
              <CommissionEdit row={r} />
            </div>
          </div>
        )
      })}
    </section>
  )
}

