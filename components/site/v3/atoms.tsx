/**
 * v3 ATOMS. The small pieces every one of the six locked patterns needs.
 *
 * Visual language: design_system/public/PUBLIC_UI.md (locked 2026-08-11).
 * Color, size, radius, ring, and duration come from ./tokens.css. No raw color
 * is declared here, and no atom fetches, derives, or formats data on its own:
 * a figure takes an already-formatted string so the caller keeps the source
 * trace beside the number that came from it.
 *
 * Barrel law honored here:
 *  - Nothing is imported from components/site/kb, components/site (flat),
 *    components/site/primitives, components/site/explore, or components/ui.
 *  - Every control REQUIRES its accessible name in the type. V3Button takes a
 *    non-nullable child, so a nameless button does not compile.
 *  - No 'use client'. Every atom is server-component-safe; when a client
 *    pattern needs one it crosses the boundary as an ordinary import.
 */
import type { MouseEventHandler, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format/date'
import './tokens.css'

/**
 * The class that opens the token scope. Put it on the outermost element of any
 * v3 surface, once, so ./tokens.css resolves for everything beneath it.
 */
export const V3_ROOT_CLASS = 'v3'

/**
 * THE LOOK (Matt 2026-08-26, PUBLIC_UI.md section 6): the Ledger register for
 * search/data surfaces. Mount it BESIDE V3_ROOT_CLASS on the page root —
 * `cn(V3_ROOT_CLASS, V3_LEDGER_CLASS)` — and every v3 token scope beneath it
 * re-resolves to the working-instrument values in tokens.css section 2b:
 * 13px base, sans display, Geist Mono numerals, dense rows, sunken panels,
 * 3px navy rules, 120ms linear motion. Content surfaces mount nothing and
 * wear the Broadside default. The class does nothing without V3_ROOT_CLASS.
 */
export const V3_LEDGER_CLASS = 'v3--ledger'

/* -------------------------------------------------------------------------- */
/* The accessible name, in the type                                            */
/* -------------------------------------------------------------------------- */

/**
 * Rejects the empty string LITERAL while leaving a plain `string` alone. Apply it
 * to any prop that computes an accessible name: `headline={''}` becomes a compile
 * error, while a `string` read out of a query still passes, because no type can
 * see inside one. That remaining case is a run-time job, and each pattern states
 * which run-time discipline it uses in its own header.
 *
 * Declared once here because it was declared twice: V3Stage spelled it `V3Named`
 * and V3Instrument and V3Ledger spelled the same conditional inline inside
 * `v3Text`'s signature. One name for one idea.
 */
export type V3NonEmpty<T extends string> = T extends '' ? never : T

/**
 * A string that is known to be non-empty. Branded, so `''` cannot reach a
 * heading, an aria-label, a link's text, or a button's label: those all compute
 * an accessible name, and the empty string computes none.
 *
 * The brand is structural (a phantom property, not a `unique symbol`), so a
 * `V3Text` made anywhere is assignable to a `V3Text` expected anywhere.
 *
 * THIS DECLARATION IS THE ONLY ONE. V3Instrument.tsx and V3Ledger.tsx each
 * carried a private copy, and both files' comments named this file as where the
 * type belonged once the barrel landed. Two exported types of the same name in
 * one barrel is not a style question: `export *` from both is a duplicate-export
 * error, so the barrel could not have compiled around it.
 */
export type V3Text = string & { readonly __v3NonEmptyText: true }

/**
 * The only way to make a `V3Text`.
 *
 * `v3Text('')` does not compile: the literal narrows the parameter to `never`. A
 * value typed `string` (anything read out of a query) compiles and is checked at
 * run time, where an empty or whitespace-only string throws instead of rendering
 * a nameless section or a nameless control. A caller holding data that is
 * legitimately allowed to be blank supplies the fallback itself:
 * `v3Text(listing.address || 'Address withheld')`.
 */
export function v3Text<S extends string>(value: S & V3NonEmpty<S>): V3Text {
  const text: string = value
  if (text.trim().length === 0) {
    throw new Error(
      'v3Text: received an empty string. Every visible string passed through this ' +
        'helper is an accessible name or a source trace. Pass real text, or pass an ' +
        'explicit fallback.',
    )
  }
  return text as V3Text
}

/* -------------------------------------------------------------------------- */
/* V3Button                                                                    */
/* -------------------------------------------------------------------------- */

export type V3ButtonVariant = 'primary' | 'ghost' | 'text'

export type V3ButtonProps = {
  /**
   * The visible label, and therefore the accessible name. Typed non-nullable so
   * a nameless control is a compile error rather than an audit finding.
   */
  children: NonNullable<ReactNode>
  /**
   * primary = solid navy, the one earned ask. ghost = outline, secondary.
   * text = underlined tertiary. Defaults to primary.
   */
  variant?: V3ButtonVariant
  /** Present means the control is a destination, so it renders a next/link. */
  href?: string
  /** Button form only (no href). */
  type?: 'button' | 'submit'
  /** Button form only (no href). */
  onClick?: MouseEventHandler<HTMLButtonElement>
  /** Button form only. A link is either rendered or it is not offered. */
  disabled?: boolean
  /** Inverts the outline and text variants for use over Stage media. */
  onMedia?: boolean
  id?: string
  className?: string
  /**
   * Only when the visible label is shorter than the name a screen reader needs
   * ("Continue" inside an unnamed step). Never a substitute for a label.
   */
  ariaLabel?: string
  ariaExpanded?: boolean
  ariaControls?: string
  ariaCurrent?: 'page' | 'step' | 'location' | true
  prefetch?: boolean
  target?: '_blank'
  rel?: string
}

/**
 * The one action control for every pattern: Stage (the single line plus one
 * action), Sheet (advance a step, submit), Instrument and Ledger (the ask
 * earned by the data above it), Quiet (never primary there).
 *
 * RULE, enforced by review not by the type: ONE primary per viewport. A second
 * primary in view means one of them is really a ghost, or the section is doing
 * two jobs and should split.
 */
export function V3Button({
  children,
  variant = 'primary',
  href,
  type = 'button',
  onClick,
  disabled,
  onMedia,
  id,
  className,
  ariaLabel,
  ariaExpanded,
  ariaControls,
  ariaCurrent,
  prefetch,
  target,
  rel,
}: V3ButtonProps) {
  const classes = cn(
    'v3-btn',
    `v3-btn--${variant}`,
    onMedia && 'v3-btn--on-media',
    className,
  )

  if (href) {
    return (
      <Link
        href={href}
        id={id}
        className={classes}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        prefetch={prefetch}
        target={target}
        rel={rel}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      id={id}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* V3Figure                                                                    */
/* -------------------------------------------------------------------------- */

export type V3FigureProps = {
  /**
   * The number as it should read on screen, already formatted by the caller
   * through lib/format (formatPrice, formatPriceCompact, a percent, a count).
   * A string keeps rounding and currency rules in one place and keeps this
   * primitive from inventing a figure the source trace does not cover.
   */
  value: string
  /** What the number is. Required: a figure without its label is not honest. */
  label: string
  /** 'lead' is the single headline figure of an Instrument. */
  emphasis?: 'standard' | 'lead'
  /** Inverts for use over Stage media. */
  onMedia?: boolean
  /** Put this on the value when a heading or region needs to reference it. */
  id?: string
  className?: string
}

/**
 * A number and what it means. The Instrument pattern is built from these
 * (verdict figure plus its supporting set); Field uses one for the honest
 * count, Ledger for a row total, Sheet for a computed result.
 * Tabular numerals, so a column of figures aligns and a counting animation
 * does not reflow.
 */
export function V3Figure({
  value,
  label,
  emphasis = 'standard',
  onMedia,
  id,
  className,
}: V3FigureProps) {
  return (
    <div
      className={cn(
        'v3-figure',
        emphasis === 'lead' && 'v3-figure--lead',
        onMedia && 'v3-figure--on-media',
        className,
      )}
    >
      <span id={id} className="v3-figure__value">
        {value}
      </span>
      <span className="v3-figure__label">{label}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* V3SourceLine                                                                */
/* -------------------------------------------------------------------------- */

export type V3SourceLineProps = {
  /**
   * The trace itself, without the word "Source" (this renders that prefix):
   * what the figures above came from, the filter, and the population. Example:
   * "live MLS, Bend single-family, active listings at last sync".
   */
  source: string
  /** When the data was last refreshed. Rendered through the canonical formatter. */
  updatedAt?: string | number | Date | null
  /** Inverts for use over Stage media. */
  onMedia?: boolean
  id?: string
  className?: string
}

/**
 * The section 0 trace line that sits under any block of real data: Instrument,
 * Field counts, Ledger rows, a Sheet result. Every figure renders with its
 * source available, so this is not decoration and is not optional on a data
 * block. Muted, small, and never louder than the number it explains.
 */
export function V3SourceLine({
  source,
  updatedAt,
  onMedia,
  id,
  className,
}: V3SourceLineProps) {
  return (
    <p
      id={id}
      className={cn('v3-source', onMedia && 'v3-source--on-media', className)}
    >
      Source: {source}
      {updatedAt == null ? null : ` · updated ${formatDate(updatedAt)}`}
    </p>
  )
}

/* -------------------------------------------------------------------------- */
/* V3SourceDisclosure                                                          */
/* -------------------------------------------------------------------------- */

export type V3SourceDisclosureProps = {
  /**
   * The full section 0 trace: table, filter, methodology stamp, population.
   * Collapsed behind a "Source" summary — the trace is present on every data
   * block but never a visible paragraph competing with the figures
   * (Matt 2026-08-19).
   */
  source: string
  /** When the data was last refreshed. Rendered through the canonical formatter. */
  updatedAt?: string | number | Date | null
  id?: string
  className?: string
}

/**
 * The collapsed form of the section 0 trace: a native details/summary whose
 * closed state shows only the word "Source". Use it under a chart or figure
 * block where the trace names tables, filters, and vintages too long for the
 * one-line V3SourceLine.
 */
export function V3SourceDisclosure({ source, updatedAt, id, className }: V3SourceDisclosureProps) {
  return (
    <details id={id} className={cn('v3-source-disclosure', className)}>
      <summary className="v3-source-disclosure__summary">Source</summary>
      <p className="v3-source">
        {source}
        {updatedAt == null ? null : ` · updated ${formatDate(updatedAt)}`}
      </p>
    </details>
  )
}

/* -------------------------------------------------------------------------- */
/* V3Eyebrow                                                                   */
/* -------------------------------------------------------------------------- */

export type V3EyebrowProps = {
  /** The context line. Non-nullable: an empty eyebrow is a hole in the layout. */
  children: NonNullable<ReactNode>
  /** Inverts for use over Stage media. */
  onMedia?: boolean
  id?: string
  className?: string
}

/**
 * The uppercase tracked line that says where the visitor is before the heading
 * says what the answer is. Opens Instrument (place plus freshness), Stage, and
 * the head of a Ledger or Quiet block. One line, never a sentence.
 */
export function V3Eyebrow({ children, onMedia, id, className }: V3EyebrowProps) {
  return (
    <p
      id={id}
      className={cn('v3-eyebrow', onMedia && 'v3-eyebrow--on-media', className)}
    >
      {children}
    </p>
  )
}

/* -------------------------------------------------------------------------- */
/* V3Lede                                                                      */
/* -------------------------------------------------------------------------- */

export type V3LedeProps = {
  /** The sentence. Non-nullable: an empty lede is a hole in the layout. */
  children: NonNullable<ReactNode>
  id?: string
  className?: string
}

/**
 * The one sentence of basis that sits under a heading. Instrument, Ledger and
 * Quiet each own this shape as a `note` prop; this is the same paragraph for a
 * surface whose working control is a client component that predates the barrel
 * and therefore carries no note slot of its own (the A-to-Z place browsers).
 *
 * Muted, held to the reading measure, never a figure. A number belongs in an
 * Instrument with its source line.
 */
export function V3Lede({ children, id, className }: V3LedeProps) {
  return (
    <p id={id} className={cn('v3-lede', className)}>
      {children}
    </p>
  )
}

/* -------------------------------------------------------------------------- */
/* V3Heading                                                                   */
/* -------------------------------------------------------------------------- */

export type V3HeadingSize = 'display' | 'field'

export type V3HeadingProps = {
  /**
   * 1 for the page answer, exactly once per page. 2 for a section title.
   * Deeper levels are a sign the page is doing two jobs.
   */
  level: 1 | 2
  /**
   * `display` is the locked Instrument/Stage scale. `field` is Amboqia at
   * display-2 so a Homes or City Field can name the page without eating the
   * photographs that are supposed to fill the fold.
   */
  size?: V3HeadingSize
  /** The heading text. Non-nullable: a heading is a name, so it cannot be empty. */
  children: NonNullable<ReactNode>
  /** Inverts for use over Stage media. */
  onMedia?: boolean
  /** Pair with aria-labelledby on the section that this heading names. */
  id?: string
  className?: string
}

function headingSizeClass(level: 1 | 2, size: V3HeadingSize): string {
  switch (size) {
    case 'field':
      return 'v3-heading--field'
    case 'display':
      return level === 1 ? 'v3-heading--1' : 'v3-heading--2'
    default: {
      const _never: never = size
      return _never
    }
  }
}

/**
 * The Amboqia display heading. Level 1 carries the answer that opens a node
 * (Instrument verdict, Field title); level 2 titles a Ledger, Sheet, Stage, or
 * Quiet block. The face is the brand display font, so this is the only way a
 * v3 surface renders a heading.
 */
export function V3Heading({
  level,
  size = 'display',
  children,
  onMedia,
  id,
  className,
}: V3HeadingProps) {
  const classes = cn(
    'v3-heading',
    headingSizeClass(level, size),
    onMedia && 'v3-heading--on-media',
    className,
  )

  if (level === 1) {
    return (
      <h1 id={id} className={classes}>
        {children}
      </h1>
    )
  }

  return (
    <h2 id={id} className={classes}>
      {children}
    </h2>
  )
}
