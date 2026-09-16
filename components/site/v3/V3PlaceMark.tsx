/**
 * V3 PLACE MARK — the designed mark for a place the site has not
 * photographed (SITE-92 round 4).
 *
 * A ledger of places carries a photograph beside each name where the registry
 * holds a verified one. Where it does not, the row used to draw a navy tile
 * with the place's initial, and the separate evaluator read a third of the
 * city index as "a flat navy tile with a single white letter ... the list
 * reads unfinished next to the rows that do carry imagery." A letter is not a
 * picture of anything.
 *
 * This is a DRAWING of the place instead, in the Atlas's own language:
 *
 *  - `silhouette` present: the place's RECORDED OUTLINE, the same boundary the
 *    Atlas draws it with, fitted into the square (lib/atlas/silhouette-tile.ts).
 *    A town's shape is a fact about the town, and it ties the row to the
 *    silhouette the reader just saw on the map above.
 *  - no silhouette: the map's POINT MARK, a navy ring on the cream field —
 *    "a place on the map" — for a place with no recorded boundary. Honest
 *    about what is not recorded; never a picture of somewhere else.
 *
 * Decorative by construction: the row it sits in is one link named by the
 * place, so the SVG is aria-hidden and carries no name. Navy on cream through
 * tokens.css; no literal value anywhere here or in V3PlaceMark.css.
 */
import { cn } from '@/lib/utils'
import type { SilhouetteTile } from '@/lib/atlas/silhouette-tile'
import './tokens.css'
import './V3PlaceMark.css'

export type V3PlaceMarkProps = {
  /** The place's recorded outline as a tile, or null/absent for the point mark. */
  silhouette?: SilhouetteTile | null
  className?: string
}

export function V3PlaceMark({ silhouette, className }: V3PlaceMarkProps) {
  if (silhouette) {
    return (
      <svg
        className={cn('v3-place-mark', 'v3-place-mark--drawn', className)}
        viewBox={silhouette.viewBox}
        aria-hidden="true"
        focusable="false"
      >
        <path d={silhouette.d} />
      </svg>
    )
  }
  return (
    <svg className={cn('v3-place-mark', 'v3-place-mark--point', className)} viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <circle className="v3-place-mark__ring" cx="22" cy="22" r="7.5" />
      <circle className="v3-place-mark__core" cx="22" cy="22" r="2.4" />
    </svg>
  )
}
