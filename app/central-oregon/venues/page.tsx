// @no-parity — content-engine route, replicates the /central-oregon/events KB
// register in code (docs/CONTENT_ENGINE_SPEC.md §11a), not a Wave-3 mockup.
/**
 * /central-oregon/venues — live-music + performing-arts venues hub, KB design.
 *
 * The durable way to cover "music and shows": each venue links to its OWN live
 * calendar for specific concerts and performances (we never scrape a lineup).
 * Two sections — live music and theater / performing arts. Data ONLY through
 * @/lib/data (Gate G8).
 */

import type { Metadata } from 'next'
import { getVenuesForIndex, getVenuesCount } from '@/lib/data'
import { VENUE_TYPE_LABEL, type CoVenue } from '@/data/co-venues'
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
import '../events/events.css'

export const revalidate = 3600

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: 'Central Oregon Live Music & Show Venues',
    description:
      'Where to see live music and shows across Central Oregon, from Hayden Homes Amphitheater and the Tower Theatre to brewery stages and neighborhood theaters. Each venue links to its live calendar, with the homes for sale nearby.',
    path: '/central-oregon/venues',
  })
}

function VenueCard({ venue }: { venue: CoVenue }) {
  return (
    <li>
      <a className="ev-card" href={`/central-oregon/venues/${venue.slug}`}>
        <span className="ev-card-cat mono-num">{VENUE_TYPE_LABEL[venue.venueType]}</span>
        <span className="ev-card-name display">{venue.name}</span>
        <span className="ev-card-meta">
          <span className="ev-card-where">{venue.city}</span>
        </span>
      </a>
    </li>
  )
}

export default function VenuesIndexPage() {
  const { music, performingArts } = getVenuesForIndex()
  const total = getVenuesCount()

  const listItems = [...music, ...performingArts]
    .filter((v, i, arr) => arr.findIndex((x) => x.slug === v.slug) === i)
    .map((v) => ({ name: v.name, url: `/central-oregon/venues/${v.slug}` }))

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Live music & shows', url: '/central-oregon/venues' },
      ],
    },
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      name: 'Central Oregon Live Music & Show Venues',
      description:
        'Live-music and performing-arts venues across Central Oregon, each with its live calendar and the homes for sale nearby.',
      url: '/central-oregon/venues',
    },
    { type: 'itemList', name: 'Central Oregon venues', items: listItems },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="venues" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Live music & shows' }]}
      />

      <SmoothScrollProvider>
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Live music & shows"
          titleTop="Live music"
          titleBottom="& shows"
          lead={`${total} of the venues that carry live music and performing arts across Central Oregon, from the amphitheater on the Deschutes to downtown theaters and brewery stages. Pick one to see what is on and the homes for sale nearby.`}
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.venues}
          statless
        />

        {music.length > 0 ? (
          <section className="section about" id="live-music" aria-label="Live music venues">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Where to hear it</span>
                <h2 className="sec-title display">Live music</h2>
              </div>
              <ul className="ev-grid">
                {music.map((v) => (
                  <VenueCard key={v.slug} venue={v} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {performingArts.length > 0 ? (
          <section className="section about" id="performing-arts" aria-label="Theater and performing arts venues">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">On stage</span>
                <h2 className="sec-title display">Theater & performing arts</h2>
              </div>
              <ul className="ev-grid">
                {performingArts.map((v) => (
                  <VenueCard key={v.slug} venue={v} />
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {total === 0 ? (
          <section className="section about" id="venues" aria-label="Venues">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon</span>
                <h2 className="sec-title display">Venues</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                The venue guide is being updated. Browse{' '}
                <a className="ev-inline-link" href="/central-oregon/events">
                  Central Oregon events
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
