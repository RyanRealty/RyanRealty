/**
 * Working surface around the concessions calculator.
 * Same Sheet token scope as /tools/mortgage-calculator: --v3-measure, not the
 * 40rem capture sheet. Copied locally so this route does not edit that file.
 */
import type { ReactNode } from 'react'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import '@/components/site/v3/V3Sheet.css'

type Props = {
  id: string
  headingId: string
  eyebrow: string
  heading: string
  lede?: string
  children: ReactNode
}

export function CalculatorSheet({ id, headingId, eyebrow, heading, lede, children }: Props) {
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
        {lede ? <p className="concessions-calc__intro">{lede}</p> : null}
      </header>
      {children}
    </section>
  )
}
