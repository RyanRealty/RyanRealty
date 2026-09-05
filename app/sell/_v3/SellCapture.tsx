/**
 * Working surface around the locked capture forms.
 *
 * V3Sheet cannot take a ReactNode slot (its children are prose, its field is
 * one control). SellValueForm and ValuationForm are the capture contracts, so
 * they stay. On /sell the wrapper is a cream slab on the Stage photograph.
 * On the homepage it still opens the Sheet token scope as the sell band.
 * Payload, field names, and Places autocomplete are unchanged.
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
  /**
   * `stage` paints the ask as a cream slab on the photograph.
   * `page` is the full Sheet (homepage sell band).
   */
  placement?: 'page' | 'stage'
  children: ReactNode
}

export function SellCapture({
  id,
  headingId,
  eyebrow,
  heading,
  ariaLabel,
  placement = 'page',
  children,
}: Props) {
  const named = heading && headingId
    ? { 'aria-labelledby': headingId }
    : { 'aria-label': ariaLabel ?? heading ?? eyebrow }

  const head = (
    <header className={placement === 'stage' ? 'sell-stage-ask__head' : 'v3-sheet-head'}>
      <V3Eyebrow>{eyebrow}</V3Eyebrow>
      {heading && headingId ? (
        <V3Heading id={headingId} level={2}>
          {heading}
        </V3Heading>
      ) : null}
    </header>
  )

  if (placement === 'stage') {
    return (
      <div className="sell-stage-ask" {...named}>
        {head}
        {children}
      </div>
    )
  }

  return (
    <section id={id} className={`${V3_ROOT_CLASS} v3-sheet`} {...named}>
      {head}
      {children}
    </section>
  )
}
