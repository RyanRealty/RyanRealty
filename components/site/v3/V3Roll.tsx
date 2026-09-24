/**
 * PATTERN — ROLL. A named set of short labels set in the display face as one
 * flowing line of type, each label a door. The shape of "who this is for":
 * a list a reader takes in at one glance, not a column of rows to scan.
 *
 * Built for /about "Who Ryan Realty works with" (Matt 2026-09-23, the About
 * page AEO playbook). The markup is a plain <ul> of links, so the set is a
 * bulleted list to a crawler and a screen reader; the look is a run of
 * Amboqia with a hairline divider between entries, which is what keeps seven
 * short items from becoming TASTE.md's "scrolling list as the design".
 *
 * FAIR HOUSING. A roll names people by what they need (first-time buyers,
 * sellers, people relocating), never by who they are. The primitive cannot
 * check that; the caller's copy must (VOICE.md, CLAUDE.md §2).
 *
 * Barrel law honored here:
 *  - Server component. No state, no fetch, no formatting.
 *  - Every value resolves through ./tokens.css in ./V3Roll.css.
 *  - An item with no label or no href is dropped; nothing left returns null.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Roll.css'

export type V3RollItem = { label: string; href: string; id?: string }

export type V3RollProps = {
  id: string
  heading: string
  eyebrow?: string
  /** One sentence under the heading. */
  lede?: string
  items: readonly V3RollItem[]
  className?: string
}

function text(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

export function V3Roll({ id, heading, eyebrow, lede, items, className }: V3RollProps) {
  const title = text(heading)
  const rows = items
    .map((item) => {
      const label = text(item.label)
      const href = text(item.href)
      return label && href ? { label, href, id: text(item.id) } : null
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!title || rows.length === 0) return null

  const headingId = `${id}-heading`
  const contextLine = text(eyebrow)
  const basis = text(lede)

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-roll', className)} aria-labelledby={headingId}>
      <div className="v3-roll__head">
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        <V3Heading level={2} id={headingId} className="v3-roll__heading">
          {title}
        </V3Heading>
        {basis ? <p className="v3-roll__lede">{basis}</p> : null}
      </div>
      <ul className="v3-roll__list">
        {rows.map((row) => (
          <li key={row.href + row.label} id={row.id} className="v3-roll__item">
            <Link href={row.href} className="v3-roll__link">
              {row.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
