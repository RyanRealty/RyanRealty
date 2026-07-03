// @no-parity — content-engine route, replicates the /parks index KB register in
// code (docs/CONTENT_ENGINE_SPEC.md §4), not a Wave-3 mockup contract.
/**
 * /central-oregon/events — Central Oregon events hub, KB (kinetic-brutalist)
 * design. The first spoke of the content engine's events pipeline
 * (docs/CONTENT_ENGINE_SPEC.md §12).
 *
 * Lists every recurring anchor event in the registry (data/co-events.ts):
 * confirmed-upcoming dates first (soonest first), then the annual anchors whose
 * next date the organizer has not yet published. Every date is verified + cited
 * (CLAUDE.md §0) — a page never shows a guessed date. The hub emits an ItemList
 * (the listicle schema AI answer engines cite most) plus breadcrumb + webPage.
 *
 * Matches the /parks index register exactly (KbNav + KbHero + card grid). Data
 * ONLY through @/lib/data (Gate G8).
 */

import type { Metadata } from 'next'
import { getEventsForIndex, getEventsByCategory, getEventsCount } from '@/lib/data'
import { EVENT_CATEGORY_LABEL, type CoEvent } from '@/data/co-events'
import { formatEventDate, shortEventDate } from '@/lib/events-format'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import type { SchemaInput } from '@/lib/site/json-ld'
import '@/components/site/kb/kb.css'
import './events.css'

export const revalidate = 3600

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Events',
    description:
      'Festivals, races, markets, and seasonal events across Central Oregon, from Bend and Redmond to Sisters and Sunriver. Confirmed dates and the homes for sale near each one, from Ryan Realty.',
    path: '/central-oregon/events',
  })
}

function EventCard({ event }: { event: CoEvent }) {
  const when = formatEventDate(event.nextConfirmedDate, event.endDate)
  const shortWhen = shortEventDate(event.nextConfirmedDate)
  return (
    <li>
      <a className="ev-card" href={`/central-oregon/events/${event.slug}`}>
        <span className="ev-card-cat mono-num">{EVENT_CATEGORY_LABEL[event.category]}</span>
        <span className="ev-card-name display">{event.name}</span>
        <span className="ev-card-meta">
          <span className="ev-card-when mono-num">{shortWhen ?? event.recurrence}</span>
          <span className="ev-card-where">
            {event.venue.includes(event.city) ? event.venue : `${event.venue}, ${event.city}`}
          </span>
        </span>
        {when ? <span className="ev-card-full mono-num">{when}</span> : null}
      </a>
    </li>
  )
}

export default function EventsIndexPage() {
  const { upcoming, anchors } = getEventsForIndex()
  const categories = getEventsByCategory()
  const total = getEventsCount()

  const itemListItems = [...upcoming, ...anchors].map((e) => ({
    name: e.name,
    url: `/central-oregon/events/${e.slug}`,
  }))

  const catId = (c: string) => `cat-${c}`

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Central Oregon events', url: '/central-oregon/events' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon Events',
      description:
        'Festivals, races, markets, and seasonal events across Central Oregon, with the homes for sale near each one.',
      url: '/central-oregon/events',
    },
    { type: 'itemList', name: 'Central Oregon events', items: itemListItems },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="events" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Central Oregon events' }]}
      />

      <SmoothScrollProvider>
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Events"
          titleTop="Central Oregon"
          titleBottom="events"
          lead={`${total} of the festivals, races, and seasonal events that anchor the year across Bend, Redmond, Sisters, and Sunriver. Pick one to see its confirmed dates and the homes for sale near the venue.`}
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.events}
          statless
        />

        {upcoming.length > 0 ? (
          <section className="section about" id="upcoming" aria-label="Upcoming events">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Confirmed dates</span>
                <h2 className="sec-title display">Coming up</h2>
              </div>
              <ul className="ev-grid">
                {upcoming.map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* Browse by category — jump chips + a section per category. */}
        {categories.length > 0 ? (
          <section className="section about" id="browse" aria-label="Browse events by category">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Browse</span>
                <h2 className="sec-title display">By category</h2>
              </div>
              <nav className="ev-chips" aria-label="Event categories">
                {categories.map((g) => (
                  <a key={g.category} className="ev-chip" href={`#${catId(g.category)}`}>
                    {EVENT_CATEGORY_LABEL[g.category]}
                    <span className="ev-chip-n mono-num">{g.events.length}</span>
                  </a>
                ))}
              </nav>
            </div>
          </section>
        ) : null}

        {categories.map((g) => (
          <section
            key={g.category}
            className="section about"
            id={catId(g.category)}
            aria-label={`${EVENT_CATEGORY_LABEL[g.category]} events`}
          >
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{g.events.length} in Central Oregon</span>
                <h2 className="sec-title display">{EVENT_CATEGORY_LABEL[g.category]}</h2>
              </div>
              <ul className="ev-grid">
                {g.events.map((event) => (
                  <EventCard key={event.slug} event={event} />
                ))}
              </ul>
            </div>
          </section>
        ))}

        {upcoming.length === 0 && anchors.length === 0 ? (
          <section className="section about" id="events" aria-label="Events">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon</span>
                <h2 className="sec-title display">Events</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                The events calendar is being updated. Browse{' '}
                <a className="ev-inline-link" href="/parks">
                  Central Oregon parks
                </a>{' '}
                or{' '}
                <a className="ev-inline-link" href="/cities">
                  cities
                </a>{' '}
                in the meantime.
              </p>
            </div>
          </section>
        ) : null}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
