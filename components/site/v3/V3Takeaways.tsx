/**
 * PATTERN — TAKEAWAYS. The short answer to a place page's main question, in
 * four to six sentences, right after the opening (AEO review, Matt 2026-10-04).
 *
 * WHY. Answer engines lift their answer from the top of a page a sentence at a
 * time, and the city and community pages opened on a photo hero whose only
 * text was a door caption; the first citable sentence was method fine print a
 * screen further down. This puts the answer first, in the served HTML, as a
 * list whose every item stands alone when it is quoted on its own.
 *
 * THE FORM. An H2 that names the place, then ONE lead paragraph of the
 * sentences lib/site/place-takeaways.ts returns (at most four) in body-lg at the text measure, each figure set strong so
 * the eye lands on it first. A paragraph, not a grid of ruled claims: the
 * separate evaluator read six ruled statements as a prose wall and a KPI grid
 * in disguise (2026-10-04), and one lead is the editorial form TASTE allows.
 * No figures set large: the number stays inside the sentence that says what
 * it means.
 *
 * Barrel law honored here:
 *  - Server component. The caller words every sentence from its own figures
 *    (lib/site/place-takeaways.ts) and owns the §0 trace.
 *  - Every value resolves through ./tokens.css in ./V3Takeaways.css.
 *  - Fewer than two sentences returns null: one line is a caption, not a
 *    section, and the page already has captions.
 */
import { cn } from '@/lib/utils'
import { V3Heading, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Takeaways.css'

export type V3TakeawaysProps = {
  id: string
  /** "Bend at a glance". */
  heading: string
  /** Plain sentences, each naming the place. */
  items: readonly string[]
  /** One quiet line under the list: the source and its date. */
  source?: string | null
  className?: string
}

/**
 * The figure in each sentence, set strong so the eye lands on 3.6 months or
 * $759,000 before it reads the words around it (the device the insight cards
 * already use, "sold for <strong>$759K</strong>"). The text is unchanged, so a
 * crawler and a screen reader get the same sentence. Exported for tests.
 */
export const TAKEAWAY_FIGURE_RE =
  /(\$[\d,]+(?:\.\d+)?[KM]?|\d[\d,]*(?:\.\d+)?%|\d[\d,]*(?:\.\d+)? (?:single-family (?:homes?|houses?)|months of supply))/g

function withFigures(sentence: string) {
  const parts = sentence.split(TAKEAWAY_FIGURE_RE)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="v3-takeaways__figure">
        {part}
      </strong>
    ) : (
      part
    ),
  )
}

export type V3TakeawaysLeadProps = {
  /** Plain sentences, each naming the place. */
  items: readonly string[]
  /** One quiet line under the paragraph: the source and its date. */
  source?: string | null
  /** Links set after the source line ("How we get our numbers"). */
  links?: readonly { label: string; href: string }[]
}

/**
 * The same paragraph without its section or H2, for a page whose H1 already
 * asks the question: the market pages place it under the headline through
 * V3Instrument's `lede` slot (SEO & AEO Desk brief 2026-10-08), so the first
 * text after the H1 is the answer. Plain server-rendered <p>, no island.
 */
export function V3TakeawaysLead({ items, source, links = [] }: V3TakeawaysLeadProps) {
  const rows = items.map((s) => s.trim()).filter(Boolean)
  if (rows.length < 2) return null
  const shown = links.filter((l) => l.label.trim() && l.href.trim())
  return (
    <div className="v3-takeaways v3-takeaways--lede">
      <p className="v3-takeaways__lead">
        {rows.map((s, i) => (
          <span key={s}>
            {i > 0 ? ' ' : null}
            {withFigures(s)}
          </span>
        ))}
      </p>
      {source?.trim() || shown.length > 0 ? (
        <p className="v3-takeaways__source">
          {source?.trim() ?? null}
          {shown.map((l, i) => (
            <span key={l.href}>
              {i === 0 ? (source?.trim() ? ' ' : null) : ' · '}
              <a href={l.href}>{l.label}</a>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}

export function V3Takeaways({ id, heading, items, source, className }: V3TakeawaysProps) {
  const rows = items.map((s) => s.trim()).filter(Boolean)
  if (rows.length < 2) return null
  const headingId = `${id}-heading`
  return (
    <section id={id} aria-labelledby={headingId} className={cn(V3_ROOT_CLASS, 'v3-takeaways', className)}>
      <V3Heading level={2} id={headingId} className="v3-takeaways__heading">
        {heading}
      </V3Heading>
      <p className="v3-takeaways__lead">
        {rows.map((s, i) => (
          <span key={s}>
            {i > 0 ? ' ' : null}
            {withFigures(s)}
          </span>
        ))}
      </p>
      {source?.trim() ? <p className="v3-takeaways__source">{source.trim()}</p> : null}
    </section>
  )
}
