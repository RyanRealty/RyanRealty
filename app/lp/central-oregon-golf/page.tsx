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
import { GOLF_SEASON } from '@/data/golf/seasons'
import { INSIDER_NOTES } from '@/data/golf/insider-notes'
import { GOLF_FAQS } from '@/data/golf/faqs'
import {
  loadGolfCommunityKpis,
  formatCurrencyToThousands,
  type GolfCommunitySlug,
  type GolfCommunityKpi,
} from '@/data/golf/community-kpis'
import { GolfCourseMap } from './_components/GolfCourseMap'

export const dynamic = 'force-static'
export const revalidate = 21600 // 6h

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Central Oregon golf — every course, by architect | Ryan Realty',
  description:
    "30 courses across Bend, Sunriver, Sisters, Redmond, Powell Butte. Grouped by designer, mapped, and tied to the community you'd live in if you played here every week.",
  alternates: { canonical: `${siteUrl}/lp/central-oregon-golf/` },
  openGraph: {
    title: 'Central Oregon golf — every course, by architect',
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
    title: 'Central Oregon golf — every course, by architect',
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
        name: 'Central Oregon Golf — Every Course, By Architect',
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
  const communityKpis = await loadGolfCommunityKpis()
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
      <WhereToLiveSection communityKpis={communityKpis} />
      <InsiderNotesSection />
      <StayVsBuySection />
      <DataTableSection />
      <FaqSection />
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
        <Link href="#contact" className="golf-sticky-nav__cta">
          Talk to a broker
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
          30 courses across Bend, Sunriver, Sisters, Redmond, and Powell Butte. Six designers with
          national reputations. 300 days of sunshine a year. Here is how to play it, and what it
          costs to live near each one.
        </p>
        <div className="golf-hero__cta-row">
          <a href="#destination-courses" className="golf-cta golf-cta--primary">
            The destination 8
          </a>
          <a href="#by-architect" className="golf-cta">
            By architect
          </a>
          <a href="#where-to-live" className="golf-cta">
            Where to live
          </a>
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
            mid-summer and the ground game opens up — links rules in the high desert.
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
        <div className="golf-eyebrow golf-eyebrow--cream">Section 3</div>
        <h2 className="golf-h2 golf-h2--cream">The destination 8.</h2>
        <p className="golf-lede golf-lede--cream">
          If you are flying into Central Oregon for a long weekend, these are the eight worth the
          trip. Ranked by a combination of design pedigree, course conditioning, and the
          panoramic-tee-box test.
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
                {c.communitySlug && (
                  <Link href={`/lp/${c.communitySlug}/`} className="golf-rank-link">
                    Homes near {c.shortName} →
                  </Link>
                )}
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
        <div className="golf-eyebrow">Section 4</div>
        <h2 className="golf-h2">Every course in Central Oregon, on one map.</h2>
        <p className="golf-lede">
          Public courses, resort courses, private clubs, and municipals — color-coded by access.
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
        <div className="golf-eyebrow">Section 5</div>
        <h2 className="golf-h2">By architect.</h2>
        <p className="golf-lede">
          Same 30 courses, grouped by the designer who routed them. The Pacific NW does not have
          another concentration of national-name architects like this.
        </p>

        <div className="golf-architect-grid">
          {groups.map(({ architect, courses }) => (
            <div key={architect.slug} className="golf-architect-card">
              <h3 className="golf-architect-name">{architect.name}</h3>
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
            </div>
          ))}
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
        <div className="golf-eyebrow">Section 8</div>
        <h2 className="golf-h2">When to play.</h2>
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
}: {
  communityKpis: Record<GolfCommunitySlug, GolfCommunityKpi | null>
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

  const communityMeta: Record<string, { name: string; pitch: string; hasLP: boolean; image?: string; imageAlt?: string }> = {
    tetherow: {
      name: 'Tetherow',
      pitch: "McLay Kidd's #57-in-the-country 18 outside your back door. Mt Bachelor lifts 20 minutes up the road.",
      hasLP: true,
      image: '/lp/central-oregon-golf/img/tetherow-03.jpg',
      imageAlt: 'Tetherow residential community along the McLay Kidd fairway',
    },
    'broken-top': {
      name: 'Broken Top',
      pitch: 'Weiskopf 18, saltwater pool, and a six-acre trout lake inside a gated 27,000 sqft clubhouse.',
      hasLP: false,
    },
    pronghorn: {
      name: 'Pronghorn / Juniper Preserve',
      pitch: "Oregon's only Jack Nicklaus signature course on the public side. Fazio next door if you want private.",
      hasLP: false,
      image: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
      imageAlt: 'Pronghorn Resort with Jack Nicklaus signature course routing',
    },
    sunriver: {
      name: 'Sunriver',
      pitch: '63 holes across four resort courses. 33 miles of bike paths. One of the largest residential resort communities in the West.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/sunriver-river.jpg',
      imageAlt: 'Sunriver Resort along the Deschutes River',
    },
    'caldera-springs': {
      name: 'Caldera Springs',
      pitch: 'Bob Cupp 9-hole short course, lakeside cabin lifestyle, walk to the lodge.',
      hasLP: false,
    },
    crosswater: {
      name: 'Crosswater',
      pitch: 'Cupp + Fought Top-100 course inside a gated Sunriver enclave. Member access stays in the family.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/crosswater-02.jpg',
      imageAlt: 'Crosswater Club fairway with wetlands and Cascade backdrop',
    },
    'black-butte-ranch': {
      name: 'Black Butte Ranch',
      pitch: '36 championship holes plus a putting course, all under the Three Sisters and Black Butte itself.',
      hasLP: false,
    },
    'brasada-ranch': {
      name: 'Brasada Ranch',
      pitch: 'Hardy + Jacobsen 18, "best 18 views in the state," 300 days of sunshine east of Bend.',
      hasLP: false,
      image: '/lp/central-oregon-golf/img/brasada-02.jpg',
      imageAlt: 'Brasada Ranch residences along the Brasada Canyons golf course',
    },
    'eagle-crest': {
      name: 'Eagle Crest',
      pitch: "Three courses including the Ridge — Central Oregon's longest playing season.",
      hasLP: false,
    },
    'awbrey-glen': {
      name: 'Awbrey Glen',
      pitch: 'Private Bunny Mason 18 on the north side of Bend. Sparkling lakes, lava outcroppings, walkable to Pine Nursery.',
      hasLP: false,
    },
    'widgi-creek': {
      name: 'Widgi Creek',
      pitch: "Locals' favorite public 18 on the way to Mt Bachelor. Pacific NW's top pickleball facility on the same property.",
      hasLP: false,
    },
    'three-rivers': {
      name: 'Three Rivers',
      pitch: 'Adjacent to the four Sunriver courses. Mid-range cabin pricing without the resort fees.',
      hasLP: false,
    },
  }

  return (
    <section className="golf-section golf-section--alt" id="where-to-live">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">Section 7</div>
        <h2 className="golf-h2">Where to live near each course.</h2>
        <p className="golf-lede">
          12 of the 14 master-planned communities in the Ryan Realty registry are golf-adjacent.
          Here is the match-up.
        </p>

        <div className="golf-live-grid">
          {items.map(({ community, courses }) => {
            const meta = communityMeta[community]
            if (!meta) return null
            const kpi = communityKpis[community as GolfCommunitySlug]
            const medianFmt = kpi ? formatCurrencyToThousands(kpi.medianSalePrice) : null
            return (
              <div key={community} className="golf-live-card">
                {meta.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.image}
                    alt={meta.imageAlt ?? meta.name}
                    loading="lazy"
                    className="golf-live-photo"
                  />
                )}
                <h3 className="golf-live-name">{meta.name}</h3>
                <p className="golf-live-pitch">{meta.pitch}</p>
                {kpi && (medianFmt || kpi.activeInventory != null || kpi.soldCount12mo != null) && (
                  <div className="golf-live-kpis">
                    {medianFmt && (
                      <div className="golf-live-kpi">
                        <span className="golf-live-kpi-label">Median 12mo</span>
                        <span className="golf-live-kpi-value">{medianFmt}</span>
                      </div>
                    )}
                    {kpi.activeInventory != null && (
                      <div className="golf-live-kpi">
                        <span className="golf-live-kpi-label">Active</span>
                        <span className="golf-live-kpi-value">{kpi.activeInventory}</span>
                      </div>
                    )}
                    {kpi.soldCount12mo != null && (
                      <div className="golf-live-kpi">
                        <span className="golf-live-kpi-label">Sold 12mo</span>
                        <span className="golf-live-kpi-value">{kpi.soldCount12mo}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="golf-live-courses">
                  <span className="golf-live-courses-label">Courses on property:</span>
                  <ul>
                    {courses.map((c) => (
                      <li key={c.slug}>
                        {c.shortName} <span className="golf-live-courses-meta">· {c.designer}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {meta.hasLP ? (
                  <Link href={`/lp/${community}/`} className="golf-live-cta">
                    Search homes in {meta.name} →
                  </Link>
                ) : (
                  <Link
                    href={`/homes-for-sale?subdivision=${encodeURIComponent(meta.name)}`}
                    className="golf-live-cta golf-live-cta--secondary"
                  >
                    Search homes in {meta.name} →
                  </Link>
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
 *  FULL DATA TABLE
 * ──────────────────────────────────────────────────────────────────────── */
function DataTableSection() {
  const sorted = [...GOLF_COURSES].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <section className="golf-section" id="full-table">
      <div className="golf-section__inner">
        <div className="golf-eyebrow">Section 6</div>
        <h2 className="golf-h2">Every course, side by side.</h2>
        <p className="golf-lede">
          Designer, year, holes, par, yardage, city, access. The full lookup table for green-fee
          research. Per-course rates omitted — we publish what we can verify from the course&apos;s
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
          Verifiable facts that only locals carry. Each note traces to a primary source — a course
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
      <div className="golf-section__inner golf-section__inner--narrow">
        <div className="golf-eyebrow">The honest math</div>
        <h2 className="golf-h2">Stay-and-play, or buy-and-play?</h2>

        <div className="golf-prose">
          <p>
            Here is the line we draw. If you golf Central Oregon one to three times a year, the
            stay-and-play package is the right tool — the resorts have priced their bundles to
            beat anything a homeowner could put together on a per-trip basis.
          </p>
          <p>
            If you golf Central Oregon eight or more times a year, the math flips. A Pronghorn or
            Brasada Ranch pied-a-terre starts in the $300K-$500K range, monthly carrying cost
            (HOA + property tax + utilities + the share of mortgage interest you would not have
            paid on the rental nights) lands around $2,500-$3,500. Five three-night resort trips
            at peak rates closes the gap fast.
          </p>
          <p>
            The frame to settle on: how many rounds, what comp set, and how much of the
            non-golf time matters. Brokers (us included) make money on the transaction. So
            this part is direct: if the rental math wins for you, the rental math wins. The
            cards above carry real 12-month median data — that is where the comparison starts.
            Reach out when you want a per-community spreadsheet.
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
            href="/seller-home-value?source=golf-lp"
            className="golf-cta golf-cta--cream"
          >
            Get a home valuation
          </Link>
          <Link
            href="/buyer-listing-alerts?source=golf-lp"
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
        font-family: 'Playfair Display', Georgia, serif;
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
        font-family: 'Playfair Display', Georgia, serif;
        font-size: clamp(40px, 6vw, 72px);
        font-weight: 500;
        line-height: 1.05;
        margin: 0 0 18px;
        letter-spacing: -0.01em;
      }
      .golf-hero__sub { max-width: 760px; font-size: 17px; line-height: 1.55; opacity: 0.88; margin: 0 0 28px; }
      .golf-hero__cta-row { display: flex; flex-wrap: wrap; gap: 10px; }

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
        font-family: 'Playfair Display', Georgia, serif;
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
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 56px; font-weight: 400; color: rgba(250,248,244,0.62); line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .golf-rank-body { display: flex; flex-direction: column; gap: 8px; }
      .golf-rank-photo {
        width: 100%; max-width: 720px; aspect-ratio: 16 / 10; object-fit: cover;
        border-radius: 10px; margin-bottom: 6px; display: block;
      }
      .golf-rank-name { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 500; margin: 0; color: #faf8f4; }
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
      .golf-architect-name { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 500; margin: 0; color: #102742; }
      .golf-architect-bio { font-size: 14.5px; line-height: 1.55; color: rgba(16,39,66,0.78); margin: 0; }
      .golf-architect-courses { display: flex; flex-wrap: wrap; gap: 6px; }
      .golf-architect-course {
        font-size: 12px; padding: 4px 10px; border-radius: 999px;
        background: rgba(16,39,66,0.07); color: #102742; font-weight: 500;
      }
      .golf-architect-aka { font-size: 12px; color: rgba(16,39,66,0.6); line-height: 1.45; margin-top: auto; padding-top: 6px; border-top: 1px solid rgba(16,39,66,0.06); }
      .golf-architect-aka-label { font-weight: 600; color: rgba(16,39,66,0.78); }

      /* Season calendar */
      .golf-season-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 28px; }
      .golf-season-card {
        background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 12px; padding: 18px 20px;
        display: flex; flex-direction: column; gap: 6px; min-height: 200px;
      }
      .golf-season-month { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 500; color: #102742; }
      .golf-season-temps { font-size: 24px; font-weight: 500; color: #102742; font-variant-numeric: tabular-nums; }
      .golf-season-temp-low { font-size: 16px; color: rgba(16,39,66,0.55); font-weight: 400; margin-left: 4px; }
      .golf-season-status {
        font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
        color: #102742; padding: 4px 10px; border-radius: 999px; background: rgba(16,39,66,0.07);
        align-self: flex-start;
      }
      .golf-season-card--prime .golf-season-status { background: #102742; color: #faf8f4; }
      .golf-season-card--high-season .golf-season-status { background: rgba(201,138,42,0.18); color: #8b5e1a; }
      .golf-season-card--shoulder .golf-season-status,
      .golf-season-card--late-season .golf-season-status { background: rgba(16,39,66,0.1); color: #102742; }
      .golf-season-card--mostly-closed .golf-season-status { background: rgba(16,39,66,0.06); color: rgba(16,39,66,0.62); }
      .golf-season-note { font-size: 13.5px; line-height: 1.5; color: rgba(16,39,66,0.74); margin: 4px 0 0; }
      .golf-season-source { font-size: 12px; color: rgba(16,39,66,0.55); margin-top: 20px; }

      /* Where to live */
      .golf-live-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-top: 32px; }
      .golf-live-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; gap: 12px; }
      .golf-live-card > :not(.golf-live-photo) { padding-left: 24px; padding-right: 24px; }
      .golf-live-card > h3.golf-live-name { padding-top: 20px; }
      .golf-live-card > .golf-live-cta { margin-bottom: 24px; margin-left: 24px; }
      .golf-live-photo { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
      .golf-live-kpis {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
        padding: 12px 14px; background: rgba(16,39,66,0.05);
        border-radius: 10px; margin: 4px 24px 0;
      }
      .golf-live-kpi { display: flex; flex-direction: column; gap: 2px; }
      .golf-live-kpi-label { font-size: 10.5px; letter-spacing: 0.06em; color: rgba(16,39,66,0.6); text-transform: uppercase; font-weight: 600; }
      .golf-live-kpi-value { font-size: 15px; font-weight: 600; color: #102742; font-variant-numeric: tabular-nums; }

      /* Insider notes */
      .golf-insider-list { list-style: none; counter-reset: insider; padding: 0; margin: 32px 0 0; display: grid; gap: 18px; }
      .golf-insider-item {
        background: white; border-left: 3px solid #102742; padding: 22px 26px;
        border-radius: 10px;
        box-shadow: 0 1px 2px rgba(16,39,66,0.04);
      }
      .golf-insider-hook { font-family: 'Playfair Display', Georgia, serif; font-size: 19px; font-weight: 500; color: #102742; margin-bottom: 8px; line-height: 1.3; }
      .golf-insider-body { font-size: 15px; line-height: 1.55; color: rgba(16,39,66,0.82); margin: 0 0 10px; }
      .golf-insider-source { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: rgba(16,39,66,0.55); letter-spacing: 0.03em; }
      .golf-insider-course { font-weight: 600; color: rgba(16,39,66,0.74); }

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
      .golf-live-name { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 500; margin: 0; color: #102742; }
      .golf-live-pitch { font-size: 14.5px; line-height: 1.55; color: rgba(16,39,66,0.78); margin: 0; }
      .golf-live-courses { font-size: 13px; color: rgba(16,39,66,0.74); }
      .golf-live-courses-label { font-weight: 600; color: rgba(16,39,66,0.86); }
      .golf-live-courses ul { list-style: none; padding: 0; margin: 6px 0 0; }
      .golf-live-courses li { padding: 2px 0; }
      .golf-live-courses-meta { color: rgba(16,39,66,0.55); }
      .golf-live-cta {
        margin-top: auto; align-self: flex-start; text-decoration: none;
        background: #102742; color: #faf8f4; padding: 9px 16px; border-radius: 999px;
        font-size: 13px; font-weight: 600;
      }
      .golf-live-cta--secondary { background: transparent; color: #102742; border: 1px solid rgba(16,39,66,0.32); }
      .golf-live-cta:hover { opacity: 0.92; }

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
