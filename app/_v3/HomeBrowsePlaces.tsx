/**
 * Browse places on Home `/`: city and resort chip doors.
 * PAGE_INVENTORY §5. Equal text chips in a multi-column grid.
 * No uneven mark thumbnails.
 */
import Link from 'next/link'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import './home-browse-places.css'

export type HomePlaceDoor = {
  label: string
  href: string
}

export function HomeBrowsePlaces({
  doors,
  id = 'places',
  eyebrow = 'Central Oregon',
  heading = 'Browse places',
}: {
  doors: readonly HomePlaceDoor[]
  /** Bound in app/page.tsx for ci:page-purpose (id must appear in the page source). */
  id?: string
  eyebrow?: string
  heading?: string
}) {
  const shown = doors.filter((d) => d.label.trim() && d.href.trim())
  if (shown.length === 0) return null

  return (
    <section
      id={id}
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
              <span className="home-browse-places__label">{door.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
