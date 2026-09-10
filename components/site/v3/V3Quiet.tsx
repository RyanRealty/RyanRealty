/**
 * PATTERN 6: QUIET.
 *
 * "Hairline-separated supporting content (FAQ, proof, definitions, legal,
 * related links). Near-zero visual weight; carries the graph's outbound edges."
 * (design_system/public/PUBLIC_UI.md section 3, locked 2026-08-11.) No card, no
 * fill, no shadow: a rule, a lead-in, and either a destination or a short body.
 * It closes a node without competing with the answer above it, so it never
 * carries a primary action.
 *
 * WHAT SITE-40 CHANGED (taste table 2026-09-08). Six page classes — invest 25,
 * compare 29, about 31, market-report 41, reviews 48, contact 49, the bottom of
 * the whole site — OPEN on this primitive rather than closing on it, and the
 * evaluators named the same three causes on all six. (1) A prose-only item kept
 * the 72rem block and set its words at the 44rem measure, so a full-width
 * hairline ran under a two-thirds-empty row: "an unfinished card, not
 * restraint". Now a passage with nothing beside it IS the measure — one grid
 * track, and the rule stops where the words stop. (2) A passage could not carry
 * the live count the page had already fetched, so a page whose job is "here is
 * the inventory, here is the math" opened with no number. Now it can, in the
 * column that used to be void, with the §0 trace beside it. (3) N doors
 * rendered as N identical hairline rows — seven on /about, five on the market
 * hub, four on /reviews — which is TASTE.md's "scrolling lists as the design"
 * applied to a link menu. Now consecutive doors are ONE group: 2-up (3-up past
 * 60rem), each with the mark of the channel it opens, one of them able to lead,
 * and each able to print a live figure with its own source line. A narrow
 * viewport therefore reaches a face, a figure, or a map in half the scroll it
 * used to take.
 *
 * The pattern set is closed, so this primitive covers every shape section 3
 * names, not only the links slice. An item is either a door (`kind: 'link'`) or
 * a passage (`kind: 'prose'`): a question and its answer, a term and its
 * definition, or a titleless paragraph run for legal and proof. That is why
 * About can open on Quiet + Sheet without a caller reshaping its content to fit.
 *
 * MOUNTING: this section puts V3_ROOT_CLASS on its own outermost element, so
 * ./tokens.css resolves whether or not an ancestor already opened the scope
 * (re-declaring it is idempotent). Nothing here depends on a caller remembering
 * a class: without the scope every token in this pattern is invalid at computed
 * value time, which silently deletes the hairline that IS the pattern, the 44px
 * touch minimum, and the focus ring.
 *
 * WHAT IS MECHANICAL HERE, AND WHAT IS NOT. An earlier revision claimed the type
 * made "no dead ends" a compile error, through a non-empty tuple. It did not.
 * This repo's tsconfig sets `strict` without `noUncheckedIndexedAccess`, so
 * `[rows[0], ...rows.slice(1)]` type-checks against an empty array, hands the
 * tuple an `undefined` head, and throws on the first property read during the
 * server render: a 500, which is strictly worse than the dead end the tuple was
 * meant to prevent. The tuple also refused an ordinary `.filter()` result, so
 * the remaining caller path was a cast that erased the guarantee outright.
 *
 * The guarantee now sits where it can actually hold, at render: an item with no
 * destination or no text is dropped rather than rendered nameless, and a block
 * with nothing left to show returns null rather than shipping a bare rule. A
 * caller passing zero exits has a dead end to fix in its own data; it does not
 * get this primitive's crash.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./tokens.css, next/link, and @/lib/utils. Nothing
 *    from the deleted KB register, components/site (flat), components/site/primitives,
 *    components/site/explore, or components/ui.
 *  - The region's name is required in the type AND it can only be given once:
 *    the props are a union of `heading` (a visible title, which becomes the
 *    name) or `ariaLabel` (no visible title). Passing both is a compile error,
 *    so the programmatic name and the visible title cannot diverge. A name that
 *    is only whitespace is not a name: it is trimmed away at render, and the
 *    element then renders as a plain container rather than as a landmark whose
 *    label a screen reader cannot read.
 *  - Every color, size, rule, and duration comes from ./tokens.css. No raw hex,
 *    and no hardcoded travel: the direction mark moves by --v3-travel, which
 *    collapses to 0 under prefers-reduced-motion.
 *  - No 'use client'. Pure server component: no state, no effects, no fetch, and
 *    no hooks, which is why the heading id derives from `id` rather than useId.
 */
import { Fragment } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  V3Eyebrow,
  V3Figure,
  V3Heading,
  V3SourceDisclosure,
  V3SourceLine,
  V3_ROOT_CLASS,
} from './atoms'
import { QUIET_MARK_ICON, V3Icon } from './V3Icon'
import './tokens.css'
import './V3Quiet.css'

/**
 * A figure a Quiet item carries, with the §0 trace that makes it publishable.
 *
 * WHY QUIET HOLDS A FIGURE AT ALL (SITE-40, taste table 2026-09-08). The six
 * lowest-scoring page classes on the site all open on this primitive, and the
 * evaluators named the same cause on each: a prose item reserved the right ~45%
 * of the content width and rendered it empty, and the page's own live count —
 * already fetched, already traced — had nowhere to sit above the fold. So the
 * slot exists, and the trace is REQUIRED rather than optional: a number without
 * its source does not render (CLAUDE.md §0). The caller formats the value; this
 * primitive never does arithmetic on a figure it could then disagree with the
 * trace about, the same rule V3Ledger's bar encode follows.
 */
export type V3QuietFigure = {
  /** The number as it should read, already formatted by the caller. */
  value: string
  /**
   * What the number is. Required on a passage's figure, where nothing else
   * names it; a door's figure may omit it because the door's own label is the
   * name, and the unit rides in `unit`.
   */
  label?: string
  /** The unit or basis printed beside a door's figure ("months", "for sale"). */
  unit?: string
  /** The §0 trace. Without it the figure is dropped, not printed unsourced. */
  source: string
  /**
   * The source's name in a visitor's words, for the one-clause source line
   * ("Central Oregon MLS, single-family, live"). The trace above still names
   * the table and the filter — that is what the disclosure opens to. Without
   * this, V3SourceLine derives the clause from the trace's leading segment,
   * which is how "Market Truth region row" reached the market hub's fold
   * (evaluator, 2026-09-09: an internal label handed to a visitor).
   */
  sourceName?: string
  /** When the figure was read. Rendered through the canonical formatter. */
  updatedAt?: string | number | Date | null
  /**
   * The figure as a share of its own ceiling, 0..1 (a 5.0 rating is 1; 4.9
   * months of supply against the six-month buyer's line is 0.82). Drawn as a
   * thin meter under the value — one ratio, one meter (dataviz SKILL) — so a
   * door's number carries an encoding and not only a numeral.
   */
  ratio?: number
}

/**
 * The channel a door opens. It is what stops N doors from being N identical
 * hairline rows — the defect the taste table named on /about (seven), /reviews
 * (four) and /housing-market (five). Derived from the href when the caller says
 * nothing, so an existing `{ label, href }` picks up its mark for free.
 */
export type V3QuietMark =
  | 'call'
  | 'text'
  | 'email'
  | 'schedule'
  | 'person'
  | 'review'
  | 'market'
  | 'supply'
  | 'history'
  | 'map'
  | 'page'
  | 'external'

/**
 * An outbound edge. `kind` is optional so the common case stays a bare
 * `{ label, href }`.
 */
export type V3QuietLink = {
  kind?: 'link'
  /** The visible row text, and therefore the link's accessible name. */
  label: string
  /** Where the edge goes. Internal path or absolute URL. */
  href: string
  /** Optional hash target when a door itself is a landing. */
  id?: string
  /** One quiet line under the label: what is behind the door. */
  detail?: string
  /**
   * A live figure the reader sees BEFORE tapping, with its trace. This is what
   * turns a routing menu into a page that carries data: the market hub's five
   * doors print months of supply, the region's active count, and the closed
   * year rather than five bare labels.
   */
  figure?: V3QuietFigure
  /**
   * The one dominant door of its run. It spans the group, opens on the section
   * rule instead of a hairline, and carries its label at the larger size — the
   * hierarchy TASTE.md asks for in place of N equal cells.
   */
  lead?: boolean
  /** Override the channel mark derived from `href`. */
  mark?: V3QuietMark
  /**
   * A face or a place standing in for the channel mark: a small owned image
   * (a broker headshot under public/, a map still) drawn in the mark's slot.
   * The evaluator's second pass on /about (2026-09-09) named seven marked doors
   * "an icon card grid": a glyph differentiates doors from each other, but a
   * photograph differentiates the PERSON door from every other door on the
   * site, which is the thing a reader came to an about page for. Owned files
   * only; never a remote URL.
   */
  media?: { src: string; alt: string }
  /**
   * `secondary`: a lighter door. Consecutive secondary doors render as ONE
   * inline line (mark + label, no arrow, no row of their own) instead of a
   * cell each. This is the node's "one dominant door plus lighter secondary
   * links": on /about the four ways to reach the principal broker are one
   * line under the door that is him, not four more rows in the grid.
   */
  weight?: 'secondary'
}

/**
 * A passage. One shape covers what section 3 lists beside related links:
 * `term` + `body` is an FAQ question and its answer or a term and its
 * definition; `body` alone is a legal paragraph, a disclosure, or a proof note.
 */
export type V3QuietProse = {
  kind: 'prose'
  /**
   * The question, the term, or the passage's title. When present the pair
   * renders as a description list, so the body is tied to its lead-in
   * programmatically rather than by proximity.
   */
  term?: string
  /** The answer, definition, or passage. One string is one paragraph. */
  body: string | readonly string[]
  /**
   * Hash target for in-page jumps (a dictionary term a `?` on another page
   * lands on). Optional. The id is on the row, not derived from `term`.
   */
  id?: string
  /**
   * The measured half of the passage. With one, the item splits into the text
   * measure and a figure column and the row spans the block; without one, the
   * item IS the text measure and its hairline stops where the words stop,
   * because a full-width rule under a 44rem paragraph is what the evaluators
   * read as "an unfinished card, not restraint".
   */
  figure?: V3QuietFigure
  /**
   * The §0 trace for a passage that states its number IN WORDS, with no figure
   * column. Until this existed the only outlet for a trace was `figure`, which
   * forced a section to print its number twice — once in the sentence and once
   * as a display numeral — to be allowed to cite it. On /subdivisions the
   * separate evaluator scored exactly that: three sections in a row resolving
   * to the same eyebrow-heading-bignumber-source cell, and when #outcomes
   * dropped its numeral to break the repeat, the trace had nowhere to go but
   * the section-level `source`, which then collided with the door's own
   * citation ("two bare SOURCE rows touching each other", 2026-09-09).
   * A passage's trace belongs under the passage.
   */
  source?: string
  /** The plain-words clause shown before the trace opens. See V3QuietFigure. */
  sourceName?: string
  /** When the passage's figures were read. Rendered through the formatter. */
  updatedAt?: string
}

/**
 * A measured pair: a label and its figure. The row a `·`-joined sentence was
 * standing in for.
 *
 * WHY THIS EXISTS. The community pages hold fully structured data — an HOA
 * annual, drive times as `{minutes, destination}`, membership tiers as
 * `{name, price, waitlist_status}`, course specs — and every one of them was
 * being join(' · ')'d into a paragraph, which is how `#belonging` became a
 * 2,974px essay of facts nobody can scan or compare. A fact row keeps the
 * structure the data already has.
 *
 * `weight` draws the value as a length beside it. It is a SHARE, 0 to 1,
 * computed by the caller from the same numbers it formatted — the primitive
 * never does arithmetic on a figure it could then disagree with the trace
 * about, which is the rule V3Ledger's bar encode already follows.
 */
export type V3QuietFact = {
  kind: 'fact'
  /** The label. Left column. */
  term: string
  /** The figure, already formatted by the caller through lib/format. */
  value: string
  /** A second, quieter line under the value: a basis, a caveat, a status. */
  detail?: string
  /** 0..1 share of the row set's largest. Out of range draws nothing. */
  weight?: number
  id?: string
}

/**
 * A named set of short labels — amenities in a category, builders, the
 * subdivisions inside a place. Not doors and not figures: a list whose shape is
 * "how many, and which", which reads as a set and not as a sentence.
 */
export type V3QuietChips = {
  kind: 'chips'
  /** What the set is. */
  term: string
  /** The labels, in the caller's order. Blank entries are dropped. */
  labels: readonly string[]
  id?: string
}

/**
 * A passage the reader opens. The same native disclosure the footer sitemap and
 * the Atlas source note use — no client JS, works before hydration, and the
 * summary carries a word count so the reader knows what they are opening.
 *
 * It exists because a place page's authored story is five or six paragraphs and
 * a section cannot both lead with its figures and print an essay above them. A
 * look rule may not delete content; it may decide what is open by default.
 */
export type V3QuietFold = {
  kind: 'fold'
  /** The summary line. What the reader is opening. */
  term: string
  /** The paragraphs inside. One string is one paragraph. */
  body: string | readonly string[]
  id?: string
}

export type V3QuietItem = V3QuietLink | V3QuietProse | V3QuietFact | V3QuietChips | V3QuietFold

/**
 * A Quiet block is named once. Either it shows a title, and that title is the
 * region's name, or it shows none and carries an invisible one. Supplying both
 * is how a region's spoken name silently drifts from its visible one, so the
 * union refuses it at compile time.
 */
type V3QuietNaming =
  | {
      /** The visible title, and the region's accessible name. */
      heading: string
      /** 2 by default. A Quiet block is supporting content, so 1 is rare. */
      headingLevel?: 1 | 2
      ariaLabel?: never
    }
  | {
      heading?: never
      headingLevel?: never
      /**
       * The region's accessible name when it shows no title, for example
       * "Related places" or "Selling questions". A landmark a screen reader
       * cannot name is a landmark it cannot skip to.
       */
      ariaLabel: string
    }

export type V3QuietProps = {
  /**
   * The rows, in reading order: doors, questions, definitions, passages. A
   * plain array, so a set built by `.filter()` passes without a cast.
   */
  items: readonly V3QuietItem[]
  /**
   * One quiet line under the rows: a caveat, a disclosure, a basis. Plain text.
   * A number belongs in an Instrument with its source line, not here.
   */
  note?: string
  /**
   * The §0 trace for a Quiet block whose `kind: 'fact'` rows carry AUTHORED
   * facts — a founding year, an acreage, a course architect, a published
   * ranking. Rendered as V3SourceDisclosure — the collapsed form the rest of
   * the site uses when a trace names more publishers or filters than fit on one
   * line (atoms.tsx, Matt 2026-08-19). Tetherow's record cites ten distinct
   * publishers; as a visible paragraph that would be louder than the facts it
   * explains, and cutting it to fit would be the wrong half to lose.
   *
   * WHY QUIET NEEDED ONE. Quiet's contract says it never carries a figure, and
   * that is still true of a MARKET figure — those belong in an Instrument with
   * its own trace. But a fact row IS a claim, and the community page's
   * Belonging block shipped four of them unsourced ("Founded 2008", "Acres
   * 700", "Course architect David McLay Kidd", "Ranked #57"), which two
   * separate evaluator rounds recorded as an honesty defect. `note` was the
   * only outlet and it renders as a caveat, not a source. Optional: a Quiet
   * holding only doors and prose passes none and renders exactly as before.
   */
  source?: string
  /**
   * The visible uppercase context line above the block. A label, never the
   * region's name.
   */
  eyebrow?: string
  id?: string
  className?: string
} & V3QuietNaming

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

/** Trimmed text, or nothing. An empty string is not a label and not a name. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function paragraphs(body: V3QuietProse['body']): string[] {
  const lines = typeof body === 'string' ? [body] : body
  return lines.map((line) => line.trim()).filter((line) => line.length > 0)
}

/** A figure survives normalization only with a value AND a trace (§0). */
function figureOf(figure: V3QuietFigure | undefined): V3QuietFigure | undefined {
  if (!figure) return undefined
  const value = text(figure.value)
  const source = text(figure.source)
  if (!value || !source) return undefined
  return {
    value,
    source,
    ...(text(figure.label) ? { label: text(figure.label) as string } : {}),
    ...(text(figure.unit) ? { unit: text(figure.unit) as string } : {}),
    ...(text(figure.sourceName) ? { sourceName: text(figure.sourceName) as string } : {}),
    ...(figure.updatedAt == null ? {} : { updatedAt: figure.updatedAt }),
    ...(typeof figure.ratio === 'number' && Number.isFinite(figure.ratio)
      ? { ratio: Math.min(1, Math.max(0, figure.ratio)) }
      : {}),
  }
}

/**
 * The channel a door opens, read off its own href. tel/sms/mailto are exact;
 * a handful of house routes have a mark of their own; everything internal is a
 * page and everything else is external. Never guesses from the label, which is
 * copy and changes.
 */
function markFor(href: string, override: V3QuietMark | undefined): V3QuietMark {
  if (override) return override
  const value = href.trim()
  const lower = value.toLowerCase()
  if (lower.startsWith('tel:')) return 'call'
  if (lower.startsWith('sms:')) return 'text'
  if (lower.startsWith('mailto:')) return 'email'
  if (lower.startsWith('http://') || lower.startsWith('https://')) return 'external'
  const path = lower.split(/[?#]/)[0] ?? ''
  if (path.startsWith('/book') || path.includes('schedul')) return 'schedule'
  if (path.startsWith('/reviews')) return 'review'
  if (
    path.startsWith('/housing-market') ||
    path.startsWith('/months-of-supply') ||
    path.startsWith('/reports') ||
    path.startsWith('/market')
  ) {
    return 'market'
  }
  if (
    path.startsWith('/cities') ||
    path.startsWith('/communities') ||
    path.startsWith('/neighborhoods') ||
    path.startsWith('/subdivisions') ||
    path.startsWith('/zip') ||
    path.startsWith('/oregon')
  ) {
    return 'map'
  }
  return 'page'
}

type RenderableLink = {
  kind: 'link'
  label: string
  href: string
  id?: string
  detail?: string
  figure?: V3QuietFigure
  lead: boolean
  mark: V3QuietMark
  media?: { src: string; alt: string }
  secondary: boolean
}

type RenderableItem =
  | RenderableLink
  | {
      kind: 'prose'
      term: string | undefined
      body: string[]
      id?: string
      figure?: V3QuietFigure
      source?: string
      sourceName?: string
      updatedAt?: string
    }
  | {
      kind: 'fact'
      term: string
      value: string
      detail: string | undefined
      weight: number | undefined
      id?: string
    }
  | { kind: 'chips'; term: string; labels: string[]; id?: string }
  | { kind: 'fold'; term: string; body: string[]; id?: string }

/**
 * Drops what cannot be rendered honestly: a link with no label would ship an
 * anchor with no accessible name (WCAG 2.4.4 and 4.1.2, and the arrow beside it
 * is aria-hidden so there is no second chance at a name), a link with no href
 * is not a door, and a passage with no body is a dangling lead-in.
 */
function toRenderable(items: readonly V3QuietItem[]): RenderableItem[] {
  const out: RenderableItem[] = []

  for (const item of items) {
    // A hole is dropped, never dereferenced. Without `noUncheckedIndexedAccess`
    // an expression like `items={[rel[0]]}` type-checks against an empty array
    // and arrives here as undefined; reading `.kind` off it is the 500 this
    // primitive used to ship.
    if (!item || typeof item !== 'object') continue

    if (item.kind === 'prose') {
      const body = paragraphs(item.body)
      if (body.length === 0) continue
      out.push({
        kind: 'prose',
        term: text(item.term),
        body,
        id: text(item.id),
        figure: figureOf(item.figure),
        // A passage's own trace. Dropped rather than rendered empty, the way
        // every other optional here is: an unsourced disclosure control is
        // worse than none.
        ...(text(item.source) ? { source: text(item.source) as string } : {}),
        ...(text(item.sourceName) ? { sourceName: text(item.sourceName) as string } : {}),
        ...(text(item.updatedAt) ? { updatedAt: text(item.updatedAt) as string } : {}),
      })
      continue
    }

    if (item.kind === 'fact') {
      const term = text(item.term)
      const value = text(item.value)
      // A fact is the pair. Half of one is a dangling label or a naked number.
      if (!term || !value) continue
      out.push({
        kind: 'fact',
        term,
        value,
        detail: text(item.detail),
        // Out of range draws nothing rather than clamping: a share above 1 is a
        // caller bug, and a bar silently pinned to full width hides it.
        weight:
          typeof item.weight === 'number' && item.weight >= 0 && item.weight <= 1
            ? item.weight
            : undefined,
        id: text(item.id),
      })
      continue
    }

    if (item.kind === 'fold') {
      const term = text(item.term)
      const body = paragraphs(item.body)
      if (!term || body.length === 0) continue
      out.push({ kind: 'fold', term, body, id: text(item.id) })
      continue
    }

    if (item.kind === 'chips') {
      const term = text(item.term)
      const labels = item.labels.map((l) => text(l)).filter((l): l is string => !!l)
      if (!term || labels.length === 0) continue
      out.push({ kind: 'chips', term, labels, id: text(item.id) })
      continue
    }

    const label = text(item.label)
    const href = text(item.href)
    if (!label || !href) continue
    out.push({
      kind: 'link',
      label,
      href,
      id: text(item.id),
      detail: text(item.detail),
      figure: figureOf(item.figure),
      lead: item.lead === true,
      secondary: item.weight === 'secondary' && item.lead !== true,
      mark: markFor(href, item.mark),
      ...(item.media && text(item.media.src)
        ? { media: { src: text(item.media.src) as string, alt: text(item.media.alt) ?? '' } }
        : {}),
    })
  }

  return out
}

/**
 * Consecutive doors are ONE group, not N rows.
 *
 * The taste table's most repeated finding across the six lowest classes was a
 * vertical run of identical hairline rows — "a table wearing hairlines applied
 * to a link menu". A run is what the group fixes: doors sit 2-up (3-up past
 * 60rem) so no two consecutive siblings share a left edge, each carries its
 * channel mark, and one may lead. Everything that is not a door still renders
 * as its own row, so a mixed block keeps its reading order exactly.
 */
type RenderableBlock =
  | { kind: 'doors'; doors: RenderableLink[]; index: number }
  | { kind: 'row'; item: Exclude<RenderableItem, RenderableLink>; index: number }

/**
 * Inside one doors group, consecutive secondary doors fold into one inline
 * line. The group keeps its order: [lead] [inline: call · text · email] [door]
 * renders in that sequence.
 */
type DoorRun = { kind: 'cell'; door: RenderableLink } | { kind: 'inline'; doors: RenderableLink[] }

function toDoorRuns(doors: RenderableLink[]): DoorRun[] {
  const runs: DoorRun[] = []
  for (const door of doors) {
    const last = runs[runs.length - 1]
    if (door.secondary) {
      if (last && last.kind === 'inline') {
        last.doors.push(door)
        continue
      }
      runs.push({ kind: 'inline', doors: [door] })
      continue
    }
    runs.push({ kind: 'cell', door })
  }
  return runs
}

function toBlocks(items: RenderableItem[]): RenderableBlock[] {
  const blocks: RenderableBlock[] = []
  for (const [index, item] of items.entries()) {
    if (item.kind === 'link') {
      const last = blocks[blocks.length - 1]
      if (last && last.kind === 'doors') {
        last.doors.push(item)
        continue
      }
      blocks.push({ kind: 'doors', doors: [item], index })
      continue
    }
    blocks.push({ kind: 'row', item, index })
  }
  return blocks
}

/* -------------------------------------------------------------------------- */
/* Channel marks                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The per-channel mark. Iconoir through V3Icon except MOS (`supply`), which is
 * the two-bar drawing, not a catalog glyph. One thin navy stroke, currentColor,
 * no fill, aria-hidden. These are marks, not a card grid of icons: they
 * differentiate doors that would otherwise be identical rows, and they never
 * appear without the label they mark.
 */
function DoorMark({ mark }: { mark: V3QuietMark }) {
  if (mark === 'supply') {
    /* The MOS drawing, at mark size: homes for sale over a month of sales. */
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          d="M3.5 6.5h13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M3.5 13.5h5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return <V3Icon name={QUIET_MARK_ICON[mark]} size={20} />
}


/** One door cell: the mark or the face, the label, the arrow, a figure with its meter, a detail, and the §0 clause outside the anchor. */
function DoorCell({ door }: { door: RenderableLink }) {
  return (
    <li
      id={door.id}
      className={cn(
        'v3-quiet__door',
        door.lead && 'v3-quiet__door--lead',
        door.figure && 'v3-quiet__door--figured',
        door.media && 'v3-quiet__door--pictured',
      )}
    >
            <Link href={door.href} className="v3-quiet__link">
              {door.media ? (
                /* Plain img, not next/image: an owned file under
                   public/, sized by CSS, the same rule V3Ledger's
                   thumbs follow. The alt names the person or the
                   place; the mark it replaces was aria-hidden. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="v3-quiet__doormedia"
                  src={door.media.src}
                  alt={door.media.alt}
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span aria-hidden="true" className="v3-quiet__doormark">
                  <DoorMark mark={door.mark} />
                </span>
              )}
              <span className="v3-quiet__label">{door.label}</span>
              <span aria-hidden="true" className="v3-quiet__mark">
                &rarr;
              </span>
              {door.figure ? (
                <span className="v3-quiet__doorfigure">
                  <span className="v3-quiet__doorvalue">{door.figure.value}</span>
                  {door.figure.unit ? (
                    <span className="v3-quiet__doorunit">{door.figure.unit}</span>
                  ) : null}
                  {door.figure.ratio != null ? (
                    <span className="v3-quiet__doormeter" aria-hidden="true">
                      <span style={{ width: `${(door.figure.ratio * 100).toFixed(1)}%` }} />
                    </span>
                  ) : null}
                </span>
              ) : null}
              {door.detail ? (
                <span className="v3-quiet__doordetail">{door.detail}</span>
              ) : null}
            </Link>
            {door.figure ? (
              <V3SourceLine
                source={door.figure.source}
                sourceName={door.figure.sourceName ?? undefined}
                updatedAt={door.figure.updatedAt ?? undefined}
                className="v3-quiet__doorsource"
              />
            ) : null}
              </li>
  )
}

/* -------------------------------------------------------------------------- */
/* V3Quiet                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The closing block of a node. Every link row is a door, styled at the lightest
 * weight the design language allows: a hairline above, the label in body Geist,
 * and a direction mark that travels by --v3-travel on hover or focus. That
 * travel is the only motion here and it encodes a state change the visitor
 * caused, per PUBLIC_UI.md section 5. Under reduced motion the token collapses
 * to 0 and the duration collapses with it, so nothing moves at all.
 */
export function V3Quiet({
  items,
  heading,
  headingLevel = 2,
  ariaLabel,
  note,
  source,
  eyebrow,
  id,
  className,
}: V3QuietProps) {
  const rendered = toRenderable(items)
  const title = text(heading)
  const trailingNote = text(note)
  const sourceLine = text(source)
  const contextLine = text(eyebrow)
  const name = title ?? text(ariaLabel)

  if (process.env.NODE_ENV !== 'production') {
    const dropped = items.length - rendered.length
    if (dropped > 0) {
      console.warn(
        `V3Quiet${name ? ` (${name})` : ''}: dropped ${dropped} item(s) with no text or no destination.`,
      )
    }
    if (rendered.length === 0 && !trailingNote) {
      console.warn(
        `V3Quiet${name ? ` (${name})` : ''}: nothing to render, so the section was omitted. A node closing on Quiet needs at least one exit.`,
      )
    }
  }

  // Nothing to say: render nothing. A bare rule under a title is the visual
  // equivalent of a dead end, and this primitive will not invent the content
  // that would fill it.
  if (rendered.length === 0 && !trailingNote) return null

  // No hooks in a server component, so the heading id comes from the caller's
  // id. Without one the region falls back to naming itself with the same text.
  const headingId = title && id ? `${id}-heading` : undefined

  /**
   * The trace goes with the FACTS, not at the bottom of the block.
   *
   * A Quiet block is not homogeneous: #belonging opens on four authored fact
   * rows and then runs another two thousand pixels of chips, drive times,
   * membership and prose. Rendering the source after the whole list put it that
   * far from the only rows it describes, and the round-two evaluator recorded
   * exactly that — "orphaned ~2000px below the facts it covers". So it closes
   * the fact run instead: the last `kind: 'fact'` row, and everything after it
   * carries on below. A block with no fact rows keeps the trace at the end,
   * which is where a trace belongs when it describes the whole block.
   */
  const lastFactIndex = rendered.reduce(
    (last, item, index) => (item.kind === 'fact' ? index : last),
    -1,
  )

  const blocks = toBlocks(rendered)

  return (
    <section
      id={id}
      className={cn(
        V3_ROOT_CLASS,
        'v3-quiet',
        !contextLine && !title && 'v3-quiet--headless',
        className,
      )}
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : name}
    >
      {contextLine || title ? (
        <div className="v3-quiet__head">
          {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
          {title ? (
            <V3Heading
              level={headingLevel}
              id={headingId}
              className="v3-quiet__heading"
            >
              {title}
            </V3Heading>
          ) : null}
        </div>
      ) : null}

      {rendered.length > 0 ? (
        <ul className="v3-quiet__list">
          {blocks.map((block) => {
            if (block.kind === 'doors') {
              const doors = block.doors
              return (
                <li
                  key={`doors-${block.index}`}
                  className={cn(
                    'v3-quiet__item',
                    'v3-quiet__item--doors',
                    doors.length === 1 && 'v3-quiet__item--doors-one',
                  )}
                >
                  <ul className="v3-quiet__doors">
                    {toDoorRuns(doors).map((run, runIndex) =>
                      run.kind === 'inline' ? (
                        <li
                          key={`inline-${runIndex}`}
                          className="v3-quiet__door v3-quiet__door--inline"
                        >
                          <ul className="v3-quiet__inline">
                            {run.doors.map((door, doorIndex) => (
                              <li key={door.id ?? `${door.href}-${doorIndex}`} id={door.id}>
                                <Link href={door.href} className="v3-quiet__inlinelink">
                                  <span aria-hidden="true" className="v3-quiet__doormark">
                                    <DoorMark mark={door.mark} />
                                  </span>
                                  <span className="v3-quiet__label">{door.label}</span>
                                  {door.detail ? (
                                    <span className="v3-quiet__inlinedetail">{door.detail}</span>
                                  ) : null}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ) : (
                        <DoorCell key={run.door.id ?? `${run.door.href}-${runIndex}`} door={run.door} />
                      ),
                    )}
                  </ul>
                </li>
              )
            }

            const item = block.item
            const index = block.index
            return (
              <Fragment key={item.id ?? `${item.kind}-${index}`}>
                {item.kind === 'fact' ? (
                  <li id={item.id} className="v3-quiet__item v3-quiet__item--fact">
                    <dl className="v3-quiet__factpair">
                      <dt className="v3-quiet__factterm">{item.term}</dt>
                      <dd className="v3-quiet__factvalue">
                        <span className="v3-quiet__factfigure">{item.value}</span>
                        {item.detail ? (
                          <span className="v3-quiet__factdetail">{item.detail}</span>
                        ) : null}
                      </dd>
                    </dl>
                    {item.weight == null ? null : (
                      <div className="v3-quiet__factbar" aria-hidden="true">
                        <span style={{ width: `${(item.weight * 100).toFixed(1)}%` }} />
                      </div>
                    )}
                  </li>
                ) : item.kind === 'fold' ? (
                  <li id={item.id} className="v3-quiet__item v3-quiet__item--fold">
                    <details className="v3-quiet__fold">
                      <summary className="v3-quiet__foldsummary">
                        <span>{item.term}</span>
                        <span className="v3-quiet__foldcount">
                          {item.body.length === 1
                            ? '1 paragraph'
                            : `${item.body.length} paragraphs`}
                        </span>
                      </summary>
                      <div className="v3-quiet__body">
                        {item.body.map((line, lineIndex) => (
                          <p className="v3-quiet__para" key={lineIndex}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </details>
                  </li>
                ) : item.kind === 'chips' ? (
                  <li id={item.id} className="v3-quiet__item v3-quiet__item--chips">
                    <dl className="v3-quiet__pair">
                      <dt className="v3-quiet__term">{item.term}</dt>
                      <dd className="v3-quiet__chipset">
                        {item.labels.map((label) => (
                          <span className="v3-quiet__chip" key={label}>
                            {label}
                          </span>
                        ))}
                      </dd>
                    </dl>
                  </li>
                ) : (
                  <li
                    id={item.id}
                    className={cn(
                      'v3-quiet__item',
                      'v3-quiet__item--prose',
                      /* The measure IS the row when there is nothing to put beside
                         the words: one track, and the hairline stops where the
                         paragraph stops. */
                      item.figure ? 'v3-quiet__item--figured' : 'v3-quiet__item--measure',
                    )}
                  >
                    {item.figure ? (
                      <div className="v3-quiet__figure">
                        <V3Figure
                          value={item.figure.value}
                          label={item.figure.label ?? item.term ?? ''}
                        />
                        {/* The passage's trace is a paragraph-length one (a
                            table, a filter, a population), so it folds the way
                            every long trace on this site folds, and opening it
                            is the row's one interaction. A door's trace is one
                            clause and stays visible. */}
                        <V3SourceDisclosure
                          source={item.figure.source}
                          sourceName={item.figure.sourceName ?? undefined}
                          updatedAt={item.figure.updatedAt ?? undefined}
                          className="v3-quiet__figuresource"
                        />
                      </div>
                    ) : null}
                    {item.term ? (
                      <dl className="v3-quiet__pair">
                        <dt className="v3-quiet__term">{item.term}</dt>
                        <dd className="v3-quiet__body">
                          {item.body.map((line, lineIndex) => (
                            <p className="v3-quiet__para" key={lineIndex}>
                              {line}
                            </p>
                          ))}
                        </dd>
                      </dl>
                    ) : (
                      <div className="v3-quiet__body">
                        {item.body.map((line, lineIndex) => (
                          <p className="v3-quiet__para" key={lineIndex}>
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                    {/* The passage's own trace, under the passage, when the
                        number it documents is in the words rather than in a
                        figure column. */}
                    {item.source && !item.figure ? (
                      <V3SourceDisclosure
                        source={item.source}
                        sourceName={item.sourceName ?? undefined}
                        updatedAt={item.updatedAt ?? undefined}
                        className="v3-quiet__prosesource"
                      />
                    ) : null}
                  </li>
                )}
                {sourceLine && index === lastFactIndex ? (
                  <li className="v3-quiet__item v3-quiet__item--source">
                    <V3SourceDisclosure source={sourceLine} className="v3-quiet__source" />
                  </li>
                ) : null}
              </Fragment>
            )
          })}
        </ul>
      ) : null}
      {trailingNote ? <p className="v3-quiet__note">{trailingNote}</p> : null}
      {sourceLine && lastFactIndex < 0 ? (
        <V3SourceDisclosure source={sourceLine} className="v3-quiet__source" />
      ) : null}
    </section>
  )
}
