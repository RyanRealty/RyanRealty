/**
 * V3 PLACE STRIP — a claim with its live figure, and the places it covers
 * drawn as a strip of marks, each a door (site queue SITE-92 round 5).
 *
 * WHY. The regional alerts sheet at the foot of the city index was "a
 * centered label, input, and navy button with nothing else in the viewport —
 * a stock SaaS newsletter form with no data, mark, or motion" (the separate
 * evaluator, round 4). The ask has data behind it — the region's real 30-day
 * count, the same figure the fold's strip prints — and a scope: every town the
 * alert covers. This primitive puts both on the surface, in the Atlas's own
 * language: the count as the installed digit primitive (components/motion/
 * number.tsx through V3Number; served settled, never counting up on load) in
 * one plain sentence, then every place as its recorded outline (V3PlaceMark,
 * the same boundary the Atlas draws it with) with its name under it, each a
 * door to the place's page, then the §0 disclosure for the figure.
 *
 * WHAT IT WILL NOT DO. It prints the strings it is handed and computes no
 * figure. A claim with no count prints its sentence alone — absent is not
 * zero. A place with no recorded outline draws the map's point mark, never a
 * picture of somewhere else.
 *
 * Barrel law honored here: imports only ./atoms, ./V3PlaceMark,
 * ./V3Number.client, ./tokens.css, next/link and @/lib/utils; no 'use client';
 * every value from tokens.css; every door at least --v3-tap tall.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SilhouetteTile } from '@/lib/atlas/silhouette-tile'
import { V3SourceDisclosure, V3_ROOT_CLASS, type V3Text } from './atoms'
import { V3Number } from './V3Number.client'
import { V3PlaceMark } from './V3PlaceMark'
import './tokens.css'
import './V3PlaceStrip.css'

export type V3PlaceStripPlace = {
  /** React key and the door's DOM id seed. */
  id: string
  /** The place's name, under its mark; the door's accessible name. */
  name: V3Text
  href: string
  /** The recorded outline as a tile (lib/atlas/silhouette-tile.ts), or null for the point mark. */
  silhouette?: SilhouetteTile | null
}

export type V3PlaceStripProps = {
  id?: string
  /**
   * The claim. `count` is the live figure — the number that drives the digit
   * primitive and the digits as the reader should see them — and `text` is
   * the sentence after it ("houses came on the market in Central Oregon in
   * the last 30 days."). Without a count, `text` is the whole sentence.
   */
  claim: { count?: { value: number; formatted: V3Text }; text: V3Text }
  /** What the strip is: "Every city the alert covers". The list's accessible name. */
  label: V3Text
  places: readonly V3PlaceStripPlace[]
  /** The §0 trace for the count (and the outlines), without the word "Source". */
  source: V3Text
  sourceName?: string | null
  /** When the figure was read. Rendered through the canonical formatter. */
  updatedAt?: string | number | Date | null
  className?: string
}

export function V3PlaceStrip({ id, claim, label, places, source, sourceName, updatedAt, className }: V3PlaceStripProps) {
  const listId = id ? `${id}-places` : undefined
  return (
    <div id={id} className={cn(V3_ROOT_CLASS, 'v3-place-strip', className)}>
      <p className="v3-place-strip__claim">
        {claim.count ? (
          <>
            <V3Number value={claim.count.value} formatted={claim.count.formatted} className="v3-place-strip__num" />{' '}
          </>
        ) : null}
        <span className="v3-place-strip__claim-text">{claim.text}</span>
      </p>
      {places.length > 0 ? (
        <>
          <p className="v3-place-strip__label" id={listId}>
            {label}
          </p>
          <ul className="v3-place-strip__list" aria-labelledby={listId}>
            {places.map((place) => (
              <li key={place.id} className="v3-place-strip__item">
                <Link href={place.href} className="v3-place-strip__place">
                  <span className="v3-place-strip__mark" aria-hidden="true">
                    <V3PlaceMark silhouette={place.silhouette ?? null} />
                  </span>
                  <span className="v3-place-strip__name">{place.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <V3SourceDisclosure
        source={source}
        sourceName={sourceName ?? undefined}
        updatedAt={updatedAt ?? undefined}
        className="v3-place-strip__source"
      />
    </div>
  )
}
