/**
 * Central Oregon golf courses registry.
 *
 * Source of truth for the /central-oregon/golf hub + detail pages. Central Oregon
 * is a golf destination; this covers the public, resort, and semi-private courses
 * (private members-only clubs are included for completeness but flagged). Each
 * course is the ENTITY (play here + what it is like to live near it) and
 * cross-links to its resort community page where one exists, so it complements
 * rather than competes with the community page (docs/CONTENT_ENGINE_SPEC.md §2.2).
 *
 * Data provenance (CLAUDE.md §0 — verified + cited, never invented):
 *   - Facts (holes, par, designer, access) trace to `officialUrl` as of
 *     `lastVerified`. Where a fact could not be verified it is omitted.
 *   - `blurb` is an ORIGINAL, brand-voice write-up. Never scraped.
 *   - `lat`/`lng` are the clubhouse location, used to join the live active
 *     single-family listings within ~1.5 miles (same box the parks pages use).
 *
 * Schema: golf courses emit `Place`/`TouristAttraction` JSON-LD — the policy-safe
 * type for a destination we do NOT own (NOT `GolfCourse`, which derives from
 * schema.org LocalBusiness and asserts ownership). Per the 2026-07-03 AEO
 * research pass, marking a third-party venue as your own LocalBusiness violates
 * Google's anti-impersonation policy.
 */

export type GolfAccess = 'public' | 'resort' | 'semi-private' | 'private'

export type CoGolfCourse = {
  /** kebab-case slug. Stable, unique. */
  slug: string
  name: string
  city: string
  /** City slug for the cross-link to /cities/[slug] + the market band. */
  geoSlug: string
  access: GolfAccess
  /** 9, 18, 27, etc. */
  holes: number
  par?: number
  designer?: string
  yearOpened?: number
  address?: string
  /** Clubhouse latitude (WGS84) — anchors the nearby-homes query + map. */
  lat?: number
  /** Clubhouse longitude (WGS84). */
  lng?: number
  /** Original, brand-voice write-up. Never scraped. */
  blurb: string
  /** Official course/resort URL the facts trace to (CLAUDE.md §0). */
  officialUrl: string
  /** Slug of the Ryan Realty resort community the course sits in, when any. */
  communitySlug?: string
  /** ISO 'YYYY-MM-DD' this row was last verified against officialUrl. */
  lastVerified: string
}

export const GOLF_ACCESS_LABEL: Record<GolfAccess, string> = {
  public: 'Public',
  resort: 'Resort',
  'semi-private': 'Semi-private',
  private: 'Private',
}

/** kebab-case a course name for its slug. */
export function slugifyCourseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The registry. Every fact is verified against `officialUrl` as of
 * `lastVerified`. Populated 2026-07-03 from source-verified research.
 */
export const CO_GOLF_COURSES: CoGolfCourse[] = [
  // ─── BEND ──────────────────────────────────────────────────────────────
  {
    slug: 'tetherow-golf-club',
    name: 'Tetherow Golf Club',
    city: 'Bend',
    geoSlug: 'bend',
    access: 'resort',
    holes: 18,
    par: 72,
    designer: 'David McLay Kidd',
    address: '61240 Skyline Ranch Rd, Bend, OR 97702',
    lat: 44.025418,
    lng: -121.364323,
    blurb:
      'Tetherow plays like a Scottish links dropped into the high desert. David McLay Kidd routed the par 72 through native fescue and volcanic contours on the west side of Bend, with the Cascades on the skyline. It anchors the Tetherow resort community, so the homes around it back right up to the course.',
    officialUrl: 'https://tetherow.com/luxury-golf-resort/golf-course/',
    communitySlug: 'tetherow',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'widgi-creek',
    name: 'Widgi Creek Golf Club',
    city: 'Bend',
    geoSlug: 'bend',
    access: 'public',
    holes: 18,
    address: '18707 SW Century Dr, Bend, OR 97702',
    lat: 44.001585,
    lng: -121.384844,
    blurb:
      'Widgi Creek is a public 18 set along Century Drive on the way to Mount Bachelor, playing just under 7,000 yards through pine and along the Deschutes canyon rim. It sits inside the Widgi Creek community, which mixes cabins and full-time homes a short drive from the Old Mill.',
    officialUrl: 'https://www.widgi.com/',
    communitySlug: 'widgi-creek',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'rivers-edge',
    name: "River's Edge Golf Course",
    city: 'Bend',
    geoSlug: 'bend',
    access: 'public',
    holes: 18,
    address: '400 NW Pro Shop Drive, Bend, OR 97703',
    lat: 44.076734,
    lng: -121.316671,
    blurb:
      "River's Edge climbs the bluff above the Deschutes on Bend's northwest side, so most holes open onto a mountain or river view as you play down the slope. The public course runs through the River's Edge community, one of the closer golf neighborhoods to downtown.",
    officialUrl: 'https://riversedgegolfbend.com/',
    communitySlug: 'rivers-edge',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'bend-golf-club',
    name: 'Bend Golf Club',
    city: 'Bend',
    geoSlug: 'bend',
    access: 'private',
    holes: 18,
    designer: 'Chandler Egan',
    yearOpened: 1925,
    address: '61045 Country Club Drive, Bend, OR 97702',
    lat: 44.01573,
    lng: -121.304456,
    blurb:
      "Bend Golf Club is the city's oldest course, member owned since 1925 and laid out by amateur champion Chandler Egan. The private 18 sits southeast of downtown along the river, with mature ponderosa lining tight, traditional corridors.",
    officialUrl: 'https://bendgolfclub.com/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'awbrey-glen',
    name: 'Awbrey Glen Golf Club',
    city: 'Bend',
    geoSlug: 'bend',
    access: 'private',
    holes: 18,
    designer: 'Gene "Bunny" Mason',
    yearOpened: 1993,
    address: '2500 NW Awbrey Glen Drive, Bend, OR 97703',
    lat: 44.080014,
    lng: -121.351165,
    blurb:
      "Awbrey Glen is a private, member owned club on Bend's northwest hillside, opened in 1993 to a Gene Mason design and later refreshed by David McLay Kidd. The Awbrey Glen neighborhood wraps the fairways with some of the higher ground and longer Cascade views in town.",
    officialUrl: 'https://www.awbreyglen.com/golf',
    communitySlug: 'awbrey-glen',
    lastVerified: '2026-07-03',
  },
  // ─── REDMOND ───────────────────────────────────────────────────────────
  {
    slug: 'eagle-crest-resort-course',
    name: 'Eagle Crest Resort Course',
    city: 'Redmond',
    geoSlug: 'redmond',
    access: 'resort',
    holes: 18,
    par: 72,
    address: '1522 Cline Falls Rd, Redmond, OR 97756',
    lat: 44.259855,
    lng: -121.262858,
    blurb:
      'The Resort Course is the original 18 at Eagle Crest in Redmond, a par 72 that plays two distinct nines across juniper flats and rock outcrops. It is the everyday course for the Eagle Crest resort community, where a lot of buyers land for the sun and the price per foot.',
    officialUrl: 'https://www.eaglecrestgolforegon.com/courses/',
    communitySlug: 'eagle-crest',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'eagle-crest-ridge-course',
    name: 'Eagle Crest Ridge Course',
    city: 'Redmond',
    geoSlug: 'redmond',
    access: 'resort',
    holes: 18,
    par: 72,
    address: '1522 Cline Falls Rd, Redmond, OR 97756',
    lat: 44.259855,
    lng: -121.262858,
    blurb:
      "The Ridge Course is Eagle Crest's higher, tighter par 72, cut through an old juniper forest with Cascade views from the upper holes. It is the tougher of the resort's full courses and sits inside the same Eagle Crest community on Redmond's west side.",
    officialUrl: 'https://www.eaglecrestgolforegon.com/courses/',
    communitySlug: 'eagle-crest',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'eagle-crest-challenge-course',
    name: 'Eagle Crest Challenge Course',
    city: 'Redmond',
    geoSlug: 'redmond',
    access: 'resort',
    holes: 18,
    par: 63,
    address: '1522 Cline Falls Rd, Redmond, OR 97756',
    lat: 44.259855,
    lng: -121.262858,
    blurb:
      'The Challenge Course is Eagle Crest\'s par 63 short course, ranked among the better ones in the country and built for a fast round without giving up scenery. It rounds out the golf inside the Eagle Crest resort community, good for families and shoulder season play.',
    officialUrl: 'https://www.eaglecrestgolforegon.com/courses/',
    communitySlug: 'eagle-crest',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'juniper',
    name: 'Juniper Golf Course',
    city: 'Redmond',
    geoSlug: 'redmond',
    access: 'public',
    holes: 18,
    par: 72,
    designer: 'John Harbottle',
    address: '1938 SW Elkhorn Ave, Redmond, OR 97756',
    lat: 44.227808,
    lng: -121.189942,
    blurb:
      'Juniper is Redmond\'s municipal 18, a John Harbottle par 72 that stretches past 7,000 yards and threads between rimrock and old junipers. As a public course owned by the city, it is one of the better values in Central Oregon for the shot variety you get.',
    officialUrl: 'https://www.playjuniper.com/',
    lastVerified: '2026-07-03',
  },
  // ─── POWELL BUTTE ──────────────────────────────────────────────────────
  {
    slug: 'brasada-canyons',
    name: 'Brasada Canyons',
    city: 'Powell Butte',
    geoSlug: 'powell-butte',
    access: 'resort',
    holes: 18,
    address: '16986 SW Brasada Ranch Rd, Powell Butte, OR 97753',
    lat: 44.15778,
    lng: -121.047792,
    blurb:
      'Brasada Canyons runs across the ranchland at Brasada Ranch in Powell Butte, with holes that fall into dry canyons and rise to open views of the Cascades and the Three Sisters. Play is held for members and resort guests, and the surrounding ranch homes sit on some of the biggest lots in the region.',
    officialUrl: 'https://www.brasada.com/bend-oregon-golf',
    communitySlug: 'brasada-ranch',
    lastVerified: '2026-07-03',
  },
  // ─── PRINEVILLE ────────────────────────────────────────────────────────
  {
    slug: 'meadow-lakes',
    name: 'Meadow Lakes Golf Course',
    city: 'Prineville',
    geoSlug: 'prineville',
    access: 'public',
    holes: 18,
    designer: 'Bill Robinson',
    address: '300 SW Meadow Lakes Drive, Prineville, OR 97754',
    lat: 44.297115,
    lng: -120.853178,
    blurb:
      "Meadow Lakes is Prineville's city owned 18, a Bill Robinson design that crosses the Crooked River four times and uses water on nearly half its holes. It was built as part of the town's water reclamation system, which is a rare origin story for a public course this good.",
    officialUrl: 'https://www.meadowlakesgc.com/meadowlakes/page/course',
    lastVerified: '2026-07-03',
  },
  // ─── TERREBONNE ────────────────────────────────────────────────────────
  {
    slug: 'crooked-river-ranch',
    name: 'Crooked River Ranch Golf Course',
    city: 'Terrebonne',
    geoSlug: 'terrebonne',
    access: 'public',
    holes: 18,
    par: 71,
    address: '5195 SW Clubhouse Rd, Terrebonne, OR 97760',
    lat: 44.423712,
    lng: -121.239351,
    blurb:
      'Crooked River Ranch is a public par 71 north of Terrebonne, best known for its fifth hole on the rim of the Crooked River Gorge with the canyon dropping away below the tee. The course sits inside the Crooked River Ranch community, where acreage and quiet are the draw.',
    officialUrl: 'https://www.crookedriverranchgc.com/',
    communitySlug: 'crooked-river-ranch',
    lastVerified: '2026-07-03',
  },
  // ─── LA PINE ───────────────────────────────────────────────────────────
  {
    slug: 'quail-run',
    name: 'Quail Run Golf Course',
    city: 'La Pine',
    geoSlug: 'la-pine',
    access: 'public',
    holes: 18,
    address: '16725 Northridge Drive, La Pine, OR 97739',
    lat: 43.757275,
    lng: -121.490911,
    blurb:
      'Quail Run is a public 18 in La Pine with four tee sets running from about 5,400 to more than 6,800 yards, so it fits a wide range of games. It plays through pine at the south end of the county, where land and homes still come cheaper than anywhere closer to Bend.',
    officialUrl: 'https://golfquailrun.com/',
    lastVerified: '2026-07-03',
  },
  // ─── SUNRIVER ──────────────────────────────────────────────────────────
  {
    slug: 'crosswater',
    name: 'Crosswater',
    city: 'Sunriver',
    geoSlug: 'sunriver',
    access: 'private',
    holes: 18,
    par: 72,
    address: '17600 Canoe Camp Drive, Sunriver, OR 97707',
    lat: 43.853336,
    lng: -121.447162,
    blurb:
      'Crosswater spreads across 600 acres of wetland and river channel south of Bend, a private par 72 in heathland style with the Deschutes and Little Deschutes threading through the routing. It is the centerpiece of the Crosswater community, the most private address inside the Sunriver area.',
    officialUrl: 'https://crosswater.com/',
    communitySlug: 'crosswater',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'sunriver-meadows',
    name: 'Meadows at Sunriver',
    city: 'Sunriver',
    geoSlug: 'sunriver',
    access: 'private',
    holes: 18,
    designer: 'John Fought',
    lat: 43.874013,
    lng: -121.446472,
    blurb:
      'The Meadows is a John Fought 18 that became part of the private Sunriver Golf Club in 2024, with open, walkable ground and long Cascade views across the resort. Homes around it trade on the strength of Sunriver\'s rental demand and its trail network.',
    officialUrl: 'https://www.sunriverresort.com/memberships/sunriver-golf-club',
    communitySlug: 'sunriver',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'sunriver-woodlands',
    name: 'Woodlands at Sunriver',
    city: 'Sunriver',
    geoSlug: 'sunriver',
    access: 'private',
    holes: 18,
    par: 72,
    lat: 43.903119,
    lng: -121.433557,
    blurb:
      'The Woodlands is Sunriver\'s par 72 threaded through lodgepole pine, tighter and more sheltered than the Meadows next door, and now part of the private Sunriver Golf Club. It sits in the heart of the resort, a short bike ride from the village and the river.',
    officialUrl: 'https://www.sunriverresort.com/memberships/sunriver-golf-club',
    communitySlug: 'sunriver',
    lastVerified: '2026-07-03',
  },
  // ─── SISTERS ───────────────────────────────────────────────────────────
  {
    slug: 'aspen-lakes',
    name: 'Aspen Lakes Golf Course',
    city: 'Sisters',
    geoSlug: 'sisters',
    access: 'public',
    holes: 18,
    designer: 'William Overdorf',
    yearOpened: 1999,
    address: '16900 Aspen Lakes Dr, Sisters, OR 97759',
    lat: 44.298366,
    lng: -121.486042,
    blurb:
      'Aspen Lakes is a public 18 outside Sisters, a William Overdorf design finished in 1999 and easy to spot for its red cinder bunkers cut from local volcanic rock. The setting runs to open hay ground and a full wall of Cascade peaks to the west.',
    officialUrl: 'https://www.aspenlakes.com/course',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'big-meadow',
    name: 'Big Meadow',
    city: 'Sisters',
    geoSlug: 'sisters',
    access: 'resort',
    holes: 18,
    par: 72,
    designer: 'Robert Muir Graves',
    address: '13899 Bishops Cap, Sisters, OR 97759',
    lat: 44.375191,
    lng: -121.641879,
    blurb:
      'Big Meadow is the original course at Black Butte Ranch, a Robert Muir Graves par 72 that opens onto wide meadow and a straight look at Black Butte and the Sisters. Public tee times are available, and the ranch around it is one of the most established second home communities in the state.',
    officialUrl: 'https://www.blackbutteranch.com/golf/golf-courses/',
    communitySlug: 'black-butte-ranch',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'glaze-meadow',
    name: 'Glaze Meadow',
    city: 'Sisters',
    geoSlug: 'sisters',
    access: 'resort',
    holes: 18,
    designer: 'John Fought',
    address: '13899 Bishops Cap, Sisters, OR 97759',
    lat: 44.375191,
    lng: -121.641879,
    blurb:
      'Glaze Meadow is the second course at Black Butte Ranch, rebuilt by John Fought in 2012 to play just over 7,000 yards from the tips with five tee sets on every hole. It shares the ranch\'s meadow and mountain setting and books public tee times alongside member play.',
    officialUrl: 'https://www.blackbutteranch.com/golf/golf-courses/',
    communitySlug: 'black-butte-ranch',
    lastVerified: '2026-07-03',
  },
]

/** Direct slug lookup. */
export function getGolfCourseBySlug(slug: string): CoGolfCourse | undefined {
  return CO_GOLF_COURSES.find((c) => c.slug === slug)
}
