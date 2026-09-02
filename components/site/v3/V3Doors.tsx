/**
 * PATTERN 7: DOORS. The page's routing moment: two to four intents, side by
 * side, each one door with a kicker, a display-face line, and one live fact.
 *
 * Visual language: design_system/public/PUBLIC_UI.md, built on ./tokens.css.
 * Born for the homepage's three routes (Buying / Selling / Investing — Matt
 * 2026-09-01), replacing the 2026-08-16 ArrivalIntent bar that was killed for
 * how it looked, not for what it did. The difference is register: no buttons,
 * no cards, no fills. Hairline dividers, Amboqia for the intent line, one
 * muted fact under it, and a chevron that concedes it is a door. The whole
 * band weighs less than a Stage and routes harder than a nav.
 *
 * Barrel law honored here:
 *  - Server component, real anchors, works before hydration.
 *  - Names are V3Text: an empty kicker or line is a compile error.
 *  - This primitive never fetches and never formats. A `fact` that carries a
 *    figure arrives already published by the caller with its own section 0
 *    trace upstream; a door with no verifiable fact omits `fact` rather than
 *    estimating one.
 *  - No raw color; everything resolves through ./tokens.css in ./V3Doors.css.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import './tokens.css'
import './V3Doors.css'

export type V3Door = {
  /** The intent word: "Buying". Uppercase tracked, muted. */
  kicker: V3Text
  /** The door's promise, display face: "See every home for sale". */
  label: V3Text
  /** One live fact under the promise. Omit rather than estimate (section 0). */
  fact?: V3Text
  href: string
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
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M3.5 10h12m-4.5-5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function V3Doors({ id, name, doors, className }: V3DoorsProps) {
  return (
    <section id={id} aria-label={name} className={cn(V3_ROOT_CLASS, 'v3-doors', className)}>
      <ul className="v3-doors__list">
        {doors.slice(0, 4).map((door) => (
          <li key={door.href} className="v3-doors__item">
            <Link href={door.href} className="v3-doors__door">
              <span className="v3-doors__kicker">{door.kicker}</span>
              <span className="v3-doors__label">{door.label}</span>
              <span className="v3-doors__foot">
                {door.fact ? <span className="v3-doors__fact">{door.fact}</span> : null}
                <span className="v3-doors__arrow">
                  <IconArrow />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
