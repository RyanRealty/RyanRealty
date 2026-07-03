// @no-parity — content-engine route, replicates the event detail KB register in
// code (docs/CONTENT_ENGINE_SPEC.md §11b), not a Wave-3 mockup contract.
/**
 * /central-oregon/venues/[slug] — venue detail page, KB design.
 *
 * The durable "shows" page: a per-venue hero, an original write-up, a prominent
 * link OUT to the venue's own live calendar (we never scrape a lineup, §7), a
 * venue map, the live homes for sale nearby (the moat), and an FAQ + FAQPage
 * schema. Data ONLY through @/lib/data (Gate G8).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getVenueDetail, type VenueHomeTile } from '@/lib/data'
import { CO_VENUES, getVenueBySlug, VENUE_TYPE_LABEL, type CoVenue } from '@/data/co-venues'
import { EVENT_CATEGORY_LABEL, type CoEvent } from '@/data/co-events'
import { VENUE_HERO_CREDITS } from '@/data/venue-hero-credits'
import { buildVenueFaq, venueKindLabel } from '@/lib/venues-format'
import { shortEventDate } from '@/lib/events-format'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { VenueMap, type VenuePin } from '@/components/site/VenueMap'
import { AreaMarketBand } from '@/components/site/AreaMarketBand'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { kbMoneyFull, type KbFeaturedItem } from '@/components/site/kb/types'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import '@/components/site/kb/kb.css'
import '../../events/events.css'

export const dynamicParams = false
export const revalidate = 300

const MAX_CARDS = 12

const SCHEMA_TYPE: Record<CoVenue['kind'], 'MusicVenue' | 'PerformingArtsTheater' | 'EventVenue'> = {
  music: 'MusicVenue',
  'performing-arts': 'PerformingArtsTheater',
  both: 'EventVenue',
}

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_VENUES.map((v) => ({ slug: v.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const venue = getVenueBySlug(slug)
  if (!venue) notFound()
  const desc = `${venue.name} in ${venue.city}, Central Oregon. See what is on, the venue details, and the homes for sale nearby, from Ryan Realty, a local Central Oregon brokerage.`
  return pageMetadata({
    title: `${venue.name} | Central Oregon Live Music & Shows`,
    description: desc,
    path: `/central-oregon/venues/${slug}`,
  })
}

function homeToFeatured(home: VenueHomeTile): KbFeaturedItem {
  return {
    price: home.price,
    address: home.addressLine,
    sub: '',
    city: home.cityLine,
    beds: home.beds,
    baths: home.baths,
    sqft: home.sqft,
    img: home.photoUrl ?? '',
    href: home.href,
    video: home.video,
    tour: home.hasTour,
  }
}

function homeToPin(home: VenueHomeTile): VenuePin | null {
  if (typeof home.lat !== 'number' || typeof home.lng !== 'number') return null
  return { lat: home.lat, lng: home.lng, href: home.href, price: home.price }
}

export default async function VenueDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getVenueDetail(slug).catch(() => null)
  const venue = detail?.venue ?? getVenueBySlug(slug)
  if (!venue) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedVenues =
    detail?.relatedVenues ?? CO_VENUES.filter((v) => v.slug !== venue.slug && v.city === venue.city)
  const eventsHere = detail?.eventsHere ?? []
  const cityMarket = detail?.cityMarket ?? null

  const hero = VENUE_HERO_CREDITS[slug]
  const heroSrc = hero?.image ?? CONTENT_HERO_IMAGES.venues

  const cards = homes.slice(0, MAX_CARDS)
  const mapPins = homes.map(homeToPin).filter((p): p is VenuePin => p !== null)
  const seeAllHref = `/search?city=${encodeURIComponent(venue.city)}`
  const hasGeo = typeof venue.lat === 'number' && typeof venue.lng === 'number'

  const medianLabel = stats.medianListPrice != null ? kbMoneyFull(stats.medianListPrice) : null
  const faq = buildVenueFaq(venue, { count: stats.count, medianLabel, cityMarket })

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Live music & shows', url: '/central-oregon/venues' },
        { name: venue.name, url: `/central-oregon/venues/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: SCHEMA_TYPE[venue.kind],
      name: venue.name,
      description: venue.blurb,
      url: `/central-oregon/venues/${slug}`,
      address: { street: venue.address, city: venue.city, state: 'OR', country: 'US' },
      geo: hasGeo ? { lat: venue.lat as number, lng: venue.lng as number } : undefined,
    },
    { type: 'faqPage', items: faq },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="venues" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Live music & shows', href: '/central-oregon/venues' },
          { label: venue.name },
        ]}
      />

      <SmoothScrollProvider>
        {/* Photo hero */}
        <header className="ev-photo-hero" style={{ backgroundImage: `url(${heroSrc})` }} aria-label={venue.name}>
          <div className="ev-photo-hero-scrim" aria-hidden />
          <div className="wrap ev-photo-hero-inner">
            <div className="ev-hero-eyebrow on-photo eyebrow">
              <span className="dot" /> {VENUE_TYPE_LABEL[venue.venueType]} · {venue.city}
            </div>
            <h1 className="ev-hero-h on-photo display">{venue.name}</h1>
          </div>
          {hero ? (
            <a className="ev-photo-hero-credit" href={hero.creditUrl} target="_blank" rel="noopener noreferrer">
              Photo: {hero.credit}
            </a>
          ) : null}
        </header>

        {/* Intro — blurb + facts + the primary "see upcoming shows" action */}
        <section className="section ev-intro" aria-label="About this venue">
          <div className="wrap">
            <p className="ev-hero-blurb">{venue.blurb}</p>

            <div className="ev-when">
              <div className="ev-fact">
                <span className="ev-fact-lbl">What is on</span>
                <span className="ev-fact-val">{venueKindLabel(venue)}</span>
              </div>
              {venue.capacity ? (
                <div className="ev-fact">
                  <span className="ev-fact-lbl">Capacity</span>
                  <span className="ev-fact-val">{venue.capacity.toLocaleString()}</span>
                </div>
              ) : null}
              <div className="ev-fact">
                <span className="ev-fact-lbl">Where</span>
                <span className="ev-fact-val">{venue.name}</span>
                <span className="ev-fact-sub">
                  <a className="ev-inline-link" href={`/cities/${venue.geoSlug}`}>
                    {venue.city}, Oregon
                  </a>
                </span>
              </div>
            </div>

            <a className="ev-shows" href={venue.calendarUrl} target="_blank" rel="noopener noreferrer">
              {eventsHere.length > 0
                ? `See the full calendar at ${venue.name}`
                : `See upcoming shows at ${venue.name}`}{' '}
              <span className="arr">→</span>
            </a>

            <p className="ev-source mono-num">
              Venue details verified {venue.lastVerified}
              {' · '}
              <a className="ev-source-link" href={venue.officialUrl} target="_blank" rel="noopener noreferrer">
                Official site
              </a>
            </p>
          </div>
        </section>

        {/* On stage here — OUR event pages held at this venue (not the venue's
            external calendar). */}
        {eventsHere.length > 0 ? (
          <section className="section about" id="on-stage" aria-label={`Events at ${venue.name}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">On our calendar</span>
                <h2 className="sec-title display">On stage here</h2>
              </div>
              <ul className="ev-grid">
                {eventsHere.map((e: CoEvent) => {
                  const shortWhen = shortEventDate(e.nextConfirmedDate)
                  return (
                    <li key={e.slug}>
                      <a className="ev-card" href={`/central-oregon/events/${e.slug}`}>
                        <span className="ev-card-cat mono-num">{EVENT_CATEGORY_LABEL[e.category]}</span>
                        <span className="ev-card-name display">{e.name}</span>
                        <span className="ev-card-meta">
                          <span className="ev-card-when mono-num">{shortWhen ?? e.recurrence}</span>
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        ) : null}

        {/* Venue map + nearby home pins */}
        {hasGeo ? (
          <section className="section ev-map-section" aria-label={`${venue.name} on the map`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{venue.city}</span>
                <h2 className="sec-title display">Homes nearby</h2>
              </div>
              <p className="ev-map-intro">
                The active single-family homes for sale within about 1.5 miles of {venue.name}, from
                our listings. The marked point is the venue, not a listing.
              </p>
            </div>
            <VenueMap
              venue={{ lat: venue.lat as number, lng: venue.lng as number, name: venue.name }}
              listings={mapPins}
              zoom={14}
              height={480}
            />
          </section>
        ) : null}

        {/* Nearby-homes stat band */}
        <section className="section ev-stats" aria-label={`Homes near ${venue.name}`}>
          <div className="wrap">
            <div className="ev-stat-grid">
              <div className="ev-stat">
                <span className="ev-stat-lbl mono-lab">Homes for sale nearby</span>
                <span className="ev-stat-val display">{stats.count.toLocaleString()}</span>
                <span className="ev-stat-sub">
                  Active single-family homes within about 1.5 miles of {venue.name}
                </span>
              </div>
              <div className="ev-stat">
                <span className="ev-stat-lbl mono-lab">Median list price</span>
                <span className="ev-stat-val display">{medianLabel ?? '—'}</span>
                <span className="ev-stat-sub">Across those homes, rounded to the nearest thousand</span>
              </div>
            </div>
          </div>
        </section>

        {/* Home cards */}
        {cards.length > 0 ? (
          <>
            <KbFeatured items={cards.map(homeToFeatured)} eyebrow={`Homes for sale near ${venue.name}`} />
            {stats.count > cards.length ? (
              <section className="section ev-seeall" aria-label="More homes">
                <div className="wrap">
                  <a className="ev-link" href={seeAllHref}>
                    See more homes in {venue.city} <span className="arr">→</span>
                  </a>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="section about" id="no-homes" aria-label="No active homes">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Homes for sale</span>
                <h2 className="sec-title display">None nearby right now</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                There are no active single-family listings within about 1.5 miles of {venue.name} at
                the moment. Inventory changes often. Browse current homes in {venue.city}.
              </p>
              <p style={{ marginTop: '18px' }}>
                <a className="ev-link" href={seeAllHref}>
                  Browse homes in {venue.city} <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        )}

        {/* Live city market read — the real-estate moat. */}
        {cityMarket ? <AreaMarketBand market={cityMarket} citySlug={venue.geoSlug} /> : null}

        {/* FAQ */}
        <section className="section about ev-faq" id="faq" aria-label="Common questions">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Good to know</span>
              <h2 className="sec-title display">Common questions</h2>
            </div>
            <dl className="ev-faq-list">
              {faq.map((item) => (
                <div className="ev-faq-item" key={item.question}>
                  <dt className="ev-faq-q">{item.question}</dt>
                  <dd className="ev-faq-a">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Other venues in the same city */}
        {relatedVenues.length > 0 ? (
          <section className="section about" id="more-venues" aria-label={`Other venues in ${venue.city}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">More venues</span>
                <h2 className="sec-title display">Other venues in {venue.city}</h2>
              </div>
              <ul className="ev-grid">
                {relatedVenues.map((v: CoVenue) => (
                  <li key={v.slug}>
                    <a className="ev-card" href={`/central-oregon/venues/${v.slug}`}>
                      <span className="ev-card-cat mono-num">{VENUE_TYPE_LABEL[v.venueType]}</span>
                      <span className="ev-card-name display">{v.name}</span>
                      <span className="ev-card-meta">
                        <span className="ev-card-where">{v.city}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: '22px' }}>
                <a className="ev-link" href="/central-oregon/venues">
                  All Central Oregon venues <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        ) : null}

        {/* CTA band */}
        <section className="section ev-cta" aria-label="Contact the team">
          <div className="wrap">
            <span className="ev-cta-eyebrow mono-lab">Living near {venue.name}</span>
            <h2 className="ev-cta-h display">Local brokers. Specific numbers. No pressure.</h2>
            <p className="ev-cta-body">
              We work across {venue.city} and the rest of Central Oregon. Tell us what matters to you,
              and we will show you the homes that fit.
            </p>
            <div className="ev-cta-row">
              <a className="btn" href="/contact">
                Meet the team <span className="arr">→</span>
              </a>
              <a className="btn ghost" href={`tel:${CONTACT.phoneDirectTel}`}>
                Call {CONTACT.phoneDirect}
              </a>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
