// @no-parity — internal admin tool (file workspace: Documents tab)
// The Oregon-law required-document predictor, moved verbatim out of
// ../page.tsx when the file became tabs (Matt 2026-09-24).
import { SectionHead, StateWord } from '@/components/admin/v2'
import type { AnticipatedDocsResult } from '@/app/actions/tc-required-docs'
import { AddMissingChecklist } from '../AddMissingChecklist'
import { DealPropertyFacts } from '../DealPropertyFacts'
import { ROLE_LABEL } from '../_columns'

const tiny = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' } as const
/** Missing documents first; the rest collapse to a count (curate, never dump). */
const SHOWN = 12

/** Anticipated-documents view — the Oregon-law required-doc predictor. */
export function AnticipatedDocs({
  data,
  cycleId,
}: {
  data: AnticipatedDocsResult | null
  cycleId: string
}) {
  if (!data) return null
  const missing = data.documents.filter((d) => !d.present)
  return (
    <section aria-label="Documents anticipated">
      <SectionHead>Documents anticipated · {ROLE_LABEL[data.role] ?? data.role}</SectionHead>
      <p style={{ ...tiny, margin: '0 0 8px', fontVariantNumeric: 'tabular-nums' }}>
        {data.documents.filter((d) => d.present).length}/{data.documents.length} present
        {data.missingRequired > 0 ? ` · ${data.missingRequired} required missing` : ''}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {[...missing, ...data.documents.filter((d) => d.present)].slice(0, SHOWN).map((d) => (
          <li
            key={d.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: 8,
              padding: '6px 2px',
              borderBottom: '1px solid var(--a-border)',
              fontSize: 'var(--a-text-sm)',
            }}
          >
            <StateWord state={d.present ? 'ok' : d.severity === 'required' ? 'down' : 'slow'}>
              {d.present ? 'On file' : d.severity === 'required' ? 'Required' : 'Expected'}
            </StateWord>
            <span
              style={{
                color: d.present ? 'var(--a-text-2)' : 'var(--a-text)',
                textDecoration: d.present ? 'line-through' : undefined,
              }}
            >
              {d.label}
            </span>
            {d.orefForm ? <span style={tiny}>OREF {d.orefForm}</span> : null}
            <span style={tiny} title={d.citation}>
              {d.severity === 'verify' ? '⚑ verify · ' : ''}
              {d.citation}
            </span>
          </li>
        ))}
      </ul>
      {data.documents.length > SHOWN ? (
        <p style={{ ...tiny, margin: '6px 0 0' }}>{data.documents.length - SHOWN} more already on file</p>
      ) : null}
      {missing.length > 0 ? (
        <div style={{ margin: '8px 0 0', display: 'grid', gap: 8 }}>
          <p style={{ ...tiny, margin: 0 }}>
            {missing.length} not yet on file.{' '}
            {data.unknown.length > 0
              ? `Confirm the facts below to add well, septic, HOA, lead, and the rest.`
              : ''}
          </p>
          <AddMissingChecklist cycleId={cycleId} missingCount={missing.length} />
        </div>
      ) : null}
      <DealPropertyFacts cycleId={cycleId} facts={data.facts} />
    </section>
  )
}

