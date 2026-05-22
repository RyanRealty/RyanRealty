/**
 * Central Oregon golf course inventory.
 *
 * Data source: out/golf-lp-research/research-notes.md §3 (verified 2026-05-22).
 * Coordinates: approximations for v1 map; refine against Google Geocoding API
 * once the maps regression is resolved.
 *
 * Per CLAUDE.md §0 Data Accuracy, every figure here traces to a primary
 * source documented in the research file. Green-fee bands deliberately
 * omitted where we can't verify from a course-page primary source —
 * "verify with the course" is the only ship-safe default.
 */

export type CourseAccess =
  | 'public'
  | 'resort'
  | 'private'
  | 'municipal'
  | 'semi-private'

export interface GolfCourse {
  slug: string
  name: string
  shortName: string
  city: string
  holes: number
  par: number
  yardsBackTees?: number
  designer: string
  designerSlug: string
  yearOpened: number
  access: CourseAccess
  signature: string
  /** Approximate lat/lng. Verify before publishing. */
  lat: number
  lng: number
  /** Existing Ryan Realty community LP slug, if course sits inside one. */
  communitySlug?:
    | 'tetherow'
    | 'broken-top'
    | 'pronghorn'
    | 'sunriver'
    | 'caldera-springs'
    | 'crosswater'
    | 'black-butte-ranch'
    | 'brasada-ranch'
    | 'eagle-crest'
    | 'awbrey-glen'
    | 'widgi-creek'
    | 'three-rivers'
  /** Ranked in the v1 destination-8 callout. */
  destinationRank?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  /** Path under `/public/lp/central-oregon-golf/img/`. Broker-shot
   * Snowdrift Visuals photography downloaded from Drive 2026-05-22. */
  heroImage?: string
  /** Alt for the heroImage — accessibility + SEO. */
  heroImageAlt?: string
}

export const GOLF_COURSES: GolfCourse[] = [
  // ── Resort / public-access destination courses ─────────────────────────
  {
    slug: 'tetherow-golf-club',
    name: 'Tetherow Golf Club',
    shortName: 'Tetherow',
    city: 'Bend',
    holes: 18,
    par: 72,
    yardsBackTees: 7298,
    designer: 'David McLay Kidd',
    designerSlug: 'david-mclay-kidd',
    yearOpened: 2008,
    access: 'semi-private',
    signature:
      'McLay Kidd links-style design with Cascade panoramas. Ranked #57 USA by Golf Digest. Same architect as Bandon Dunes and the St Andrews Castle Course.',
    lat: 44.0142,
    lng: -121.3508,
    communitySlug: 'tetherow',
    destinationRank: 1,
    heroImage: '/lp/central-oregon-golf/img/tetherow-02.jpg',
    heroImageAlt: 'Tetherow Golf Club fairway with Cascade Range in the background',
  },
  {
    slug: 'pronghorn-nicklaus',
    name: 'Pronghorn Nicklaus Signature Course',
    shortName: 'Pronghorn Nicklaus',
    city: 'Bend (NE)',
    holes: 18,
    par: 72,
    yardsBackTees: 7379,
    designer: 'Jack Nicklaus',
    designerSlug: 'jack-nicklaus',
    yearOpened: 2003,
    access: 'public',
    signature:
      "Oregon's only Jack Nicklaus signature design. Public access. Dramatic lava outcroppings and ancient juniper.",
    lat: 44.1494,
    lng: -121.1573,
    communitySlug: 'pronghorn',
    destinationRank: 2,
    heroImage: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
    heroImageAlt: 'Pronghorn Resort fairway with juniper and high-desert terrain',
  },
  {
    slug: 'pronghorn-fazio',
    name: 'Pronghorn Tom Fazio Championship Course',
    shortName: 'Pronghorn Fazio',
    city: 'Bend (NE)',
    holes: 18,
    par: 72,
    yardsBackTees: 7470,
    designer: 'Tom Fazio',
    designerSlug: 'tom-fazio',
    yearOpened: 2007,
    access: 'private',
    signature:
      'Famous par-3 #8: a 45-foot canyon with an exposed lava tube. One of the most photographed holes in the Pacific NW. Private.',
    lat: 44.1517,
    lng: -121.1601,
    communitySlug: 'pronghorn',
    destinationRank: 3,
  },
  {
    slug: 'crosswater',
    name: 'Sunriver Resort — Crosswater',
    shortName: 'Crosswater',
    city: 'Sunriver',
    holes: 18,
    par: 72,
    yardsBackTees: 7683,
    designer: 'Robert E. Cupp & John Fought',
    designerSlug: 'cupp-fought',
    yearOpened: 1995,
    access: 'semi-private',
    signature:
      'Golf Digest Top 100. Pine forests, wetlands, Cascade peaks. Resort guests and Crosswater Club members.',
    lat: 43.8522,
    lng: -121.4475,
    communitySlug: 'crosswater',
    destinationRank: 4,
    heroImage: '/lp/central-oregon-golf/img/crosswater-01.jpg',
    heroImageAlt: 'Crosswater Club at Sunriver — wetlands, pine forest, Cascade peaks',
  },
  {
    slug: 'sunriver-meadows',
    name: 'Sunriver Resort — Meadows',
    shortName: 'Sunriver Meadows',
    city: 'Sunriver',
    holes: 18,
    par: 71,
    yardsBackTees: 7012,
    designer: 'John Fought (2008 renovation)',
    designerSlug: 'john-fought',
    yearOpened: 1981,
    access: 'resort',
    signature: 'Public resort course. Water hazards, sloping fairways, deep bunkers.',
    lat: 43.8762,
    lng: -121.4510,
    communitySlug: 'sunriver',
  },
  {
    slug: 'sunriver-woodlands',
    name: 'Sunriver Resort — Woodlands',
    shortName: 'Sunriver Woodlands',
    city: 'Sunriver',
    holes: 18,
    par: 72,
    yardsBackTees: 6932,
    designer: 'Robert Trent Jones Jr.',
    designerSlug: 'robert-trent-jones-jr',
    yearOpened: 1981,
    access: 'resort',
    signature: 'Public resort course. Lava-rock features, mature ponderosa forest.',
    lat: 43.8889,
    lng: -121.4347,
    communitySlug: 'sunriver',
  },
  {
    slug: 'caldera-links',
    name: 'Sunriver Resort — Caldera Links',
    shortName: 'Caldera Links',
    city: 'Sunriver / Caldera Springs',
    holes: 9,
    par: 27,
    designer: 'Bob Cupp & Jim Ramey',
    designerSlug: 'cupp-fought',
    yearOpened: 2007,
    access: 'resort',
    signature:
      'Family-friendly short course, 60-185 yard holes. Reserved for Sunriver Resort guests, Caldera Springs owners, Crosswater Club members.',
    lat: 43.8521,
    lng: -121.4392,
    communitySlug: 'caldera-springs',
  },
  {
    slug: 'black-butte-big-meadow',
    name: 'Black Butte Ranch — Big Meadow',
    shortName: 'Big Meadow',
    city: 'Sisters',
    holes: 18,
    par: 72,
    yardsBackTees: 7002,
    designer: 'Robert Muir Graves',
    designerSlug: 'robert-muir-graves',
    yearOpened: 1972,
    access: 'resort',
    signature:
      '7,000+ yards from championship tees. Towering ponderosa and expansive fairways below Black Butte itself.',
    lat: 44.3785,
    lng: -121.6239,
    communitySlug: 'black-butte-ranch',
    destinationRank: 6,
    heroImage: '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
    heroImageAlt: 'Three Sisters peaks looming over Sisters, Oregon — the Black Butte Ranch terrain',
  },
  {
    slug: 'black-butte-glaze-meadow',
    name: 'Black Butte Ranch — Glaze Meadow',
    shortName: 'Glaze Meadow',
    city: 'Sisters',
    holes: 18,
    par: 72,
    yardsBackTees: 7007,
    designer: 'John Fought (2012 renovation)',
    designerSlug: 'john-fought',
    yearOpened: 1980,
    access: 'resort',
    signature:
      'John Fought rebuilt the course in 2012. Considered by many the most iconic course in Central Oregon.',
    lat: 44.3671,
    lng: -121.6336,
    communitySlug: 'black-butte-ranch',
    destinationRank: 5,
    heroImage: '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
    heroImageAlt: 'Three Sisters peaks above Black Butte Ranch — the Glaze Meadow setting',
  },
  {
    slug: 'brasada-canyons',
    name: 'Brasada Canyons',
    shortName: 'Brasada Canyons',
    city: 'Powell Butte',
    holes: 18,
    par: 72,
    yardsBackTees: 7295,
    designer: 'Jim Hardy & Peter Jacobsen',
    designerSlug: 'hardy-jacobsen',
    yearOpened: 2007,
    access: 'resort',
    signature:
      'Five tee sets, 4,722-7,295 yards. "Best 18 views in the state." Members, resort guests, and accompanied guests.',
    lat: 44.2754,
    lng: -121.0118,
    communitySlug: 'brasada-ranch',
    destinationRank: 7,
    heroImage: '/lp/central-oregon-golf/img/brasada-01.jpg',
    heroImageAlt: 'Brasada Canyons at Brasada Ranch — open high-desert terrain east of Bend',
  },
  {
    slug: 'eagle-crest-resort',
    name: 'Eagle Crest Resort — Resort Course',
    shortName: 'Eagle Crest Resort',
    city: 'Redmond',
    holes: 18,
    par: 72,
    yardsBackTees: 6673,
    designer: 'Gene "Bunny" Mason',
    designerSlug: 'bunny-mason',
    yearOpened: 1986,
    access: 'resort',
    signature: '6,673 yards from the tips. The original Eagle Crest course.',
    lat: 44.3196,
    lng: -121.2461,
    communitySlug: 'eagle-crest',
  },
  {
    slug: 'eagle-crest-ridge',
    name: 'Eagle Crest Resort — Ridge Course',
    shortName: 'Eagle Crest Ridge',
    city: 'Redmond',
    holes: 18,
    par: 71,
    yardsBackTees: 6927,
    designer: 'John Thronson & Bunny Mason',
    designerSlug: 'bunny-mason',
    yearOpened: 1993,
    access: 'resort',
    signature:
      '"A driver\'s dream." Open year-round — the longest playing season in Central Oregon.',
    lat: 44.3229,
    lng: -121.2526,
    communitySlug: 'eagle-crest',
  },
  {
    slug: 'eagle-crest-challenge',
    name: 'Eagle Crest Resort — Challenge Course',
    shortName: 'Eagle Crest Challenge',
    city: 'Redmond',
    holes: 18,
    par: 63,
    designer: 'John Thronson',
    designerSlug: 'bunny-mason',
    yearOpened: 1995,
    access: 'resort',
    signature: 'Executive layout. Pairs with the Ridge for the area\'s longest playing season.',
    lat: 44.3181,
    lng: -121.2419,
    communitySlug: 'eagle-crest',
  },
  {
    slug: 'aspen-lakes',
    name: 'Aspen Lakes Golf Course',
    shortName: 'Aspen Lakes',
    city: 'Sisters',
    holes: 18,
    par: 72,
    yardsBackTees: 7302,
    designer: 'William Overdorf',
    designerSlug: 'william-overdorf',
    yearOpened: 1996,
    access: 'public',
    signature:
      'Family-owned. Distinctive red-cinder sand bunkers — the Cyrus family crushed their own volcanic cinders for them.',
    lat: 44.2862,
    lng: -121.5182,
    destinationRank: 8,
    heroImage: '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
    heroImageAlt: 'Sisters area beneath the Three Sisters peaks — Aspen Lakes setting',
  },
  {
    slug: 'widgi-creek',
    name: 'Widgi Creek Golf Club',
    shortName: 'Widgi Creek',
    city: 'Bend',
    holes: 18,
    par: 72,
    yardsBackTees: 6905,
    designer: 'Robert Muir Graves',
    designerSlug: 'robert-muir-graves',
    yearOpened: 1989,
    access: 'public',
    signature:
      'Ponderosa corridor along the Deschutes. Voted Central Oregon\'s favorite public course 20+ times by The Source readers.',
    lat: 44.0224,
    lng: -121.3461,
    communitySlug: 'widgi-creek',
  },
  {
    slug: 'rivers-edge',
    name: "River's Edge Golf Course",
    shortName: "River's Edge",
    city: 'Bend',
    holes: 18,
    par: 72,
    yardsBackTees: 6647,
    designer: 'Robert Muir Graves',
    designerSlug: 'robert-muir-graves',
    yearOpened: 1987,
    access: 'public',
    signature:
      'In-town public course. Cascade and Deschutes River views. Golf Digest "Best Places to Play."',
    lat: 44.0784,
    lng: -121.3230,
  },
  {
    slug: 'lost-tracks',
    name: 'Lost Tracks Golf Club',
    shortName: 'Lost Tracks',
    city: 'Bend',
    holes: 18,
    par: 72,
    yardsBackTees: 7003,
    designer: 'Brian Whitcomb',
    designerSlug: 'brian-whitcomb',
    yearOpened: 1996,
    access: 'public',
    signature:
      '7,003 yards. Owner-designed by Whitcomb (PGA of America past president). The old-railroad dining-car bridge on hole 16. Borders the national forest.',
    lat: 44.0288,
    lng: -121.2756,
  },
  {
    slug: 'juniper',
    name: 'Juniper Golf Course',
    shortName: 'Juniper',
    city: 'Redmond',
    holes: 18,
    par: 72,
    yardsBackTees: 7200,
    designer: 'John Harbottle III',
    designerSlug: 'john-harbottle-iii',
    yearOpened: 2005,
    access: 'municipal',
    signature:
      "Ranked Best Municipal Course in Oregon. Hosted the 2007 and 2010 Oregon Open. City of Redmond owned.",
    lat: 44.2967,
    lng: -121.2138,
  },
  {
    slug: 'quail-run',
    name: 'Quail Run Golf Course',
    shortName: 'Quail Run',
    city: 'La Pine',
    holes: 18,
    par: 72,
    yardsBackTees: 6859,
    designer: 'Jim Ramey',
    designerSlug: 'cupp-fought',
    yearOpened: 1991,
    access: 'public',
    signature: 'Panoramic Cascade views. Lowest green fees in Central Oregon, $25-$55.',
    lat: 43.6675,
    lng: -121.4831,
  },
  {
    slug: 'meadow-lakes',
    name: 'Meadow Lakes Golf Course',
    shortName: 'Meadow Lakes',
    city: 'Prineville',
    holes: 18,
    par: 72,
    yardsBackTees: 6841,
    designer: 'Bill Robinson',
    designerSlug: 'bill-robinson',
    yearOpened: 1993,
    access: 'municipal',
    signature:
      "The Crooked River crosses the routing four times. Top-3 municipal in Oregon. The course doubles as Prineville's wastewater-disposal system, built 1993.",
    lat: 44.3008,
    lng: -120.8312,
  },
  {
    slug: 'crooked-river-ranch',
    name: 'Crooked River Ranch Golf Course',
    shortName: 'Crooked River Ranch',
    city: 'Terrebonne',
    holes: 18,
    par: 71,
    yardsBackTees: 5818,
    designer: 'Bunny Mason & Jim Ramey',
    designerSlug: 'bunny-mason',
    yearOpened: 1979,
    access: 'public',
    signature: 'Hole #5 plays over a corner of the Crooked River Canyon — one of the most photographed holes in Oregon.',
    lat: 44.4864,
    lng: -121.2998,
  },
  {
    slug: 'greens-at-redmond',
    name: 'The Greens at Redmond',
    shortName: 'The Greens',
    city: 'Redmond',
    holes: 18,
    par: 58,
    designer: 'Robert Muir Graves',
    designerSlug: 'robert-muir-graves',
    yearOpened: 1995,
    access: 'public',
    signature:
      'Public executive course. Man-made lakes, canals, white-sand bunkers. A lower-stakes round; good for new players.',
    lat: 44.2723,
    lng: -121.1803,
  },
  {
    slug: 'desert-peaks',
    name: 'Desert Peaks Golf Club',
    shortName: 'Desert Peaks',
    city: 'Madras',
    holes: 9,
    par: 36,
    yardsBackTees: 3231,
    designer: 'City of Madras',
    designerSlug: 'other',
    yearOpened: 1980,
    access: 'municipal',
    signature: 'Open year-round weather permitting. Cascade views from the high desert.',
    lat: 44.6332,
    lng: -121.1304,
  },
  // ── Private / Club-membership ─────────────────────────────────────────
  {
    slug: 'bend-golf-club',
    name: 'Bend Golf Club',
    shortName: 'Bend Golf Club',
    city: 'Bend',
    holes: 18,
    par: 72,
    yardsBackTees: 7000,
    designer: 'H. Chandler Egan & Bob Baldock',
    designerSlug: 'egan-baldock',
    yearOpened: 1925,
    access: 'private',
    signature:
      'Oldest course in Central Oregon. H. Chandler Egan back nine dates to 1925. Has hosted the Oregon Open, Northwest Open, Oregon Amateur, and PNGA Women\'s Amateur.',
    lat: 44.0261,
    lng: -121.2785,
  },
  {
    slug: 'broken-top-club',
    name: 'Broken Top Club',
    shortName: 'Broken Top',
    city: 'Bend',
    holes: 18,
    par: 72,
    yardsBackTees: 7161,
    designer: 'Tom Weiskopf & Jay Morrish',
    designerSlug: 'weiskopf-morrish',
    yearOpened: 1993,
    access: 'private',
    signature:
      'Private. 27,000 sqft clubhouse. Membership capped at 395 golf + 200 social. Homeownership not required.',
    lat: 44.0438,
    lng: -121.3661,
    communitySlug: 'broken-top',
  },
  {
    slug: 'awbrey-glen',
    name: 'Awbrey Glen Golf Club',
    shortName: 'Awbrey Glen',
    city: 'Bend',
    holes: 18,
    par: 72,
    yardsBackTees: 7002,
    designer: 'Gene "Bunny" Mason',
    designerSlug: 'bunny-mason',
    yearOpened: 2003,
    access: 'private',
    signature:
      'Private. 7,002 yards, rating 72.6 / slope 135. Practice center includes Central Oregon\'s only 5-hole par-3 learning course.',
    lat: 44.0871,
    lng: -121.3306,
    communitySlug: 'awbrey-glen',
  },
]

// Helpers consumed by the LP sections.
export const DESTINATION_COURSES: GolfCourse[] = GOLF_COURSES
  .filter((c): c is GolfCourse & { destinationRank: number } => c.destinationRank !== undefined)
  .sort((a, b) => a.destinationRank - b.destinationRank)

export function coursesByAccess(): Record<CourseAccess, GolfCourse[]> {
  const acc: Record<CourseAccess, GolfCourse[]> = {
    public: [],
    resort: [],
    private: [],
    municipal: [],
    'semi-private': [],
  }
  for (const c of GOLF_COURSES) acc[c.access].push(c)
  return acc
}
