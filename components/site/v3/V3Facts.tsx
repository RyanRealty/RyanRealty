/**
 * PATTERN — FACTS. A fact sheet: one <dl> of label and value pairs, in the
 * served HTML, that a person scans and an answer engine lifts whole.
 *
 * Built for /about "Key facts about Ryan Realty" (Matt 2026-09-23, the About
 * page AEO playbook). Why not V3Quiet's fact rows: Quiet wraps every pair in
 * its own list item and its own <dl>, so seventeen facts are seventeen one-row
 * lists. A fact sheet is ONE definition list, which is the structure an
 * extractor reads as a set of attributes of one entity, and it is the shape
 * the key facts table in the playbook asks for.
 *
 * THE FORM. Two columns of pairs past 64rem (flowing down the first column,
 * then the second), one below it; a hairline under each pair, the label in
 * the small tracked caps every label on the site uses, the value in body type.
 * A value may carry doors (a website, a profile, a page); they render as
 * links with the 44px hit box, never as the whole value.
 *
 * Barrel law honored here:
 *  - Server component. The caller formats every value and owns its §0 trace;
 *    `detail` is the place for a basis ("recorded MLS closings"), `note` for
 *    one line under the sheet.
 *  - Every value resolves through ./tokens.css in ./V3Facts.css.
 *  - A pair with no label, or with neither a value nor a door, is dropped;
 *    nothing left returns null.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3_ROOT_CLASS } from './atoms'
import { V3MarkStrip, markStripDrawable, type V3MarkStripProps } from './V3MarkStrip'
import './tokens.css'
import './V3Facts.css'

export type V3FactLink = { label: string; href: string }

/** A value drawn as a record over time (see V3MarkStrip). */
export type V3FactStrip = Omit<V3MarkStripProps, 'className'>

export type V3Fact = {
  /** The attribute: "Founded", "Headquarters". Rendered as <dt>. */
  term: string
  /** The value, already formatted. */
  value?: string
  /**
   * The one number the value is about, set large in the numeral face before
   * the words ("2014", "3", "3%", "25", "5.0"): the sheet reads as figures at
   * a glance and as sentences on a closer look. Preformatted by the caller.
   */
  figure?: string
  /** A quieter second line: the basis, a date span, a source. */
  detail?: string
  /** Doors that belong to this value (a website, profiles, a page). */
  links?: readonly V3FactLink[]
  /** The value drawn as marks over time (see V3FactStrip). */
  strip?: V3FactStrip
  id?: string
}

export type V3FactsProps = {
  id: string
  heading: string
  eyebrow?: string
  facts: readonly V3Fact[]
  /** One quiet line under the sheet: the basis for the live values. */
  note?: string
  className?: string
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export function V3Facts({ id, heading, eyebrow, facts, note, className }: V3FactsProps) {
  const title = text(heading)
  const rows = facts
    .map((fact) => {
      const term = text(fact.term)
      const value = text(fact.value)
      const links = (fact.links ?? [])
        .map((link) => {
          const label = text(link.label)
          const href = text(link.href)
          return label && href ? { label, href } : null
        })
        .filter((link): link is V3FactLink => link !== null)
      const strip = fact.strip && markStripDrawable(fact.strip) ? fact.strip : undefined
      return term && (value || links.length > 0)
        ? { term, value, figure: text(fact.figure), detail: text(fact.detail), links, strip, id: text(fact.id) }
        : null
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!title || rows.length === 0) return null

  const headingId = `${id}-heading`
  const contextLine = text(eyebrow)
  const basis = text(note)

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-facts', className)} aria-labelledby={headingId}>
      <div className="v3-facts__head">
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        <V3Heading level={2} id={headingId} className="v3-facts__heading">
          {title}
        </V3Heading>
      </div>
      <dl className="v3-facts__list">
        {rows.map((row) => (
          <div key={row.term} id={row.id} className="v3-facts__row">
            <dt className="v3-facts__term">{row.term}</dt>
            <dd className="v3-facts__value">
              {row.figure ? (
                /* Figure and words on one line, baseline to baseline. The
                   space is in the text, so an extractor reads "25 recorded
                   closings", not "25recorded closings". */
                <span className="v3-facts__line">
                  <span className="v3-facts__figure">{row.figure}</span>
                  {row.value ? ' ' : null}
                  {row.value ? <span className="v3-facts__text">{row.value}</span> : null}
                </span>
              ) : row.value ? (
                <span className="v3-facts__text">{row.value}</span>
              ) : null}
              {row.links.length > 0 ? (
                <span className="v3-facts__links">
                  {row.links.map((link) =>
                    isExternal(link.href) ? (
                      <a key={link.href} href={link.href} className="v3-facts__link" rel="me">
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.href} href={link.href} className="v3-facts__link">
                        {link.label}
                      </Link>
                    ),
                  )}
                </span>
              ) : null}
              {row.detail ? <span className="v3-facts__detail">{row.detail}</span> : null}
              {row.strip ? <V3MarkStrip {...row.strip} className="v3-facts__strip" /> : null}
            </dd>
          </div>
        ))}
      </dl>
      {basis ? <p className="v3-facts__note">{basis}</p> : null}
    </section>
  )
}
