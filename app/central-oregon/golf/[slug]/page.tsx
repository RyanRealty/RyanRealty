// @no-parity — content-engine route, replicates the venue/trail detail KB
// register in code (docs/CONTENT_ENGINE_SPEC.md §11b), not a Wave-3 mockup.
/**
 * /central-oregon/golf/[slug] — per-course detail page, KB design.
 *
 * The "each course + homes for sale nearby" layer on top of the CANONICAL golf
 * registry (data/golf/courses.ts) that also powers the /lp/central-oregon-golf
 * hub. One registry, no duplication. Pairs the course profile (broker-shot hero,
 * the registry signature, the facts, an outbound tee-time link) with the live
 * homes within ~1.5 miles of the clubhouse, a map, the city market read, and an
 * FAQ + FAQPage schema. Data ONLY through @/lib/data (Gate G8).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getGolfDetail, type GolfHomeTile } from '@/lib/data'
import { GOLF_COURSES, type GolfCourse } from '@/data/golf/courses'
import { GOLF_ACCESS_LABEL, buildGolfFaq, cityToGeoSlug, displayCity } from '@/lib/golf-format'
import { golfHeroFor } from '@/lib/golf-hero'
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

function courseBySlug(slug: string): GolfCourse | undefined {
  return GOLF_COURSES.find((c) => c.slug === slug)
}

export function generateStaticParams(): Array<{ slug: string }> {
  return GOLF_COURSES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const course = courseBySlug(slug)
  if (!course) notFound()
  const city = displayCity(course.city)
  const desc = `${course.name}, a ${GOLF_ACCESS_LABEL[course.access].toLowerCase()} ${course.holes}-hole golf course in ${city}, Central Oregon. What it is, where it plays, and the homes for sale nearby, from Ryan Realty.`
  return pageMetadata({
    title: `${course.shortName} | Central Oregon Golf`,
    description: desc,
    path: `/central-oregon/golf/${slug}`,
  })
}

function homeToFeatured(home: GolfHomeTile): KbFeaturedItem {
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

function homeToPin(home: GolfHomeTile): VenuePin | null {
  if (typeof home.lat !== 'number' || typeof home.lng !== 'number') return null
  return { lat: home.lat, lng: home.lng, href: home.href, price: home.price }
}

export default async function GolfDetailPage({ params }: Props) {
  const { slug } = await params

  const detail = await getGolfDetail(slug).catch(() => null)
  const course = detail?.course ?? courseBySlug(slug)
  if (!course) notFound()

  const geoSlug = detail?.geoSlug ?? cityToGeoSlug(course.city)
  const city = displayCity(course.city)
  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const relatedCourses =
    detail?.relatedCourses ??
    GOLF_COURSES.filter((c) => c.slug !== course.slug && cityToGeoSlug(c.city) === geoSlug)
  const cityMarket = detail?.cityMarket ?? null

  const heroSrc = golfHeroFor(slug) ?? CONTENT_HERO_IMAGES.golf
  const hasBrokerHero = golfHeroFor(slug) !== null

  const cards = homes.slice(0, MAX_CARDS)
  const mapPins = homes.map(homeToPin).filter((p): p is VenuePin => p !== null)
  const seeAllHref = `/search?city=${encodeURIComponent(city)}`
  const hasGeo = typeof course.lat === 'number' && typeof course.lng === 'number'

  const medianLabel = stats.medianListPrice != null ? kbMoneyFull(stats.medianListPrice) : null
  const faq = buildGolfFaq(course, { count: stats.count, medianLabel, cityMarket })

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Golf', url: '/lp/central-oregon-golf' },
        { name: course.shortName, url: `/central-oregon/golf/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'TouristAttraction',
      name: course.name,
      description: course.signature,
      url: `/central-oregon/golf/${slug}`,
      address: { city, state: 'OR', country: 'US' },
      geo: hasGeo ? { lat: course.lat, lng: course.lng } : undefined,
    },
    { type: 'faqPage', items: faq },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="golf" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Golf', href: '/lp/central-oregon-golf' },
          { label: course.shortName },
        ]}
      />

      <SmoothScrollProvider>
        {/* Photo hero */}
        <header
          className="ev-photo-hero"
          style={{ backgroundImage: `url(${heroSrc})` }}
          aria-label={course.name}
        >
          <div className="ev-photo-hero-scrim" aria-hidden />
          <div className="wrap ev-photo-hero-inner">
            <div className="ev-hero-eyebrow on-photo eyebrow">
              <span className="dot" /> {GOLF_ACCESS_LABEL[course.access]} · {city}
            </div>
            <h1 className="ev-hero-h on-photo display">{course.name}</h1>
          </div>
          {hasBrokerHero ? (
            <span className="ev-photo-hero-credit">Photo: Snowdrift Visuals for Ryan Realty</span>
          ) : null}
        </header>

        {/* Intro — signature + facts + the outbound tee-time action */}
        <section className="section ev-intro" aria-label="About this course">
          <div className="wrap">
            <p className="ev-hero-blurb">{course.signature}</p>

            <div className="ev-when">
              <div className="ev-fact">
                <span className="ev-fact-lbl">Access</span>
                <span className="ev-fact-val">{GOLF_ACCESS_LABEL[course.access]}</span>
              </div>
              <div className="ev-fact">
                <span className="ev-fact-lbl">Holes</span>
                <span className="ev-fact-val">
                  {course.holes} · par {course.par}
                </span>
                {typeof course.yardsBackTees === 'number' ? (
                  <span className="ev-fact-sub mono-num">
                    {course.yardsBackTees.toLocaleString()} yds
                  </span>
                ) : null}
              </div>
              <div className="ev-fact">
                <span className="ev-fact-lbl">Designer</span>
                <span className="ev-fact-val">{course.designer}</span>
                <span className="ev-fact-sub mono-num">Opened {course.yearOpened}</span>
              </div>
              <div className="ev-fact">
                <span className="ev-fact-lbl">Where</span>
                <span className="ev-fact-val">{course.shortName}</span>
                <span className="ev-fact-sub">
                  <a className="ev-inline-link" href={`/cities/${geoSlug}`}>
                    {city}, Oregon
                  </a>
                </span>
              </div>
            </div>

            {course.teeTimeUrl ? (
              <a className="ev-shows" href={course.teeTimeUrl} target="_blank" rel="noopener noreferrer">
                Tee times and course info <span className="arr">→</span>
              </a>
            ) : null}

            <p className="ev-source mono-num">
              Part of the{' '}
              <a className="ev-source-link" href="/lp/central-oregon-golf">
                Central Oregon golf guide
              </a>
            </p>
          </div>
        </section>

        {/* Course map + nearby home pins */}
        {hasGeo ? (
          <section className="section ev-map-section" aria-label={`${course.shortName} on the map`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{city}</span>
                <h2 className="sec-title display">Homes nearby</h2>
              </div>
              <p className="ev-map-intro">
                The active single-family homes for sale within about 1.5 miles of {course.shortName},
                from our listings. The marked point is the course, not a listing.
              </p>
            </div>
            <VenueMap
              venue={{ lat: course.lat, lng: course.lng, name: course.shortName }}
              listings={mapPins}
              zoom={14}
              height={480}
            />
          </section>
        ) : null}

        {/* Nearby-homes stat band */}
        <section className="section ev-stats" aria-label={`Homes near ${course.shortName}`}>
          <div className="wrap">
            <div className="ev-stat-grid">
              <div className="ev-stat">
                <span className="ev-stat-lbl mono-lab">Homes for sale nearby</span>
                <span className="ev-stat-val display">{stats.count.toLocaleString()}</span>
                <span className="ev-stat-sub">
                  Active single-family homes within about 1.5 miles of {course.shortName}
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
            <KbFeatured items={cards.map(homeToFeatured)} eyebrow={`Homes for sale near ${course.shortName}`} />
            {stats.count > cards.length ? (
              <section className="section ev-seeall" aria-label="More homes">
                <div className="wrap">
                  <a className="ev-link" href={seeAllHref}>
                    See more homes in {city} <span className="arr">→</span>
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
                There are no active single-family listings within about 1.5 miles of {course.shortName}{' '}
                at the moment. Inventory changes often. Browse current homes in {city}.
              </p>
              <p style={{ marginTop: '18px' }}>
                <a className="ev-link" href={seeAllHref}>
                  Browse homes in {city} <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        )}

        {/* Community cross-link — the course sits inside a resort community */}
        {course.communitySlug ? (
          <section className="section about" id="community" aria-label="The community around this course">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Live here</span>
                <h2 className="sec-title display">The community around the course</h2>
              </div>
              <p className="about-p" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                {course.shortName} sits inside a Ryan Realty community page with its own boundary,
                market read, and current listings. See what it is like to own a home on this course.
              </p>
              <p style={{ marginTop: '18px' }}>
                <a className="ev-link" href={`/communities/${course.communitySlug}`}>
                  Explore the community <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        ) : null}

        {/* Live city market read — the real-estate moat. */}
        {cityMarket ? <AreaMarketBand market={cityMarket} citySlug={geoSlug} /> : null}

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

        {/* Other courses in the same city */}
        {relatedCourses.length > 0 ? (
          <section className="section about" id="more-courses" aria-label={`Other courses near ${city}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">More golf</span>
                <h2 className="sec-title display">Other courses near {city}</h2>
              </div>
              <ul className="ev-grid">
                {relatedCourses.map((c: GolfCourse) => (
                  <li key={c.slug}>
                    <a className="ev-card" href={`/central-oregon/golf/${c.slug}`}>
                      <span className="ev-card-cat mono-num">
                        {GOLF_ACCESS_LABEL[c.access]} · {c.holes} holes
                      </span>
                      <span className="ev-card-name display">{c.shortName}</span>
                      <span className="ev-card-meta">
                        <span className="ev-card-where">{displayCity(c.city)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: '22px' }}>
                <a className="ev-link" href="/lp/central-oregon-golf">
                  The full Central Oregon golf guide <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        ) : null}

        {/* CTA band */}
        <section className="section ev-cta" aria-label="Contact the team">
          <div className="wrap">
            <span className="ev-cta-eyebrow mono-lab">Living near {course.shortName}</span>
            <h2 className="ev-cta-h display">Local brokers. Specific numbers. No pressure.</h2>
            <p className="ev-cta-body">
              We work across {city} and the rest of Central Oregon. Tell us what matters to you, and
              we will show you the homes that fit, on the course or off it.
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
