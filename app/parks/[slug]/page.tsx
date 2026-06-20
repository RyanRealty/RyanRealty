/**
 * /parks/[slug] — park detail page, KB (kinetic-brutalist) design.
 *
 * Shows the park's official boundary polygon (from the `boundaries` table,
 * geo_type='park') on a map together with the REAL active single-family homes
 * for sale near it (from our own MLS listings, a ~1.5-mile bounding box), plus
 * a sourced description, amenities, and source attribution.
 *
 * RESTYLED IN PLACE to the KB design system (Phase 9): KbNav + KbFooter chrome,
 * KbHero heading, KB section rhythm (.section/.about, Amboqia display headings,
 * hard --edge borders, mono labels), KbFeatured for the listing grid. The
 * interactive NeighborhoodMap is kept exactly as-is (polygon + nearby-home
 * pins). No content dropped — hero blurb, every amenity, the source attribution,
 * all three stats, the map, the home grid + "see more" link, the empty state,
 * other-parks cross-links, every JSON-LD schema, and the contact CTA are kept.
 *
 * Park facts (blurb, amenities, acreage) are verified + cited in the registry,
 * never invented (CLAUDE.md §0). If a park ever has no polygon, the map frames
 * on the centroid + nearby homes only rather than drawing a wrong shape.
 *
 * Data ONLY through @/lib/data (Gate G8).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getParkDetail,
  getParkBoundaryGeoJSON,
  type ParkHomeTile,
} from '@/lib/data'
import { CO_PARKS, getParkBySlug, type ParkType } from '@/data/co-parks'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { NeighborhoodMap } from '@/components/site/NeighborhoodMap'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { kbMoneyFull, type KbFeaturedItem } from '@/components/site/kb/types'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import '@/components/site/kb/kb.css'

export const dynamicParams = false
export const revalidate = 300

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

const MAX_CARDS = 12

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_PARKS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  // Registry-only — the metadata needs no live data, so it never touches the
  // DB. That keeps a transient listings timeout from failing metadata
  // generation (and shaves a query off every render).
  const park = getParkBySlug(slug)
  if (!park) notFound()

  const typeLabel = TYPE_LABEL[park.type].toLowerCase()
  const desc = `${park.name} is a ${typeLabel} in ${park.city}, Central Oregon. See what is there and the homes for sale nearby, from Ryan Realty, a local Central Oregon brokerage.`

  return pageMetadata({
    title: `${park.name} | Central Oregon Parks`,
    description: desc,
    path: `/parks/${slug}`,
  })
}

function homeToFeatured(home: ParkHomeTile): KbFeaturedItem {
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
  }
}

export default async function ParkDetailPage({ params }: Props) {
  const { slug } = await params

  // The park's core content (blurb, amenities, acreage) comes from the static
  // registry; only the nearby homes need the DB. A transient listings timeout
  // (Supabase 57014) must never fail the static build or 500 the page — degrade
  // to the park with zero homes (which already has its own empty state) and let
  // ISR retry on the next revalidate. getParkDetail returns null for an unknown
  // slug and throws on a DB error; the registry lookup tells the two apart, so a
  // real 404 still 404s while a transient timeout renders the park.
  const detail = await getParkDetail(slug).catch(() => null)
  const park = detail?.park ?? getParkBySlug(slug)
  if (!park) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const nearbyParks =
    detail?.nearbyParks ?? CO_PARKS.filter((p) => p.slug !== park.slug && p.city === park.city)

  // The map frames the park's official boundary polygon, then renders the
  // nearby-home pins inside the same view. The polygon is the authoritative
  // shape; the pins are the verified homes from our listings. On a transient
  // boundary error we degrade to a point-only map (no polygon).
  const polygon = park.hasPolygon
    ? await getParkBoundaryGeoJSON(slug).catch(() => null)
    : null

  const mapPins = homes
    .filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number')
    .map((h) => ({
      lat: h.lat as number,
      lng: h.lng as number,
      href: h.href,
      price: h.price,
    }))

  const typeLabel = TYPE_LABEL[park.type]

  // "See all homes" → search pre-filtered to the park's city (the search route
  // has no dedicated park filter).
  const seeAllHref = `/search?city=${encodeURIComponent(park.city)}`

  const cards = homes.slice(0, MAX_CARDS)

  // ── Structured data: Park + BreadcrumbList. additionalProperty carries only
  //    verified values (acreage + the home-count we actually computed). ──
  const additionalProperty: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Homes for sale near this park', value: stats.count },
  ]
  if (typeof park.acres === 'number') {
    additionalProperty.push({ name: 'Area', value: park.acres, unitText: 'acre' })
  }
  if (stats.medianListPrice != null) {
    additionalProperty.push({
      name: 'Median list price of nearby homes',
      value: stats.medianListPrice,
      unitText: 'USD',
    })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Parks', url: '/parks' },
        { name: park.name, url: `/parks/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Park',
      name: park.name,
      description: park.blurb,
      url: `/parks/${slug}`,
      address: { city: park.city, state: 'OR', country: 'US' },
      geo: { lat: park.lat, lng: park.lng },
      additionalProperty,
    },
  ]

  return (
    <main className="kb-root">
      <ParkDetailStyles />
      <KbNav />
      <KbSectionTracker pageType="parks" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Parks', href: '/parks' }, { label: park.name }]}
      />

      <SmoothScrollProvider>
        {/* Hero heading — type + city eyebrow, park name, sourced blurb */}
        <header className="section park-hero" aria-label={park.name}>
          <div className="wrap">
            <div className="park-hero-eyebrow eyebrow">
              <span className="dot" /> {typeLabel} · {park.city}
            </div>
            <h1 className="park-hero-h display">{park.name}</h1>
            <p className="park-hero-blurb">{park.blurb}</p>
          </div>
        </header>

        {/* About — amenities + source attribution. Every fact traces to sourceUrl. */}
        <section className="section about" id="amenities" aria-label={`Amenities at ${park.name}`}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">What is here</span>
              <h2 className="sec-title display">Amenities</h2>
            </div>

            <ul className="park-amenities">
              {park.amenities.map((amenity) => (
                <li key={amenity} className="park-amenity">
                  <span aria-hidden className="park-amenity-mark">·</span>
                  <span>{amenity}</span>
                </li>
              ))}
            </ul>

            <p className="park-source mono-num">
              Park information: {park.agency}
              {' · '}
              <a className="park-source-link" href={park.sourceUrl} target="_blank" rel="noopener noreferrer">
                View source
              </a>
            </p>
          </div>
        </section>

        {/* Stat band — verified facts only. Navy ledger, Amboqia values. */}
        <section className="section park-stats" aria-label={`${park.name} by the numbers`}>
          <div className="wrap">
            <div
              className="park-stat-grid"
              style={{ ['--park-stat-cols' as string]: typeof park.acres === 'number' ? 3 : 2 }}
            >
              {typeof park.acres === 'number' ? (
                <div className="park-stat">
                  <span className="park-stat-lbl mono-lab">Park size</span>
                  <span className="park-stat-val display">{park.acres.toLocaleString()}</span>
                  <span className="park-stat-sub">Acres</span>
                </div>
              ) : null}
              <div className="park-stat">
                <span className="park-stat-lbl mono-lab">Homes for sale</span>
                <span className="park-stat-val display">{stats.count.toLocaleString()}</span>
                <span className="park-stat-sub">Active single-family homes near this park</span>
              </div>
              <div className="park-stat">
                <span className="park-stat-lbl mono-lab">Median list price</span>
                <span className="park-stat-val display">
                  {stats.medianListPrice != null ? kbMoneyFull(stats.medianListPrice) : '—'}
                </span>
                <span className="park-stat-sub">Across those homes, rounded to the nearest thousand</span>
              </div>
            </div>
          </div>
        </section>

        {/* Map — park boundary polygon + nearby-home pins. Interactive component
            kept as-is; the KB heading sits above it. */}
        {polygon ? (
          <section className="section park-map-section" aria-label={`${park.name} and homes nearby`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">{park.city}</span>
                <h2 className="sec-title display">On the map</h2>
              </div>
              <p className="park-map-intro">
                The park boundary plus the active single-family homes for sale within roughly 1.5
                miles, from our listings.
              </p>
            </div>
            <NeighborhoodMap
              polygons={[
                {
                  slug: park.slug,
                  name: park.name,
                  geometry: polygon,
                },
              ]}
              listings={mapPins}
              zoom={13}
              height={520}
              tone="default"
            />
          </section>
        ) : null}

        {/* Home cards — KbFeatured (canonical KB listing grid). Empty state kept. */}
        {cards.length > 0 ? (
          <>
            <KbFeatured items={cards.map(homeToFeatured)} eyebrow={`Homes for sale near ${park.name}`} />
            {stats.count > cards.length ? (
              <section className="section park-seeall" aria-label="More homes">
                <div className="wrap">
                  <a className="park-link" href={seeAllHref}>
                    See more homes in {park.city} <span className="arr">→</span>
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
                There are no active single-family listings within about 1.5 miles of {park.name} at
                the moment. Inventory changes often. Browse current homes in {park.city} to see what
                is on the market today.
              </p>
              <p style={{ marginTop: '18px' }}>
                <a className="park-link" href={`/search?city=${encodeURIComponent(park.city)}`}>
                  Browse homes in {park.city} <span className="arr">→</span>
                </a>
              </p>
            </div>
          </section>
        )}

        {/* Other parks in the same city */}
        <section className="section about" id="more-parks" aria-label={`Other parks in ${park.city}`}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">More parks</span>
              <h2 className="sec-title display">Other parks in {park.city}</h2>
            </div>
            {nearbyParks.length > 0 ? (
              <ul className="parks-grid">
                {nearbyParks.map((p) => (
                  <li key={p.slug}>
                    <a className="parks-card" href={`/parks/${p.slug}`}>
                      <span className="parks-card-name display">{p.name}</span>
                      <span className="parks-card-meta">
                        <span className="parks-card-type mono-num">{TYPE_LABEL[p.type]}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <p style={{ marginTop: '22px' }}>
              <a className="park-link" href="/parks">
                All Central Oregon parks <span className="arr">→</span>
              </a>
            </p>
          </div>
        </section>

        {/* CTA band */}
        <section className="section park-cta" aria-label="Contact the team">
          <div className="wrap">
            <span className="park-cta-eyebrow mono-lab">Living near {park.name}</span>
            <h2 className="park-cta-h display">Local brokers. Specific numbers. No pressure.</h2>
            <p className="park-cta-body">
              We work across {park.city} and the rest of Central Oregon. Tell us what matters to you,
              the trails, the river, room to roam, and we will show you the homes that fit.
            </p>
            <div className="park-cta-row">
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

/**
 * Route-scoped KB styling for the park detail sections. Scoped under `.kb-root`
 * so it cannot leak into the shadcn site, and kept here (not in shared kb.css,
 * which this group must not touch). Hard navy edges, Amboqia display, mono
 * labels. Motion is CSS-only so it is safe under prefers-reduced-motion.
 */
function ParkDetailStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
/* Hero heading (cream, no photo — this page leads with the map + listings) */
.kb-root .park-hero{background:var(--cream);color:var(--navy);padding-top:clamp(96px,12vw,150px);}
.kb-root .park-hero-eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--navy-70);}
.kb-root .park-hero-eyebrow .dot{width:7px;height:7px;border-radius:50%;background:var(--navy);}
.kb-root .park-hero-h{margin-top:16px;font-size:clamp(2.6rem,8vw,6rem);line-height:.92;letter-spacing:-.01em;}
.kb-root .park-hero-blurb{margin-top:clamp(18px,2.4vw,26px);max-width:62ch;font-size:clamp(1.02rem,1.7vw,1.3rem);line-height:1.5;font-weight:500;color:var(--navy-70);}

/* Amenities */
.kb-root .park-amenities{list-style:none;margin-top:clamp(28px,3.5vw,42px);display:grid;grid-template-columns:1fr;gap:12px 28px;}
@media(min-width:640px){.kb-root .park-amenities{grid-template-columns:repeat(2,1fr);}}
@media(min-width:1040px){.kb-root .park-amenities{grid-template-columns:repeat(3,1fr);}}
.kb-root .park-amenity{display:flex;align-items:flex-start;gap:10px;font-size:1rem;line-height:1.4;color:var(--navy);}
.kb-root .park-amenity-mark{flex-shrink:0;font-weight:700;color:var(--navy);}
.kb-root .park-source{margin-top:clamp(26px,3vw,38px);padding-top:16px;border-top:1px solid var(--navy-12);font-size:.78rem;letter-spacing:.04em;color:var(--navy-70);}
.kb-root .park-source-link{color:var(--navy);font-weight:600;border-bottom:1px solid var(--navy-12);transition:border-color .15s ease;}
.kb-root .park-source-link:hover,.kb-root .park-source-link:focus-visible{border-color:var(--navy);outline:none;}

/* Stat band — navy ledger */
.kb-root .park-stats{background:var(--navy);color:var(--cream);}
.kb-root .park-stat-grid{display:grid;grid-template-columns:1fr;gap:0;padding:clamp(40px,5vw,64px) 0;}
@media(min-width:760px){.kb-root .park-stat-grid{grid-template-columns:repeat(var(--park-stat-cols,3),1fr);}}
.kb-root .park-stat{display:flex;flex-direction:column;gap:10px;padding:8px 0;}
@media(min-width:760px){.kb-root .park-stat{padding:0 clamp(20px,2.5vw,36px);border-left:1px solid var(--cream-12);}.kb-root .park-stat:first-child{padding-left:0;border-left:0;}}
@media(max-width:759px){.kb-root .park-stat{padding:18px 0;border-top:1px solid var(--cream-12);}.kb-root .park-stat:first-child{border-top:0;padding-top:0;}}
.kb-root .park-stat-lbl{color:var(--cream-70);}
.kb-root .park-stat-val{font-size:clamp(2.4rem,6vw,3.6rem);line-height:.95;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}
.kb-root .park-stat-sub{font-size:.82rem;line-height:1.35;color:var(--cream-70);}

/* Map section heading */
.kb-root .park-map-section .park-map-intro{margin-top:18px;max-width:62ch;font-size:.95rem;line-height:1.45;color:var(--navy-70);}

/* See-all link + generic park links */
.kb-root .park-link{display:inline-flex;align-items:center;gap:8px;font-size:.92rem;font-weight:600;letter-spacing:.02em;color:var(--navy);border-bottom:1px solid var(--navy-12);padding-bottom:2px;transition:border-color .15s ease;}
.kb-root .park-link:hover,.kb-root .park-link:focus-visible{border-color:var(--navy);outline:none;}
.kb-root .park-link .arr{transition:transform .18s ease;}
.kb-root .park-link:hover .arr{transform:translateX(4px);}
.kb-root .park-seeall{padding-top:clamp(20px,2.5vw,30px);}

/* Other-parks grid (shares the index card register) */
.kb-root .parks-grid{list-style:none;display:grid;grid-template-columns:1fr;gap:0;margin-top:clamp(26px,3.5vw,42px);border-top:1px solid var(--navy-12);border-left:1px solid var(--navy-12);}
@media(min-width:640px){.kb-root .parks-grid{grid-template-columns:repeat(2,1fr);}}
@media(min-width:1040px){.kb-root .parks-grid{grid-template-columns:repeat(3,1fr);}}
.kb-root .parks-card{display:flex;flex-direction:column;gap:11px;height:100%;padding:22px 22px 24px;border-right:1px solid var(--navy-12);border-bottom:1px solid var(--navy-12);background:var(--cream);transition:background .18s ease,color .18s ease,box-shadow .18s ease;}
@media(hover:hover){.kb-root .parks-card:hover{background:var(--navy);color:var(--cream);box-shadow:var(--shadow-md,0 6px 22px rgba(16,39,66,.16));}}
.kb-root .parks-card:focus-visible{outline:3px solid var(--navy);outline-offset:-3px;}
.kb-root .parks-card-name{font-size:clamp(1.2rem,2.5vw,1.5rem);line-height:1.02;}
.kb-root .parks-card-meta{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin-top:auto;font-size:.78rem;font-weight:600;letter-spacing:.02em;}
.kb-root .parks-card-type{padding:3px 9px;border:1px solid var(--navy);font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;}
.kb-root .parks-card:hover .parks-card-type{border-color:var(--cream-40);color:var(--cream);}

/* CTA band — navy */
.kb-root .park-cta{background:var(--navy);color:var(--cream);padding:clamp(56px,8vw,96px) 0;}
.kb-root .park-cta-eyebrow{display:block;color:var(--cream-70);margin-bottom:16px;}
.kb-root .park-cta-h{font-size:clamp(2rem,5.4vw,3.4rem);line-height:.96;letter-spacing:-.01em;max-width:18ch;}
.kb-root .park-cta-body{margin-top:18px;max-width:60ch;font-size:clamp(1rem,1.6vw,1.18rem);line-height:1.5;color:var(--cream-70);}
.kb-root .park-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:clamp(26px,3.5vw,40px);}
`,
      }}
    />
  )
}
