/**
 * PATTERN 7: DOORS. The page's routing moment: two to four intents, side by
 * side, each one door with a kicker, a display-face line, and one live fact.
 *
 * Visual language: design_system/public/PUBLIC_UI.md, built on ./tokens.css.
 * Optional line pictogram (Buy / Sell / Work) sits above the kicker when set.
 * No heritage downtown art. No clip-art.
 *
 * HIERARCHY (SITE-48, 2026-09-09). Four equal bordered cells with an arrow in
 * each is the silhouette of the banned card grid, and the taste table named it
 * on /contact by that name: "four visually identical hairline cells … the same
 * phone number restated twice". A band that is a REACH CONTROL — one thing the
 * reader is meant to do, with lighter alternatives — marks one door `primary`.
 * That door renders first, at display scale, and holds the section's live
 * state; the rest render as a light link column beside it. A band that is a
 * ROUTING MOMENT (four equal destinations at the close of a page) marks none,
 * and renders exactly as it always did — every existing caller is byte-
 * identical.
 */
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import { V3Icon } from './V3Icon'
import './tokens.css'
import './V3Doors.css'

export type V3DoorPictogram = 'buy' | 'sell' | 'work'

export type V3Door = {
  /** The intent word: "Buying". Uppercase tracked, muted. */
  kicker: V3Text
  /** The door's promise, display face: "See every home for sale". */
  label: V3Text
  /** One live fact under the promise. Omit rather than estimate (section 0). */
  fact?: V3Text
  href: string
  /** Optional owned still. When set, art sits above the kicker. */
  imageSrc?: string
  /** Accessible name for the still. Defaults to empty decorative. */
  imageAlt?: string
  /** Clean line pictogram. Preferred over heritage image art on Home. */
  pictogram?: V3DoorPictogram
  /**
   * The one door the band is FOR. At most one per band: it renders first, at
   * display scale, and the others fall back to a light link column. Leave it
   * off on a routing band where the destinations are genuinely equal.
   */
  primary?: boolean
  /**
   * A live state for the primary door — an element whose text changes with the
   * world (office hours against the clock, a queue that is or is not moving).
   * Section 0 applies: pass a state that is read, never one that is asserted.
   * Ignored on a door that is not primary, because a band with four live
   * states has no hierarchy again.
   */
  live?: ReactNode
}

export type V3DoorsProps = {
  id: string
  /** The section's accessible name; never rendered visually. */
  name: V3Text
  /** Two to four doors. One door is a button, five is a nav. */
  doors: readonly [V3Door, V3Door, ...V3Door[]]
  className?: string
}

function IconArrow() {
  return <V3Icon name="ArrowRight" size={20} />
}

const DOOR_PICTOGRAM = {
  buy: 'Home',
  sell: 'HomeSale',
  work: 'Building',
} as const

function DoorPictogram({ kind }: { kind: V3DoorPictogram }) {
  return <V3Icon name={DOOR_PICTOGRAM[kind]} size={40} />
}

export function V3Doors({ id, name, doors, className }: V3DoorsProps) {
  const shown = doors.slice(0, 4)
  // The primary door leads the band in the DOM as well as on the page: the
  // reader who tabs and the reader who looks meet the same first thing, and
  // the CSS grid can then give column one to `:first-child` without a second
  // source of truth for which door that is.
  const leadIndex = shown.findIndex((d) => d.primary)
  const ordered = leadIndex > 0 ? [shown[leadIndex]!, ...shown.filter((_, i) => i !== leadIndex)] : shown
  const hasLead = leadIndex >= 0

  return (
    <section
      id={id}
      aria-label={name}
      className={cn(V3_ROOT_CLASS, 'v3-doors', hasLead && 'v3-doors--lead', className)}
    >
      {/* The light column's row count, so `grid-row: 1 / -1` on the lead has
          EXPLICIT lines to resolve against. Without it `-1` names the last
          explicit line — line 2 with no template — and the lead occupied row
          one only, which left the first light door stretched to the lead's
          height with a third of its cell empty. */}
      <ul
        className="v3-doors__list"
        style={hasLead ? ({ '--v3-doors-rows': ordered.length - 1 } as CSSProperties) : undefined}
      >
        {ordered.map((door, index) => {
          const isLead = hasLead && index === 0
          return (
            <li key={door.href} className={cn('v3-doors__item', isLead && 'v3-doors__item--lead')}>
              <Link href={door.href} className={cn('v3-doors__door', isLead && 'v3-doors__door--lead')}>
                {door.pictogram ? (
                  <span className="v3-doors__pictogram" aria-hidden="true">
                    <DoorPictogram kind={door.pictogram} />
                  </span>
                ) : door.imageSrc ? (
                  <span className="v3-doors__art" aria-hidden={door.imageAlt ? undefined : true}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={door.imageSrc} alt={door.imageAlt ?? ''} width={640} height={400} decoding="async" />
                  </span>
                ) : null}
                <span className="v3-doors__kicker">{door.kicker}</span>
                <span className="v3-doors__label">{door.label}</span>
                <span className="v3-doors__foot">
                  {door.fact ? <span className="v3-doors__fact">{door.fact}</span> : null}
                  <span className="v3-doors__arrow">
                    <IconArrow />
                  </span>
                </span>
              </Link>
              {isLead && door.live ? <div className="v3-doors__live">{door.live}</div> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
