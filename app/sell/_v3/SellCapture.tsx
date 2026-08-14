/**
 * Working surface around the locked capture forms.
 *
 * V3Sheet cannot take a ReactNode slot (its children are prose, its field is
 * one control). SellValueForm and ValuationForm are the capture contracts, so
 * they stay. This wrapper opens the Sheet token scope and layout so the form
 * sits in the locked Sell order as the first Sheet, without rewriting the
 * payload, field names, or Places autocomplete.
 */
import type { ReactNode } from 'react'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import '@/components/site/v3/V3Sheet.css'

type Props = {
  /** Omit when the child form already owns the hash target (SellValueForm id=get-value). */
  id?: string
  headingId?: string
  eyebrow: string
  heading?: string
  /** Used when the child form owns the visible heading. /sell address step has none. */
  ariaLabel?: string
  children: ReactNode
}

export function SellCapture({ id, headingId, eyebrow, heading, ariaLabel, children }: Props) {
  const named = heading && headingId
    ? { 'aria-labelledby': headingId }
    : { 'aria-label': ariaLabel ?? heading ?? eyebrow }

  return (
    <section id={id} className={`${V3_ROOT_CLASS} v3-sheet`} {...named}>
      <header className="v3-sheet-head">
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        {heading && headingId ? (
          <V3Heading id={headingId} level={2}>
            {heading}
          </V3Heading>
        ) : null}
      </header>
      {children}
    </section>
  )
}
