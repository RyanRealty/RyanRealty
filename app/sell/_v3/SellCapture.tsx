/**
 * Working surface around the locked capture forms.
 *
 * V3Sheet cannot take a ReactNode slot (its children are prose, its field is
 * one control). SellValueForm and ValuationForm are the capture contracts, so
 * they stay. On /sell the wrapper is a cream slab on the Stage photograph.
 * On the homepage it still opens the Sheet token scope as the sell band.
 * Payload, field names, and Places autocomplete are unchanged.
 *
 * SITE-111: the stage placement is ONE narrow column again — a sourced line
 * with its own section-0 trace, then the address field, then the ask. The
 * two-column slab that carried a Bend months-of-supply drawing beside an empty
 * field is gone, and the 2026-09-12 table said why: "Bend-wide months of supply
 * printed next to an untyped address, so the page answers the city before it
 * has a house." Supply is now drawn in the sheet the address opens, against the
 * street the visitor actually typed. Scroll cue to #proof stays under the ask.
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
  /**
   * Quiet sourced sentence above the field. Plain prose, never a KPI tile.
   * Server-composed from a DAL figure the page already fetched.
   */
  proof?: ReactNode
  /**
   * The section-0 trace for the figures in `proof`, as a collapsed disclosure.
   * The fold used to carry figures whose only source line lived three sections
   * down; a figure and its trace belong in the same viewport.
   */
  trace?: ReactNode
  /** Scroll affordance keyed to the next section (The record). Stage only. */
  nextHref?: string
  nextLabel?: string
  children: ReactNode
}

export function SellCapture({
  id,
  headingId,
  eyebrow,
  heading,
  ariaLabel,
  placement = 'page',
  proof,
  trace,
  nextHref,
  nextLabel,
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
      <>
        <div className="sell-stage-ask" {...named}>
          {proof ? (
            <div className="sell-stage-ask__record">
              <p className="sell-stage-ask__proof">{proof}</p>
              {trace}
            </div>
          ) : null}
          <div className="sell-stage-ask__form">
            {head}
            {children}
          </div>
        </div>
        {/* The cue to what is next belongs on the photograph, not inside the
            ask: a scroll affordance printed in the capture slab makes the slab
            taller and reads as one more line of the form. */}
        {nextHref && nextLabel ? (
          <a className="sell-stage-next" href={nextHref}>
            <span className="sell-stage-next__mark" aria-hidden="true" />
            {nextLabel}
          </a>
        ) : null}
      </>
    )
  }

  return (
    <section id={id} className={`${V3_ROOT_CLASS} v3-sheet`} {...named}>
      {head}
      {children}
    </section>
  )
}
