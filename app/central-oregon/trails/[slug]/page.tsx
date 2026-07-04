// @no-parity — content-engine route, replicates the golf/venue detail KB
// register in code (docs/CONTENT_ENGINE_SPEC.md §11b), not a Wave-3 mockup.
/**
 * /central-oregon/trails/[slug] — trail detail page, KB design.
 *
 * Pairs a verified trail profile (a per-trail hero, an original write-up, the
 * facts, a link OUT to the official land-manager page) with the live homes for
 * sale within about 1.5 miles of the trailhead (the moat), a map, the city
 * market read, and an FAQ + FAQPage schema. Data ONLY through @/lib/data (G8).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTrailDetail, getTrailLineGeoJSON, type TrailHomeTile } from '@/lib/data'
import {
  CO_TRAILS,
  getTrailBySlug,
  TRAIL_USE_LABEL,
  TRAIL_DIFFICULTY_LABEL,
  type CoTrail,
} from '@/data/co-trails'
import { TRAIL_HERO_CREDITS } from '@/data/trail-hero-credits'
import { buildTrailFaq } from '@/lib/trails-format'
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

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_TRAILS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const trail = getTrailBySlug(slug)
  if (!trail) notFound()
  const useWord =
    trail.use === 'mtb' ? 'mountain-bike trail' : trail.use === 'both' ? 'hiking and biking trail' : 'hiking trail'
  const desc = `${trail.name}, a ${useWord} near ${trail.city}, Central Oregon. What it is, where the trailhead is, and the homes for sale nearby, from Ryan Realty.`
  return pageMetadata({
    title: `${trail.name} | Central Oregon Trails`,
    description: desc,
    path: `/central-oregon/trails/${slug}`,
  })
}

function homeToFeatured(home: TrailHomeTile): KbFeaturedItem {
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

function homeToPin(home: TrailHomeTile): VenuePin | null {
  if (typeof home.lat !== 'number' || typeof home.lng !== 'number') return null
  return { lat: home.lat, lng: home.lng, href: home.href, price: home.price }
}

function distanceLabel(trail: CoTrail): string | null {
  if (typeof trail.lengthMiles !== 'number') return null
  const unit = trail.lengthMiles === 1 ? 'mile' : 'miles'
  return `${trail.lengthMiles} ${unit}${trail.distanceNote ? ` ${trail.distanceNote}` : ''}`
}

export default async function TrailDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getTrailDetail(slug).catch(() => null)
  const trail = detail?.trail ?? getTrailBySlug(slug)
  if (!trail) notFound()

  // Authoritative route linework (public.trail_lines) — null → point-only map.
  const trailLine = await getTrailLineGeoJSON(slug).catch(() => null)

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedTrails =
    detail?.relatedTrails ?? CO_TRAILS.filter((t) => t.slug !== trail.slug && t.city === trail.city)
  const cityMarket = detail?.cityMarket ?? null

  const hero = TRAIL_HERO_CREDITS[slug]
  const heroSrc = hero?.image ?? CONTENT_HERO_IMAGES.trails

  const cards = homes.slice(0, MAX_CARDS)
  const mapPins = homes.map(homeToPin).filter((p): p is VenuePin => p !== null)
  const seeAllHref = `/search?city=${encodeURIComponent(trail.city)}`
  const hasGeo = typeof trail.lat === 'number' && typeof trail.lng === 'number'
  const dist = distanceLabel(trail)

  const medianLabel = stats.medianListPrice != null ? kbMoneyFull(stats.medianListPrice) : null
  const faq = buildTrailFaq(trail, { count: stats.count, medianLabel, cityMarket })

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Trails', url: '/central-oregon/trails' },
        { name: trail.name, url: `/central-oregon/trails/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'TouristAttraction',
      name: trail.name,
      description: trail.blurb,
      url: `/central-oregon/trails/${slug}`,
      address: { city: trail.city, state: 'OR', country: 'US' },
      geo: hasGeo ? { lat: trail.lat as number, lng: trail.lng as number } : undefined,
    },
    { type: 'faqPage', items: faq },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="trails" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Trails', href: '/central-oregon/trails' },
          { label: trail.name },
        ]}
      />

      <SmoothScrollProvider>
        {/* Photo hero */}
        <header
          className="ev-photo-hero"
          style={{ backgroundImage: `url(${heroSrc})` }}
          aria-label={trail.name}
        >
          <div className="ev-photo-hero-scrim" aria-hidden />
          <div className="wrap ev-photo-hero-inner">
            <div className="ev-hero-eyebrow on-photo eyebrow">
              <span className="dot" /> {TRAIL_USE_LABEL[trail.use]} · {trail.city}
            </div>
            <h1 className="ev-hero-h on-photo display">{trail.name}</h1>
          </div>
          {hero ? (
            <a className="ev-photo-hero-credit" href={hero.creditUrl} target="_blank" rel="noopener noreferrer">
              Photo: {hero.credit}
            </a>
          ) : null}
        </header>

        {/* Intro — blurb + facts + the primary "official info" action */}
        <section className="section ev-intro" aria-label="About this trail">
          <div className="wrap">
            <p className="ev-hero-blurb">{trail.blurb}</p>

            <div className="ev-when">
              <div className="ev-fact">
                <span className="ev-fact-lbl">Use</span>
                <span className="ev-fact-val">{TRAIL_USE_LABEL[trail.use]}</span>
              </div>
              {dist ? (
                <div className="ev-fact">
                  <span className="ev-fact-lbl">Distance</span>
                  <span className="ev-fact-val">{dist}</span>
                </div>
              ) : null}
              {trail.difficulty ? (
                <div className="ev-fact">
                  <span className="ev-fact-lbl">Difficulty</span>
                  <span className="ev-fact-val">{TRAIL_DIFFICULTY_LABEL[trail.difficulty]}</span>
                </div>
              ) : null}
              {trail.fee ? (
                <div className="ev-fact">
                  <span className="ev-fact-lbl">Parking</span>
                  <span className="ev-fact-val">{trail.fee}</span>
                </div>
              ) : null}
              <div className="ev-fact">
                <span className="ev-fact-lbl">Where</span>
                <span className="ev-fact-val">{trail.landManager}</span>
                <span className="ev-fact-sub">
                  <a className="ev-inline-link" href={`/cities/${trail.geoSlug}`}>
                    {trail.city}, Oregon
                  </a>
                </span>
              </div>
            </div>

            <a className="ev-shows" href={trail.officialUrl} target="_blank" rel="noopener noreferrer">
              See the official trail and conditions <span className="arr">→</span>
            </a>

            <p className="ev-source mono-num">
              Trail details verified {trail.lastVerified}
              {' · '}
              <a className="ev-source-link" href={trail.officialUrl} target="_blank" rel="noopener noreferrer">
                {trail.landManager}
              </a>
            </p>
          </div>
        </section>

        {/* Trail map + nearby home pins */}
        {hasGeo ? (
          <section className="section ev-map-section" aria-label={`${trail.name} on the map`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{trail.city}</span>
                <h2 className="sec-title display">Homes nearby</h2>
              </div>
              <p className="ev-map-intro">
                {trailLine
                  ? `The ${trail.name} route, drawn from ${trail.landManager} trail data, with the active single-family homes for sale near the trailhead. The line is the trail, the ringed dot is the trailhead.`
                  : `The active single-family homes for sale within about 1.5 miles of the ${trail.name} trailhead, from our listings. The marked point is the trailhead, not a listing.`}
              </p>
            </div>
            <VenueMap
              venue={{ lat: trail.lat as number, lng: trail.lng as number, name: trail.name }}
              listings={mapPins}
              line={trailLine}
              zoom={14}
              height={480}
            />
          </section>
        ) : null}

        {/* Nearby-homes stat band */}
        <section className="section ev-stats" aria-label={`Homes near ${trail.name}`}>
          <div className="wrap">
            <div className="ev-stat-grid">
              <div className="ev-stat">
                <span className="ev-stat-lbl mono-lab">Homes for sale nearby</span>
                <span className="ev-stat-val display">{stats.count.toLocaleString()}</span>
                <span className="ev-stat-sub">
                  Active single-family homes within about 1.5 miles of the trailhead
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
            <KbFeatured items={cards.map(homeToFeatured)} eyebrow={`Homes for sale near ${trail.name}`} />
            {stats.count > cards.length ? (
              <section className="section ev-seeall" aria-label="More homes">
                <div className="wrap">
                  <a className="ev-link" href={seeAllHref}>
                    See more homes in {trail.city} <span className="arr">→</span>
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
                <h2 className="sec-title display">None right at the trailhead</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                There are no active single-family listings within about 1.5 miles of the {trail.name}{' '}
                trailhead right now. Much of the land around it is public forest. Browse current homes
                in {trail.city} instead.
              </p>
              <p style={{ marginTop: '18px' }}>
                <a className="ev-link" href={seeAllHref}>
                  Browse homes in {trail.city} <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        )}

        {/* Community cross-link when the trailhead sits in a resort community */}
        {trail.communitySlug ? (
          <section className="section about" id="community" aria-label="The community near this trail">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Live here</span>
                <h2 className="sec-title display">The community near the trail</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                {trail.name} is close to a Ryan Realty community page with its own boundary, market
                read, and current listings. See what it is like to own a home near it.
              </p>
              <p style={{ marginTop: '18px' }}>
                <a className="ev-link" href={`/communities/${trail.communitySlug}`}>
                  Explore the community <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        ) : null}

        {/* Live city market read — the real-estate moat. */}
        {cityMarket ? <AreaMarketBand market={cityMarket} citySlug={trail.geoSlug} /> : null}

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

        {/* Other trails in the same city */}
        {relatedTrails.length > 0 ? (
          <section className="section about" id="more-trails" aria-label={`Other trails near ${trail.city}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">More trails</span>
                <h2 className="sec-title display">Other trails near {trail.city}</h2>
              </div>
              <ul className="ev-grid">
                {relatedTrails.map((t: CoTrail) => (
                  <li key={t.slug}>
                    <a className="ev-card" href={`/central-oregon/trails/${t.slug}`}>
                      <span className="ev-card-cat mono-num">{TRAIL_USE_LABEL[t.use]}</span>
                      <span className="ev-card-name display">{t.name}</span>
                      <span className="ev-card-meta">
                        <span className="ev-card-where">{t.city}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: '22px' }}>
                <a className="ev-link" href="/central-oregon/trails">
                  All Central Oregon trails <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        ) : null}

        {/* CTA band */}
        <section className="section ev-cta" aria-label="Contact the team">
          <div className="wrap">
            <span className="ev-cta-eyebrow mono-lab">Living near {trail.name}</span>
            <h2 className="ev-cta-h display">Local brokers. Specific numbers. No pressure.</h2>
            <p className="ev-cta-body">
              We work across {trail.city} and the rest of Central Oregon. Tell us what matters to you,
              trail access included, and we will show you the homes that fit.
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
