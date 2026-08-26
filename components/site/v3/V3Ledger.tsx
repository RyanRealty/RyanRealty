/**
 * PATTERN 3: LEDGER. A scannable list of real rows where every row is a door.
 *
 * Visual language: design_system/public/PUBLIC_UI.md (locked 2026-08-11), pattern 3.
 * Proven in the moving prototype at app/dev/public-v3/ (the Market "what just changed"
 * block, the Homes "longest on market" block, and the Tumalo recent-sales block). This
 * generalizes those three, it does not restyle them.
 *
 * What the pattern is for: recent sales, listings ordered by one dimension, market
 * reports, saved searches, open houses. Anything the visitor scans down a column and
 * leaves through. Hairline separators, no cards, tabular numerals on the value column,
 * 44px minimum row height so a thumb hits one row and not two.
 *
 * Barrel law honored here:
 *  - No import from components/site/kb, components/site (flat), components/site/primitives,
 *    components/site/explore, or components/ui. Only ./atoms and lib helpers.
 *  - The accessible name is in the type, and the type is `V3Text`, not `string`. A bare
 *    `string` accepts `''`, which renders `<section aria-label="">` (no landmark), an
 *    empty `<h2>` (axe `empty-heading`), and a row anchor a screen reader reads out as
 *    its raw URL. `V3Text` is branded, so `heading=""` and `what=""` are compile errors
 *    and every name-bearing value passes through `v3Text()`.
 *  - Zero rows is a typed branch, not a silent return. The props union pairs an empty
 *    `rows` with a required `emptyMessage`, so a query that comes back empty states its
 *    reason instead of deleting the section from the page.
 *  - A value column of figures requires its section 0 trace. `source` is required on the
 *    figure variant and forbidden on the no-figure variant, so a live price cannot ship
 *    untraced and a saved-search list is not asked to invent a trace it does not have.
 *  - No raw color. Every value comes from ./tokens.css through ./V3Ledger.css.
 *  - No 'use client'. Nothing here holds state, so this is a pure server component and
 *    the rows are real anchors that work before hydration.
 *
 * Data rules: this primitive never fetches, never formats a figure, never formats a
 * date, and never invents a row. `value`, `when`, `detail`, and `updated` all arrive
 * already formatted by the caller through lib/format, which keeps currency, rounding,
 * and timezone in one place and keeps every rendered string identical to the one its
 * source trace covers.
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  V3Button,
  V3Eyebrow,
  V3Heading,
  V3SourceLine,
  V3_ROOT_CLASS,
  type V3ButtonVariant,
  type V3Text,
} from './atoms'
import './tokens.css'
import './V3Ledger.css'

/* -------------------------------------------------------------------------- */
/* V3Text: the accessible name, in the type                                    */
/* -------------------------------------------------------------------------- */

/**
 * `V3Text` and its constructor `v3Text()` now live in ./atoms.tsx, which is the landing
 * the comment on the copy that used to sit here anticipated. This file and
 * ./V3Instrument.tsx each carried a private declaration of the same branded type, and two
 * exported types of one name cannot both leave through one barrel.
 *
 * Nothing about the contract changed: `heading=""` and `what=""` are still compile
 * errors, and every name-bearing value still passes through `v3Text()`, imported from the
 * barrel alongside this component.
 */

/* -------------------------------------------------------------------------- */
/* Rows                                                                        */
/* -------------------------------------------------------------------------- */

type V3LedgerRowBase = {
  /**
   * Where the row goes. Required: the pattern's whole claim is that every row is a
   * door, so a row without a destination is a different pattern.
   */
  href: string
  /**
   * The temporal or contextual line: "closed Jun 12", "34 days on market", "saved
   * Aug 3". Rendered small and uppercase above the name on 390, in its own column
   * from 768 up. Dates arrive already formatted through lib/format/date.
   */
  when: V3Text
  /** The row's name, and the loudest part of its link text. */
  what: V3Text
  /** The second line under the name: beds and baths, a subdivision, a status. */
  detail?: V3Text
  /** React key when two rows can share an href. Defaults to href. */
  id?: string
  /**
   * A verified photograph OF THE THING THE ROW NAMES. Optional, and the option is
   * the point: a place ledger may only show a picture when it has one it can
   * vouch for, so the absence of a photo is the honest state and never a
   * stand-in. Callers resolve it from a verified registry or from a real listing
   * inside the place's own boundary; nothing here fetches, picks, or falls back.
   *
   * `src` only. The photo is DECORATIVE by construction — the row's accessible
   * name is `what`, the row is already one link, and a second name on the image
   * would make a screen reader read every row twice — so it renders `alt=""` and
   * takes no alt text from the caller.
   */
  media?: { src: string }
  /**
   * Only when the row text is shorter than the name a screen reader needs. Never a
   * substitute for `what`.
   */
  ariaLabel?: V3Text
  /**
   * The row opens a file or a site we do not own, so it opens in a new tab. One
   * flag rather than a `target` plus a `rel`, because the pair is what makes the
   * new tab safe: `target="_blank"` without `rel="noopener"` hands the opened
   * document a handle on this one. A caller cannot get half of it right.
   *
   * Default off. An internal door stays in the tab the visitor is already in.
   */
  newTab?: boolean
}

/**
 * A row whose third column carries data: a price, a count, a percent, a delta.
 * A Ledger of these requires `source`; see V3LedgerProps.
 */
export type V3LedgerFigureRow = V3LedgerRowBase & {
  /**
   * The figure, already formatted by the caller (formatPrice, a count, a percent).
   * A string, so this primitive cannot round a number differently from the source
   * trace printed beneath the list.
   */
  value: V3Text
}

/**
 * A row with no value column: saved searches, open houses, report links. The grid
 * collapses the third column to zero width, so the two-column row keeps the same
 * rhythm as a figure row without a placeholder.
 */
export type V3LedgerPlainRow = V3LedgerRowBase & {
  value?: never
}

export type V3LedgerRow = V3LedgerFigureRow | V3LedgerPlainRow

/**
 * At least one row, enforced by the tuple head, the same technique V3Quiet uses for
 * its outbound edges. Build a dynamic set as `[first, ...rest]` and handle the empty
 * case explicitly:
 *
 * ```tsx
 * const [first, ...rest] = sales
 * return first ? (
 *   <V3Ledger heading={title} rows={[first, ...rest]} source={trace} />
 * ) : (
 *   <V3Ledger heading={title} rows={[]} emptyMessage={v3Text('No sales closed in this window.')} />
 * )
 * ```
 */
export type V3LedgerRows<R extends V3LedgerRow> = readonly [R, ...R[]]

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

export type V3LedgerAction = {
  /** The visible label, and therefore the control's accessible name. */
  label: V3Text
  href: string
  variant?: V3ButtonVariant
}

type V3LedgerBase = {
  /**
   * The section title, and the accessible name of the region. Required, and non-empty
   * by type, so the region is a landmark and the `<h2>` is a real heading.
   */
  heading: V3Text
  /** 1 only when the Ledger opens the page (Saved). Defaults to 2. */
  headingLevel?: 1 | 2
  /** The context line above the heading: the place, the window, the filter. */
  eyebrow?: V3Text
  /** One sentence under the heading when the list needs a stated basis. */
  note?: V3Text
  /** The one ask this list earns, if it earns one. Ghost by default: the rows are the point. */
  action?: V3LedgerAction
  /**
   * The caveat that belongs to these rows, under the list. `note` states the
   * basis before a visitor reads the list; this states what the list does not
   * establish after they have.
   *
   * A ReactNode, not text, for one reason: a provenance caveat usually ends by
   * naming the index the rows were copied from, and that name is a link. Splitting
   * it out would either drop the attribution or turn the last sentence of a caveat
   * into a control. Nothing here computes an accessible name, which is why this is
   * the one slot in the pattern that is not `V3Text`: put prose and at most a plain
   * link in it, never a button, a heading, or a figure.
   */
  footnote?: ReactNode
  /** Sets the section id and, from it, the heading id used by aria-labelledby. */
  id?: string
  className?: string
}

/**
 * The section 0 trace for the figures in the value column, without the word "Source"
 * (the source line renders that prefix), plus the freshness stamp that goes with it.
 *
 * `updated` is a PREFORMATTED string, not a date. The atom's `updatedAt` prop runs a
 * raw value through formatDate, which fails silently twice: `'2026-08-12'`, the
 * ordinary shape of a Postgres `date` column, parses as UTC midnight and prints
 * "Aug 11, 2026" in Pacific, a day early inside the trace itself; and an unparseable
 * value prints a lone em dash, which claims a refresh happened while replacing the
 * timestamp with punctuation. Both are invisible to the caller. So the caller formats
 * the stamp with lib/format/date and hands over the finished string, exactly as it
 * already does for `value`, `when`, and `detail`.
 */
type V3LedgerTraced = {
  source: V3Text
  updated?: V3Text
}

/** No figures, so no trace, and `updated` cannot exist without the source it stamps. */
type V3LedgerUntraced = {
  source?: never
  updated?: never
}

type V3LedgerTrace = V3LedgerTraced | V3LedgerUntraced

/**
 * Three shapes, and the type will not let a caller land between them:
 *
 * 1. Rows whose value column carries figures. `source` is REQUIRED. PUBLIC_UI.md
 *    section 2 renders every figure with its trace available, and a Ledger is the
 *    pattern defined by its number column.
 * 2. Rows with no value column (saved searches, open houses). A trace is allowed and
 *    not required, because there is no figure to trace.
 * 3. No rows at all, which REQUIRES `emptyMessage`. The section still renders, and it
 *    states why it is empty in the caller's words. A zero-row query is a fact worth
 *    printing, so the trace stays available here too.
 */
export type V3LedgerProps =
  | (V3LedgerBase &
      V3LedgerTraced & {
        /** The rows, in the order the visitor should read them. */
        rows: V3LedgerRows<V3LedgerFigureRow>
        emptyMessage?: never
      })
  | (V3LedgerBase &
      V3LedgerTrace & {
        rows: V3LedgerRows<V3LedgerPlainRow>
        emptyMessage?: never
      })
  | (V3LedgerBase &
      V3LedgerTrace & {
        rows: readonly []
        /**
         * Why the list is empty, in the caller's words. Required with zero rows: an
         * empty state states its reason, and this primitive will not write that
         * reason on the caller's behalf.
         */
        emptyMessage: V3Text
      })

/**
 * RULE: no chevrons, no cards, no zebra striping. The hairline is the separator and
 * the row itself is the target. The only motion is the 200ms hover and focus wash,
 * which encodes that the row under the cursor is the one that will open.
 */
export function V3Ledger(props: V3LedgerProps) {
  const {
    heading,
    headingLevel = 2,
    eyebrow,
    note,
    source,
    updated,
    emptyMessage,
    action,
    footnote,
    id,
    className,
  } = props

  const rows: readonly V3LedgerRow[] = props.rows
  const isEmpty = rows.length === 0

  // Unreachable through the type: the empty variant requires emptyMessage. Still
  // reachable from untyped JS, where the old behavior was `return null`: the whole
  // section vanished from the page the day a query came back empty, with no reason
  // stated and no signal to QA. Fail loudly instead.
  if (isEmpty && !emptyMessage) {
    throw new Error(
      'V3Ledger: rows is empty and emptyMessage is missing. An empty Ledger renders ' +
        'the reason it is empty; it never renders nothing.',
    )
  }

  const headingId = id ? `${id}-heading` : undefined

  // The trace and its stamp are two already-formatted strings joined the way the atom
  // joins them. Nothing here parses or formats a date.
  const trace = source && updated ? `${source} · updated ${updated}` : source

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-ledger', className)}
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : heading}
    >
      <div className="v3-ledger__head">
        {eyebrow ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id={headingId}>
          {heading}
        </V3Heading>
        {note ? <p className="v3-ledger__note">{note}</p> : null}
      </div>

      {isEmpty ? (
        <p className="v3-ledger__empty">{emptyMessage}</p>
      ) : (
        <ul className="v3-ledger__list">
          {rows.map((row) => (
            <li key={row.id ?? row.href} className="v3-ledger__item">
              <Link
                href={row.href}
                className="v3-ledger__row"
                aria-label={row.ariaLabel}
                target={row.newTab ? '_blank' : undefined}
                rel={row.newTab ? 'noopener noreferrer' : undefined}
              >
                <span className="v3-ledger__when">{row.when}</span>
                <span
                  className={cn('v3-ledger__what', row.media && 'v3-ledger__what--media')}
                >
                  {row.media ? (
                    /* Plain img, not next/image: these are owned files under public/
                       and remote MLS photo URLs in the same column, and the row must
                       render identically for both without depending on image-host
                       configuration. Decorative by construction — see `media`. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="v3-ledger__thumb"
                      src={row.media.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <span className="v3-ledger__label">
                    {row.what}
                    {row.detail ? (
                      <span className="v3-ledger__detail">{row.detail}</span>
                    ) : null}
                  </span>
                </span>
                {row.value ? (
                  <span className="v3-ledger__value">{row.value}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {footnote ? <p className="v3-ledger__footnote">{footnote}</p> : null}

      {trace ? (
        <V3SourceLine source={trace} className="v3-ledger__source" />
      ) : null}

      {action ? (
        <div className="v3-ledger__action">
          <V3Button href={action.href} variant={action.variant ?? 'ghost'}>
            {action.label}
          </V3Button>
        </div>
      ) : null}
    </section>
  )
}
