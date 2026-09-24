// @no-parity — internal admin tool (file workspace: terms read from the contract)
//
// What the executed agreement says, where it says it, and how that compares
// with the file (Matt 2026-09-24: "When they read the actual deal file, any
// counteroffers, addendums, and all that stuff will be automatically placed
// into the deal file"). Empty fields were already filled by the terms reader
// (lib/data/tc/deal-terms.ts); a field that differs waits here for one click.
import { Panel, StateWord } from '@/components/admin/v2'
import type { CycleTerms } from '@/lib/data/tc/deal-terms'
import type { ResolvedField } from '@/lib/tc/terms/resolve'
import type { TermColumn } from '@/lib/tc/terms/plan'
import { AcceptTermButton } from './AcceptTermButton'

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

type Row = { key: string; label: string; value: string; field: ResolvedField<unknown>; column: TermColumn | null }

const FIELD_LABEL: Record<string, string> = {
  purchasePrice: 'Price',
  earnestMoney: 'Earnest money',
  closingDate: 'Closing',
  inspectionDays: 'Inspection period',
  financingDays: 'Financing period',
  financingType: 'Financing',
  sellerConcessions: 'Seller concessions',
  escrowCompany: 'Escrow company',
  escrowNumber: 'Escrow number',
  settlementDate: 'Settlement date',
  receivedDate: 'Received',
  closingText: 'Closing',
  possession: 'Possession',
  lastSignatureDate: 'Signed',
  buyers: 'Buyers',
  kind: 'Form',
}

function rows(t: CycleTerms['terms']): Row[] {
  const out: Row[] = []
  const push = <T,>(key: string, label: string, f: ResolvedField<T> | undefined, show: (v: T) => string, column: TermColumn | null) => {
    if (f) out.push({ key, label, value: show(f.value), field: f as ResolvedField<unknown>, column })
  }
  push('price', 'Sale price', t.salePrice, money, 'sale_price')
  push('em', 'Earnest money', t.earnestMoney, money, 'earnest_money')
  push('acc', 'Accepted', t.acceptanceDate, String, 'contract_acceptance_date')
  push('close', 'Closing', t.closingDate, String, 'escrow_closing_date')
  push('insp', 'Inspection period', t.inspectionDays, (v) => `${v} business days`, 'inspection_days')
  push('fin', 'Financing period', t.financingDays, (v) => `${v} business days`, 'financing_days')
  push('type', 'Financing', t.financingType, (v) => (v === 'fha' || v === 'va' || v === 'usda' ? v.toUpperCase() : v.charAt(0).toUpperCase() + v.slice(1)), null)
  push('conc', 'Seller concessions', t.sellerConcessions, money, null)
  push('poss', 'Possession', t.possession, String, null)
  push('escco', 'Escrow company', t.escrowCompany, String, 'escrow_company')
  push('escno', 'Escrow number', t.escrowNumber, String, 'escrow_number')
  return out
}

function sourceLine(f: ResolvedField<unknown>): string {
  const s = f.source
  return [s.instrument, s.page ? `page ${s.page}` : null, s.documentName].filter(Boolean).join(' · ')
}

export function ContractTerms({ state, canEdit }: { state: CycleTerms | null; canEdit: boolean }) {
  if (!state) return null
  const { terms, plan, disagreements, unread, failed } = state
  const conflictBy = new Map(plan.conflicts.map((c) => [c.column, c]))
  const filledBy = new Set(plan.same)
  const list = rows(terms)
  const aside =
    terms.status === 'executed' ? (
      <StateWord state="ok">Executed agreement</StateWord>
    ) : terms.status === 'offer_only' ? (
      <StateWord state="waiting">Not accepted yet</StateWord>
    ) : null

  return (
    <Panel title="From the contract" aside={aside}>
      {unread || failed ? (
        <p className="av2-panel__empty" style={{ textAlign: 'left', padding: '0 0 var(--a-s2)' }}>
          {unread ? `${unread} contract document${unread === 1 ? ' is' : 's are'} still being read.` : ''}
          {unread && failed ? ' ' : ''}
          {failed ? `${failed} could not be read by both readers yet and will be tried again.` : ''}
        </p>
      ) : null}
      {list.length ? (
        <ul className="av2-feed">
          {list.map((r) => {
            const conflict = r.column ? conflictBy.get(r.column) : undefined
            return (
              <li key={r.key} className="av2-feed__row" style={{ alignItems: 'baseline' }}>
                <span className="av2-feed__when">{r.label}</span>
                <span className="av2-feed__what">{r.value}</span>
                {conflict ? (
                  <StateWord state="slow">File says {conflict.current}</StateWord>
                ) : r.column && filledBy.has(r.column) ? (
                  <StateWord state="ok">On file</StateWord>
                ) : null}
                <span className="av2-feed__more" title={r.field.source.quote ?? undefined} style={{ flexBasis: '100%', fontSize: 'var(--a-text-xs)' }}>
                  {sourceLine(r.field)}
                  {r.field.replaced.length ? ` · changed from ${r.field.replaced.map((x) => String(x.value)).join(' → ')}` : ''}
                </span>
                {conflict && canEdit ? <AcceptTermButton cycleId={state.cycleId} column={conflict.column} label={`Use ${conflict.contract}`} /> : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="av2-panel__empty">
          {terms.status === 'none' && terms.notes.length ? terms.notes[0] : unread ? 'The terms appear here once the contract is read.' : 'No executed sale agreement is on this cycle yet.'}
        </p>
      )}
      {terms.notes.length && list.length ? (
        <p style={{ margin: 'var(--a-s2) 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{terms.notes.join(' ')}</p>
      ) : null}
      {disagreements.length ? (
        <div style={{ marginTop: 'var(--a-s3)' }}>
          <p style={{ margin: '0 0 var(--a-s1)', fontSize: 'var(--a-text-sm)', fontWeight: 600 }}>Read differently by the two readers, so not used</p>
          <ul className="av2-feed">
            {disagreements.slice(0, 8).map((d, i) => (
              <li key={`${d.documentId}-${d.field}-${i}`} className="av2-feed__row">
                <span className="av2-feed__when">{FIELD_LABEL[d.field] ?? d.field}</span>
                <span className="av2-feed__what">
                  {String(d.first ?? 'nothing')} / {String(d.second ?? 'nothing')}
                </span>
                <span className="av2-feed__more" style={{ fontSize: 'var(--a-text-xs)' }}>
                  {[d.title, d.page ? `page ${d.page}` : null, d.documentName].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  )
}
