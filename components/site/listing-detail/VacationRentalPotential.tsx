import { TabularNumber, Price } from '@/components/site/primitives'
import { cn } from '@/lib/utils'

/**
 * VacationRentalPotential — KB section style.
 * Navy sec-head, Amboqia heading, KPI cells in cream/navy palette.
 *
 * Per CLAUDE.md §0 Data Accuracy: no number unless caller passes one.
 */

export type VacationRentalProjection = {
  peakNightly: number
  offPeakNightly: number
  occupancyRate: number
  annualGross: number
  compCount: number
  source?: string
}

type Props = {
  projection: VacationRentalProjection | null
  className?: string
}

export function VacationRentalPotential({ projection, className }: Props) {
  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Investment</div>
          <h2 className="sec-title display">Vacation rental</h2>
        </div>
      </div>

      <div style={{ marginTop: 'clamp(22px,3vw,36px)' }}>
        {projection ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '3px',
                background: 'rgba(16,39,66,0.12)',
                border: '1px solid rgba(16,39,66,0.12)',
              }}
            >
              <VacKpiCell label="Peak nightly" sub="July to August">
                <Price value={projection.peakNightly} />
              </VacKpiCell>
              <VacKpiCell label="Off-peak nightly" sub="Shoulder months">
                <Price value={projection.offPeakNightly} />
              </VacKpiCell>
              <VacKpiCell label="Occupancy" sub="Annual average">
                <TabularNumber value={Math.round(projection.occupancyRate * 100)} />%
              </VacKpiCell>
              <VacKpiCell label="Annual gross" sub={`Based on ${projection.compCount} comps`}>
                <Price value={projection.annualGross} />
              </VacKpiCell>
            </div>
            {projection.source ? (
              <div
                className="eyebrow"
                style={{ marginTop: 12, color: 'rgba(16,39,66,0.45)', fontSize: '0.6rem', letterSpacing: '0.14em' }}
              >
                Source: {projection.source}
              </div>
            ) : null}
          </>
        ) : (
          <div
            style={{
              border: '3px solid var(--navy, #102742)',
              padding: '22px 24px',
              background: 'var(--cream, #faf8f4)',
            }}
          >
            <p
              style={{
                fontSize: 'clamp(0.92rem,1.6vw,1rem)',
                lineHeight: 1.6,
                color: 'rgba(16,39,66,0.75)',
                maxWidth: '60ch',
                marginBottom: 18,
              }}
            >
              We compute vacation rental projections from comparable short-term rentals in the same community, weighted by bed count, view, and amenities. A custom projection for this property is on request.
            </p>
            <a
              href="/contact?intent=vacation-rental-projection"
              className="btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              Get the rental projection <span aria-hidden>→</span>
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

function VacKpiCell({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--cream, #faf8f4)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        className="eyebrow"
        style={{ color: 'rgba(16,39,66,0.55)', fontSize: '0.62rem', letterSpacing: '0.18em' }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-amboqia, serif)',
          fontSize: 'clamp(1.2rem,2.5vw,1.7rem)',
          lineHeight: 1,
          color: 'var(--navy, #102742)',
          fontVariantNumeric: 'tabular-nums',
          overflow: 'visible',
        }}
      >
        {children}
      </div>
      <div
        style={{
          fontSize: '0.68rem',
          color: 'rgba(16,39,66,0.45)',
          letterSpacing: '0.04em',
        }}
      >
        {sub}
      </div>
    </div>
  )
}
