/**
 * PATTERN 8: ANSWERS. A set of questions the reader opens, with the page's
 * remaining edges beside them.
 *
 * Visual language: design_system/public/PUBLIC_UI.md, built on ./tokens.css.
 * The pattern set is OPEN (PUBLIC_UI.md section 3): a section whose job is not
 * one of the existing patterns is BUILT as a primitive here rather than
 * hand-rolled on a page. This is that build.
 *
 * WHY THIS EXISTS RATHER THAN A LONGER V3Quiet. Quiet renders a question and
 * its answer as a description list, every answer expanded, and its stylesheet
 * says so on purpose: "no disclosure widget: supporting content stays readable
 * and indexable rather than hiding behind a control." That decision predates
 * TASTE.md (Matt, 2026-09-01), which bans the wall of text by name — "a section
 * whose primary content is more than two paragraphs of prose with no figure,
 * image, map, or interactive element. FAQ blocks count. If the prose is needed
 * for search, it sits under a disclosure or beside a display, never as the
 * section." On /about the Quiet FAQ measured 1,491px at 1440 and 8 paragraphs
 * with no control, the tallest section on the page. Quiet keeps its job (prose
 * that must read as prose); a question set takes this one.
 *
 * INDEXABLE ANYWAY. `details` keeps every answer in the served HTML — a
 * crawler reads a closed disclosure exactly as it reads an open paragraph, and
 * the caller's FAQPage JSON-LD describes the same strings. Nothing is hidden
 * behind script, and the section works with JavaScript off.
 *
 * THE FORM. Two columns on a wide window: the heading and the outbound doors
 * hold the left rail, the questions hold the right. One column at 390, in
 * reading order (heading, questions, doors). The page it closes is not another
 * full-width hairline stack (TASTE.md: "the stacked-section page").
 *
 * Barrel law honored here:
 *  - Server component, native disclosure, works before hydration.
 *  - This primitive never fetches and never formats.
 *  - No raw color and no hardcoded motion: every value resolves through
 *    ./tokens.css in ./V3Answers.css, and the mark's motion reads
 *    --v3-dur-state, which reduced motion collapses.
 *  - Names are enforced at RENDER, the discipline V3Quiet states: a question
 *    with no text, an answer with no body, or a door with no label or href is
 *    dropped rather than shipped nameless, and a block with nothing left
 *    returns null rather than a bare rule. A plain `string` is taken so a set
 *    built by `.map()` over a page's content array needs no cast.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Answers.css'

export type V3Answer = {
  /** The question. It is the summary's text and the control's accessible name. */
  question: string
  /** The answer. One string is one paragraph. */
  body: string | readonly string[]
  /** Open on arrival. Use it on the first row so the control shows its work. */
  open?: boolean
  /** Hash target, for a `?` on another page landing on one question. */
  id?: string
}

/** An outbound edge, same shape as a Quiet door row. */
export type V3AnswersDoor = {
  /** The visible row text, and therefore the link's accessible name. */
  label: string
  href: string
}

export type V3AnswersProps = {
  id: string
  /** The visible title, and the region's accessible name. */
  heading: string
  /** 2 by default. This block closes a node, so 1 is wrong here. */
  headingLevel?: 1 | 2
  /** The uppercase context line above the title. A label, never the name. */
  eyebrow?: string
  questions: readonly V3Answer[]
  /** Where the reader goes next. Omit for a block that only answers. */
  doors?: readonly V3AnswersDoor[]
  /** One quiet line under the left rail: a caveat, a basis. Plain text. */
  note?: string
  /**
   * What the folded door set is called, when there are enough doors to fold.
   * Defaults to "Where to go next" — a promise about destinations, not about
   * the questions above it.
   */
  doorsLabel?: string
  className?: string
}

/**
 * Doors stay in the flow up to this many; past it they fold behind one summary.
 * Six is the ceiling TASTE puts on an unencoded list before it becomes "a table
 * wearing hairlines", and a set of exits is exactly that kind of list.
 */
const FOLD_DOORS_PAST = 6

/**
 * A legacy Quiet item array, split into what this pattern takes.
 *
 * Twelve routes still close on a V3Quiet holding a mixed pile: questions as
 * `kind: 'prose'` rows with a `term`, and outbound edges as bare
 * `{ label, href }`. One heading, three jobs, no disclosure. This turns that
 * pile into the two lists V3Answers wants, so a route migrates in one line
 * instead of growing its own copy of the same split.
 *
 * A prose row with no `term` is NOT a question — it is a legal paragraph or a
 * disclosure, which is what Quiet is genuinely for — so it is returned in
 * `prose` for the caller to keep rendering as prose rather than being forced
 * into a question shape with an empty summary.
 */
export function splitQuietItems(
  items: readonly { kind?: string; term?: string; body?: string | readonly string[]; label?: string; href?: string }[],
): { questions: V3Answer[]; doors: V3AnswersDoor[]; prose: { body: string | readonly string[] }[] } {
  const questions: V3Answer[] = []
  const doors: V3AnswersDoor[] = []
  const prose: { body: string | readonly string[] }[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.href === 'string' && typeof item.label === 'string') {
      doors.push({ label: item.label, href: item.href })
      continue
    }
    if (item.body == null) continue
    if (typeof item.term === 'string' && item.term.trim()) {
      questions.push({ question: item.term, body: item.body })
    } else {
      prose.push({ body: item.body })
    }
  }
  return { questions, doors, prose }
}

/** Trimmed text, or nothing. An empty string is not a label and not a name. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function paragraphs(body: V3Answer['body']): string[] {
  const lines = typeof body === 'string' ? [body] : body
  return lines.map((line) => line.trim()).filter((line) => line.length > 0)
}

type RenderableAnswer = { question: string; body: string[]; open: boolean; id?: string }

function toRenderable(questions: readonly V3Answer[]): RenderableAnswer[] {
  const out: RenderableAnswer[] = []
  for (const item of questions) {
    // A hole is dropped, never dereferenced: without `noUncheckedIndexedAccess`
    // an indexed expression type-checks against an empty array and arrives
    // here as undefined. Reading a property off it would be a 500.
    if (!item || typeof item !== 'object') continue
    const question = text(item.question)
    const body = paragraphs(item.body)
    if (!question || body.length === 0) continue
    out.push({ question, body, open: item.open === true, id: text(item.id) })
  }
  return out
}

function toDoors(doors: readonly V3AnswersDoor[] | undefined): V3AnswersDoor[] {
  if (!doors) return []
  const out: V3AnswersDoor[] = []
  for (const door of doors) {
    if (!door || typeof door !== 'object') continue
    const label = text(door.label)
    const href = text(door.href)
    if (!label || !href) continue
    out.push({ label, href })
  }
  return out
}

/**
 * The closing question set of a node. Every row is a native disclosure, so the
 * reader works the section instead of scrolling past it, and the answers stay
 * in the HTML for the crawler that never opens one.
 */
export function V3Answers({
  id,
  heading,
  headingLevel = 2,
  eyebrow,
  questions,
  doors,
  note,
  doorsLabel,
  className,
}: V3AnswersProps) {
  const rows = toRenderable(questions)
  const edges = toDoors(doors)
  const title = text(heading)
  const contextLine = text(eyebrow)
  const trailingNote = text(note)

  if (process.env.NODE_ENV !== 'production') {
    const dropped = questions.length - rows.length
    if (dropped > 0) {
      console.warn(
        `V3Answers${title ? ` (${title})` : ''}: dropped ${dropped} question(s) with no text or no answer.`,
      )
    }
  }

  // Nothing to answer and nowhere to go: render nothing rather than a bare
  // rule under a title.
  if (rows.length === 0 && edges.length === 0) return null

  const headingId = title ? `${id}-heading` : undefined

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-answers', className)}
      aria-labelledby={headingId}
    >
      <div className="v3-answers__grid">
        <div className="v3-answers__head">
          {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
          {title ? (
            <V3Heading level={headingLevel} id={headingId} className="v3-answers__heading">
              {title}
            </V3Heading>
          ) : null}
          {trailingNote ? <p className="v3-answers__note">{trailingNote}</p> : null}
        </div>

        {rows.length > 0 ? (
          <ul className="v3-answers__list">
            {rows.map((row, index) => (
              <li key={row.id ?? `q-${index}`} id={row.id} className="v3-answers__item">
                {/* NO `name` HERE, AND IT IS NOT AN OVERSIGHT. Grouping the rows
                    into a browser-native exclusive accordion (`name={...}`) made
                    the row that ships open close itself after hydration, in 2 of
                    3 loads of /about at 375 — Chromium's group logic closes every
                    other row in the group whenever one row's open state is
                    touched, and React's hydration commit touches all four. The
                    same page with the attribute removed held the open row across
                    5 of 5 loads. Rows open independently instead, which is what
                    a question set wants anyway: nothing a reader opened closes
                    because they opened something else. */}
                <details className="v3-answers__row" open={row.open}>
                  <summary className="v3-answers__q">
                    <span className="v3-answers__q-text">{row.question}</span>
                    <span aria-hidden="true" className="v3-answers__mark" />
                  </summary>
                  <div className="v3-answers__a">
                    {row.body.map((line, lineIndex) => (
                      <p className="v3-answers__para" key={lineIndex}>
                        {line}
                      </p>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : null}

        {edges.length > 0 ? (
          /*
           * Past a handful, the doors fold.
           *
           * A community page closed on FORTY-ONE of these — every recorded
           * governing document, every golf course, every sibling resort, plus
           * the generic site edges — as one flat list about 2,000px tall. That
           * is TASTE's "scrolling list as the design" and it was the largest
           * single block on the page after the prose.
           *
           * Folding rather than cutting, deliberately: these edges are the
           * node's outbound graph, the internal-link gates read them, and a
           * closed native disclosure keeps every anchor in the HTML for a
           * crawler while showing the reader a count they can act on. The
           * summary names how many, so the fold is an offer and not a place to
           * hide destinations — the same rule the footer's fold follows, with
           * the same chevron.
           */
          edges.length > FOLD_DOORS_PAST ? (
            <details className="v3-answers__edges">
              <summary className="v3-answers__edges-summary">
                {text(doorsLabel) ?? 'Where to go next'}
                <span className="v3-answers__edges-count">
                  {edges.length}
                  {/* The same +/- mark the questions beside it use. A chevron
                      here would put two disclosure glyphs in one section. */}
                  <span aria-hidden="true" className="v3-answers__mark" />
                </span>
              </summary>
              <ul className="v3-answers__doors">
                {edges.map((door) => (
                  <li key={door.href} className="v3-answers__door-item">
                    <Link href={door.href} className="v3-answers__door">
                      <span className="v3-answers__door-label">{door.label}</span>
                      <span aria-hidden="true" className="v3-answers__door-mark">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <ul className="v3-answers__doors">
              {edges.map((door) => (
                <li key={door.href} className="v3-answers__door-item">
                  <Link href={door.href} className="v3-answers__door">
                    <span className="v3-answers__door-label">{door.label}</span>
                    <span aria-hidden="true" className="v3-answers__door-mark">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </section>
  )
}
