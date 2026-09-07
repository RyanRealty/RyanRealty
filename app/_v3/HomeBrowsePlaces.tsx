/**
 * Browse places on Home `/`: city and resort chip/pill doors.
 * PAGE_INVENTORY §5. Not V3Quiet hairline rows. Not a KPI grid.
 * Marks reuse chrome community stills when already wired.
 */
import Link from 'next/link'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import './home-browse-places.css'

export type HomePlaceDoor = {
  label: string
  href: string
  /** Optional community still (chrome-marks), decorative. */
  markSrc?: string
}

export function HomeBrowsePlaces({
  doors,
  eyebrow = 'Central Oregon',
  heading = 'Browse places',
}: {
  doors: readonly HomePlaceDoor[]
  eyebrow?: string
  heading?: string
}) {
  const shown = doors.filter((d) => d.label.trim() && d.href.trim())
  if (shown.length === 0) return null

  return (
    <section
      id="places"
      className={`${V3_ROOT_CLASS} home-browse-places`}
      aria-labelledby="places-heading"
    >
      <div className="home-browse-places__head">
        {eyebrow.trim() ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={2} id="places-heading" className="home-browse-places__heading">
          {heading}
        </V3Heading>
      </div>

      <ul className="home-browse-places__chips">
        {shown.map((door) => (
          <li key={door.href} className="home-browse-places__item">
            <Link href={door.href} className="home-browse-places__chip">
              {door.markSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={door.markSrc}
                  alt=""
                  className="home-browse-places__mark"
                  width={28}
                  height={28}
                  decoding="async"
                />
              ) : null}
              <span className="home-browse-places__label">{door.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
