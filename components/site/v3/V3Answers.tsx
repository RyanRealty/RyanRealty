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
 * the caller's FAQPage JSON-LD describes the same strings. Every sentence,
 * every trace and every mark is emitted by the SERVER render, including the
 * drawing's client component, so the section reads with scripting off; what
 * hydration adds is the crosshair and the count-through, and nothing else.
 *
 * THE FORM. Two columns on a wide window: the heading and the outbound doors
 * hold the left rail, the questions hold the right. One column at 390, in
 * reading order (heading, questions, doors). The page it closes is not another
 * full-width hairline stack (TASTE.md: "the stacked-section page").
 *
 * THE ANSWER IS A NUMBER, SO THE ROW CARRIES ONE (site queue SITE-08). Every
 * question on a place page is about one figure. A row may therefore declare a
 * `figure`, and then:
 *   - CLOSED, the value sits on the row, tabular, right of the question. The
 *     section reads as an answer sheet at a glance — 4.9 months, 29 days, 95%,
 *     39%, 120 sales down one edge — instead of as a list of things to open.
 *     TASTE ritual question 2 ("is the first read instant?") is answered by the
 *     shut section, not by the opened one.
 *   - OPEN, the figure is DRAWN before the sentence, and the drawing is an
 *     instrument rather than a picture: the rule takes a crosshair the reader
 *     scrubs with a pointer or the arrow keys, the tally counts through under
 *     the pointer, and both carry a readout. Geometry and its refusals live in
 *     ./V3Answers.marks.ts, the interrogation in ./answer-mark.client.tsx; a
 *     figure that cannot be drawn honestly opens onto its sentence alone
 *     rather than onto a mark in the wrong place.
 * Each drawing is ONE role="img" whose label reads the whole thing as a
 * sentence, and its positioned spans and its readout are aria-hidden, so a
 * screen reader gets one clean reading rather than a second copy of text that
 * is already in the row.
 *
 * A row may also carry ONE `action`. The last question on a place page is where
 * the reader wants to do something about the answer, and the doors in the left
 * rail are the page's outbound graph, not this row's next step.
 *
 * Barrel law honored here:
 *  - Server component, native disclosure, works before hydration.
 *  - This primitive never fetches and never formats.
 *  - No raw color and no hardcoded motion: every value resolves through
 *    ./tokens.css in ./V3Answers.css, and the mark's motion reads
 *    --v3-dur-state, which reduced motion collapses.
 *  - The one client file is the drawing, and it holds no data of its own: it
 *    is handed geometry the server already resolved.
 *  - Names are enforced at RENDER, the discipline V3Quiet states: a question
 *    with no text, an answer with no body, or a door with no label or href is
 *    dropped rather than shipped nameless, and a block with nothing left
 *    returns null rather than a bare rule. A plain `string` is taken so a set
 *    built by `.map()` over a page's content array needs no cast.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Figure, V3Heading, V3SourceLine, V3_ROOT_CLASS } from './atoms'
import { AnswerMarkDrawing } from './answer-mark.client'
import type { V3AnswerMark } from './V3Answers.marks'
import './tokens.css'
import './V3Answers.css'

export type { V3AnswerMark, V3AnswerScale, V3AnswerTally } from './V3Answers.marks'

/** The one number an answer is about, as the reader sees it. */
export type V3AnswerFigure = {
  /** Formatted and unit-bearing: "4.9", "29 days", "95.0%", "120". */
  value: string
  /** What it measures, in plain words. Never a column name, never jargon. */
  label: string
  /** The drawing the open row leads with. Omit when the figure has no honest one. */
  mark?: V3AnswerMark
}

export type V3Answer = {
  /** The question. It is the summary's text and the control's accessible name. */
  question: string
  /** The answer. One string is one paragraph. */
  body: string | readonly string[]
  /** Open on arrival. Use it on the first row so the control shows its work. */
  open?: boolean
  /** Hash target, for a `?` on another page landing on one question. */
  id?: string
  /** The one sourced figure this answer is about (SITE-08). */
  figure?: V3AnswerFigure
  /** Where the answer's source came from, as the trace line §0 requires. */
  source?: string
  /** ONE next step for this answer. Not an outbound door — those are `doors`. */
  action?: { label: string; href: string }
  /**
   * A prose row appended after the cited ones (HOA rules, the school district).
   * It renders in the reading face rather than the display face, so a sheet
   * whose right column runs five tabular figures and then stops does not read
   * as two figures that failed to load.
   *
   * EXPLICIT, not inferred from "has no figure". The value ask is also
   * figure-less and is the OPPOSITE of quiet — it is the row the section is
   * for. Deriving this from the absence of a figure muted it (caught on
   * /communities/tetherow, 2026-09-08).
   */
  reference?: boolean
}

/** An outbound edge, same shape as a Quiet door row. */
export type V3AnswersDoor = {
  /** The visible row text, and therefore the link's accessible name. */
  label: string
  href: string
  /**
   * What kind of destination this is — "Recorded documents", "Golf",
   * "Nearby resorts", "Around the site". Optional, and a set with no groups at
   * all renders exactly as it did before.
   *
   * WHY IT EXISTS. Folding the doors fixed the height and not the shape: two
   * separate evaluator rounds (2026-09-08, then again after) opened the fold on
   * /communities/tetherow and found 41 undifferentiated hairline rows, and on
   * /communities/redmond-odin-crest-estate found 31 — governing documents,
   * golf courses, sibling resorts and generic site links interleaved with
   * nothing between them. That is TASTE's "a table wearing hairlines", just
   * deferred behind a click, and the second round proved it systemic rather
   * than one page's miss. A reader opening a set of exits is looking for a KIND
   * of destination, so the set says which kind.
   *
   * Order is the caller's: groups appear in the order their first door does, so
   * the builder's reading order survives. Doors with no group sort last, under
   * no label, which is what a small leftover set should look like.
   */
  group?: string
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
   * The machine handle behind the rows' source lines — table plus key, e.g.
   * "market_metric:neighborhood:bend-awbrey-butte". Emitted as
   * `data-source-key` on the section rather than written into the visible
   * trace, so §0's "name the source" stays greppable in the served HTML while
   * the sentence a visitor reads stays free of raw slugs and table names
   * (TASTE.md, 2026-09-08 evaluator finding on all three place grains).
   */
  sourceKey?: string | null
  /**
   * What the folded door set is called, when there are enough doors to fold.
   * Defaults to "Where to go next" — a promise about destinations, not about
   * the questions above it.
   */
  doorsLabel?: string
  className?: string
}

/**
 * The folded set, split into the groups the caller named, in first-appearance
 * order, with the ungrouped remainder last under no label. A set where nobody
 * named a group comes back as one unlabelled block — byte-identical output to
 * the flat list this replaced.
 */
export function groupDoors(
  doors: readonly V3AnswersDoor[],
): { label: string | null; doors: V3AnswersDoor[] }[] {
  const order: string[] = []
  const byGroup = new Map<string, V3AnswersDoor[]>()
  const loose: V3AnswersDoor[] = []
  for (const door of doors) {
    const key = door.group?.trim()
    if (!key) {
      loose.push(door)
      continue
    }
    if (!byGroup.has(key)) {
      byGroup.set(key, [])
      order.push(key)
    }
    byGroup.get(key)!.push(door)
  }
  const groups: { label: string | null; doors: V3AnswersDoor[] }[] = order.map((label) => ({
    label,
    doors: byGroup.get(label)!,
  }))
  if (loose.length > 0) groups.push({ label: null, doors: loose })
  return groups
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
  /**
   * One door per destination. Two callers can reach the same page — the
   * community page pushed "Value my home" after buildExploreEdges had already
   * added it, so /communities/tetherow shipped the exit twice and React warned
   * about two children with the same key, since a door is keyed by its href.
   * The first wins: the builder's label is the considered one.
   */
  const seen = new Set<string>()
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    if (typeof item.href === 'string' && typeof item.label === 'string') {
      if (seen.has(item.href)) continue
      seen.add(item.href)
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

type RenderableAnswer = {
  question: string
  body: string[]
  open: boolean
  id?: string
  figure?: V3AnswerFigure
  source?: string
  action?: { label: string; href: string }
  reference: boolean
}

/**
 * A figure with no value or no label is not a figure — it is a naked numeral or
 * an orphan word, and both are TASTE tells ("KPI grids: a number with no plain
 * sentence beside it"). Dropped rather than half-rendered.
 */
function toFigure(figure: V3AnswerFigure | undefined): V3AnswerFigure | undefined {
  if (!figure || typeof figure !== 'object') return undefined
  const value = text(figure.value)
  const label = text(figure.label)
  if (!value || !label) return undefined
  return figure.mark ? { value, label, mark: figure.mark } : { value, label }
}

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
    const actionLabel = text(item.action?.label)
    const actionHref = text(item.action?.href)
    out.push({
      question,
      body,
      open: item.open === true,
      id: text(item.id),
      figure: toFigure(item.figure),
      source: text(item.source),
      reference: item.reference === true,
      ...(actionLabel && actionHref ? { action: { label: actionLabel, href: actionHref } } : {}),
    })
  }
  return out
}

/**
 * The drawing, or nothing.
 *
 * Geometry and its refusals live in ./V3Answers.marks.ts; the rendering, the
 * crosshair, the scrub and the count-through live in ./answer-mark.client.tsx,
 * because TASTE.md's chart bar is that a data drawing has to be interrogable
 * and a server component cannot hold a pointer. The server still renders the
 * complete drawing — the client file adds handlers on hydration and nothing
 * else, so the row works shut, open, and with scripting off.
 */

function toDoors(doors: readonly V3AnswersDoor[] | undefined): V3AnswersDoor[] {
  if (!doors) return []
  const out: V3AnswersDoor[] = []
  for (const door of doors) {
    if (!door || typeof door !== 'object') continue
    const label = text(door.label)
    const href = text(door.href)
    if (!label || !href) continue
    const group = text(door.group)
    out.push(group ? { label, href, group } : { label, href })
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
  sourceKey,
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
      data-source-key={sourceKey?.trim() || undefined}
    >
      <div className="v3-answers__grid">
        {/* THE RAIL IS ONE COLUMN, AND IT STAYS PUT. The title, the basis
            note and the outbound doors travel with the reader down a long
            question set on a wide window. Before this they were two separate
            grid areas stacked at the top and the left half of the section was
            empty for most of its height, which on a place page is most of a
            screen of nothing beside the only content anyone is reading.
            Sticky, no motion, and a no-op wherever the list is shorter than
            the viewport. */}
        <div className="v3-answers__rail">
          <div className="v3-answers__head">
            {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
            {title ? (
              <V3Heading level={headingLevel} id={headingId} className="v3-answers__heading">
                {title}
              </V3Heading>
            ) : null}
            {trailingNote ? <p className="v3-answers__note">{trailingNote}</p> : null}
          </div>


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
                {groupDoors(edges).map((group, groupIndex) => (
                  <div
                    key={group.label ?? `ungrouped-${groupIndex}`}
                    className="v3-answers__door-group"
                  >
                    {group.label ? (
                      <p className="v3-answers__door-group-label">{group.label}</p>
                    ) : null}
                    <ul className="v3-answers__doors">
                      {group.doors.map((door) => (
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
                  </div>
                ))}
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


        {rows.length > 0 ? (
          <ul className="v3-answers__list">
            {rows.map((row, index) => (
              <li
                key={row.id ?? `q-${index}`}
                id={row.id}
                /* A ROW WITH NO FIGURE IS A DIFFERENT KIND OF ROW, AND IT SAYS SO.
                   The place grains append prose-only rows from
                   lib/site/market-faq.ts (HOA, school district) after the cited
                   ones. Wearing the identical chrome, the sheet's right column
                   ran five aligned tabular numerals and then two blanks, which
                   reads as figures that failed to load — two separate evaluators
                   called it on /communities/tetherow (2026-09-08). A reference
                   row now carries the reading face instead of the display face,
                   so the eye sorts the two registers without a fake figure being
                   invented to fill the gap. */
                className={cn('v3-answers__item', row.reference && 'v3-answers__item--reference')}
              >
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
                    {/* THE ANSWER, SHUT. A figure on the closed row is what
                        turns this from a list of things to open into a sheet
                        the reader has already read. */}
                    {row.figure ? (
                      /* The barrel's own figure atom, not a second one: same
                         numeral face, same tabular rule, same label treatment
                         as every Instrument on the page (TASTE consistency). */
                      <V3Figure
                        value={row.figure.value}
                        label={row.figure.label}
                        className="v3-answers__q-figure"
                      />
                    ) : null}
                    <span aria-hidden="true" className="v3-answers__mark" />
                  </summary>
                  <div className="v3-answers__a">
                    {row.figure?.mark ? <AnswerMarkDrawing mark={row.figure.mark} /> : null}
                    {row.body.map((line, lineIndex) => (
                      <p className="v3-answers__para" key={lineIndex}>
                        {line}
                      </p>
                    ))}
                    {row.action ? (
                      <Link href={row.action.href} className="v3-answers__action">
                        <span className="v3-answers__action-label">{row.action.label}</span>
                        <span aria-hidden="true" className="v3-answers__action-mark">
                          &rarr;
                        </span>
                      </Link>
                    ) : null}
                    {/* §0. The trace sits with the figure it explains, not in a
                        single line at the foot of the section describing eight
                        different populations at once. */}
                    {row.source ? (
                      <V3SourceLine source={row.source} className="v3-answers__source" />
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
