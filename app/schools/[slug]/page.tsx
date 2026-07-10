/**
 * /schools/[slug] — school detail page, KB (kinetic-brutalist) design.
 *
 * Shows the REAL active single-family homes that feed this school (from our own
 * MLS listings), on a map and as listing cards, plus verified academic context,
 * district context, and nearby schools. Academic stats are intentionally absent
 * unless the registry carries a verified value (CLAUDE.md §0 — never invented).
 *
 * RESTYLED IN PLACE to the KB design system (Phase 9). The structure is
 * preserved exactly — breadcrumb · hero · about · stat band · map · feeding-home
 * grid (or empty state) · district + nearby · CTA — just re-skinned to the
 * brutalist register (navy/cream surfaces, Amboqia display headings, hard --edge
 * borders, mono labels, .section/.wrap rhythm). The map swaps the prior
 * NeighborhoodMap for the KB-native KbListingMap (same city-polygon frame + the
 * school's own feeding-home pins, now with beds/baths/sqft in the popup — no
 * content lost). KbNav + KbFooter carry the chrome. Data ONLY through @/lib/data
 * (Gate G8). Every figure is live (§0).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getSchoolDetail,
  getGeoBoundaryMapData,
  type SchoolHomeTile,
} from '@/lib/data'
import { CO_SCHOOLS, getSchoolBySlug, slugifySchoolName, type SchoolLevel } from '@/data/co-schools'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import '@/components/site/kb/kb.css'

export const dynamicParams = false
export const revalidate = 300

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  high: 'High school',
  middle: 'Middle school',
  elementary: 'Elementary school',
}

/** schema.org educational subtype per level (all are Place subtypes). */
const SCHOOL_SCHEMA_TYPE: Record<SchoolLevel, 'ElementarySchool' | 'MiddleSchool' | 'HighSchool'> = {
  high: 'HighSchool',
  middle: 'MiddleSchool',
  elementary: 'ElementarySchool',
}

const MAX_CARDS = 12

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return CO_SCHOOLS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  // Registry-only — the metadata needs no live data, so it never touches the
  // DB. That keeps a transient listings timeout from failing metadata
  // generation (and shaves a query off every render).
  const school = getSchoolBySlug(slug)
  if (!school) notFound()

  const levelLabel = LEVEL_LABEL[school.level].toLowerCase()
  const desc = `${school.name} is a ${levelLabel} in ${school.city}, part of ${school.district}. See the homes for sale that feed this school from Ryan Realty, a local Central Oregon brokerage.`

  return pageMetadata({
    title: `${school.name} | Central Oregon Schools`,
    description: desc,
    path: `/schools/${slug}`,
  })
}

function money(n: number | null): string {
  if (n == null) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export default async function SchoolDetailPage({ params }: Props) {
  const { slug } = await params

  // The school's core content (name, district, verified academic stats) comes
  // from the static registry; only the feeding homes need the DB. A transient
  // listings timeout (Supabase 57014) must never fail the static build or 500
  // the page — all 55 schools pre-render at next build (dynamicParams = false),
  // so one uncaught throw here used to kill the whole deploy. Degrade to the
  // school with zero homes (the grid has its own empty state) and let ISR retry
  // on the next revalidate. getSchoolDetail returns null for an unknown slug
  // and throws on a DB error; the registry lookup tells the two apart, so a
  // real 404 still 404s while a transient timeout renders the school.
  const detail = await getSchoolDetail(slug).catch(() => null)
  const school = detail?.school ?? getSchoolBySlug(slug)
  if (!school) notFound()

  const homes = detail?.homes ?? []
  const stats = detail?.stats ?? { count: 0, medianListPrice: null }
  const nearby =
    detail?.nearby ??
    CO_SCHOOLS.filter(
      (s) => s.slug !== school.slug && s.districtSlug === school.districtSlug && s.level === school.level,
    )

  // Draw the school's own ATTENDANCE-AREA polygon (Deschutes County GIS, stored
  // in boundaries as geo_type='school') where one exists — that is the boundary
  // buyers care about. Fall back to the primary-city polygon as a frame when the
  // school has no attendance polygon (out-of-county districts, alt schools). The
  // pins are the verified feeding homes either way.
  const citySlug = slugifySchoolName(school.city)
  const schoolBoundary =
    homes.length > 0 ? await getGeoBoundaryMapData({ geoType: 'school', geoSlug: school.slug }).catch(() => null) : null
  const usingAttendanceArea = !!schoolBoundary?.polygon
  const boundary =
    schoolBoundary?.polygon
      ? schoolBoundary
      : homes.length > 0
        ? await getGeoBoundaryMapData({ geoType: 'city', geoSlug: citySlug }).catch(() => ({ polygon: null, pins: [] }))
        : { polygon: null, pins: [] }
  const polygonLabel = usingAttendanceArea ? `${school.name} attendance area` : school.city

  // KB map geojson — the school's own feeding-home pins (price + beds/baths/sqft
  // + address in the popup). The city polygon below is the frame only.
  const mapFeatures = homes
    .filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number')
    .map((h) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [h.lng as number, h.lat as number] as [number, number] },
      properties: {
        p: h.price,
        bd: h.beds,
        ba: h.baths,
        sf: h.sqft,
        a: h.addressLine,
        sub: '',
        city: h.cityLine,
        img: h.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }
  const mapPolygons =
    boundary.polygon && mapFeatures.length > 0
      ? {
          type: 'FeatureCollection' as const,
          features: [
            { type: 'Feature' as const, geometry: boundary.polygon, properties: { name: polygonLabel } },
          ],
        }
      : undefined

  const levelLabel = LEVEL_LABEL[school.level]

  // Verified academic stats — render ONLY the fields the registry actually
  // carries (enriched from cited sources; never invented per CLAUDE.md §0).
  const academicStats: Array<{ label: string; value: string }> = []
  if (school.grades) academicStats.push({ label: 'Grades', value: school.grades })
  if (typeof school.enrollment === 'number') {
    academicStats.push({ label: 'Enrollment', value: school.enrollment.toLocaleString() })
  }
  if (typeof school.studentTeacherRatio === 'number') {
    academicStats.push({ label: 'Student-teacher ratio', value: `${school.studentTeacherRatio}:1` })
  }
  if (typeof school.greatSchoolsRating === 'number') {
    academicStats.push({ label: 'GreatSchools rating', value: `${school.greatSchoolsRating}/10` })
  }
  const hasAbout = Boolean(school.blurb) || academicStats.length > 0

  // "See all homes" → search pre-filtered to the school's city + the school
  // name as a keyword (the search route has no dedicated school filter).
  const seeAllHref = `/search?city=${encodeURIComponent(school.city)}&keywords=${encodeURIComponent(
    school.name,
  )}`

  const cards = homes.slice(0, MAX_CARDS)

  // ── Structured data: School + BreadcrumbList. additionalProperty carries
  //    only the verified home-feeding numbers (never academic stats we lack). ──
  const additionalProperty: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Homes for sale that feed this school', value: stats.count },
  ]
  if (stats.medianListPrice != null) {
    additionalProperty.push({
      name: 'Median list price of feeding homes',
      value: stats.medianListPrice,
      unitText: 'USD',
    })
  }

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Schools', url: '/schools' },
        { name: school.name, url: `/schools/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: SCHOOL_SCHEMA_TYPE[school.level],
      name: school.name,
      description: `${school.name}, a ${levelLabel.toLowerCase()} in ${school.city}, ${school.district}.`,
      url: `/schools/${slug}`,
      address: { city: school.city, state: 'OR', country: 'US' },
      containedInPlace: school.district,
      additionalProperty,
    },
  ]

  return (
    <main className="kb-root">
      <SchoolDetailStyles />
      <KbNav />
      <KbSectionTracker pageType="schools" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Schools', href: '/schools' },
          { label: school.name },
        ]}
      />

      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: stats.count,
            medianListPrice: stats.medianListPrice,
            medianDaysToPending: null,
          }}
          eyebrow={`${levelLabel} · ${school.city}`}
          titleTop={levelLabel}
          titleBottom={school.name}
          lead={`feed ${school.name}, part of ${school.district}. The active single-family homes for sale, from our own listings.`}
          videoSrc={null}
          posterSrc={CONTENT_HERO_IMAGES.schools}
          mediaCaption="Regional view · Central Oregon"
        />

        {/* About — verified academic stats (blurb + at-a-glance facts), rendered
            only where the registry carries cited values. Source-attributed. */}
        {hasAbout ? (
          <section className="section ov" id="about" aria-label={`About ${school.name}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">About this school</span>
                <h2 className="sec-title display">About {school.name}</h2>
              </div>
              <div className={academicStats.length > 0 ? 'ov-grid' : ''}>
                <div className="ov-prose">
                  {school.blurb ? <p>{school.blurb}</p> : null}
                  <p className="schools-source mono-lab">
                    School data: GreatSchools, NCES
                    {school.sourceUrl ? (
                      <>
                        {' · '}
                        <a
                          className="schools-source-link"
                          href={school.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View source
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                {academicStats.length > 0 ? (
                  <aside className="ov-facts">
                    <span className="ov-facts-lbl mono-lab">At a glance</span>
                    <dl>
                      {academicStats.map((stat) => (
                        <div key={stat.label} className="ov-fact">
                          <dt>{stat.label}</dt>
                          <dd className="mono-num">{stat.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </aside>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* Stat band — verified home-feeding numbers only (navy register). */}
        <section className="section region schools-band" id="stats" aria-label={`${school.name} homes for sale`}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">{school.city} · For sale</span>
              <h2 className="sec-title display">By the numbers</h2>
            </div>
            <div className="region-grid schools-statband">
              <div className="stat-cell">
                <span className="stat-num mono-num">{stats.count.toLocaleString('en-US')}</span>
                <span className="stat-label">
                  Homes for sale · active single-family homes that feed this school
                </span>
              </div>
              <div className="stat-cell">
                <span className="stat-num mono-num">{money(stats.medianListPrice)}</span>
                <span className="stat-label">
                  Median list price · across those homes, rounded to the nearest thousand
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Map — city polygon frame + the school's feeding-home pins (KB map). */}
        {mapPolygons && mapFeatures.length > 0 ? (
          <KbListingMap
            geojson={mapGeo}
            totalActive={stats.count}
            fitToFeatures
            showRegionMarkers={false}
            polygons={mapPolygons}
            eyebrow={school.city}
            title={`Where ${school.name}\nhomes are`}
            subtitle={`Active single-family homes for sale that feed ${school.name}, on the real terrain. Click any dot for the price, the beds, and the street.`}
          />
        ) : null}

        {/* Feeding homes — listing grid (or graceful empty state). */}
        {cards.length > 0 ? (
          <section className="section listings" id="homes" aria-label={`Homes that feed ${school.name}`}>
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Homes for sale</span>
                <h2 className="sec-title display">
                  Homes that feed
                  <br />
                  {school.name}
                </h2>
              </div>
              <div className="lst-grid">
                {cards.map((home) => (
                  <a key={home.listingKey} className="lst-card" href={home.href}>
                    <div className="lst-media">
                      {home.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="lst-img" src={home.photoUrl} alt={home.addressLine} loading="lazy" />
                      ) : (
                        <span className="lst-noimg" aria-hidden="true" />
                      )}
                    </div>
                    <div className="lst-info">
                      <div>
                        <div className="lst-price mono-num">{money(home.price)}</div>
                        <div className="lst-addr">
                          {home.addressLine}
                          <span className="sub">{home.cityLine}</span>
                        </div>
                      </div>
                      <div className="lst-specs">
                        {home.beds != null ? <span>{home.beds} bd</span> : null}
                        {home.baths != null ? <span>{home.baths} ba</span> : null}
                        {home.sqft ? <span>{Number(home.sqft).toLocaleString('en-US')} sf</span> : null}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
              {stats.count > cards.length ? (
                <div className="lst-foot">
                  <a href={seeAllHref} className="btn alt">
                    See all {stats.count.toLocaleString('en-US')} homes in {school.city}{' '}
                    <span className="arr">→</span>
                  </a>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="section about" id="homes" aria-label="No homes feed this school">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Homes for sale</span>
                <h2 className="sec-title display">No active homes right now</h2>
              </div>
              <div className="ov-prose" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
                <p>
                  There are no active single-family listings tied to {school.name} at the moment.
                  Inventory changes often. Browse current homes in {school.city} to see what is on the
                  market today.
                </p>
                <p>
                  <a
                    className="schools-inline-link"
                    href={`/search?city=${encodeURIComponent(school.city)}`}
                  >
                    Browse homes in {school.city} <span aria-hidden="true">→</span>
                  </a>
                </p>
              </div>
            </div>
          </section>
        )}

        {/* District context + nearby schools (cream register). */}
        <section className="section about" id="district" aria-label={school.district}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">School district</span>
              <h2 className="sec-title display">{school.district}</h2>
            </div>
            <div className="ov-prose" style={{ paddingTop: 'clamp(24px,3vw,36px)' }}>
              <p>
                {school.name} is one of the {school.district} schools. Explore the others at this
                level below.
              </p>
            </div>

            {nearby.length > 0 ? (
              <div className="schools-nearby">
                <h3 className="schools-level-title mono-lab">Nearby schools</h3>
                <ul className="schools-grid">
                  {nearby.map((s) => (
                    <li key={s.slug}>
                      <a className="schools-card" href={`/schools/${s.slug}`}>
                        <span className="schools-card-name display">{s.name}</span>
                        <span className="schools-card-meta">
                          <span className="schools-card-city">{s.city}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="sec-cta">
              <a href="/schools" className="btn alt">
                All Central Oregon schools <span className="arr">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* CTA — local-broker close (navy register). */}
        <section className="section proof schools-cta" id="contact" aria-label={`Buying near ${school.name}`}>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Buying near {school.name}</span>
              <h2 className="sec-title display">
                Local brokers.
                <br />
                Specific numbers.
              </h2>
            </div>
            <div className="schools-cta-body">
              <p>
                We work across {school.city} and the rest of Central Oregon. Tell us what matters for
                your family and we will show you the homes that fit, near the schools you want.
              </p>
              <div className="schools-cta-row">
                <a href="/contact" className="btn ghost">
                  Meet the team <span className="arr">→</span>
                </a>
                <a href={`tel:${CONTACT.phoneDirectTel}`} className="btn ghost">
                  Call {CONTACT.phoneDirect}
                </a>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

/**
 * Route-scoped KB styling for the school-detail blocks that have no exact
 * existing KB class (the stat-band two-up, the empty/nearby card grids, the
 * source caption, the CTA body). Scoped under `.kb-root` so it cannot leak, and
 * kept here (not in the shared kb.css, which this group must not touch). Hard
 * navy/cream edges, mono labels, Amboqia titles — the brutalist register.
 */
function SchoolDetailStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
.kb-root .region.schools-band{padding-bottom:clamp(40px,5vw,60px);}
.kb-root .schools-statband{padding-top:clamp(8px,1.5vw,16px);}
.kb-root .schools-statband .stat-num{font-size:clamp(2.6rem,9vw,5rem);}
.kb-root .schools-statband .stat-label{max-width:42ch;}
.kb-root .ov .schools-source{margin-top:18px;color:var(--navy-70);}
.kb-root .ov .schools-source-link{color:var(--navy);border-bottom:1px solid var(--navy);transition:opacity .15s ease;}
.kb-root .ov .schools-source-link:hover,.kb-root .ov .schools-source-link:focus-visible{opacity:.7;outline:none;}
.kb-root .about .schools-inline-link{color:var(--navy);font-weight:600;border-bottom:1px solid var(--navy);transition:opacity .15s ease;}
.kb-root .about .schools-inline-link:hover,.kb-root .about .schools-inline-link:focus-visible{opacity:.7;outline:none;}
.kb-root .listings .lst-noimg{position:absolute;inset:0;background:var(--navy-12);}
.kb-root .schools-level-title{color:var(--navy-70);margin:clamp(30px,4vw,44px) 0 18px;}
.kb-root .schools-nearby .schools-level-title{color:var(--navy-70);}
.kb-root .schools-grid{list-style:none;display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--navy-12);border-left:1px solid var(--navy-12);}
@media(min-width:640px){.kb-root .schools-grid{grid-template-columns:repeat(2,1fr);}}
@media(min-width:1040px){.kb-root .schools-grid{grid-template-columns:repeat(3,1fr);}}
.kb-root .schools-card{display:flex;flex-direction:column;gap:9px;height:100%;padding:20px 20px 22px;border-right:1px solid var(--navy-12);border-bottom:1px solid var(--navy-12);background:var(--cream);transition:background .18s ease,color .18s ease,box-shadow .18s ease;}
@media(hover:hover){.kb-root .schools-card:hover{background:var(--navy);color:var(--cream);box-shadow:var(--shadow-md,0 6px 22px rgba(16,39,66,.16));}}
.kb-root .schools-card:focus-visible{outline:3px solid var(--navy);outline-offset:-3px;}
.kb-root .schools-card-name{font-size:clamp(1.15rem,2.4vw,1.45rem);line-height:1.02;}
.kb-root .schools-card-meta{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;font-size:.78rem;font-weight:600;letter-spacing:.02em;}
.kb-root .schools-card-city{color:var(--navy-70);}
.kb-root .schools-card:hover .schools-card-city{color:var(--cream-70);}
.kb-root .schools-cta{padding-bottom:clamp(46px,6vw,72px);}
.kb-root .schools-cta-body{padding-top:clamp(26px,3.5vw,42px);display:flex;flex-direction:column;gap:26px;max-width:62ch;}
.kb-root .schools-cta-body p{font-size:clamp(1.02rem,1.7vw,1.25rem);line-height:1.55;color:var(--cream-70);}
.kb-root .schools-cta-row{display:flex;flex-wrap:wrap;gap:12px;}
`,
      }}
    />
  )
}
