/**
 * PATTERN 11: DOOR BOARD. Every place on a board, each with its picture, its
 * live figure, and the doors it opens — every door carrying the count it
 * opens onto.
 *
 * WHY AN ELEVENTH PATTERN (site queue SITE-92 round 5, the city index). The
 * second, third and fourth door of every featured city — its guide, its
 * inventory, its open houses, Bend's luxury page — rendered as a Quiet: fifteen
 * cities × two links as thirty identical icon+text+arrow rows. The separate
 * evaluator named it by the brief's own refuse line: "exactly the 'link farm
 * of city names with no figure' the brief refuses, and it repeats the same row
 * shape as the ledger just above it with none of the ledger's visual
 * encoding." Quiet is the right form for a handful of exits; it has no
 * picture, no figure column, and no place for a door's own count.
 *
 * THE FORM IS A BOARD OF PLACES, not a list and not a card grid: one packed
 * grid of tiles, each led by the photograph we can vouch for (or the place's
 * recorded outline drawn in the Atlas's own language where we hold none), the
 * place's name in the display face, its live figure as the installed digit
 * primitive (components/motion/number.tsx through V3Number — the served face is
 * the sourced figure; digits move only when the value changes, never on
 * load), one plain line, and its doors as a tap-height row where each door
 * prints the count it opens onto. Hairlines above tiles, not boxes; radius 0;
 * no shadow. The tile with the largest figure leads the board across two
 * columns, the way the ledger's largest bar carries the full track.
 *
 * WHAT IT WILL NOT DO (§0). It prints exactly the strings it is handed: no
 * count is computed here, no figure formatted, no photograph picked. A tile
 * with no published figure prints the caller's `absent` line ("No live count")
 * and never a zero; a door with no figure prints its label alone. The board's
 * one source disclosure carries the caller's trace for every figure on it.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./V3Number.client, ./tokens.css, next/link, @/lib/utils.
 *  - No 'use client'. Pure server component; V3Number is the one island inside.
 *  - Every color, size, rule and duration comes from ./tokens.css.
 *  - Every door and every face is at least --v3-tap tall (WCAG 2.5.8).
 */
import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3SourceDisclosure, V3_ROOT_CLASS, type V3Text } from './atoms'
import { V3Number } from './V3Number.client'
import './tokens.css'
import './V3DoorBoard.css'

/**
 * A live figure: the number that drives the digit primitive and the digits as
 * the reader should see them, plus what they count. `formatted` is what a
 * crawler and a no-JS reader get; `value` is what the wheel turns to when the
 * figure changes after load. Both are the caller's, so the face and the
 * caller's source trace are one string.
 */
export type V3DoorBoardFigure = {
  value: number
  formatted: V3Text
  /** What the digits count: "single-family for sale", "this week", "at $1.5M+". */
  unit?: V3Text
}

/** One door on a tile, and the count it opens onto when a source published one. */
export type V3DoorBoardDoor = {
  /** The door's visible label on its tile: "Homes for sale". */
  label: V3Text
  /**
   * The rest of the link's name, which the tile already says beside it ("in
   * Bend"): kept in the link's text, visually hidden, so a reader who cannot
   * see the tile and a crawler both get the whole door — the same anchor text
   * the Quiet rows carried — without printing the city on every door.
   */
  rest?: V3Text
  href: string
  figure?: V3DoorBoardFigure
  id?: string
}

export type V3DoorBoardTile = {
  /** React key and the tile's DOM id seed. */
  id: string
  /** The place's name, in the display face; the accessible name of its face link. */
  name: V3Text
  /** The place's own page: the photograph and the name open it. */
  href: string
  /**
   * A verified photograph OF THE PLACE. Decorative by construction — the face
   * link is named by `name` — so it renders `alt=""`. Absent when we hold none.
   */
  media?: { src: string }
  /**
   * The drawn mark for a place with no photograph: its recorded outline
   * (V3PlaceMark with a silhouette) or the map's point mark. Decorative.
   */
  mark?: ReactNode
  /** The place's live figure. */
  figure?: V3DoorBoardFigure
  /** The honest line when no source published a figure: "No live count". */
  absent?: V3Text
  /** One plain line under the figure: the median ask, the verdict. */
  line?: V3Text
  /** The doors this place opens. One to four. */
  doors: readonly V3DoorBoardDoor[]
  /** The tile that leads the board (the caller's largest figure). At most one. */
  lead?: boolean
}

export type V3DoorBoardProps = {
  id: string
  eyebrow?: V3Text
  /** The section's visible title and its accessible name. */
  heading: V3Text
  headingLevel?: 1 | 2
  /** One plain sentence: what the board is and what its figures count. */
  lede?: V3Text
  tiles: readonly V3DoorBoardTile[]
  /** The §0 trace for every figure on the board, without the word "Source". */
  source: V3Text
  /** The source's name for the disclosure's compact clause. */
  sourceName?: string | null
  /** The freshness stamp, PREFORMATTED by the caller through lib/format/date. */
  updated?: V3Text
  className?: string
}

function Figure({ figure, className }: { figure: V3DoorBoardFigure; className: string }) {
  return (
    <span className={className}>
      <V3Number value={figure.value} formatted={figure.formatted} className={`${className}-digits`} />
      {figure.unit ? <span className={`${className}-unit`}>{figure.unit}</span> : null}
    </span>
  )
}

function Tile({ tile, anchorId }: { tile: V3DoorBoardTile; anchorId: string }) {
  const pictured = Boolean(tile.media?.src?.trim())
  const drawn = !pictured && tile.mark != null
  return (
    <li
      /* Namespaced under the board: a bare place slug as a DOM id would collide
         with any other block on the page that names the same place. */
      id={anchorId}
      className={cn(
        'v3-door-board__tile',
        tile.lead && 'v3-door-board__tile--lead',
        pictured && 'v3-door-board__tile--pictured',
        drawn && 'v3-door-board__tile--drawn',
      )}
    >
      <h3 className="v3-door-board__name">
        <Link href={tile.href} className="v3-door-board__face">
          {pictured || drawn ? (
            <span className="v3-door-board__media" aria-hidden="true">
              {pictured && tile.media ? (
                /* Plain img, not next/image: owned files under public/ and
                   graded library frames share this column and must render
                   identically without image-host configuration. Decorative:
                   the face is named by the place's name beside it. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="v3-door-board__photo" src={tile.media.src} alt="" loading="lazy" decoding="async" />
              ) : (
                tile.mark
              )}
            </span>
          ) : null}
          <span className="v3-door-board__name-text">{tile.name}</span>
        </Link>
      </h3>
      {tile.figure ? (
        <p className="v3-door-board__figure">
          <Figure figure={tile.figure} className="v3-door-board__count" />
        </p>
      ) : tile.absent ? (
        <p className="v3-door-board__figure v3-door-board__figure--absent">{tile.absent}</p>
      ) : null}
      {tile.line ? <p className="v3-door-board__line">{tile.line}</p> : null}
      {tile.doors.length > 0 ? (
        <ul className="v3-door-board__doors">
          {tile.doors.slice(0, 4).map((door) => (
            <li key={door.id ?? door.href} className="v3-door-board__door-item">
              <Link href={door.href} className="v3-door-board__door">
                <span className="v3-door-board__door-label">
                  {door.label}
                  {door.rest ? <span className="v3-door-board__door-rest"> {door.rest}</span> : null}
                </span>
                {door.figure ? <Figure figure={door.figure} className="v3-door-board__door-figure" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function V3DoorBoard({
  id,
  eyebrow,
  heading,
  headingLevel = 2,
  lede,
  tiles,
  source,
  sourceName,
  updated,
  className,
}: V3DoorBoardProps) {
  // Nothing on the board: render nothing. A heading over an empty board would
  // claim the region has no places, and this primitive invents none.
  if (tiles.length === 0) return null
  const headingId = `${id}-heading`
  // Two already-formatted strings joined the way V3Ledger joins them.
  const trace = updated ? `${source} · updated ${updated}` : source
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-door-board', className)} aria-labelledby={headingId}>
      <div className="v3-door-board__head">
        {eyebrow ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id={headingId}>
          {heading}
        </V3Heading>
        {lede ? <p className="v3-door-board__lede">{lede}</p> : null}
      </div>
      <ul className="v3-door-board__tiles">
        {tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} anchorId={`${id}-${tile.id}`} />
        ))}
      </ul>
      <V3SourceDisclosure source={trace} sourceName={sourceName ?? undefined} className="v3-door-board__source" />
    </section>
  )
}
