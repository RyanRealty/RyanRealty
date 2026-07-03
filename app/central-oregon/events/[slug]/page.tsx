// @no-parity — content-engine route, replicates the /parks/[slug] KB register in
// code (docs/CONTENT_ENGINE_SPEC.md §4), not a Wave-3 mockup contract.
/**
 * /central-oregon/events/[slug] — event detail page, KB design. The reference
 * template for the content engine (docs/CONTENT_ENGINE_SPEC.md §11b): per-geo
 * photo hero, venue map, live-homes moat block, FAQ + FAQPage schema, broker
 * POV, and dense cross-links.
 *
 * CLAUDE.md §0: dates + facts come from the verified registry (data/co-events.ts)
 * and every stat traces to a source. The Event JSON-LD is emitted ONLY when a
 * real `nextConfirmedDate` exists — never with a guessed date. FAQ answers are
 * built from verified facts only.
 *
 * Data ONLY through @/lib/data (Gate G8).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getEventDetail, type EventHomeTile } from '@/lib/data'
import { CO_EVENTS, getEventBySlug, EVENT_CATEGORY_LABEL, type CoEvent } from '@/data/co-events'
import { CO_VENUES } from '@/data/co-venues'
import { EVENT_HERO_CREDITS } from '@/data/event-hero-credits'
import { formatEventDate, shortEventDate, buildEventFaq } from '@/lib/events-format'
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
import '../events.css'

export const dynamicParams = false
export const revalidate = 300

const MAX_CARDS = 12

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_EVENTS.map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = getEventBySlug(slug)
  if (!event) notFound()

  const when = formatEventDate(event.nextConfirmedDate, event.endDate)
  const timing = when ? `${when}.` : `${event.recurrence}.`
  const desc = `${event.name} in ${event.city}, Central Oregon. ${timing} See the details and the homes for sale near the venue, from Ryan Realty, a local Central Oregon brokerage.`

  return pageMetadata({
    title: `${event.name} | Central Oregon Events`,
    description: desc,
    path: `/central-oregon/events/${slug}`,
  })
}

function homeToFeatured(home: EventHomeTile): KbFeaturedItem {
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
    // MLS background video → autoplays in the tile on scroll-into-view (parity
    // with every other listing grid on the site). Tour badge when media exists
    // but can't autoplay chrome-less.
    video: home.video,
    tour: home.hasTour,
  }
}

function homeToPin(home: EventHomeTile): VenuePin | null {
  if (typeof home.lat !== 'number' || typeof home.lng !== 'number') return null
  return { lat: home.lat, lng: home.lng, href: home.href, price: home.price }
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params

  // Event content (dates, blurb) comes from the static registry; only the
  // nearby homes need the DB. A transient listings timeout must never fail the
  // build or 500 the page — degrade to the event with zero homes and let ISR
  // retry. getEventDetail returns null for an unknown slug and throws on a DB
  // error; the registry lookup tells the two apart.
  const detail = await getEventDetail(slug).catch(() => null)
  const event = detail?.event ?? getEventBySlug(slug)
  if (!event) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedEvents =
    detail?.relatedEvents ?? CO_EVENTS.filter((e) => e.slug !== event.slug && e.city === event.city)

  // Curated per-event hero: a genuinely relevant, licensed photo (place-accurate
  // where a real venue photo exists, otherwise a licensed lifestyle photo) with
  // photographer credit rendered on the hero. Events without a curated hero fall
  // back to the canonical Central Oregon lifestyle photo — never a loose,
  // mismatched geo photo (Matt directive 2026-07-03).
  const hero = EVENT_HERO_CREDITS[slug]
  const heroSrc = hero?.image ?? CONTENT_HERO_IMAGES.events

  const when = formatEventDate(event.nextConfirmedDate, event.endDate)
  const cards = homes.slice(0, MAX_CARDS)
  const mapPins = homes.map(homeToPin).filter((p): p is VenuePin => p !== null)
  const seeAllHref = `/search?city=${encodeURIComponent(event.city)}`
  const hasVenueGeo = typeof event.lat === 'number' && typeof event.lng === 'number'

  const cityMarket = detail?.cityMarket ?? null
  const medianLabel = stats.medianListPrice != null ? kbMoneyFull(stats.medianListPrice) : null
  const faq = buildEventFaq(event, { count: stats.count, medianLabel, cityMarket })

  // ── Structured data. Event is emitted ONLY when a real date exists (§0). ──
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Central Oregon events', url: '/central-oregon/events' },
        { name: event.name, url: `/central-oregon/events/${slug}` },
      ],
    },
  ]
  if (event.nextConfirmedDate) {
    schemas.push({
      type: 'event',
      eventType: event.schemaType,
      name: event.name,
      description: event.blurb,
      url: `/central-oregon/events/${slug}`,
      startDate: event.nextConfirmedDate,
      endDate: event.endDate ?? undefined,
      locationName: event.venue,
      // streetAddress (required for the Event rich result) resolved from the
      // venue registry when the event is held at a venue we describe (§8c fix).
      address: {
        street: CO_VENUES.find((v) => event.venue.toLowerCase().includes(v.name.toLowerCase()))
          ?.address,
        city: event.city,
        state: 'OR',
        country: 'US',
      },
      geo: hasVenueGeo ? { lat: event.lat as number, lng: event.lng as number } : undefined,
      organizerName: event.organizer,
      organizerUrl: event.officialUrl,
      offers: event.priceInfo === 'Free' ? { isFree: true, url: event.officialUrl } : undefined,
    })
  }
  schemas.push({ type: 'faqPage', items: faq })

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="events" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Central Oregon events', href: '/central-oregon/events' },
          { label: event.name },
        ]}
      />

      <SmoothScrollProvider>
        {/* Photo hero — per-geo image + navy scrim + overlaid title. */}
        <header
          className="ev-photo-hero"
          style={{ backgroundImage: `url(${heroSrc})` }}
          aria-label={event.name}
        >
          <div className="ev-photo-hero-scrim" aria-hidden />
          <div className="wrap ev-photo-hero-inner">
            <div className="ev-hero-eyebrow on-photo eyebrow">
              <span className="dot" /> {EVENT_CATEGORY_LABEL[event.category]} · {event.city}
            </div>
            <h1 className="ev-hero-h on-photo display">{event.name}</h1>
          </div>
          {hero ? (
            <a
              className="ev-photo-hero-credit"
              href={hero.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Photo: {hero.credit}
            </a>
          ) : null}
        </header>

        {/* Intro — sourced blurb + when/where fact band + source attribution. */}
        <section className="section ev-intro" aria-label="About this event">
          <div className="wrap">
            <p className="ev-hero-blurb">{event.blurb}</p>

            <div className="ev-when">
              <div className="ev-fact">
                <span className="ev-fact-lbl">{when ? 'Next date' : 'When'}</span>
                <span className="ev-fact-val">{when ?? event.recurrence}</span>
                {when ? <span className="ev-fact-sub">{event.recurrence}</span> : null}
              </div>
              <div className="ev-fact">
                <span className="ev-fact-lbl">Where</span>
                <span className="ev-fact-val">{event.venue}</span>
                <span className="ev-fact-sub">
                  {event.venueParkSlug ? (
                    <a className="ev-inline-link" href={`/parks/${event.venueParkSlug}`}>
                      {event.city} · view the park
                    </a>
                  ) : (
                    event.city
                  )}
                </span>
              </div>
              {event.priceInfo ? (
                <div className="ev-fact">
                  <span className="ev-fact-lbl">Admission</span>
                  <span className="ev-fact-val">{event.priceInfo}</span>
                </div>
              ) : null}
              {event.organizer ? (
                <div className="ev-fact">
                  <span className="ev-fact-lbl">Organizer</span>
                  <span className="ev-fact-val">{event.organizer}</span>
                </div>
              ) : null}
            </div>

            <p className="ev-source mono-num">
              Details verified {event.lastVerified}
              {' · '}
              <a
                className="ev-source-link"
                href={event.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Official event site
              </a>
            </p>
          </div>
        </section>

        {/* Broker POV — first-hand, specific, in brand voice (§3). Optional. */}
        {event.brokerPov ? (
          <section className="section about" id="local-note" aria-label="Local note">
            <div className="wrap">
              <div className="ev-pov">
                <span className="ev-pov-lbl">From the team</span>
                <p className="ev-pov-body">{event.brokerPov}</p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Venue map — a marker at the venue + the live nearby-home pins. */}
        {hasVenueGeo ? (
          <section className="section ev-map-section" aria-label={`${event.venue} on the map`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{event.city}</span>
                <h2 className="sec-title display">Homes nearby</h2>
              </div>
              <p className="ev-map-intro">
                The active single-family homes for sale within about 1.5 miles of {event.venue}, from
                our listings. The marked point is the venue, not a listing.
              </p>
            </div>
            <VenueMap
              venue={{ lat: event.lat as number, lng: event.lng as number, name: event.venue }}
              listings={mapPins}
              zoom={13}
              height={480}
            />
          </section>
        ) : null}

        {/* Nearby-homes stat band — verified live figures only. Navy ledger. */}
        <section className="section ev-stats" aria-label={`Homes near ${event.venue}`}>
          <div className="wrap">
            <div className="ev-stat-grid">
              <div className="ev-stat">
                <span className="ev-stat-lbl mono-lab">Homes for sale nearby</span>
                <span className="ev-stat-val display">{stats.count.toLocaleString()}</span>
                <span className="ev-stat-sub">
                  Active single-family homes within about 1.5 miles of {event.venue}
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

        {/* Home cards — KbFeatured. Empty state kept. */}
        {cards.length > 0 ? (
          <>
            <KbFeatured
              items={cards.map(homeToFeatured)}
              eyebrow={`Homes for sale near ${event.venue}`}
            />
            {stats.count > cards.length ? (
              <section className="section ev-seeall" aria-label="More homes">
                <div className="wrap">
                  <a className="ev-link" href={seeAllHref}>
                    See more homes in {event.city} <span className="arr">→</span>
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
                There are no active single-family listings within about 1.5 miles of {event.venue} at
                the moment. Inventory changes often. Browse current homes in {event.city} to see what
                is on the market today.
              </p>
              <p style={{ marginTop: '18px' }}>
                <a className="ev-link" href={seeAllHref}>
                  Browse homes in {event.city} <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        )}

        {/* Live city market read — the real-estate moat. */}
        {cityMarket ? <AreaMarketBand market={cityMarket} citySlug={event.geoSlug} /> : null}

        {/* FAQ — built from verified facts (§0). Feeds the FAQPage schema. */}
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

        {/* Other events in the same city */}
        {relatedEvents.length > 0 ? (
          <section className="section about" id="more-events" aria-label={`Other events in ${event.city}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">More events</span>
                <h2 className="sec-title display">Other events in {event.city}</h2>
              </div>
              <ul className="ev-grid">
                {relatedEvents.map((e: CoEvent) => {
                  const shortWhen = shortEventDate(e.nextConfirmedDate)
                  return (
                    <li key={e.slug}>
                      <a className="ev-card" href={`/central-oregon/events/${e.slug}`}>
                        <span className="ev-card-cat mono-num">{EVENT_CATEGORY_LABEL[e.category]}</span>
                        <span className="ev-card-name display">{e.name}</span>
                        <span className="ev-card-meta">
                          <span className="ev-card-when mono-num">{shortWhen ?? e.recurrence}</span>
                          <span className="ev-card-where">{e.venue}</span>
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
              <p style={{ marginTop: '22px' }}>
                <a className="ev-link" href="/central-oregon/events">
                  All Central Oregon events <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        ) : null}

        {/* CTA band */}
        <section className="section ev-cta" aria-label="Contact the team">
          <div className="wrap">
            <span className="ev-cta-eyebrow mono-lab">Living near {event.venue}</span>
            <h2 className="ev-cta-h display">Local brokers. Specific numbers. No pressure.</h2>
            <p className="ev-cta-body">
              We work across {event.city} and the rest of Central Oregon. Tell us what matters to you,
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
