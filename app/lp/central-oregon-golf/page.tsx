/**
 * Central Oregon Golf — top-of-funnel landing page at /lp/central-oregon-golf/.
 *
 * Strategic angle (per out/golf-lp-research/research-notes.md):
 *   Zero competing brokers on this SERP. Every page-1 result is either a
 *   tourism directory (centraloregon.golf, visitcentraloregon.com,
 *   nwgolfmaps.com) or a single resort. Three exploitable gaps:
 *     1. No editorial voice helping first-timers pick from 30 courses.
 *     2. No architect-grouped cross-cut even though McLay Kidd / Nicklaus /
 *        Fazio / Weiskopf / Fought / Cupp / RTJ Jr designed Central Oregon
 *        courses — huge SERP wedge nobody owns.
 *     3. No "where to live near each course" tie-in. 12 of 14 resort
 *        communities in our registry are golf-adjacent.
 *
 * Voice rules: CLAUDE.md §3. Banned words enforced. Sentence case. Tabular
 * numerals on every figure. Currency rounded to thousands. No exclamation
 * marks in body copy.
 *
 * Build status: v1 ships the static sections. The interactive course map
 * (Section 4) renders via GoogleCourseMap with a static-list fallback —
 * the maps regression mitigation makes both states usable.
 */
import 'server-only'

import type { Metadata } from 'next'
import Link from 'next/link'

import LandingPageTracker from '@/components/LandingPageTracker'
import {
  GOLF_COURSES,
  DESTINATION_COURSES,
  type GolfCourse,
  type CourseAccess,
} from '@/data/golf/courses'
import { coursesByArchitect } from '@/data/golf/architects'
import { architectPhotoFor } from '@/data/golf/architect-photos'
import { GOLF_SEASON } from '@/data/golf/seasons'
import { INSIDER_NOTES } from '@/data/golf/insider-notes'
import { GOLF_FAQS } from '@/data/golf/faqs'
import {
  loadGolfCommunityKpis,
  formatCurrencyToThousands,
  type GolfCommunitySlug,
  type GolfCommunityKpi,
} from '@/data/golf/community-kpis'
import { loadGolfFeaturedListings } from '@/data/golf/featured-listings'
import { listingCardHref, type ListingCardData } from '@/components/lp/ListingCard'
import { GolfCourseMap } from './_components/GolfCourseMap'

export const dynamic = 'force-static'
export const revalidate = 21600 // 6h

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Central Oregon golf, every course by architect | Ryan Realty',
  description:
    "30 courses across Bend, Sunriver, Sisters, Redmond, Powell Butte. Grouped by designer, mapped, and tied to the community you'd live in if you played here every week.",
  alternates: { canonical: `${siteUrl}/lp/central-oregon-golf/` },
  openGraph: {
    title: 'Central Oregon golf, every course by architect',
    description:
      "30 courses, 14 architects, 300 days of sunshine. The full Central Oregon golf brief, plus where to live if you'd play here every week.",
    type: 'website',
    url: `${siteUrl}/lp/central-oregon-golf/`,
    images: [
      {
        url: `${siteUrl}/lp/central-oregon-golf/img/tetherow-hero.jpg`,
        width: 1600,
        height: 1066,
        alt: 'Tetherow Golf Club fairway with the Cascade Range in the background',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Central Oregon golf, every course by architect',
    description: '30 courses, 14 architects, 300 days of sunshine.',
    images: [`${siteUrl}/lp/central-oregon-golf/img/tetherow-hero.jpg`],
  },
}

const NAVY = '#102742'
const CREAM = '#faf8f4'

const ACCESS_LABEL: Record<CourseAccess, string> = {
  public: 'Public',
  resort: 'Resort access',
  private: 'Private',
  municipal: 'Municipal',
  'semi-private': 'Semi-private',
}

// JSON-LD: a @graph with CollectionPage + FAQPage + BreadcrumbList +
// RealEstateAgent (Matt Ryan / Ryan Realty). The CollectionPage's
// mainEntity is an ItemList of every GolfCourse with full design
// credits + access type so Google's structured-data understanding is
// dense rather than sparse.
function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Central Oregon Golf',
            item: `${siteUrl}/lp/central-oregon-golf/`,
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: 'Central Oregon Golf, Every Course By Architect',
        url: `${siteUrl}/lp/central-oregon-golf/`,
        description:
          "Central Oregon golf course directory grouped by architect. Verified design credits, holes, par, yardage, and the community each course sits inside.",
        isPartOf: { '@type': 'WebSite', url: siteUrl, name: 'Ryan Realty' },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${siteUrl}/lp/central-oregon-golf/img/tetherow-hero.jpg`,
          width: 1600,
          height: 1066,
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: GOLF_COURSES.length,
          itemListElement: GOLF_COURSES.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'GolfCourse',
              name: c.name,
              alternateName: c.shortName,
              numberOfHoles: c.holes,
              description: c.signature,
              address: {
                '@type': 'PostalAddress',
                addressLocality: c.city,
                addressRegion: 'OR',
                addressCountry: 'US',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: c.lat,
                longitude: c.lng,
              },
              ...(c.designer
                ? {
                    architect: {
                      '@type': 'Person',
                      name: c.designer,
                    },
                  }
                : {}),
              ...(c.yearOpened
                ? { foundingDate: String(c.yearOpened) }
                : {}),
            },
          })),
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: GOLF_FAQS.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      },
      {
        '@type': 'RealEstateAgent',
        name: 'Ryan Realty',
        url: siteUrl,
        telephone: '+1-541-213-6706',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Bend',
          addressRegion: 'OR',
          addressCountry: 'US',
        },
        areaServed: ['Bend', 'Redmond', 'Sunriver', 'Sisters', 'Madras', 'Prineville', 'Powell Butte', 'Terrebonne'],
      },
    ],
  }
}

export default async function CentralOregonGolfPage() {
  const [communityKpis, featuredListings] = await Promise.all([
    loadGolfCommunityKpis(),
    loadGolfFeaturedListings(),
  ])
  return (
    <main
      style={{
        background: CREAM,
        color: NAVY,
        fontFamily: 'Geist, system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <LandingPageTracker lpVariant="central-oregon-golf" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />

      <StickyNav />
      <HeroSection />
      <IntroSection />
      <DestinationCoursesSection />
      <MapSection />
      <ByArchitectSection />
      <SeasonCalendarSection />
      <InsiderNotesSection />
      <FaqSection />
      <DataTableSection />
      <StayVsBuySection />
      <WhereToLiveSection communityKpis={communityKpis} featuredListings={featuredListings} />
      <CtaSection />

      <PageStyles />
    </main>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  HERO
 * ──────────────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────
 *  STICKY NAV — anchor links pinned at the top once the hero scrolls past
 * ──────────────────────────────────────────────────────────────────────── */
function StickyNav() {
  return (
    <nav className="golf-sticky-nav" aria-label="Page sections">
      <div className="golf-sticky-nav__inner">
        <span className="golf-sticky-nav__brand">Central Oregon Golf</span>
        <a href="#destination-courses">The 8</a>
        <a href="#map">Map</a>
        <a href="#by-architect">By architect</a>
        <a href="#season">When to play</a>
        <a href="#where-to-live">Where to live</a>
        <a href="#insider">Insider notes</a>
        <a href="#faq">FAQ</a>
        <Link href="/lp/buyer-listing-alerts?source=golf-lp" className="golf-sticky-nav__cta">
          See homes
        </Link>
      </div>
    </nav>
  )
}

function HeroSection() {
  return (
    <section className="golf-hero">
      <div className="golf-hero__bg" aria-hidden />
      <div className="golf-hero__overlay" aria-hidden />
      <div className="golf-hero__inner">
        <div className="golf-hero__eyebrow">CENTRAL OREGON · GOLF</div>
        <h1 className="golf-hero__h1">Central Oregon golf, by the architects who built it.</h1>
        <p className="golf-hero__sub">
          27 named courses. McLay Kidd, Nicklaus, Fazio, RTJ Jr, Weiskopf, Fought. 3,600 feet of
          elevation. 300 days of sunshine. The eight worth flying in for, the season window that
          beats Bandon, and the back-nine views you don&apos;t get anywhere else.
        </p>
        <div className="golf-hero__cta-row">
          <Link
            href="/lp/buyer-listing-alerts?source=golf-lp"
            className="golf-cta golf-cta--primary"
          >
            See golf-community homes
          </Link>
          <Link
            href="/lp/seller-home-value?source=golf-lp"
            className="golf-cta golf-cta--cream-outline"
          >
            Get a home valuation
          </Link>
        </div>
        <div className="golf-hero__jump-row">
          <a href="#destination-courses">The destination 8</a>
          <span aria-hidden>·</span>
          <a href="#by-architect">By architect</a>
          <span aria-hidden>·</span>
          <a href="#season">When to play</a>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  WHY CENTRAL OREGON
 * ──────────────────────────────────────────────────────────────────────── */
function IntroSection() {
  return (
    <section className="golf-section">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">Why here</div>
        <h2 className="golf-h2">High desert, lava terrain, and 3,600 feet of elevation.</h2>
        <div className="golf-prose">
          <p>
            Central Oregon golf does not play like the Willamette Valley, and it does not play like
            the desert Southwest. Three things make it its own.
          </p>
          <p>
            <strong>The geology.</strong> Pronghorn&apos;s par-3 #8 plays over a 45-foot canyon with
            an exposed lava tube. Aspen Lakes&apos; bunkers are filled with red cinders the Cyrus
            family crushed from their own volcanic stone. The Crooked River cuts across Meadow Lakes
            four times. The terrain writes the shots.
          </p>
          <p>
            <strong>The climate.</strong> 300 days of sunshine, low humidity, cool nights. Even in
            July the morning round is sweater weather. The high-desert dry hardens the fairways
            mid-summer and the ground game opens up. Links rules in the high desert.
          </p>
          <p>
            <strong>The elevation.</strong> 3,500-3,800 feet across the playing field. The ball
            carries about 8 percent further than it does at sea level. Yardage maps for Bandon Dunes
            do not apply here. Bring a half-club less.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  THE DESTINATION 8
 * ──────────────────────────────────────────────────────────────────────── */
function DestinationCoursesSection() {
  return (
    <section className="golf-section golf-section--dark" id="destination-courses">
      <div className="golf-section__inner">
        <div className="golf-eyebrow golf-eyebrow--cream">The eight worth the trip</div>
        <h2 className="golf-h2 golf-h2--cream">If you only play eight, play these.</h2>
        <p className="golf-lede golf-lede--cream">
          Ranked by name-architect pedigree, course conditioning, and the views from the tee. Three
          are at Sunriver and Black Butte Ranch. Two are at Pronghorn. One is a private Fazio
          you&apos;ll need a member to walk you on. The Cascade backdrop runs through all eight.
        </p>

        <ol className="golf-rank-grid">
          {DESTINATION_COURSES.map((c, i) => (
            <li key={c.slug} className="golf-rank-card">
              <div className="golf-rank-num">{(i + 1).toString().padStart(2, '0')}</div>
              <div className="golf-rank-body">
                {c.heroImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.heroImage}
                    alt={c.heroImageAlt ?? c.name}
                    loading="lazy"
                    className="golf-rank-photo"
                  />
                )}
                <h3 className="golf-rank-name">{c.name}</h3>
                <div className="golf-rank-meta">
                  <span>{c.designer}</span>
                  <span>·</span>
                  <span>{c.yearOpened}</span>
                  <span>·</span>
                  <span>
                    {c.holes} holes, par {c.par}
                  </span>
                  {c.yardsBackTees ? (
                    <>
                      <span>·</span>
                      <span>{c.yardsBackTees.toLocaleString()} yards</span>
                    </>
                  ) : null}
                  <span>·</span>
                  <span className="golf-access-pill">{ACCESS_LABEL[c.access]}</span>
                </div>
                <p className="golf-rank-sig">{c.signature}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  INTERACTIVE MAP
 * ──────────────────────────────────────────────────────────────────────── */
function MapSection() {
  return (
    <section className="golf-section" id="map">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">Every course on one map</div>
        <h2 className="golf-h2">Public, resort, private, municipal.</h2>
        <p className="golf-lede">
          Public courses, resort courses, private clubs, and municipals, color-coded by access.
          Click a pin for designer, year, holes, and the community it sits in.
        </p>
        <div className="golf-map-wrap">
          <GolfCourseMap />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  BY ARCHITECT — the SERP wedge
 * ──────────────────────────────────────────────────────────────────────── */
function ByArchitectSection() {
  const groups = coursesByArchitect()
  return (
    <section className="golf-section golf-section--alt" id="by-architect">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">Who designed what</div>
        <h2 className="golf-h2">By architect.</h2>
        <p className="golf-lede">
          Same 30 courses, grouped by the designer who routed them. The Pacific NW does not have
          another concentration of national-name architects like this.
        </p>

        <div className="golf-architect-grid">
          {groups.map(({ architect, courses }) => {
            const photo = architectPhotoFor(architect.slug)
            return (
              <div key={architect.slug} className="golf-architect-card">
                <div className="golf-architect-top">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.path}
                      alt={photo.caption ?? architect.name}
                      loading="lazy"
                      className="golf-architect-portrait"
                    />
                  ) : (
                    <div className="golf-architect-monogram" aria-hidden>
                      {architect.monogram}
                    </div>
                  )}
                  <div className="golf-architect-header">
                    <h3 className="golf-architect-name">
                      {architect.name}
                      <span className="golf-architect-count">
                        {courses.length} {courses.length === 1 ? 'course' : 'courses'}
                      </span>
                    </h3>
                    {architect.wikipediaUrl && (
                      <a
                        href={architect.wikipediaUrl}
                        target="_blank"
                        rel="noopener nofollow"
                        className="golf-architect-link"
                        aria-label={`Wikipedia: ${architect.name}`}
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </div>
                <p className="golf-architect-bio">{architect.bio}</p>
                <div className="golf-architect-courses">
                  {courses.map((c) => (
                    <span key={c.slug} className="golf-architect-course">
                      {c.shortName}
                    </span>
                  ))}
                </div>
                {architect.alsoKnownFor && architect.alsoKnownFor.length > 0 && (
                  <div className="golf-architect-aka">
                    <span className="golf-architect-aka-label">Also known for: </span>
                    {architect.alsoKnownFor.join(', ')}
                  </div>
                )}
                {photo && (
                  <div className="golf-architect-credit">
                    Photo:{' '}
                    <a href={photo.source} target="_blank" rel="noopener nofollow">
                      {photo.author}
                    </a>
                    {' · '}
                    <a href={photo.licenseUrl} target="_blank" rel="noopener nofollow">
                      {photo.license}
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  SEASON CALENDAR
 * ──────────────────────────────────────────────────────────────────────── */
function SeasonCalendarSection() {
  return (
    <section className="golf-section" id="season">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">When to play</div>
        <h2 className="golf-h2">Short, intense, and dry.</h2>
        <p className="golf-lede">
          The Central Oregon golf year is short and intense. The destination courses open in late
          March. June is the value play. September is the locals&apos; favorite. Two courses run
          year-round when the weather allows.
        </p>

        <div className="golf-season-grid">
          {GOLF_SEASON.map((m) => (
            <div
              key={m.month}
              className={`golf-season-card golf-season-card--${m.courseStatus}`}
            >
              <div className="golf-season-month">{m.month}</div>
              <div className="golf-season-temps">
                <span>{m.avgHighF}°</span>
                <span className="golf-season-temp-low">/ {m.avgLowF}°</span>
              </div>
              <div className="golf-season-status">{statusLabel(m.courseStatus)}</div>
              <p className="golf-season-note">{m.localsMove}</p>
            </div>
          ))}
        </div>

        <div className="golf-season-source">
          Temperature data: NOAA Bend Airport (KBDN) climate normals, 1991-2020.
        </div>
      </div>
    </section>
  )
}

function featuredPrice(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

function statusLabel(s: 'mostly-closed' | 'shoulder' | 'prime' | 'high-season' | 'late-season'): string {
  if (s === 'mostly-closed') return 'Mostly closed'
  if (s === 'shoulder') return 'Shoulder rates'
  if (s === 'prime') return 'Prime month'
  if (s === 'high-season') return 'High season'
  return 'Late season'
}

/* ─────────────────────────────────────────────────────────────────────────
 *  WHERE TO LIVE — the conversion engine
 * ──────────────────────────────────────────────────────────────────────── */
function WhereToLiveSection({
  communityKpis,
  featuredListings,
}: {
  communityKpis: Record<GolfCommunitySlug, GolfCommunityKpi | null>
  featuredListings: Record<GolfCommunitySlug, ListingCardData | null>
}) {
  // Pull every unique community across all courses
  const seen = new Set<string>()
  const items: Array<{ community: string; courses: GolfCourse[] }> = []
  for (const c of GOLF_COURSES) {
    if (!c.communitySlug || seen.has(c.communitySlug)) continue
    seen.add(c.communitySlug)
    items.push({
      community: c.communitySlug,
      courses: GOLF_COURSES.filter((x) => x.communitySlug === c.communitySlug),
    })
  }

  // Pitches written for the golfer scrolling. One line. What course you play
  // when you live there + the one detail that makes the community make sense.
  // Real-estate price + inventory comes from the KPI strip; this is the
  // golf-relevant context, not the broker pitch.
  const FALLBACK = '/lp/central-oregon-golf/img/bend-cascades-01.jpg'
  const communityMeta: Record<string, { name: string; pitch: string; hasLP: boolean; image: string; imageAlt: string }> = {
    tetherow: {
      name: 'Tetherow',
      pitch: 'You play McLay Kidd. Mt Bachelor is 20 minutes up the road for the ski-day chasers.',
      hasLP: true,
      image: '/lp/central-oregon-golf/img/tetherow-03.jpg',
      imageAlt: 'Tetherow homes along the McLay Kidd fairway',
    },
    'broken-top': {
      name: 'Broken Top',
      pitch: 'You play Weiskopf. Gated, capped at 395 golf members, with a six-acre trout lake on property.',
      hasLP: false,
      image: FALLBACK,
      imageAlt: 'Broken Top neighborhood near Mt Bachelor',
    },
    pronghorn: {
      name: 'Pronghorn / Juniper Preserve',
      pitch: 'You play Nicklaus. The Fazio is next door if you can get a member to walk you on.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
      imageAlt: 'Pronghorn Resort with the Nicklaus signature course',
    },
    sunriver: {
      name: 'Sunriver',
      pitch: 'You get four courses, Meadows, Woodlands, Crosswater, Caldera Links, plus 33 miles of paved bike paths.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/sunriver-river.jpg',
      imageAlt: 'Sunriver Resort along the Deschutes River',
    },
    'caldera-springs': {
      name: 'Caldera Springs',
      pitch: 'Cabin lifestyle inside Sunriver. Caldera Links 9-hole short course at the door, the lodge a walk away.',
      hasLP: false,
      image: FALLBACK,
      imageAlt: 'Caldera Springs cabin community at Sunriver',
    },
    crosswater: {
      name: 'Crosswater',
      pitch: 'Gated Sunriver enclave wrapped around the Cupp/Fought top-100. Member-only access stays that way.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/crosswater-02.jpg',
      imageAlt: 'Crosswater Club fairway with wetlands and Cascade backdrop',
    },
    'black-butte-ranch': {
      name: 'Black Butte Ranch',
      pitch: 'Two championship courses (Big Meadow + Glaze Meadow) plus a putting course, all under the Three Sisters.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
      imageAlt: 'Three Sisters peaks above Black Butte Ranch',
    },
    'brasada-ranch': {
      name: 'Brasada Ranch',
      pitch: 'Hardy & Jacobsen 18 with no two holes parallel. 25 minutes east of Bend, 300 days of sunshine.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/brasada-02.jpg',
      imageAlt: 'Brasada Ranch residences along Brasada Canyons',
    },
    'eagle-crest': {
      name: 'Eagle Crest',
      pitch: 'Three courses including the Ridge, the longest playing season in Central Oregon. Public access for residents.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
      imageAlt: 'Eagle Crest Resort terrain in Redmond, Oregon',
    },
    'awbrey-glen': {
      name: 'Awbrey Glen',
      pitch: 'Private Bunny Mason 18 with a 5-hole par-3 practice course. Walkable from the north side of Bend.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/awbrey-glen-01.jpg',
      imageAlt: 'Awbrey Glen Golf Club on the north side of Bend',
    },
    'widgi-creek': {
      name: 'Widgi Creek',
      pitch: "Locals' favorite public 18 on the way to Mt Bachelor. PNW's top pickleball complex shares the property.",
      hasLP: false,
      image: '/lp/central-oregon-golf/img/widgi-creek-01.jpg',
      imageAlt: 'Widgi Creek Golf Club along the Deschutes corridor in west Bend',
    },
    'three-rivers': {
      name: 'Three Rivers',
      pitch: 'Next to the four Sunriver courses without the resort overhead. Cabin pricing, no HOA-mandated club dues.',
      hasLP: false,
      image: FALLBACK,
      imageAlt: 'Three Rivers area south of Bend',
    },
  }

  return (
    <section className="golf-section golf-section--alt" id="where-to-live">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">If you fell in love with one of them</div>
        <h2 className="golf-h2">Where to live next to each course.</h2>
        <p className="golf-lede">
          Twelve of the courses above sit inside a residential community. Each card carries the
          course you play, the priciest active listing today, and the 12-month inventory pulse.
        </p>

        <div className="golf-live-grid">
          {items.map(({ community, courses }) => {
            const meta = communityMeta[community]
            if (!meta) return null
            const kpi = communityKpis[community as GolfCommunitySlug]
            const featured = featuredListings[community as GolfCommunitySlug]
            const medianFmt = kpi ? formatCurrencyToThousands(kpi.medianSalePrice) : null
            const searchHref = meta.hasLP
              ? `/lp/${community}/`
              : `/homes-for-sale?subdivision=${encodeURIComponent(meta.name)}`
            return (
              <div key={community} className="golf-live-card">
                <div className="golf-live-photo-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={meta.image}
                    alt={meta.imageAlt}
                    loading="lazy"
                    className="golf-live-photo"
                  />
                  <div className="golf-live-photo-overlay" aria-hidden />
                  <h3 className="golf-live-name">{meta.name}</h3>
                </div>

                <div className="golf-live-body">
                  <p className="golf-live-pitch">{meta.pitch}</p>

                  <ul className="golf-live-courses">
                    {courses.map((c) => (
                      <li key={c.slug}>
                        <span className="golf-live-course-name">{c.shortName}</span>
                        <span className="golf-live-course-by">{c.designer}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="golf-live-spacer" />

                  {featured && (
                    <Link
                      href={listingCardHref(featured)}
                      className="golf-live-featured"
                      aria-label={`Featured home: ${featured.address}`}
                    >
                      {featured.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={featured.photoUrl}
                          alt=""
                          loading="lazy"
                          className="golf-live-featured-thumb"
                        />
                      )}
                      <div className="golf-live-featured-body">
                        <div className="golf-live-featured-label">Top active listing</div>
                        <div className="golf-live-featured-price">{featuredPrice(featured.listPrice)}</div>
                        <div className="golf-live-featured-meta">
                          {featured.beds != null && <span>{featured.beds} bed</span>}
                          {featured.baths != null && <span>{featured.baths} bath</span>}
                          {featured.sqft != null && <span>{Number(featured.sqft).toLocaleString()} sqft</span>}
                        </div>
                      </div>
                    </Link>
                  )}

                  {kpi && (medianFmt || kpi.activeInventory != null || kpi.soldCount12mo != null) && (
                    <div className="golf-live-kpis">
                      {medianFmt && (
                        <div className="golf-live-kpi">
                          <span className="golf-live-kpi-value">{medianFmt}</span>
                          <span className="golf-live-kpi-label">Median 12mo</span>
                        </div>
                      )}
                      {kpi.activeInventory != null && (
                        <div className="golf-live-kpi">
                          <span className="golf-live-kpi-value">{kpi.activeInventory}</span>
                          <span className="golf-live-kpi-label">Active</span>
                        </div>
                      )}
                      {kpi.soldCount12mo != null && (
                        <div className="golf-live-kpi">
                          <span className="golf-live-kpi-value">{kpi.soldCount12mo}</span>
                          <span className="golf-live-kpi-label">Sold 12mo</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Link href={searchHref} className="golf-live-cta">
                    See homes in {meta.name} →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  FULL DATA TABLE
 * ──────────────────────────────────────────────────────────────────────── */
function DataTableSection() {
  const sorted = [...GOLF_COURSES].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <section className="golf-section" id="full-table">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">The full lookup</div>
        <h2 className="golf-h2">Every course, side by side.</h2>
        <p className="golf-lede">
          Designer, year, holes, par, yardage, city, access. The full lookup table for green-fee
          research. Per-course rates omitted. We publish what we can verify from the course&apos;s
          own site, and rate cards change.
        </p>

        <div className="golf-table-wrap">
          <table className="golf-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>City</th>
                <th>Holes</th>
                <th>Par</th>
                <th>Yards</th>
                <th>Designer</th>
                <th>Year</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.slug}>
                  <td className="golf-table__name">{c.name}</td>
                  <td>{c.city}</td>
                  <td>{c.holes}</td>
                  <td>{c.par}</td>
                  <td>{c.yardsBackTees ? c.yardsBackTees.toLocaleString() : '—'}</td>
                  <td>{c.designer}</td>
                  <td>{c.yearOpened}</td>
                  <td>{ACCESS_LABEL[c.access]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  INSIDER NOTES — editorial depth no directory carries
 * ──────────────────────────────────────────────────────────────────────── */
function InsiderNotesSection() {
  return (
    <section className="golf-section golf-section--alt" id="insider">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">Insider notes</div>
        <h2 className="golf-h2">The seven things the directories don’t tell you.</h2>
        <p className="golf-lede">
          Verifiable facts that only locals carry. Each note traces to a primary source, a course
          history page, a city public-works archive, or a published architectural profile.
        </p>

        <ol className="golf-insider-list">
          {INSIDER_NOTES.map((n) => (
            <li key={n.slug} className="golf-insider-item">
              <div className="golf-insider-hook">{n.hook}</div>
              <p className="golf-insider-body">{n.body}</p>
              <div className="golf-insider-source">
                {n.course && <span className="golf-insider-course">{n.course}</span>}
                <span className="golf-insider-cite">Source: {n.source}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  STAY VS BUY — the honest conversion essay
 * ──────────────────────────────────────────────────────────────────────── */
function StayVsBuySection() {
  return (
    <section className="golf-section" id="stay-vs-buy">
      <div className="golf-section__inner">
        <div className="golf-section__center">
          <div className="golf-eyebrow">How often will you actually play?</div>
          <h2 className="golf-h2">Stay-and-play, or own-and-play?</h2>
          <p className="golf-lede">
            One to three weekends a year, the resort package is the right call. Eight rounds or
            more, the math leans the other way. Run your number against the side-by-side.
          </p>
        </div>

        <div className="golf-sb-compare">
          <div className="golf-sb-card golf-sb-card--rent">
            <div className="golf-sb-tag">Stay-and-play</div>
            <h3 className="golf-sb-title">5 resort weekends a year</h3>
            <div className="golf-sb-math">
              <div className="golf-sb-line">
                <span>Peak nightly</span>
                <span>$400</span>
              </div>
              <div className="golf-sb-line">
                <span>Nights / trip</span>
                <span>3</span>
              </div>
              <div className="golf-sb-line">
                <span>Trips / year</span>
                <span>5</span>
              </div>
              <div className="golf-sb-divider" />
              <div className="golf-sb-line golf-sb-line--total">
                <span>Lodging only</span>
                <span>$6,000</span>
              </div>
            </div>
            <p className="golf-sb-note">
              Add green fees, cart, range balls, and dinner. Real landed cost lands at
              $9,000 to $12,000 a year. Cleanest math if your home course is somewhere else and
              you fly in to play 12 to 18 rounds total.
            </p>
          </div>

          <div className="golf-sb-card golf-sb-card--buy">
            <div className="golf-sb-tag golf-sb-tag--accent">Own-and-play</div>
            <h3 className="golf-sb-title">Cabin near a course you love</h3>
            <div className="golf-sb-math">
              <div className="golf-sb-line">
                <span>Entry price</span>
                <span>$300K-$500K</span>
              </div>
              <div className="golf-sb-line">
                <span>Monthly carrying</span>
                <span>$2,500-$3,500</span>
              </div>
              <div className="golf-sb-line">
                <span>Rounds you can play</span>
                <span>Unlimited</span>
              </div>
              <div className="golf-sb-divider" />
              <div className="golf-sb-line golf-sb-line--total">
                <span>Annual carrying</span>
                <span>$30K-$42K</span>
              </div>
            </div>
            <p className="golf-sb-note">
              The carrying cost above is net of the mortgage interest you would have paid on
              resort nights, and the appreciation offset is real once you hold three or four
              years.
            </p>
          </div>
        </div>

        <div className="golf-sb-bottom">
          <p>
            Where you fall on this depends on rounds per year, what you want the non-golf time to
            look like, and whether the rest of the family comes. If the rental math wins for you,
            the rental math wins. If you want a per-community spreadsheet against your usage,
            <Link href="#contact"> ask</Link>.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  FAQ — long-tail intent + FAQPage schema
 * ──────────────────────────────────────────────────────────────────────── */
function FaqSection() {
  return (
    <section className="golf-section golf-section--alt" id="faq">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">FAQ</div>
        <h2 className="golf-h2">Things people actually ask.</h2>
        <p className="golf-lede">
          Answers built from the course inventory, the architect grouping, and the season
          calendar above. Every answer is specific. Every figure traces.
        </p>

        <div className="golf-faq-list">
          {GOLF_FAQS.map((f, i) => (
            <details key={i} className="golf-faq-item">
              <summary className="golf-faq-q">{f.question}</summary>
              <p className="golf-faq-a">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  CTA + FOOTER
 * ──────────────────────────────────────────────────────────────────────── */
function CtaSection() {
  return (
    <section className="golf-section golf-section--dark" id="contact">
      <div className="golf-section__inner golf-section__inner--narrow">
        <h2 className="golf-h2 golf-h2--cream golf-h2--center">
          Thinking about a golf-community home in Central Oregon?
        </h2>
        <p className="golf-lede golf-lede--cream golf-lede--center">
          Ryan Realty is a small Bend brokerage. Matt Ryan is a principal broker who lives here, plays
          here, and has sold inside every golf community on this page. Reach out and tell us where you
          are in the process.
        </p>
        <div className="golf-cta-row golf-cta-row--center">
          <Link
            href="/lp/seller-home-value?source=golf-lp"
            className="golf-cta golf-cta--cream"
          >
            Get a home valuation
          </Link>
          <Link
            href="/lp/buyer-listing-alerts?source=golf-lp"
            className="golf-cta golf-cta--outline"
          >
            Set up listing alerts
          </Link>
        </div>
        <div className="golf-cta-meta">
          <div>
            <span className="golf-cta-meta-label">Matt Ryan, principal broker</span>
            <span className="golf-cta-meta-num">541.213.6706</span>
          </div>
          <div>
            <span className="golf-cta-meta-label">Web</span>
            <span className="golf-cta-meta-num">ryan-realty.com</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
 *  STYLES — single block so the page ships self-contained
 * ──────────────────────────────────────────────────────────────────────── */
function PageStyles() {
  return (
    <style>{`
      /* Sticky nav */
      .golf-sticky-nav {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(250,248,244,0.92);
        backdrop-filter: saturate(180%) blur(14px);
        -webkit-backdrop-filter: saturate(180%) blur(14px);
        border-bottom: 1px solid rgba(16,39,66,0.06);
      }
      .golf-sticky-nav__inner {
        max-width: 1200px; margin: 0 auto;
        padding: 12px 24px;
        display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
      }
      .golf-sticky-nav__brand {
        font-family: var(--font-amboqia), Georgia, serif;
        font-size: 17px; font-weight: 500; color: #102742;
        letter-spacing: -0.005em;
        margin-right: 6px;
      }
      .golf-sticky-nav a {
        font-size: 13px; color: rgba(16,39,66,0.78); text-decoration: none; font-weight: 500;
        padding: 4px 2px;
      }
      .golf-sticky-nav a:hover { color: #102742; }
      .golf-sticky-nav__cta {
        margin-left: auto;
        background: #102742; color: #faf8f4 !important;
        padding: 8px 16px !important; border-radius: 999px;
        font-weight: 600 !important;
      }
      .golf-sticky-nav__cta:hover { background: rgba(16,39,66,0.92); }
      @media (max-width: 820px) {
        .golf-sticky-nav__brand { display: none; }
        .golf-sticky-nav__inner { gap: 14px; padding: 10px 16px; }
        .golf-sticky-nav a:not(.golf-sticky-nav__cta) { font-size: 12px; }
      }

      .golf-hero {
        position: relative;
        background: #102742;
        color: #faf8f4;
        padding: 120px 24px 128px;
        overflow: hidden;
        isolation: isolate;
      }
      .golf-hero__bg {
        position: absolute;
        inset: 0;
        background-image: url('/lp/central-oregon-golf/img/tetherow-hero.jpg');
        background-size: cover;
        background-position: center;
        z-index: 0;
      }
      .golf-hero__overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(16,39,66,0.55) 0%, rgba(16,39,66,0.85) 100%);
        z-index: 1;
      }
      .golf-hero__inner { position: relative; z-index: 2; max-width: 1100px; margin: 0 auto; }
      .golf-hero__eyebrow { font-size: 11px; letter-spacing: 0.16em; opacity: 0.7; font-weight: 600; margin-bottom: 14px; }
      .golf-hero__h1 {
        font-family: var(--font-amboqia), Georgia, serif;
        font-size: clamp(40px, 6vw, 72px);
        font-weight: 500;
        line-height: 1.05;
        margin: 0 0 18px;
        letter-spacing: -0.01em;
      }
      .golf-hero__sub { max-width: 760px; font-size: 17px; line-height: 1.55; opacity: 0.88; margin: 0 0 28px; }
      .golf-hero__cta-row { display: flex; flex-wrap: wrap; gap: 10px; }
      .golf-hero__jump-row {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
        margin-top: 18px; font-size: 13px;
      }
      .golf-hero__jump-row a {
        color: rgba(250,248,244,0.82); text-decoration: none; font-weight: 500;
        border-bottom: 1px solid rgba(250,248,244,0.28); padding-bottom: 1px;
      }
      .golf-hero__jump-row a:hover { color: #faf8f4; border-bottom-color: #faf8f4; }
      .golf-hero__jump-row span { color: rgba(250,248,244,0.4); }

      .golf-cta {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 11px 18px; border-radius: 999px; font-size: 13.5px; font-weight: 600;
        background: transparent; color: #faf8f4;
        border: 1px solid rgba(250,248,244,0.32); text-decoration: none;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .golf-cta:hover { background: rgba(250,248,244,0.08); border-color: rgba(250,248,244,0.55); }
      .golf-cta--primary { background: #faf8f4; color: #102742; border-color: #faf8f4; }
      .golf-cta--primary:hover { background: rgba(250,248,244,0.92); }
      .golf-cta--cream { background: #faf8f4; color: #102742; border-color: #faf8f4; }
      .golf-cta--outline { background: transparent; color: #faf8f4; border-color: #faf8f4; }
      .golf-cta--cream-outline { background: transparent; color: #faf8f4; border-color: rgba(250,248,244,0.6); }
      .golf-cta--cream-outline:hover { background: rgba(250,248,244,0.1); border-color: #faf8f4; }

      .golf-section { padding: 88px 24px; }
      .golf-section--alt { background: rgba(16,39,66,0.04); }
      .golf-section--dark { background: #102742; color: #faf8f4; }
      .golf-section__inner { max-width: 1100px; margin: 0 auto; }
      .golf-section__inner--narrow { max-width: 760px; }

      .golf-eyebrow {
        font-size: 11px; letter-spacing: 0.16em; opacity: 0.62; font-weight: 600;
        margin-bottom: 12px; color: #102742;
      }
      .golf-eyebrow--cream { color: #faf8f4; opacity: 0.7; }

      .golf-h2 {
        font-family: var(--font-amboqia), Georgia, serif;
        font-size: clamp(30px, 4vw, 44px);
        font-weight: 500;
        line-height: 1.12;
        letter-spacing: -0.005em;
        margin: 0 0 14px;
      }
      .golf-h2--cream { color: #faf8f4; }
      .golf-h2--center { text-align: center; }

      .golf-lede { font-size: 16.5px; line-height: 1.55; color: rgba(16,39,66,0.74); max-width: 760px; margin: 0 0 32px; }
      .golf-lede--cream { color: rgba(250,248,244,0.85); }
      .golf-lede--center { margin-left: auto; margin-right: auto; text-align: center; }

      .golf-prose p { font-size: 16px; line-height: 1.62; color: rgba(16,39,66,0.78); max-width: 720px; margin: 0 0 18px; }
      .golf-prose strong { color: #102742; }

      /* Destination 8 ranked cards */
      .golf-rank-grid { list-style: none; padding: 0; margin: 28px 0 0; display: grid; grid-template-columns: 1fr; gap: 0; counter-reset: rank; }
      .golf-rank-card {
        display: grid; grid-template-columns: 80px 1fr; gap: 20px;
        padding: 28px 0; border-top: 1px solid rgba(250,248,244,0.14);
      }
      .golf-rank-card:last-child { border-bottom: 1px solid rgba(250,248,244,0.14); }
      .golf-rank-num {
        font-family: var(--font-amboqia), Georgia, serif;
        font-size: 56px; font-weight: 400; color: rgba(250,248,244,0.62); line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .golf-rank-body { display: flex; flex-direction: column; gap: 8px; }
      .golf-rank-photo {
        width: 100%; max-width: 720px; aspect-ratio: 16 / 10; object-fit: cover;
        border-radius: 10px; margin-bottom: 6px; display: block;
      }
      .golf-rank-name { font-family: var(--font-amboqia), Georgia, serif; font-size: 24px; font-weight: 500; margin: 0; color: #faf8f4; }
      .golf-rank-meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; opacity: 0.82; color: #faf8f4; align-items: center; }
      .golf-access-pill {
        display: inline-block; padding: 2px 9px; border-radius: 999px;
        background: rgba(250,248,244,0.13); font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em;
      }
      .golf-rank-sig { font-size: 15px; line-height: 1.55; color: rgba(250,248,244,0.86); margin: 4px 0 0; max-width: 720px; }
      .golf-rank-link { color: #faf8f4; font-size: 13px; font-weight: 600; text-decoration: none; border-bottom: 1px solid rgba(250,248,244,0.42); padding-bottom: 1px; align-self: flex-start; margin-top: 4px; }
      .golf-rank-link:hover { border-bottom-color: #faf8f4; }

      /* Map wrap */
      .golf-map-wrap { margin-top: 12px; }

      /* By architect */
      .golf-architect-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 22px; margin-top: 36px; }
      .golf-architect-card {
        background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; padding: 22px 24px;
        display: flex; flex-direction: column; gap: 12px;
      }
      .golf-architect-top { display: flex; gap: 14px; align-items: center; }
      .golf-architect-portrait,
      .golf-architect-monogram {
        flex-shrink: 0; width: 64px; height: 64px; border-radius: 50%;
        background: #102742; color: #faf8f4;
        display: flex; align-items: center; justify-content: center;
        font-family: var(--font-amboqia), Georgia, serif;
        font-size: 22px; font-weight: 500; letter-spacing: 0.02em;
        overflow: hidden; object-fit: cover;
      }
      .golf-architect-portrait { object-position: top; }
      .golf-architect-header {
        flex: 1; min-width: 0;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
      }
      .golf-architect-name { font-family: var(--font-amboqia), Georgia, serif; font-size: 20px; font-weight: 500; margin: 0; color: #102742; line-height: 1.2; }
      .golf-architect-link {
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(16,39,66,0.07); color: rgba(16,39,66,0.74);
        text-decoration: none; font-size: 13px; font-weight: 700;
        transition: background 0.15s, color 0.15s;
      }
      .golf-architect-link:hover { background: #102742; color: #faf8f4; }
      .golf-architect-count {
        display: inline-block; margin-left: 10px;
        font-family: 'Geist', system-ui, sans-serif;
        font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
        color: rgba(16,39,66,0.62); background: rgba(16,39,66,0.06);
        padding: 3px 9px; border-radius: 999px;
        vertical-align: middle;
      }
      .golf-architect-bio { font-size: 14.5px; line-height: 1.55; color: rgba(16,39,66,0.78); margin: 0; }
      .golf-architect-courses { display: flex; flex-wrap: wrap; gap: 6px; }
      .golf-architect-course {
        font-size: 12px; padding: 4px 10px; border-radius: 999px;
        background: rgba(16,39,66,0.07); color: #102742; font-weight: 500;
      }
      .golf-architect-aka { font-size: 12px; color: rgba(16,39,66,0.6); line-height: 1.45; margin-top: auto; padding-top: 6px; border-top: 1px solid rgba(16,39,66,0.06); }
      .golf-architect-aka-label { font-weight: 600; color: rgba(16,39,66,0.78); }
      .golf-architect-credit {
        font-size: 10.5px; line-height: 1.5; color: rgba(16,39,66,0.45);
        margin-top: 4px; letter-spacing: 0.01em;
      }
      .golf-architect-credit a {
        color: inherit; text-decoration: underline; text-decoration-color: rgba(16,39,66,0.2);
      }
      .golf-architect-credit a:hover { color: rgba(16,39,66,0.78); }

      /* Season calendar */
      .golf-season-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 28px; }
      .golf-season-card {
        background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 12px; padding: 18px 20px;
        display: flex; flex-direction: column; gap: 6px; min-height: 200px;
      }
      .golf-season-month { font-family: var(--font-amboqia), Georgia, serif; font-size: 22px; font-weight: 500; color: #102742; }
      .golf-season-temps { font-size: 24px; font-weight: 500; color: #102742; font-variant-numeric: tabular-nums; }
      .golf-season-temp-low { font-size: 16px; color: rgba(16,39,66,0.55); font-weight: 400; margin-left: 4px; }
      .golf-season-status {
        font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
        color: #102742; padding: 4px 10px; border-radius: 999px; background: rgba(16,39,66,0.07);
        align-self: flex-start;
      }
      .golf-season-card--prime .golf-season-status { background: #102742; color: #faf8f4; }
      .golf-season-card--high-season .golf-season-status { background: rgba(16,39,66,0.14); color: #102742; box-shadow: inset 0 0 0 1px rgba(16,39,66,0.45); }
      .golf-season-card--shoulder .golf-season-status,
      .golf-season-card--late-season .golf-season-status { background: rgba(16,39,66,0.1); color: #102742; }
      .golf-season-card--mostly-closed .golf-season-status { background: rgba(16,39,66,0.06); color: rgba(16,39,66,0.62); }
      .golf-season-note { font-size: 13.5px; line-height: 1.5; color: rgba(16,39,66,0.74); margin: 4px 0 0; }
      .golf-season-source { font-size: 12px; color: rgba(16,39,66,0.55); margin-top: 20px; }

      /* Where to live — fixed layout, photo with overlay + name overlaid */
      .golf-live-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 22px; margin-top: 36px; }
      .golf-live-card {
        background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px;
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 1px 2px rgba(16,39,66,0.04);
      }
      .golf-live-photo-wrap {
        position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: #102742;
      }
      .golf-live-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
      .golf-live-photo-overlay {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(16,39,66,0) 35%, rgba(16,39,66,0.72) 100%);
      }
      .golf-live-name {
        position: absolute; left: 18px; right: 18px; bottom: 14px; margin: 0;
        font-family: var(--font-amboqia), Georgia, serif;
        font-size: 24px; font-weight: 500; color: #faf8f4;
        text-shadow: 0 1px 12px rgba(0,0,0,0.45);
        line-height: 1.15;
      }
      .golf-live-body {
        display: flex; flex-direction: column; gap: 14px;
        padding: 20px 22px 22px; flex: 1;
      }
      .golf-live-pitch {
        font-size: 14.5px; line-height: 1.5; color: rgba(16,39,66,0.82); margin: 0;
      }
      .golf-live-courses { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
      .golf-live-courses li {
        display: flex; align-items: baseline; gap: 8px; font-size: 13px;
        padding-bottom: 4px; border-bottom: 1px solid rgba(16,39,66,0.06);
      }
      .golf-live-courses li:last-child { border-bottom: none; padding-bottom: 0; }
      .golf-live-course-name { font-weight: 600; color: #102742; }
      .golf-live-course-by { color: rgba(16,39,66,0.55); }
      .golf-live-spacer { flex: 1; min-height: 0; }
      .golf-live-kpis {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
        padding: 10px 12px; background: rgba(16,39,66,0.05);
        border-radius: 8px;
      }
      .golf-live-kpi { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .golf-live-kpi-value {
        font-size: 14px; font-weight: 700; color: #102742; font-variant-numeric: tabular-nums;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .golf-live-kpi-label { font-size: 10px; letter-spacing: 0.06em; color: rgba(16,39,66,0.55); text-transform: uppercase; font-weight: 600; }

      /* Insider notes */
      .golf-insider-list { list-style: none; counter-reset: insider; padding: 0; margin: 32px 0 0; display: grid; gap: 18px; }
      .golf-insider-item {
        background: white; border-left: 3px solid #102742; padding: 22px 26px;
        border-radius: 10px;
        box-shadow: 0 1px 2px rgba(16,39,66,0.04);
      }
      .golf-insider-hook { font-family: var(--font-amboqia), Georgia, serif; font-size: 19px; font-weight: 500; color: #102742; margin-bottom: 8px; line-height: 1.3; }
      .golf-insider-body { font-size: 15px; line-height: 1.55; color: rgba(16,39,66,0.82); margin: 0 0 10px; }
      .golf-insider-source { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: rgba(16,39,66,0.55); letter-spacing: 0.03em; }
      .golf-insider-course { font-weight: 600; color: rgba(16,39,66,0.74); }

      /* Stay vs Buy */
      .golf-section__center { text-align: center; max-width: 760px; margin: 0 auto 40px; }
      .golf-section__center .golf-eyebrow,
      .golf-section__center .golf-h2,
      .golf-section__center .golf-lede { text-align: center; }
      .golf-section__center .golf-lede { margin-left: auto; margin-right: auto; }
      .golf-sb-compare {
        display: grid; grid-template-columns: 1fr 1fr; gap: 22px;
        max-width: 980px; margin: 0 auto;
      }
      @media (max-width: 720px) { .golf-sb-compare { grid-template-columns: 1fr; } }
      .golf-sb-card {
        background: white; border-radius: 16px; padding: 28px 30px;
        border: 1px solid rgba(16,39,66,0.08);
        display: flex; flex-direction: column; gap: 16px;
      }
      .golf-sb-card--buy { background: #102742; color: #faf8f4; border-color: #102742; }
      .golf-sb-tag {
        display: inline-block; padding: 4px 12px; border-radius: 999px;
        background: rgba(16,39,66,0.07); color: #102742;
        font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
        align-self: flex-start;
      }
      .golf-sb-tag--accent { background: rgba(250,248,244,0.18); color: #faf8f4; }
      .golf-sb-title { font-family: var(--font-amboqia), Georgia, serif; font-size: 26px; font-weight: 500; margin: 0; line-height: 1.15; }
      .golf-sb-math { display: flex; flex-direction: column; gap: 8px; font-size: 14.5px; }
      .golf-sb-line { display: flex; justify-content: space-between; gap: 12px; }
      .golf-sb-line span:last-child { font-variant-numeric: tabular-nums; font-weight: 600; }
      .golf-sb-divider {
        height: 1px; background: rgba(16,39,66,0.12); margin: 6px 0 4px;
      }
      .golf-sb-card--buy .golf-sb-divider { background: rgba(250,248,244,0.22); }
      .golf-sb-line--total { font-size: 16px; font-weight: 700; }
      .golf-sb-line--total span:last-child { font-size: 18px; }
      .golf-sb-note { font-size: 13.5px; line-height: 1.5; opacity: 0.78; margin: 4px 0 0; }
      .golf-sb-bottom {
        max-width: 760px; margin: 32px auto 0; padding-top: 28px;
        border-top: 1px solid rgba(16,39,66,0.1);
        font-size: 15px; line-height: 1.6; color: rgba(16,39,66,0.78); text-align: center;
      }
      .golf-sb-bottom p { margin: 0; }

      /* FAQ */
      .golf-faq-list { display: grid; gap: 8px; margin-top: 32px; }
      .golf-faq-item {
        background: white; border-radius: 12px; padding: 18px 24px;
        border: 1px solid rgba(16,39,66,0.08);
      }
      .golf-faq-item[open] { box-shadow: 0 1px 2px rgba(16,39,66,0.04), 0 4px 16px rgba(16,39,66,0.06); }
      .golf-faq-q {
        cursor: pointer; font-size: 16px; font-weight: 600; color: #102742;
        list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px;
      }
      .golf-faq-q::-webkit-details-marker { display: none; }
      .golf-faq-q::after {
        content: '+'; font-size: 22px; font-weight: 400; color: rgba(16,39,66,0.55);
        transition: transform 0.18s;
      }
      .golf-faq-item[open] .golf-faq-q::after { content: '−'; }
      .golf-faq-a {
        font-size: 15px; line-height: 1.6; color: rgba(16,39,66,0.78);
        margin: 12px 0 0; padding-top: 12px; border-top: 1px solid rgba(16,39,66,0.06);
      }
      /* Featured listing inside Where-to-Live card */
      .golf-live-featured {
        display: grid; grid-template-columns: 92px 1fr; gap: 12px; align-items: center;
        text-decoration: none; color: inherit;
        background: #102742; color: #faf8f4;
        border-radius: 10px; padding: 10px 14px 10px 10px;
        transition: transform 0.15s;
      }
      .golf-live-featured:hover { transform: translateY(-1px); }
      .golf-live-featured-thumb {
        width: 92px; height: 70px; object-fit: cover; border-radius: 6px; display: block;
      }
      .golf-live-featured-body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .golf-live-featured-label {
        font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
        opacity: 0.72;
      }
      .golf-live-featured-price {
        font-family: var(--font-amboqia), Georgia, serif; font-size: 22px; font-weight: 500;
        color: #faf8f4; line-height: 1.05;
      }
      .golf-live-featured-meta {
        display: flex; gap: 4px; font-size: 11.5px; opacity: 0.78;
        font-variant-numeric: tabular-nums;
      }
      .golf-live-featured-meta span + span::before { content: '·'; margin: 0 4px; opacity: 0.6; }

      .golf-live-cta {
        align-self: flex-start; text-decoration: none;
        background: transparent; color: #102742;
        border: 1px solid rgba(16,39,66,0.32);
        padding: 9px 16px; border-radius: 999px;
        font-size: 13px; font-weight: 600;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .golf-live-cta:hover { background: #102742; color: #faf8f4; border-color: #102742; }

      /* Data table */
      .golf-table-wrap { overflow-x: auto; margin-top: 24px; border: 1px solid rgba(16,39,66,0.1); border-radius: 12px; background: white; }
      .golf-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
      .golf-table th, .golf-table td { padding: 11px 14px; text-align: left; font-size: 13.5px; border-bottom: 1px solid rgba(16,39,66,0.06); white-space: nowrap; }
      .golf-table th { background: rgba(16,39,66,0.05); font-weight: 600; color: #102742; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
      .golf-table tr:last-child td { border-bottom: none; }
      .golf-table__name { font-weight: 500; color: #102742; }

      /* CTA section */
      .golf-cta-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-start; margin: 22px 0; }
      .golf-cta-row--center { justify-content: center; }
      .golf-cta-meta { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; margin-top: 28px; }
      .golf-cta-meta > div { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .golf-cta-meta-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.62; }
      .golf-cta-meta-num { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }

      @media (max-width: 640px) {
        .golf-hero { padding: 64px 20px 72px; }
        .golf-section { padding: 64px 20px; }
        .golf-rank-card { grid-template-columns: 1fr; gap: 8px; }
        .golf-rank-num { font-size: 40px; }
      }
    `}</style>
  )
}
