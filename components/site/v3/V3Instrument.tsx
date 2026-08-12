/**
 * PATTERN 1: INSTRUMENT. The answer, big.
 *
 * Visual language: design_system/public/PUBLIC_UI.md (locked 2026-08-11), pattern 1.
 * One verdict, number, or range in Amboqia, the supporting figures under a single
 * hairline, the section 0 trace beneath, and the one ask the data earns. No ornament
 * precedes the answer. Opens Market nodes, carries a place market band, and reports the
 * valuation result.
 *
 * Provenance, stated exactly. The geometry is derived from that document. The moving
 * prototype at app/dev/public-v3/ demonstrates the same pattern and imports nothing from
 * this directory: it hand-writes its own global `.v3-instrument` rule against its own
 * token names (--navy-70, --edge). The prototype is a second implementation of the same
 * spec, so nothing here is proven by it, and the two collide on shared class names when
 * both stylesheets load in one document. ./V3Instrument.css holds that collision.
 *
 * Data contract, from CLAUDE.md section 0: every figure, the trace, and the freshness
 * stamp arrive already formatted by the caller through lib/format. This primitive never
 * fetches, never rounds, never derives a number, and never parses a date, so the string
 * on screen is the one the caller traced to a query.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, next/link, and @/lib/utils. Nothing from components/site/kb,
 *    components/site (flat), components/site/primitives, components/site/explore, or
 *    components/ui.
 *  - Every name-bearing string is `V3Text`, not `string`. `string` accepts `''`, and an
 *    empty headline renders a region whose aria-labelledby points at an empty h1, which
 *    is a region with no accessible name at all. `headline=""`, `source=""`, and an
 *    empty action label are compile errors here.
 *  - The section id comes from the caller. Nothing is derived from the headline: verdict
 *    sentences are templated ("A balanced market"), the Places node renders a place
 *    verdict and a parent-market verdict on one page, and a derived id would give both
 *    sections the same id and point the second one's aria-labelledby at the first one's
 *    heading. Without an id the section names itself with aria-label instead.
 *  - `level` is required, so two Instruments on one page cannot both emit an h1 because
 *    a default chose for them.
 *  - Figures take an href, because PUBLIC-PRODUCT-OS makes every market stat a door and
 *    calls dead text naming a linkable thing a defect.
 *  - No 'use client'. Nothing here holds state.
 *  - No raw color. Every value comes from ./tokens.css through ./V3Instrument.css.
 *
 * Motion, deliberately absent. An earlier build counted each figure to its value over
 * 900ms on mount. PUBLIC_UI.md section 5 allows 600ms and longer only for a scroll-bound
 * sequence the visitor controls, and section 1 ships a motion only when it encodes a
 * state change the visitor caused. Arrival is neither, and a mount-triggered
 * requestAnimationFrame is not scroll-bound. A Market instrument settling is one of the
 * two moments the spec does allow, as a GSAP ScrollTrigger plus Lenis sequence bound to
 * scroll; when that is built it enters as a scroll-bound client child, not as a boolean
 * prop that fires on arrival. The retired implementation is V3InstrumentCount.client.tsx,
 * which this file no longer imports.
 */
import { Fragment } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  V3Button,
  V3Eyebrow,
  V3Figure,
  V3Heading,
  V3SourceLine,
  V3_ROOT_CLASS,
  type V3ButtonVariant,
  type V3Text,
} from './atoms'
import './tokens.css'
import './V3Instrument.css'

/* -------------------------------------------------------------------------- */
/* V3Text: the accessible name, in the type                                    */
/* -------------------------------------------------------------------------- */

/**
 * `V3Text` and its constructor `v3Text()` now live in ./atoms.tsx, which is where the
 * comment on the copy that used to sit here said they belonged once the barrel landed.
 * A caller reaches them through the barrel (`import { v3Text } from '@/components/site/v3'`)
 * exactly as it reaches this component. Nothing about the contract changed: a `V3Text` is
 * a string known to be non-empty, and `v3Text('')` still does not compile.
 *
 * Every name-bearing prop below is still `V3Text`, not `string`.
 */

/* -------------------------------------------------------------------------- */
/* Figures                                                                     */
/* -------------------------------------------------------------------------- */

export type V3InstrumentFigure = {
  /**
   * The number as it should read on screen, already formatted by the caller
   * (formatPrice, formatPriceCompact, a percent, a count). A string keeps rounding and
   * currency rules in lib/format and keeps this primitive from inventing a figure the
   * source trace does not cover.
   */
  value: V3Text
  /** What the number is. Required: a figure without its label is not honest. */
  label: V3Text
  /**
   * Where the stat goes. PUBLIC-PRODUCT-OS: every place name, listing address, and
   * market stat is a door into its node, and dead text naming a linkable thing is a
   * defect. Absent only when the stat genuinely has no node behind it.
   */
  href?: string
  /**
   * Only when the value and the label together do not name the destination ("4.3 months"
   * plus "Supply" reads fine; a bare percent may not). Never a substitute for `label`.
   */
  ariaLabel?: V3Text
}

/**
 * At least one figure, enforced by the tuple head, the same technique V3Ledger uses for
 * its rows. The pattern is a verdict with the figures that support it, so a verdict with
 * nothing under it and a source line explaining nothing is a different section. Build a
 * dynamic set as `[first, ...rest]` and handle the empty case where the data is read:
 *
 * ```tsx
 * const [first, ...rest] = figures
 * return first ? (
 *   <V3Instrument level={1} headline={verdict} figures={[first, ...rest]} source={trace} />
 * ) : (
 *   <V3Quiet ... />  // state why the market has no figures, do not claim a verdict
 * )
 * ```
 */
export type V3InstrumentFigures = readonly [V3InstrumentFigure, ...V3InstrumentFigure[]]

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The one ask, earned by the data above it (PUBLIC_UI.md section 1). It renders inside
 * the labelled section, under the trace, so the ask belongs to the answer that earned it
 * instead of floating outside the region as a loose control.
 */
export type V3InstrumentAction = {
  /** The visible label, and therefore the control's accessible name. */
  label: V3Text
  href: string
  /** Defaults to primary. One primary per viewport, enforced by review. */
  variant?: V3ButtonVariant
}

export type V3InstrumentProps = {
  /**
   * The verdict sentence, and therefore the accessible name of the section. It must be
   * consistent with the figures below it: "seller's market" over 6.2 months of supply is
   * a data failure, not a copy choice.
   */
  headline: V3Text
  /** The supporting figures, left to right in the order the caller passes them. */
  figures: V3InstrumentFigures
  /**
   * The section 0 trace for those figures, without the word "Source" (the source line
   * renders that): what they came from, the filter, the population.
   */
  source: V3Text
  /**
   * The freshness stamp, PREFORMATTED by the caller through lib/format/date, and joined
   * to the trace here. It is not a raw date, because the atom's own `updatedAt` prop
   * hands a raw value to `formatDate`, which returns a lone em dash for anything it
   * cannot parse. That renders "updated" followed by punctuation: a freshness claim with
   * no date in it, an em dash in public copy, and neither one visible to the caller.
   */
  updated?: V3Text
  /** The context line above the verdict: where the visitor is. One line, never a sentence. */
  eyebrow?: V3Text
  /** The next step this answer earns, if it earns one. */
  action?: V3InstrumentAction
  /**
   * 1 when the Instrument opens the page and carries its answer. 2 for a market band
   * inside a page another pattern opened. Required, because a page can carry two
   * Instruments and only one of them is the page's answer.
   */
  level: 1 | 2
  /**
   * The section id. Pass one whenever the page links to this section, or whenever a
   * second Instrument shares the page. The heading id is this plus -headline, and the
   * section points at it with aria-labelledby; with no id the section carries the same
   * name through aria-label.
   */
  id?: string
  className?: string
}

/**
 * A freshness stamp that carries no date. `formatDate` returns a lone em dash for a null
 * or unparseable value, and a caller writing `updated={v3Text(formatDate(row.updated_at))}`
 * passes that straight through: the string is non-empty, so the brand accepts it. Matching
 * on the dash family drops the clause instead, which leaves the trace complete and
 * truthful ("Source: live MLS, Bend single-family actives") rather than asserting a
 * refresh that has no timestamp. Written as escapes so no dash character exists in this
 * file for the voice gate to find.
 */
const NO_DATE = /^[\s\u002D\u2010-\u2015\u2212]*$/

export function V3Instrument({
  headline,
  figures,
  source,
  updated,
  eyebrow,
  action,
  level,
  id,
  className,
}: V3InstrumentProps) {
  // Unreachable through the type: `V3Text` is only constructed by `v3Text()`, which
  // throws on empty. Reachable from untyped JS and from a cast, and the old behavior
  // there was a region whose name resolved to an empty heading, and a bare "Source:"
  // with nothing after it, which is the visual form of a trace with none of the trace.
  // Fail loudly instead.
  if (headline.trim().length === 0) {
    throw new Error(
      'V3Instrument: headline is empty. The verdict is the accessible name of the ' +
        'section; an empty one leaves the region unnamed.',
    )
  }
  if (source.trim().length === 0) {
    throw new Error(
      'V3Instrument: source is empty. Section 0 requires the trace beside the figures, ' +
        'and a bare "Source:" claims one that is not there.',
    )
  }

  const headlineId = id ? `${id}-headline` : undefined

  // The trace and its stamp are two already-formatted strings, joined the way the atom
  // joins them. Nothing here parses or formats a date.
  const stamp = updated && !NO_DATE.test(updated) ? updated : undefined
  const trace = stamp ? `${source} · updated ${stamp}` : source

  // One figure is the headline figure, so it takes the lead size the atom reserves for
  // it. Two or more read as a set and stay the same weight.
  const emphasis = figures.length === 1 ? 'lead' : 'standard'

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-instrument', className)}
      aria-labelledby={headlineId}
      aria-label={headlineId ? undefined : headline}
    >
      {eyebrow ? (
        <V3Eyebrow className="v3-instrument__eyebrow">{eyebrow}</V3Eyebrow>
      ) : null}

      <V3Heading level={level} id={headlineId} className="v3-instrument__headline">
        {headline}
      </V3Heading>

      <div
        className={cn(
          'v3-instrument__figures',
          figures.length === 1 && 'v3-instrument__figures--single',
        )}
      >
        {figures.map((figure, i) => {
          const key = `${i}-${figure.label}`
          const rendered = (
            <V3Figure value={figure.value} label={figure.label} emphasis={emphasis} />
          )
          // A door wraps the whole figure, so the value and the label are one target and
          // the accessible name reads as the stat it opens.
          return figure.href ? (
            <Link
              key={key}
              href={figure.href}
              className="v3-instrument__door"
              aria-label={figure.ariaLabel}
            >
              {rendered}
            </Link>
          ) : (
            <Fragment key={key}>{rendered}</Fragment>
          )
        })}
      </div>

      <V3SourceLine source={trace} className="v3-instrument__source" />

      {action ? (
        <div className="v3-instrument__action">
          <V3Button href={action.href} variant={action.variant ?? 'primary'}>
            {action.label}
          </V3Button>
        </div>
      ) : null}
    </section>
  )
}
