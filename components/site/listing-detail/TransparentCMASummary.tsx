import { Eyebrow, H3, Price, Stack, TabularNumber, TextLink } from '@/components/site/primitives'

/**
 * TransparentCMASummary — surface a Comparative Market Analysis when
 * Ryan Realty has run one on this property. Per DESIGN_DIRECTIVES.md
 * D77 (Zillow Showcase parity), this is the "we'll show our work"
 * differentiator: every figure traces to the CMA workbook and the
 * full PDF is linked.
 *
 * The block renders nothing when no CMA exists. Calling page queries
 * `public.cmas` for the listing key; if a row exists, it passes the
 * summary; otherwise null.
 *
 * Per CLAUDE.md §0 Data Accuracy: pricing claims must trace to the
 * CMA workbook. No vague language; only the computed range, the
 * comp count, and a link to the PDF.
 */

export type CMASummary = {
  /** Range low per CMA workbook. */
  rangeLow: number
  /** Range high per CMA workbook. */
  rangeHigh: number
  /** Suggested list price (the broker's recommendation). */
  suggested: number
  /** Number of comparables used. */
  compCount: number
  /** ISO date the CMA was produced. */
  producedAt: string
  /** Public URL to the CMA PDF artifact. */
  pdfUrl: string
  /** Methodology, e.g. "weighted by SqFt, lot size, condition, view". */
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
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Our market analysis</Eyebrow>
        <H3 className="mt-1.5">What our CMA says</H3>
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Estimated range
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
              <Price value={cma.rangeLow} /> to <Price value={cma.rangeHigh} />
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Suggested list
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
              <Price value={cma.suggested} />
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Based on
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
              <TabularNumber value={cma.compCount} /> comparables
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">
            Produced {formatDate(cma.producedAt)}
            {cma.methodology ? `. Methodology: ${cma.methodology}` : null}
          </div>
          <TextLink href={cma.pdfUrl} tone="primary">
            See the full CMA
          </TextLink>
        </div>
      </div>
    </Stack>
  )
}
