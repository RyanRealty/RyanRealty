/**
 * PATTERN 6: QUIET.
 *
 * "Hairline-separated supporting content (FAQ, proof, definitions, legal,
 * related links). Near-zero visual weight; carries the graph's outbound edges."
 * (design_system/public/PUBLIC_UI.md section 3, locked 2026-08-11.) No card, no
 * fill, no shadow: a rule, a lead-in, and either a destination or a short body.
 * It closes a node without competing with the answer above it, so it never
 * carries a primary action and never carries a figure.
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
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Quiet.css'

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
}

export type V3QuietItem = V3QuietLink | V3QuietProse

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
   * The visible uppercase context line above the block. A label, never the
   * region's name.
   */
  eyebrow?: string
  /**
   * Keep the first N items open. The rest sit behind a Read more disclosure
   * so a long About stays three paragraphs on first paint.
   */
  foldAfter?: number
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

type RenderableItem =
  | { kind: 'link'; label: string; href: string; id?: string }
  | { kind: 'prose'; term: string | undefined; body: string[]; id?: string }

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
      out.push({ kind: 'prose', term: text(item.term), body, id: text(item.id) })
      continue
    }

    const label = text(item.label)
    const href = text(item.href)
    if (!label || !href) continue
    out.push({ kind: 'link', label, href, id: text(item.id) })
  }

  return out
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
function QuietItem({ item, index }: { item: RenderableItem; index: number }) {
  return item.kind === 'link' ? (
    <li
      key={item.id ?? `link-${index}`}
      id={item.id}
      className="v3-quiet__item v3-quiet__item--link"
    >
      <Link href={item.href} className="v3-quiet__link">
        <span className="v3-quiet__label">{item.label}</span>
        <span aria-hidden="true" className="v3-quiet__mark">
          →
        </span>
      </Link>
    </li>
  ) : (
    <li
      key={item.id ?? `prose-${index}`}
      id={item.id}
      className="v3-quiet__item v3-quiet__item--prose"
    >
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
    </li>
  )
}

export function V3Quiet({
  items,
  heading,
  headingLevel = 2,
  ariaLabel,
  note,
  eyebrow,
  foldAfter,
  id,
  className,
}: V3QuietProps) {
  const rendered = toRenderable(items)
  const title = text(heading)
  const trailingNote = text(note)
  const contextLine = text(eyebrow)
  const name = title ?? text(ariaLabel)
  const foldAt =
    typeof foldAfter === 'number' && foldAfter > 0 && rendered.length > foldAfter
      ? foldAfter
      : rendered.length
  const openItems = rendered.slice(0, foldAt)
  const foldedItems = rendered.slice(foldAt)

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

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-quiet', className)}
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

      {openItems.length > 0 ? (
        <ul className="v3-quiet__list">
          {openItems.map((item, index) => (
            <QuietItem item={item} index={index} key={item.id ?? `open-${index}`} />
          ))}
        </ul>
      ) : null}

      {foldedItems.length > 0 ? (
        <details className="v3-quiet__more">
          <summary className="v3-quiet__more-summary">Read more</summary>
          <ul className="v3-quiet__list">
            {foldedItems.map((item, index) => (
              <QuietItem item={item} index={foldAt + index} key={item.id ?? `fold-${index}`} />
            ))}
          </ul>
        </details>
      ) : null}

      {trailingNote ? <p className="v3-quiet__note">{trailingNote}</p> : null}
    </section>
  )
}
