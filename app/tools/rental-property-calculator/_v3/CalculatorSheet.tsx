/**
 * Working surface around the calculator island.
 *
 * V3Sheet cannot take a ReactNode slot (its children are prose, its field is
 * one control). The underwriting math lives in RentalCalculator, so that form
 * stays. This wrapper opens the Sheet token scope and layout so the form sits
 * in the locked pattern order as the Sheet, without rewriting inputs, formulas,
 * URL prefill, the PDF download, or submitRentalLead.
 *
 * max-width uses --v3-measure (72rem), not --v3-measure-sheet (40rem). An
 * underwriting form is not one question. The 40rem sheet measure is for
 * progressive capture.
 */
import type { ReactNode } from 'react'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import '@/components/site/v3/V3Sheet.css'

type Props = {
  id: string
  headingId: string
  eyebrow: string
  heading: string
  children: ReactNode
}

export function CalculatorSheet({ id, headingId, eyebrow, heading, children }: Props) {
  return (
    <section
      id={id}
      className={`${V3_ROOT_CLASS} v3-sheet`}
      aria-labelledby={headingId}
      style={{ maxWidth: 'var(--v3-measure)' }}
    >
      <header className="v3-sheet-head">
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        <V3Heading id={headingId} level={2}>
          {heading}
        </V3Heading>
      </header>
      {children}
    </section>
  )
}
