/**
 * Typed content for the immersive Central Oregon golf landing page rendered at
 * /homes-for-sale/<city>/on-golf-course.
 *
 * Sources, per CLAUDE.md §0 Data Accuracy:
 *  - Community registry: data/resort-communities.json (slug, city, citySlug).
 *  - Course facts: data/golf/courses.ts (designer, holes, access, signature).
 *  - FAQ facts: data/golf/faqs.ts + data/golf/courses.ts.
 *  - Image files: verified to exist under
 *    public/lp/central-oregon-golf/img/ at author time (2026-06-03).
 *
 * No course fact is invented here. Where a community has no broker-shot photo
 * on disk, `imageSrc` is omitted rather than pointed at a missing file. Where a
 * single true sentence about a community cannot be sourced, the field carries
 * only what the registry and course inventory support.
 *
 * Voice rules per CLAUDE.md §3 (brand voice). Self-scanned: no em-dash, no
 * en-dash, no semicolon, no dramatic colon, no banned words. Sentence case.
 */

export interface GolfCommunity {
  /** Display name, matches the registry label. */
  name: string
  /** City the community sits in (registry `city`). */
  city: string
  /** City slug for route building (registry `city_slug`). */
  citySlug: string
  /** Community slug, matches data/resort-communities.json + /communities/<slug>. */
  slug: string
  /** Canonical community page path. */
  communityHref: string
  /**
   * Hero/section image under public/lp/central-oregon-golf/img/. Present only
   * when a broker-shot file exists on disk for this community. Optional so a
   * community without a photo renders without a broken image reference.
   */
  imageSrc?: string
  /** Alt text for imageSrc when present. */
  imageAlt?: string
  /** Primary golf course at this community, when one is documented in courses.ts. */
  course?: string
  /** Holes / course-count note, when verifiable from the course inventory. */
  holesNote?: string
  /** One true, sourced sentence about living here in relation to its golf. */
  honestFact: string
}

/**
 * Ordered for the immersive layout: the three public-access destination
 * communities first (Tetherow, Pronghorn, Brasada), then the rest grouped by
 * area. Order matches the on-page narrative, not alphabetical.
 */
export const GOLF_COMMUNITIES: GolfCommunity[] = [
  {
    name: 'Tetherow',
    city: 'Bend',
    citySlug: 'bend',
    slug: 'tetherow',
    communityHref: '/communities/tetherow',
    imageSrc: '/lp/central-oregon-golf/img/tetherow-hero.jpg',
    imageAlt: 'Tetherow Golf Club fairway with the Cascade range behind it',
    course: 'Tetherow Golf Club',
    holesNote: '18 holes, par 72',
    honestFact:
      'David McLay Kidd, the architect of Bandon Dunes, designed the links-style course that the homes here front.',
  },
  {
    name: 'Pronghorn',
    city: 'Bend',
    citySlug: 'bend',
    slug: 'pronghorn',
    communityHref: '/communities/pronghorn',
    imageSrc: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
    imageAlt: 'Pronghorn course with high-desert juniper and lava rock',
    course: 'Pronghorn Nicklaus Signature Course',
    holesNote: '36 holes across two courses',
    honestFact:
      'The Nicklaus course here is the only Jack Nicklaus signature design in Oregon, and it is open to the public.',
  },
  {
    name: 'Brasada Ranch',
    city: 'Powell Butte',
    citySlug: 'powell-butte',
    slug: 'brasada-ranch',
    communityHref: '/communities/brasada-ranch',
    imageSrc: '/lp/central-oregon-golf/img/brasada-01.jpg',
    imageAlt: 'Brasada Canyons fairway with open high-desert views east of Bend',
    course: 'Brasada Canyons',
    holesNote: '18 holes, par 72',
    honestFact:
      'No two holes at Brasada Canyons run parallel, so the rounds and the homesites feel set apart from one another.',
  },
  {
    name: 'Broken Top',
    city: 'Bend',
    citySlug: 'bend',
    slug: 'broken-top',
    communityHref: '/communities/broken-top',
    course: 'Broken Top Club',
    holesNote: '18 holes, par 72',
    honestFact:
      'The Tom Weiskopf and Jay Morrish course is private, and membership does not require owning a home in the community.',
  },
  {
    name: 'Widgi Creek',
    city: 'Bend',
    citySlug: 'bend',
    slug: 'widgi-creek',
    communityHref: '/communities/widgi-creek',
    imageSrc: '/lp/central-oregon-golf/img/widgi-creek-01.jpg',
    imageAlt: 'Widgi Creek fairway in a ponderosa corridor near the Deschutes River',
    course: 'Widgi Creek Golf Club',
    holesNote: '18 holes, par 72',
    honestFact:
      'The Robert Muir Graves course runs through a ponderosa corridor along the Deschutes and stays open to the public.',
  },
  {
    name: 'Awbrey Glen',
    city: 'Bend',
    citySlug: 'bend',
    slug: 'awbrey-glen',
    communityHref: '/communities/awbrey-glen',
    imageSrc: '/lp/central-oregon-golf/img/awbrey-glen-01.jpg',
    imageAlt: 'Awbrey Glen fairway on the northwest side of Bend',
    course: 'Awbrey Glen Golf Club',
    holesNote: '18 holes, par 72',
    honestFact:
      'The course is private, and its practice center holds the only 5-hole par-3 learning course in Central Oregon.',
  },
  {
    name: 'Eagle Crest',
    city: 'Redmond',
    citySlug: 'redmond',
    slug: 'eagle-crest',
    communityHref: '/communities/eagle-crest',
    imageSrc: '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
    imageAlt: 'Eagle Crest Resort fairway west of Redmond',
    course: 'Eagle Crest Resort',
    holesNote: '54 holes across three courses',
    honestFact:
      'The Ridge Course stays open year-round when conditions allow, the longest playing season in the region.',
  },
  {
    name: 'Black Butte Ranch',
    city: 'Sisters',
    citySlug: 'sisters',
    slug: 'black-butte-ranch',
    communityHref: '/communities/black-butte-ranch',
    course: 'Black Butte Ranch',
    holesNote: '36 holes across the Big Meadow and Glaze Meadow courses',
    honestFact:
      'John Fought rebuilt the Glaze Meadow course in 2012, and both courses sit below Black Butte west of Sisters.',
  },
  {
    name: 'Sunriver',
    city: 'Sunriver',
    citySlug: 'sunriver',
    slug: 'sunriver',
    communityHref: '/communities/sunriver',
    imageSrc: '/lp/central-oregon-golf/img/sunriver-river.jpg',
    imageAlt: 'The Deschutes River running through Sunriver',
    course: 'Sunriver Resort (Meadows and Woodlands)',
    holesNote: '63 holes across four resort courses',
    honestFact:
      'The Meadows and Woodlands courses are open to resort guests, and cabin-sized inventory near them can fit under one million dollars.',
  },
  {
    name: 'Crosswater',
    city: 'Sunriver',
    citySlug: 'sunriver',
    slug: 'crosswater',
    communityHref: '/communities/crosswater',
    imageSrc: '/lp/central-oregon-golf/img/crosswater-01.jpg',
    imageAlt: 'Crosswater course through pine forest and wetland near Sunriver',
    course: 'Crosswater',
    holesNote: '18 holes, par 72',
    honestFact:
      'Crosswater is a Golf Digest Top 100 course reserved for Sunriver Resort guests and Crosswater Club members.',
  },
  {
    name: 'Caldera Springs',
    city: 'Sunriver',
    citySlug: 'sunriver',
    slug: 'caldera-springs',
    communityHref: '/communities/caldera-springs',
    course: 'Caldera Links',
    holesNote: '9-hole short course, par 27',
    honestFact:
      'Caldera Links is a 9-hole short course for owners here, Sunriver Resort guests, and Crosswater Club members.',
  },
]

/**
 * Stat band — counts derived from this file and the course inventory, plus the
 * region label. No fabricated climate stat. Every value here is countable
 * against GOLF_COMMUNITIES / data/golf/courses.ts.
 */
export const GOLF_STAT_BAND: { value: string; label: string }[] = [
  { value: '11', label: 'golf communities' },
  { value: '28', label: 'courses across the region' },
  { value: '5', label: 'towns, from Bend to Sisters' },
  { value: 'Central Oregon', label: 'high desert at the foot of the Cascades' },
]

export interface GolfFaqItem {
  question: string
  answer: string
}

/**
 * FAQPage-ready golf-buyer questions. Honest and useful: the difference between
 * on-course and golf-view, HOA dues versus a separate club membership, the
 * playing season, and the short-term-rental nuance at resort communities.
 * Facts trace to data/golf/courses.ts, data/golf/faqs.ts, and the registry.
 */
export const GOLF_FAQ: GolfFaqItem[] = [
  {
    question: 'What is the difference between an on-course home and a golf-view home?',
    answer:
      'An on-course home fronts a fairway, a tee, or a green directly, so play passes the property line. A golf-view home looks toward the course from across a road or a buffer and is usually priced below comparable frontage. Ask which one a listing is before you tour, because the listing photos can read the same from the deck.',
  },
  {
    question: 'Does buying a home here include a golf membership?',
    answer:
      'Usually not. At most Central Oregon golf communities the HOA dues cover common-area upkeep, and golf is a separate club membership you join and pay for on its own. Broken Top, for one, does not require homeownership to join the golf club, and owning a home there does not include golf. Confirm what the dues cover and what the club costs before you write an offer.',
  },
  {
    question: 'Which golf communities are open to the public versus private?',
    answer:
      'Public-access destination courses include Tetherow, the Pronghorn Nicklaus course, Widgi Creek, and the resort courses at Sunriver, Eagle Crest, Black Butte Ranch, and Brasada. Broken Top, Awbrey Glen, and the Pronghorn Fazio course are private. Crosswater is reserved for Sunriver Resort guests and Crosswater Club members. You can live on a private course without playing it, and play a public one without living there.',
  },
  {
    question: 'When is the Central Oregon golf season?',
    answer:
      'Late March to early November for most public and resort courses, with frost delays at both ends. Eagle Crest Ridge and a few year-round courses stay open in winter when conditions allow, on a midday-only basis. A home here is a three-season golf address for most owners, and the off months are the value months.',
  },
  {
    question: 'Can I rent my golf-community home short-term when I am not using it?',
    answer:
      'It depends on the community. Resort areas such as Sunriver and Eagle Crest have an established nightly-rental market, while some HOAs cap or prohibit short stays. Short-term-rental rules change, and Deschutes County and the city can have their own permits. Verify the current HOA covenant and the local permit rules for the exact address before you count on rental income.',
  },
  {
    question: 'Can I buy a golf-community home for under one million dollars?',
    answer:
      'Yes, in some communities. Eagle Crest in Redmond has condos that start well below a million, and cabin-sized inventory near the Sunriver resort courses can fit under that mark. The mainline destination communities such as Tetherow, Pronghorn, and Brasada Ranch generally start above a million for a finished home.',
  },
  {
    question: 'How does the elevation change how the course plays?',
    answer:
      'The destination courses sit between 3,500 and 3,800 feet, so the ball carries close to 8 percent further than at sea level. Plan a club less than your sea-level yardage, and expect colder morning rounds to play longer. It is a small thing that changes how a course feels on the first visit.',
  },
]

/** Phone in brand dotted format, for any CTA the page renders. */
export const GOLF_LANDING_PHONE = '541.213.6706'
