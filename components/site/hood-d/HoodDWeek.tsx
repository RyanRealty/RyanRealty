import Link from 'next/link'
import type { HoodDEvent } from './types'

export function HoodDWeek({ events }: { events: HoodDEvent[] }) {
  if (events.length === 0) return null

  return (
    <section className="hood-d-section" id="this-week">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">This week</span>
          <h2 className="hood-d-display">Nearby events</h2>
        </div>
        <ul className="hood-d-week-list">
          {events.map((event) => (
            <li key={event.href}>
              <Link href={event.href}>
                {event.name}
                {event.detail ? <span>{event.detail}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
