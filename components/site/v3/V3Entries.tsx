/**
 * PATTERN — ENTRIES. A short set of offerings, each one a numbered entry: a
 * named title (an H3, so an answer engine can lift "what does this firm do"
 * straight off the outline), two or three sentences on what it is and what the
 * reader gets, and ONE door to the page that delivers it.
 *
 * Built for /about "What Ryan Realty does" (Matt 2026-09-23, the About-page
 * AEO playbook). Why not an existing pattern: Quiet renders a question and its
 * answer as a description list with no heading per item and no door per item,
 * Answers hides the body behind a disclosure (a service list is the content,
 * not a thing to open), and Doors is a routing moment of two to four intents
 * with no body. An offering needs all three at once: the name as a heading,
 * the substance in the served HTML, and the next step.
 *
 * THE FORM. An editorial index, not a card grid: no fill, no box, no icon.
 * On a wide window the head and a numbered INDEX of the entries hold a sticky
 * left rail, and the entries run as full rows down the right: a two-digit
 * number and the name in the display face, the paragraph, the door. The index
 * marks the entry being read as the reader scrolls (V3EntriesIndex, the one
 * client island), and each index line is a hash link to its entry. At 390 the
 * rail is the head alone and the rows stack.
 *
 * WHY ROWS AND A RAIL, NOT A GRID (2026-09-23 evaluator). The first build set
 * the six entries as a three-across grid of number/heading/paragraph tiles,
 * and the separate evaluator read it, the claims band and the steps line as
 * "the same template three times". A column of rows beside a sticky index is
 * a different object from a band of columns: it changes width, density and
 * direction, and the index gives the reader something to do.
 *
 * Barrel law honored here:
 *  - Server component. No state, no effects, no fetch, no formatting: the
 *    caller writes every sentence; the index is the entry's position.
 *  - Every value resolves through ./tokens.css in ./V3Entries.css.
 *  - Names are enforced at render: an entry with no title or no body is
 *    dropped, a door with no label or href is dropped, and a set with nothing
 *    left returns null rather than a bare rule under a heading.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3_ROOT_CLASS } from './atoms'
import { V3EntriesIndex } from './V3EntriesIndex.client'
import './tokens.css'
import './V3Entries.css'

export type V3EntryDoor = { label: string; href: string }

export type V3Entry = {
  /** The offering's name. Rendered as an H3. */
  title: string
  /** What it is and what the reader gets. One string is one paragraph. */
  body: string | readonly string[]
  /** The one page that delivers it. */
  door?: V3EntryDoor
  /** Hash target, and the index line's destination. Derived when omitted. */
  id?: string
}

export type V3EntriesProps = {
  id: string
  heading: string
  eyebrow?: string
  /** One sentence of basis under the heading. */
  lede?: string
  entries: readonly V3Entry[]
  /** The index rail's accessible name. Defaults to the heading. */
  indexLabel?: string
  className?: string
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function paragraphs(body: V3Entry['body']): string[] {
  const lines = typeof body === 'string' ? [body] : body
  return lines.map((line) => line.trim()).filter((line) => line.length > 0)
}

export function V3Entries({ id, heading, eyebrow, lede, entries, indexLabel, className }: V3EntriesProps) {
  const title = text(heading)
  const rows = entries
    .map((entry, index) => {
      const name = text(entry.title)
      const body = paragraphs(entry.body)
      const doorLabel = text(entry.door?.label)
      const doorHref = text(entry.door?.href)
      return name && body.length > 0
        ? {
            name,
            body,
            id: text(entry.id) ?? `${id}-${index + 1}`,
            door: doorLabel && doorHref ? { label: doorLabel, href: doorHref } : undefined,
          }
        : null
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!title || rows.length === 0) return null

  const headingId = `${id}-heading`
  const contextLine = text(eyebrow)
  const basis = text(lede)

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-entries', className)} aria-labelledby={headingId}>
      <div className="v3-entries__rail">
        <div className="v3-entries__head">
          {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
          <V3Heading level={2} id={headingId} className="v3-entries__heading">
            {title}
          </V3Heading>
          {basis ? <p className="v3-entries__lede">{basis}</p> : null}
        </div>
        {rows.length > 2 ? (
          <V3EntriesIndex
            label={text(indexLabel) ?? title}
            items={rows.map((row) => ({ id: row.id, label: row.name }))}
          />
        ) : null}
      </div>
      <ol className="v3-entries__list">
        {rows.map((row, index) => (
          <li key={row.id} id={row.id} className="v3-entries__item">
            <div className="v3-entries__title">
              <span className="v3-entries__number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="v3-entries__name">{row.name}</h3>
            </div>
            <div className="v3-entries__text">
              {row.body.map((line, lineIndex) => (
                <p key={lineIndex} className="v3-entries__body">
                  {line}
                </p>
              ))}
              {row.door ? (
                <Link href={row.door.href} className="v3-entries__door">
                  <span>{row.door.label}</span>
                  <span aria-hidden="true" className="v3-entries__arrow">
                    &rarr;
                  </span>
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
