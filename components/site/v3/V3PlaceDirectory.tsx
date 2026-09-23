/**
 * PATTERN 9b: DIRECTORY. Every place of one grain, grouped by town, with a
 * multi-part place's parts nested under it — all of it in the served HTML.
 *
 * WHY A NEW PRIMITIVE AND NOT V3PlaceIndex (visibility audit 2026-09-22,
 * SEO-4 / EXP-3; Matt 2026-09-23). V3PlaceIndex is a gazetteer of SIBLINGS: one
 * flat set, each name carrying a measured length. The /subdivisions directory
 * is a TREE — about three thousand recorded subdivisions in a dozen towns, a
 * few hundred of them recorded as a family of phases (Ridge at Eagle Crest is
 * 60 county plats). Flattened, the family's name disappears into its own
 * phases; nested, a reader finds the place by the name they know and then
 * steps into the phase. That nesting is the whole reason for this pattern.
 *
 * EVERY ANCHOR IS IN THE SERVED HTML. Towns and families fold into native
 * `<details>`, the same disclosure V3PlaceIndex and V3Answers use: the markup
 * ships open or closed, so a crawler reaches every page and a reader gets a
 * page a dozen rows tall until they open a town. Browser find-in-page opens a
 * closed `<details>` on a match, so typing a name still finds it.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./tokens.css, next/link and @/lib/utils.
 *  - No 'use client'. Pure server component, no state, ids from the caller's.
 *  - Every figure arrives preformatted (rule 3 of ci:public-v3).
 *  - Every color, size, rule and duration comes from ./tokens.css.
 *  - Every anchor row is at least `--v3-tap` tall (WCAG 2.5.8).
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3Lede, V3SourceDisclosure, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3PlaceDirectory.css'

/** One part of a multi-part place (a recorded phase). */
export type V3PlaceDirectoryChild = {
  name: string
  href: string
}

/** One place in a town's list. */
export type V3PlaceDirectoryEntry = {
  name: string
  href: string
  /** A short preformatted note: "60 recorded phases". */
  detail?: string
  /** The place's recorded parts, each its own page. */
  children?: readonly V3PlaceDirectoryChild[]
  /** The disclosure label for `children`, preformatted: "60 phases". */
  childrenLabel?: string
}

/** One town. */
export type V3PlaceDirectoryGroup = {
  /** Anchor-safe key: the town slug. */
  key: string
  label: string
  /** Preformatted: "1,204 subdivisions". */
  countLabel?: string
  entries: readonly V3PlaceDirectoryEntry[]
}

export type V3PlaceDirectoryProps = {
  id: string
  eyebrow?: string
  heading: string
  lede?: string
  groups: readonly V3PlaceDirectoryGroup[]
  /** Town keys whose fold starts open. Default: none. */
  openKeys?: readonly string[]
  /** The §0 trace for what the directory lists. */
  source?: string
  className?: string
}

function trimmed(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function DirectoryEntry({ entry, id }: { entry: V3PlaceDirectoryEntry; id: string }) {
  const children = (entry.children ?? []).filter((c) => trimmed(c.name) && trimmed(c.href))
  return (
    <li className="v3-place-dir__item">
      <Link className="v3-place-dir__row" href={entry.href}>
        <span className="v3-place-dir__name">{entry.name}</span>
        {trimmed(entry.detail) ? <span className="v3-place-dir__detail">{entry.detail}</span> : null}
      </Link>
      {children.length > 0 ? (
        <details className="v3-place-dir__parts" id={id}>
          <summary className="v3-place-dir__parts-summary">
            {trimmed(entry.childrenLabel) ?? `${entry.name}, every part`}
          </summary>
          <ul className="v3-place-dir__parts-list">
            {children.map((child) => (
              <li key={child.href} className="v3-place-dir__part">
                <Link className="v3-place-dir__part-link" href={child.href}>
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  )
}

export function V3PlaceDirectory({
  id,
  eyebrow,
  heading,
  lede,
  groups,
  openKeys = [],
  source,
  className,
}: V3PlaceDirectoryProps) {
  const shown = groups.filter((g) => trimmed(g.key) && trimmed(g.label) && g.entries.length > 0)
  const title = trimmed(heading)
  if (shown.length === 0 || !title) return null
  const headingId = `${id}-heading`
  const open = new Set(openKeys)
  const trace = trimmed(source)
  const context = trimmed(eyebrow)
  const claim = trimmed(lede)

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-place-dir', className)} aria-labelledby={headingId}>
      <div className="v3-place-dir__head">
        {context ? <V3Eyebrow>{context}</V3Eyebrow> : null}
        <V3Heading level={2} id={headingId} className="v3-place-dir__heading">
          {title}
        </V3Heading>
        {claim ? <V3Lede className="v3-place-dir__lede">{claim}</V3Lede> : null}
      </div>

      {shown.length > 1 ? (
        <nav className="v3-place-dir__jump" aria-label={`${title}: jump to a town`}>
          <ul className="v3-place-dir__jump-list">
            {shown.map((g) => (
              <li key={g.key}>
                <a className="v3-place-dir__jump-link" href={`#${id}-${g.key}`}>
                  {g.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {shown.map((g) => (
        <details key={g.key} id={`${id}-${g.key}`} className="v3-place-dir__group" open={open.has(g.key)}>
          <summary className="v3-place-dir__group-summary">
            <span className="v3-place-dir__group-name">{g.label}</span>
            {trimmed(g.countLabel) ? <span className="v3-place-dir__group-count">{g.countLabel}</span> : null}
          </summary>
          <ul className="v3-place-dir__list">
            {g.entries.map((entry, i) => (
              <DirectoryEntry key={entry.href} entry={entry} id={`${id}-${g.key}-${i}`} />
            ))}
          </ul>
        </details>
      ))}

      {trace ? <V3SourceDisclosure source={trace} className="v3-place-dir__source" /> : null}
    </section>
  )
}
