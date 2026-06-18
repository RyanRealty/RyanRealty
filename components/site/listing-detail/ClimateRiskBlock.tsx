import { cn } from '@/lib/utils'
import { TabularNumber } from '@/components/site/primitives'

/**
 * ClimateRiskBlock — KB section style. Navy sec-head, Amboqia heading,
 * risk cells in cream/navy palette.
 *
 * CLAUDE.md §0: every score must trace to a verified primary source.
 * When risk is null, renders a CTA (not fake numbers).
 */

export type ClimateRiskScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type ClimateRisk = {
  flood: ClimateRiskScore | null
  wildfire: ClimateRiskScore | null
  heat: ClimateRiskScore | null
  drought: ClimateRiskScore | null
  source?: string
}

type Props = {
  risk: ClimateRisk | null
  className?: string
}

function scoreLabel(s: ClimateRiskScore | null): string {
  if (s == null) return ''
  if (s <= 3) return 'Minimal'
  if (s <= 5) return 'Minor'
  if (s <= 7) return 'Moderate'
  if (s <= 8) return 'Major'
  return 'Severe'
}

function scoreToneColor(s: ClimateRiskScore | null): string {
  if (s == null) return 'rgba(16,39,66,0.4)'
  if (s <= 7) return 'var(--navy, #102742)'
  if (s <= 8) return '#b45300'
  return '#b91c1c'
}

function RiskCell({ label, score }: { label: string; score: ClimateRiskScore | null }) {
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
          fontSize: 'clamp(1.4rem,3vw,2rem)',
          lineHeight: 1,
          color: scoreToneColor(score),
          fontVariantNumeric: 'tabular-nums',
          overflow: 'visible',
        }}
      >
        {score != null ? <><TabularNumber value={score} /> <span style={{ fontSize: '0.5em', opacity: 0.6 }}>of 10</span></> : 'Pending'}
      </div>
      {score != null ? (
        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(16,39,66,0.55)',
          }}
        >
          {scoreLabel(score)}
        </div>
      ) : null}
    </div>
  )
}

export function ClimateRiskBlock({ risk, className }: Props) {
  const hasAnyScore =
    risk != null && [risk.flood, risk.wildfire, risk.heat, risk.drought].some((s) => s != null)

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Climate</div>
          <h2 className="sec-title display">Climate risk</h2>
        </div>
      </div>

      <div style={{ marginTop: 'clamp(22px,3vw,36px)' }}>
        {hasAnyScore && risk ? (
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
              <RiskCell label="Flood" score={risk.flood} />
              <RiskCell label="Wildfire" score={risk.wildfire} />
              <RiskCell label="Heat" score={risk.heat} />
              <RiskCell label="Drought" score={risk.drought} />
            </div>
            {risk.source ? (
              <div
                className="eyebrow"
                style={{ marginTop: 12, color: 'rgba(16,39,66,0.45)', fontSize: '0.6rem', letterSpacing: '0.14em' }}
              >
                Source: {risk.source}
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
              We pull climate risk data from FEMA flood maps, the Deschutes County wildland-urban interface map, and NOAA heat trends. Detailed scoring for this property is on request.
            </p>
            <a
              href="/contact?intent=climate-report"
              className="btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              Get the climate report <span aria-hidden>→</span>
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
