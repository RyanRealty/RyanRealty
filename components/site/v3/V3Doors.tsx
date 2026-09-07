/**
 * PATTERN 7: DOORS. The page's routing moment: two to four intents, side by
 * side, each one door with a kicker, a display-face line, and one live fact.
 *
 * Visual language: design_system/public/PUBLIC_UI.md, built on ./tokens.css.
 * Optional line pictogram (Buy / Sell / Work) sits above the kicker when set.
 * No heritage downtown art. No clip-art.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
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

function DoorPictogram({ kind }: { kind: V3DoorPictogram }) {
  const common = {
    viewBox: '0 0 48 48',
    width: 40,
    height: 40,
    'aria-hidden': true as const,
    focusable: false as const,
  }
  if (kind === 'buy') {
    return (
      <svg {...common}>
        <path
          d="M8 22.5 24 9l16 13.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 21.5V38h24V21.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 38V27h8v11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (kind === 'sell') {
    return (
      <svg {...common}>
        <path
          d="M14 34V14h14l6 6v14H14Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M28 14v6h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 24h10M19 29h10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path
        d="M16 36V18.5L24 12l8 6.5V36"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 36v-8h6v8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="22" r="1.4" fill="currentColor" />
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
          </li>
        ))}
      </ul>
    </section>
  )
}
