/**
 * V3SourceLine — the section 0 trace, folded.
 *
 * WHY THIS PRIMITIVE MOVED OUT OF atoms.tsx (SITE-42, 2026-09-09)
 *
 * The trace was right on every page and the FORM was wrong on all of them. The
 * taste table of 2026-09-08 named it on four page classes and wrote the same
 * finding four times:
 *
 *   /price-drops (30)                    the line was a direct child of
 *                                        `main.v3` with no measure of its own,
 *                                        so its box was 0..1440 at desktop and
 *                                        0..375 on a phone: the sentence began
 *                                        hard against the viewport edge and ran
 *                                        to the other one. Unreadable at both.
 *   /subdivisions/ridge-at-eagle-crest   the whole trace sentence printed as
 *   (59)                                 hero copy directly under the H1.
 *   /housing-market/bend (53) and        one unbroken paragraph of small grey
 *   /central-oregon (63)                 prose mixing the plain source with
 *                                        methodology asides, the least
 *                                        editorial text on the page, and where
 *                                        the eye stopped.
 *
 * §0 is absolute and the trace stays. TASTE.md is equally clear that the fix is
 * FORM. So: NOTHING IS CUT, ONLY FOLDED. The complete string the caller passed
 * is in the server HTML on every render, inside a native <details> — crawlable,
 * greppable, no JavaScript — and what a reader sees before touching anything is
 * one clause: the source's name and the as-of date, at caption size.
 *
 * DERIVING THE CLAUSE WITHOUT GUESSING
 *
 * A caller that has the two values at hand passes them (`sourceName`, `asOf`).
 * Every other trace in this codebase is written in one shape — the feed, a
 * comma, then the population:
 *
 *   "live MLS through Oregon Data Share, asking-price cuts on active …"
 *   "Oregon Data Share via MarketPulse, active single-family houses in Bend. …"
 *   "Closed MLS sales through Oregon Data Share, Central Oregon service-area …"
 *
 * so the leading segment up to the first comma is usually the source name. The
 * rule is structural and holds no opinion about meaning: take the pre-comma
 * segment and the first sentence, and keep the SHORTER of the two. The date is
 * the `asOf` prop, else the `updatedAt`
 * prop, else the canonical " · updated <stamp>" clause the trace already ends
 * with (V3Instrument joins the stamp that way, and so does this atom). Nothing
 * is invented: a trace carrying no stamp and no prop renders the name alone.
 *
 * TWO MOUNTS
 *
 *   block  the default. A quiet footer row under the data it explains: the
 *          label, the name, the stamp, and the disclosure control at the far
 *          end of the row on a wide window.
 *   hero   a small bordered chip beside the figure it supports, for an opening
 *          where a sentence in the display register is the defect.
 *
 * HELD TO THE CONTENT COLUMN. The box carries `--v3-measure` itself, and a line
 * mounted straight on the v3 root (`.v3 > .v3-source`) takes the page gutter
 * too, so /price-drops cannot put a trace against the viewport edge again. A
 * line inside a section is already inside that section's measure, and the
 * max-inline-size is a no-op there.
 *
 * Visual language: design_system/public/PUBLIC_UI.md. Color, size, rule and
 * duration come from ./tokens.css; no raw color is declared here or in the CSS.
 */
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format/date'
import './tokens.css'
import './V3SourceLine.css'

/**
 * The canonical stamp join. `V3Instrument` builds `${source} · updated ${stamp}`
 * and so does this atom's own `updatedAt` branch, so a trace that already
 * carries its date says so in exactly this shape.
 */
const STAMP_RE = /\s*·\s*updated\s+([^·]+?)\s*$/

export type V3SourceParts = {
  /** The source's name, for the clause a reader sees first. */
  name: string
  /** The as-of date for that clause, or null when the trace carries none. */
  stamp: string | null
  /** The complete trace, exactly as it reaches the disclosure. */
  trace: string
}

/**
 * Split the trailing " · updated <stamp>" clause off a trace. Returns the body
 * and the stamp; a trace without one returns the whole string and null.
 */
export function splitSourceStamp(source: string): { body: string; stamp: string | null } {
  const match = STAMP_RE.exec(source)
  if (!match) return { body: source.trim(), stamp: null }
  return { body: source.slice(0, match.index).trim(), stamp: match[1].trim() }
}

/**
 * The source's name, from the trace's own shape. Two candidates, both purely
 * structural: the leading segment up to the first comma, and the first sentence
 * (to the first period or semicolon). THE SHORTER ONE WINS.
 *
 * That ordering is the rule and not a preference. Most traces here open
 * "<feed>, <population>", where the pre-comma segment is the name and the first
 * sentence is the whole population — so the comma wins. `platStatsTrace` opens
 * "live MLS through Oregon Data Share through the subdivision statistics cache,
 * closed single-family sales in …", where the first comma lands at 156
 * characters into a 280-character sentence — so a NAME_MAX cut-off would have
 * fallen back to the LONGER of the two, which is how a 156-character "clause"
 * reached /subdivisions/ridge-at-eagle-crest in the first accept run. Shortest
 * wins is right in both directions, and it never guesses at meaning — only at
 * where a sentence ends.
 */
export function sourceNameFromTrace(body: string): string {
  const trimmed = body.trim()
  const candidates: string[] = []
  const comma = balancedCut(trimmed, ',')
  if (comma > 0) candidates.push(trimmed.slice(0, comma).trim())
  const stop = balancedCut(trimmed, '.;')
  if (stop > 0) candidates.push(trimmed.slice(0, stop).trim())
  else candidates.push(trimmed)
  const best = candidates
    .filter((c) => c.length > 0)
    .sort((a, b) => a.length - b.length)[0]
  return best ?? trimmed
}

/**
 * The first cut character at depth zero, or -1.
 *
 * A trace often puts its population in a parenthesis — "…in the last 7 days
 * (the same pull the list below renders, 60 in the window)." — and the first
 * comma then sits INSIDE it, so a naive cut ends the visible clause on an open
 * bracket: "…(the same pull the list below renders" (evaluator on /price-drops,
 * 2026-09-09: "the parenthetical never closes"). A clause is a thing a person
 * reads aloud, so it never ends mid-bracket.
 */
function balancedCut(text: string, cuts: string): number {
  let depth = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    else if (depth === 0 && cuts.includes(ch)) return i
  }
  return -1
}

/**
 * The whole derivation in one pure function, so a test can hold it and a caller
 * can see what its trace will fold to. `trace` is what the disclosure prints and
 * it always contains the caller's string verbatim.
 */
export function v3SourceParts(input: {
  source: string
  sourceName?: string | null
  asOf?: string | number | Date | null
  updatedAt?: string | number | Date | null
}): V3SourceParts {
  const { body, stamp: inlineStamp } = splitSourceStamp(input.source)
  const explicit = input.asOf ?? input.updatedAt ?? null
  const stamp = explicit == null ? inlineStamp : formatDate(explicit)
  const name = input.sourceName?.trim() || sourceNameFromTrace(body)
  // The caller's string, verbatim, plus the stamp it did not already carry —
  // the same join the visible line used before this primitive folded.
  const trace =
    explicit != null && inlineStamp == null
      ? `${input.source} · updated ${formatDate(explicit)}`
      : input.source
  return { name, stamp, trace }
}

export type V3SourceLineMount = 'block' | 'hero'

export type V3SourceLineProps = {
  /**
   * The trace itself, without the word "Source" (this renders that label): what
   * the figures above came from, the filter, the population, and any
   * methodology the number needs. Long is FINE and always was — it is folded,
   * not cut, and it reaches the HTML in full.
   */
  source: string
  /**
   * The source's name for the compact clause, when the caller has it. Skip it
   * and the clause is derived from the trace's own leading segment.
   */
  sourceName?: string | null
  /** The as-of date for the compact clause, when the caller has one. */
  asOf?: string | number | Date | null
  /** Legacy name for the same stamp. Rendered through the canonical formatter. */
  updatedAt?: string | number | Date | null
  /** Inverts for use over Stage media. */
  onMedia?: boolean
  /** `hero` renders the chip form beside an opening figure. Default `block`. */
  mount?: V3SourceLineMount
  id?: string
  className?: string
}

/**
 * The section 0 trace under any block of real data: Instrument, Field counts,
 * Ledger rows, a Sheet result, a place opening. Every figure renders with its
 * source available, so this is not decoration and is not optional — but it is
 * one clause until a reader asks for the rest.
 */
export function V3SourceLine({
  source,
  sourceName,
  asOf,
  updatedAt,
  onMedia,
  mount = 'block',
  id,
  className,
}: V3SourceLineProps) {
  const { name, stamp, trace } = v3SourceParts({ source, sourceName, asOf, updatedAt })
  return (
    <details
      id={id}
      className={cn(
        'v3-source',
        mount === 'hero' && 'v3-source--hero',
        onMedia && 'v3-source--on-media',
        className,
      )}
    >
      {/* THE SPACES BETWEEN THE SPANS ARE LOAD-BEARING. Flex layout draws the
          gaps, but a screen reader and a copy-paste read textContent, and
          without them the control announced "Sourcelive MLS through Oregon Data
          Shareas of Sep 9, 2026" (first accept run, 2026-09-09). A whitespace-
          only text node is not a flex item, so nothing moves. */}
      <summary className="v3-source__summary">
        <span className="v3-source__clause">
          <span className="v3-source__label">Source</span>{' '}
          <span className="v3-source__name">{name}</span>
          {stamp ? <> <span className="v3-source__stamp">as of {stamp}</span></> : null}
        </span>{' '}
        <span className="v3-source__more">how we calculate this</span>
      </summary>
      <p className="v3-source__trace">{trace}</p>
    </details>
  )
}

export type V3SourceDisclosureProps = {
  /** The full section 0 trace: table, filter, methodology stamp, population. */
  source: string
  /** When the data was last refreshed. Rendered through the canonical formatter. */
  updatedAt?: string | number | Date | null
  /** The source's name for the compact clause, when the caller has it. */
  sourceName?: string | null
  id?: string
  className?: string
}

/**
 * The name this primitive answered to on the surfaces that already folded their
 * trace by hand (2026-08-19). It is the SAME object now — one job, one
 * primitive, one variant, per TASTE.md's consistency rule — kept as an export so
 * no caller has to change a line to get the better clause.
 */
export function V3SourceDisclosure({
  source,
  updatedAt,
  sourceName,
  id,
  className,
}: V3SourceDisclosureProps) {
  return (
    <V3SourceLine
      source={source}
      updatedAt={updatedAt}
      sourceName={sourceName}
      id={id}
      className={className}
    />
  )
}
