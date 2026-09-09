/**
 * PATTERN 9: INDEX. The place tree, named, measured, and crawlable.
 *
 * WHY A NINTH PATTERN AND NOT A QUIET (site queue SITE-30, 2026-09-09).
 *
 * The Atlas draws the places inside a place as touchable outlines, and it is a
 * client component: its region names and hrefs reach the browser inside the
 * hydration payload and nowhere else. Measured on 2026-09-09 against the served
 * HTML of the live tree: /cities/bend carried ZERO `<a href="/subdivisions/…">`
 * (its only 22 occurrences of that string were storage image URLs),
 * /communities/tetherow carried 47 occurrences of which 46 were escaped JSON in
 * the RSC payload and exactly one was a real anchor. A link that exists only in
 * a hydration payload is not a link — no crawler follows it, and the 511
 * sitemapped plat pages therefore had essentially no contextual inbound links
 * from the pages that own them.
 *
 * Quiet (pattern 6) already "carries the graph's outbound edges", and that is
 * the right register for a handful of exits at the close of a node. It is the
 * wrong form for sixty siblings that differ from one another by a measurement:
 * Quiet's rows are one-per-line hairline doors with no column for a figure and
 * no comparison between rows, so sixty of them read as the scrolling list
 * TASTE.md bans by name. This pattern is what an index actually is — a dense
 * multi-column gazetteer where each name carries its own figure and every
 * figure is drawn as a length, so the set reads as one comparison and the
 * reader can see which sibling is the big one before reading a single number.
 *
 * THE LIST AND THE MAP CANNOT DISAGREE. The caller passes the SAME array it
 * hands the Atlas (plus, on a city, the plats the map does not draw), so a
 * place drawn above always has its anchor below. An entry whose count is null
 * prints no figure rather than a zero — §0: unknown is not zero.
 *
 * EVERY ANCHOR IS IN THE SERVED HTML, including the ones behind the fold. The
 * fold is a native `<details>`, the same disclosure V3Answers uses for the same
 * reason: the markup ships whether or not it is open, so the crawler and the
 * reader who wants everything both get all of it, and the reader who does not
 * gets a section twelve rows tall instead of sixty.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./tokens.css, next/link and @/lib/utils.
 *  - No 'use client'. Pure server component: no state, no effects, no hooks,
 *    which is why every id derives from the caller's `id`.
 *  - Every color, size, rule and duration comes from ./tokens.css. The bar
 *    length is a caller-computed share written to a custom property; this
 *    primitive never does arithmetic on a figure it would then have to keep
 *    consistent with a trace.
 *  - Rows are `--v3-tap` tall, so every anchor is a 44px hit area (WCAG 2.5.8).
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Button, V3Eyebrow, V3Heading, V3Lede, V3SourceDisclosure, V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3PlaceIndex.css'

/** One place inside the place this section sits on. */
export type V3PlaceIndexEntry = {
  /** The published name. Also the anchor's accessible name. */
  name: string
  /** Where the place's own page is. */
  href: string
  /**
   * The one measurement this index publishes for every row, already counted by
   * the caller's read. `null` (or omitted) prints NOTHING — an unmeasured place
   * is not a place with none (§0).
   */
  count?: number | null
  /** React key when two entries could share an href. Defaults to href. */
  key?: string
}

export type V3PlaceIndexProps = {
  id: string
  /** The uppercase context line. */
  eyebrow?: string
  /** The section's visible title and its accessible name. */
  heading: string
  /** One plain sentence: the claim this index makes. */
  lede?: string
  /**
   * What `count` counts, in the reader's words: "homes for sale",
   * "sales on record". Required whenever any entry carries a count, because a
   * bare column of integers beside place names is a number with no noun.
   */
  countLabel?: string
  entries: readonly V3PlaceIndexEntry[]
  /**
   * Rows outside the fold. The rest ship in a native `<details>` — present in
   * the HTML, one control away from the reader. Default 12.
   */
  foldAfter?: number
  /**
   * The door out, for a place whose tree is bigger than a page should print.
   * Bend holds 1,519 recorded plats above the publishing floor; the index shows
   * the largest of them and this is where the rest live. Tertiary by rule — an
   * index is not where a page earns its primary ask.
   */
  action?: { label: string; href: string }
  /** The §0 trace for the counts. Rendered as the collapsed disclosure. */
  source?: string
  className?: string
}

type Row = {
  name: string
  href: string
  count: number | null
  key: string
  /** Share of the largest count in the set, 0..1. null when there is no count. */
  share: number | null
}

function trimmed(value: string | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

/**
 * Drops what cannot render honestly, orders the set, and computes each row's
 * share of the largest count.
 *
 * Order: measured rows first, biggest count first, then everything else
 * alphabetically. A reader scanning an index wants the significant places at
 * the top and the long tail in a findable order, and the two halves are not
 * comparable — a row with no measurement cannot be ranked against one with a
 * measurement without inventing its number.
 */
export function placeIndexRows(entries: readonly V3PlaceIndexEntry[]): Row[] {
  const seen = new Set<string>()
  const rows: Row[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const name = trimmed(entry.name)
    const href = trimmed(entry.href)
    // An anchor with no name has no accessible name; a name with no
    // destination is not a door. Neither ships.
    if (!name || !href) continue
    const key = trimmed(entry.key) ?? href
    if (seen.has(key)) continue
    seen.add(key)
    const count =
      typeof entry.count === 'number' && Number.isFinite(entry.count) && entry.count >= 0
        ? Math.round(entry.count)
        : null
    rows.push({ name, href, count, key, share: null })
  }

  const largest = rows.reduce((max, r) => (r.count != null && r.count > max ? r.count : max), 0)
  for (const row of rows) {
    row.share = row.count != null && largest > 0 ? row.count / largest : null
  }

  return rows.sort((a, b) => {
    if (a.count != null && b.count != null && a.count !== b.count) return b.count - a.count
    if (a.count != null && b.count == null) return -1
    if (a.count == null && b.count != null) return 1
    return a.name.localeCompare(b.name, 'en-US')
  })
}

function IndexRow({ row, countLabel }: { row: Row; countLabel: string | undefined }) {
  return (
    <li className="v3-place-index__item">
      <Link className="v3-place-index__row" href={row.href}>
        <span className="v3-place-index__name">{row.name}</span>
        {row.count == null ? null : (
          <span className="v3-place-index__figure">
            <span
              className="v3-place-index__bar"
              aria-hidden="true"
              // The length is the caller's share of the caller's largest, not a
              // number this primitive derived from the one it prints.
              style={row.share == null ? undefined : { ['--v3-share' as string]: String(row.share) }}
            />
            <span className="v3-place-index__count">
              {row.count.toLocaleString('en-US')}
              {countLabel ? <span className="v3-place-index__unit"> {countLabel}</span> : null}
            </span>
          </span>
        )}
      </Link>
    </li>
  )
}

/**
 * The index. A section with a head, a grid of named doors each carrying its own
 * measurement, and — past `foldAfter` — one native disclosure holding the rest.
 */
export function V3PlaceIndex({
  id,
  eyebrow,
  heading,
  lede,
  countLabel,
  entries,
  foldAfter = 12,
  action,
  source,
  className,
}: V3PlaceIndexProps) {
  const rows = placeIndexRows(entries)

  // Nothing to index: render nothing. A heading over an empty grid is a dead
  // end, and this primitive will not invent the places that would fill it.
  if (rows.length === 0) return null

  const title = trimmed(heading)
  if (!title) return null

  const headingId = `${id}-heading`
  const contextLine = trimmed(eyebrow)
  const claim = trimmed(lede)
  const trace = trimmed(source)
  const unit = trimmed(countLabel)

  const cut = Math.max(1, foldAfter)
  const lead = rows.slice(0, cut)
  const tail = rows.slice(cut)

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-place-index', className)}
      aria-labelledby={headingId}
    >
      <div className="v3-place-index__head">
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        <V3Heading level={2} id={headingId} className="v3-place-index__heading">
          {title}
        </V3Heading>
        {claim ? <V3Lede className="v3-place-index__lede">{claim}</V3Lede> : null}
      </div>

      <ul className="v3-place-index__list">
        {lead.map((row) => (
          <IndexRow key={row.key} row={row} countLabel={unit} />
        ))}
      </ul>

      {tail.length > 0 ? (
        <details className="v3-place-index__fold">
          <summary className="v3-place-index__fold-summary">
            {/* The summary counts what opening it gives you, so the fold is an
                offer rather than a place to hide the rest of the list. */}
            {`${tail.length.toLocaleString('en-US')} more`}
          </summary>
          <ul className="v3-place-index__list v3-place-index__list--tail">
            {tail.map((row) => (
              <IndexRow key={row.key} row={row} countLabel={unit} />
            ))}
          </ul>
        </details>
      ) : null}

      {action && trimmed(action.label) && trimmed(action.href) ? (
        <p className="v3-place-index__action">
          <V3Button variant="text" href={action.href}>
            {action.label}
          </V3Button>
        </p>
      ) : null}

      {trace ? <V3SourceDisclosure source={trace} className="v3-place-index__source" /> : null}
    </section>
  )
}
