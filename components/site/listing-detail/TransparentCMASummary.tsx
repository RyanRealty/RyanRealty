import { Price, TabularNumber, TextLink } from '@/components/site/primitives'
import { cn } from '@/lib/utils'

/**
 * TransparentCMASummary — KB section style.
 * Navy sec-head, Amboqia heading, cream card with navy border.
 *
 * Per CLAUDE.md §0: only renders when caller passes a real CMA row.
 */

export type CMASummary = {
  rangeLow: number
  rangeHigh: number
  suggested: number
  compCount: number
  producedAt: string
  pdfUrl: string
  methodology?: string
}

type Props = {
  cma: CMASummary | null
  className?: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Los_Angeles',
    })
  } catch {
    return iso
  }
}

export function TransparentCMASummary({ cma, className }: Props) {
  if (cma == null) return null

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Our analysis</div>
          <h2 className="sec-title display">Market analysis</h2>
        </div>
      </div>

      <div
        style={{
          marginTop: 'clamp(22px,3vw,36px)',
          border: '3px solid var(--navy, #102742)',
          padding: '22px 24px',
          background: 'var(--cream, #faf8f4)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 24,
            marginBottom: 20,
          }}
        >
          <div>
            <div
              className="eyebrow"
              style={{ color: 'rgba(16,39,66,0.72)', fontSize: '0.62rem', letterSpacing: '0.18em', marginBottom: 6 }}
            >
              Estimated range
            </div>
            <div
              style={{
                fontFamily: 'var(--font-amboqia, serif)',
                fontSize: 'clamp(1rem,2.2vw,1.4rem)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--navy, #102742)',
                overflow: 'visible',
              }}
            >
              <Price value={cma.rangeLow} /> to <Price value={cma.rangeHigh} />
            </div>
          </div>
          <div>
            <div
              className="eyebrow"
              style={{ color: 'rgba(16,39,66,0.72)', fontSize: '0.62rem', letterSpacing: '0.18em', marginBottom: 6 }}
            >
              Suggested list
            </div>
            <div
              style={{
                fontFamily: 'var(--font-amboqia, serif)',
                fontSize: 'clamp(1.1rem,2.5vw,1.6rem)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--navy, #102742)',
                overflow: 'visible',
              }}
            >
              <Price value={cma.suggested} />
            </div>
          </div>
          <div>
            <div
              className="eyebrow"
              style={{ color: 'rgba(16,39,66,0.72)', fontSize: '0.62rem', letterSpacing: '0.18em', marginBottom: 6 }}
            >
              Based on
            </div>
            <div
              style={{
                fontFamily: 'var(--font-amboqia, serif)',
                fontSize: 'clamp(1.1rem,2.5vw,1.6rem)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--navy, #102742)',
                overflow: 'visible',
              }}
            >
              <TabularNumber value={cma.compCount} /> comps
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderTop: '1px solid rgba(16,39,66,0.15)',
            paddingTop: 16,
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              color: 'rgba(16,39,66,0.72)',
              letterSpacing: '0.02em',
              lineHeight: 1.5,
            }}
          >
            Produced {formatDate(cma.producedAt)}
            {cma.methodology ? `. Methodology: ${cma.methodology}` : null}
          </div>
          <TextLink href={cma.pdfUrl} tone="primary">
            See the full CMA
          </TextLink>
        </div>
      </div>
    </section>
  )
}
