/**
 * Working surface around the locked capture forms.
 *
 * V3Sheet cannot take a ReactNode slot (its children are prose, its field is
 * one control). SellValueForm and ValuationForm are the capture contracts, so
 * they stay. On /sell the wrapper is a cream slab on the Stage photograph.
 * On the homepage it still opens the Sheet token scope as the sell band.
 * Payload, field names, and Places autocomplete are unchanged.
 *
 * SITE-85: stage placement is a two-column working surface — sourced proof
 * (and optional MOS two-bar) beside the address ask — so the fold is not the
 * industry portal card. Scroll cue to #proof stays under the pair.
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
   * Quiet sourced sentence near the CTA. Plain prose, never a KPI tile.
   * Server-composed from a DAL figure the page already fetched.
   */
  proof?: ReactNode
  /**
   * Optional drawing that sits with the proof (MOS two-bar from the same Bend
   * pulse the Instrument uses). Stage only.
   */
  aside?: ReactNode
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
  aside,
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
    const hasRail = Boolean(proof || aside)
    return (
      <div className="sell-stage-ask" data-layout={hasRail ? 'pair' : 'solo'} {...named}>
        {hasRail ? (
          <aside className="sell-stage-ask__rail" aria-label="Bend market context">
            {proof ? <p className="sell-stage-ask__proof">{proof}</p> : null}
            {aside}
          </aside>
        ) : null}
        <div className="sell-stage-ask__form">
          {head}
          {children}
        </div>
        {nextHref && nextLabel ? (
          <a className="sell-stage-next" href={nextHref}>
            <span className="sell-stage-next__mark" aria-hidden="true" />
            {nextLabel}
          </a>
        ) : null}
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
