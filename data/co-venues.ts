/**
 * Central Oregon live-music + performing-arts venues registry.
 *
 * Source of truth for the /central-oregon/venues hub + detail pages — the
 * durable way to cover "music and shows" without scraping ever-changing concert
 * calendars. Each venue is a stable PLACE; its detail page links out to the
 * venue's OWN official live calendar (`calendarUrl`) for specific shows, shows
 * the homes for sale nearby, and never republishes a copyrighted lineup
 * (docs/CONTENT_ENGINE_SPEC.md §7).
 *
 * Data provenance (CLAUDE.md §0 — verified + cited, never invented):
 *   - `blurb` is an ORIGINAL, brand-voice write-up of what the venue is.
 *   - `officialUrl` / `calendarUrl` are the venue's own pages, verified live as
 *     of `lastVerified`.
 *   - `lat`/`lng` are the venue location, used to join the live active
 *     single-family listings within ~1.5 miles (the same box the parks +
 *     events pages use).
 */

export type VenueKind = 'music' | 'performing-arts' | 'both'

export type VenueType =
  | 'amphitheater'
  | 'theater'
  | 'playhouse'
  | 'brewery-stage'
  | 'club'
  | 'hall'
  | 'multi-use'

export type CoVenue = {
  /** kebab-case slug. Stable, unique. */
  slug: string
  name: string
  /** music / performing-arts / both — drives the hub's two sections. */
  kind: VenueKind
  venueType: VenueType
  city: string
  /** City slug for the cross-link to /cities/[slug]. */
  geoSlug: string
  address?: string
  /** Venue latitude (WGS84) — anchors the nearby-homes query + map. */
  lat?: number
  /** Venue longitude (WGS84). */
  lng?: number
  /** Approximate capacity, when published. */
  capacity?: number
  /** Original, brand-voice write-up of what the venue is. */
  blurb: string
  /** Venue's official homepage. */
  officialUrl: string
  /** Venue's live shows/events calendar — we LINK here, never scrape it. */
  calendarUrl: string
  /** ISO 'YYYY-MM-DD' this row was last verified against officialUrl. */
  lastVerified: string
}

export const VENUE_TYPE_LABEL: Record<VenueType, string> = {
  amphitheater: 'Amphitheater',
  theater: 'Theater',
  playhouse: 'Playhouse',
  'brewery-stage': 'Brewery stage',
  club: 'Club',
  hall: 'Music hall',
  'multi-use': 'Multi-use venue',
}

export const VENUE_KIND_LABEL: Record<VenueKind, string> = {
  music: 'Live music',
  'performing-arts': 'Theater & performing arts',
  both: 'Music & performing arts',
}

/** kebab-case a venue name for its slug. */
export function slugifyVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The registry. Every venue is verified against its `officialUrl` as of
 * `lastVerified`. Populated 2026-07-03 from source-verified research.
 */
export const CO_VENUES: CoVenue[] = [
  // ── Performing-arts + multi-use venues (verified 2026-07-03) ──
  {
    slug: 'tower-theatre',
    name: 'Tower Theatre',
    kind: 'both',
    venueType: 'theater',
    city: 'Bend',
    geoSlug: 'bend',
    address: '835 NW Wall St',
    lat: 44.058,
    lng: -121.313,
    capacity: 480,
    blurb:
      'A restored art deco theater on Wall Street in the heart of downtown Bend, open since 1940 and run today by the nonprofit Tower Theatre Foundation. The 480 seat house is Central Oregon’s anchor performing arts stage, with a year-round calendar that runs national touring musicians, comedians, dance companies, film screenings, and the closing night of the Sunriver Music Festival each August. Its neon blade sign is one of the most photographed landmarks downtown. The walkable blocks around the theater, from Wall and Bond streets down to Mirror Pond, hold some of the most sought-after addresses in Bend.',
    officialUrl: 'https://www.towertheatre.org/',
    calendarUrl: 'https://www.towertheatre.org/events',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'greenwood-playhouse',
    name: 'Greenwood Playhouse',
    kind: 'performing-arts',
    venueType: 'playhouse',
    city: 'Bend',
    geoSlug: 'bend',
    address: '148 NW Greenwood Ave',
    lat: 44.062,
    lng: -121.31,
    blurb:
      'The home of Cascades Theatrical Company, the oldest community theater in Central Oregon, founded in 1978. It stages a full season of plays and musicals in downtown Bend.',
    officialUrl: 'https://cascadestheatrical.org/',
    calendarUrl: 'https://cascadestheatrical.org/category/main-stage-productions/upcoming-productions/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'second-street-theater',
    name: '2nd Street Theater',
    kind: 'performing-arts',
    venueType: 'theater',
    city: 'Bend',
    geoSlug: 'bend',
    address: '220 NE Lafayette Ave',
    lat: 44.063,
    lng: -121.305,
    capacity: 93,
    blurb:
      'A 93 seat black box theater run by the nonprofit Stage Right Productions. It stages plays and musicals and hosts other local arts groups.',
    officialUrl: 'https://www.2ndstreettheater.com/',
    calendarUrl: 'https://www.2ndstreettheater.com/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'the-belfry',
    name: 'The Belfry',
    kind: 'both',
    venueType: 'multi-use',
    city: 'Sisters',
    geoSlug: 'sisters',
    address: '302 E Main Ave',
    lat: 44.291,
    lng: -121.548,
    blurb:
      'A 1914 former church turned concert and event hall in downtown Sisters. It hosts touring musicians, dance, and community events, and serves as a stage for the Sisters Folk Festival.',
    officialUrl: 'https://belfryevents.com/',
    calendarUrl: 'https://belfryevents.com/events/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'volcanic-theatre-pub',
    name: 'Volcanic Theatre Pub',
    kind: 'both',
    venueType: 'multi-use',
    city: 'Bend',
    geoSlug: 'bend',
    address: '70 SW Century Dr',
    lat: 44.055,
    lng: -121.324,
    blurb:
      'An intimate all ages black box venue with a full bar on Century Drive in Bend. It runs live music most nights, plus film, comedy, and theater.',
    officialUrl: 'https://www.volcanictheatre.com/',
    calendarUrl: 'https://www.volcanictheatre.com/events',
    lastVerified: '2026-07-03',
  },

  // ── Live-music venues (verified 2026-07-03) ──
  {
    slug: 'hayden-homes-amphitheater',
    name: 'Hayden Homes Amphitheater',
    kind: 'music',
    venueType: 'amphitheater',
    city: 'Bend',
    geoSlug: 'bend',
    address: '344 SW Shevlin Hixon Dr',
    lat: 44.0525,
    lng: -121.3178,
    capacity: 8000,
    blurb:
      'An outdoor riverfront amphitheater in the Old Mill District, built in 2001 and known for years as the Les Schwab Amphitheater. The lawn holds roughly eight thousand people on the banks of the Deschutes, and its summer season brings a run of national touring acts to town from late spring into October, from rock and country headliners to symphony nights. Gates open a couple hours before showtime and much of the crowd floats in on the river or walks over from the Old Mill shops and restaurants. Living within walking or paddling distance of the amphitheater is one of the things that defines the west side and the neighborhoods along the river.',
    officialUrl: 'https://www.bendconcerts.com/',
    calendarUrl: 'https://www.bendconcerts.com/events',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'midtown-ballroom',
    name: 'Midtown Ballroom & Domino Room',
    kind: 'music',
    venueType: 'hall',
    city: 'Bend',
    geoSlug: 'bend',
    address: '51 NW Greenwood Ave',
    lat: 44.0596,
    lng: -121.3126,
    blurb:
      "Bend's largest indoor music complex, three rooms under one roof: the Midtown Ballroom, the mid sized Domino Room, and the smaller Annex. It books local and national touring acts.",
    officialUrl: 'https://midtownballroom.com/',
    calendarUrl: 'https://midtownballroom.com/calendar',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'silver-moon-brewing',
    name: 'Silver Moon Brewing',
    kind: 'music',
    venueType: 'brewery-stage',
    city: 'Bend',
    geoSlug: 'bend',
    address: '24 NW Greenwood Ave',
    lat: 44.0595,
    lng: -121.3115,
    blurb:
      'A downtown Bend brewery and pub with a dedicated stage that runs live music through the week, from a weekly bluegrass night to touring bands.',
    officialUrl: 'https://www.silvermoonbrewing.com/',
    calendarUrl: 'https://www.silvermoonbrewing.com/events',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'mcmenamins-old-st-francis',
    name: 'McMenamins Old St. Francis School',
    kind: 'music',
    venueType: 'hall',
    city: 'Bend',
    geoSlug: 'bend',
    address: '700 NW Bond St',
    lat: 44.0577,
    lng: -121.3098,
    blurb:
      'A 1936 schoolhouse that McMenamins turned into a hotel, pub, brewery, and movie theater in 2004. Live music runs in Father Luke’s Room and the Old St. Francis Theater.',
    officialUrl: 'https://www.mcmenamins.com/old-st-francis-school',
    calendarUrl: 'https://www.mcmenamins.com/old-st-francis-school/things-to-do/music-events',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'worthy-brewing',
    name: 'Worthy Brewing',
    kind: 'music',
    venueType: 'brewery-stage',
    city: 'Bend',
    geoSlug: 'bend',
    address: '495 NE Bellevue Dr',
    lat: 44.062,
    lng: -121.2707,
    blurb:
      "A craft brewery on Bend's east side with a large backyard patio and a rooftop Hopservatory. Its summer concert series runs outdoor live music from spring into fall.",
    officialUrl: 'https://worthybrewing.com/',
    calendarUrl: 'https://worthybrewing.com/events-and-concerts',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'rivers-place',
    name: "River's Place",
    kind: 'music',
    venueType: 'brewery-stage',
    city: 'Bend',
    geoSlug: 'bend',
    address: '787 NE Purcell Blvd',
    lat: 44.0713,
    lng: -121.2807,
    blurb:
      "An indoor and outdoor taphouse and food truck lot on Bend's east side. Live music runs Thursdays, Saturdays, and Sundays through the year.",
    officialUrl: 'https://riversplacebend.com/',
    calendarUrl: 'https://riversplacebend.com/events',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'bunk-brew',
    name: 'Bunk+Brew',
    kind: 'music',
    venueType: 'brewery-stage',
    city: 'Bend',
    geoSlug: 'bend',
    address: '42 NW Hawthorne Ave',
    lat: 44.0607,
    lng: -121.3135,
    blurb:
      "A hostel and community basecamp in Bend's oldest brick building, with food carts and craft beer. Live music runs every weekend alongside trivia, karaoke, and film nights.",
    officialUrl: 'https://www.bunkandbrew.com/',
    calendarUrl: 'https://www.bunkandbrew.com/events/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'the-commons-bend',
    name: 'The Commons Cafe & Taproom',
    kind: 'music',
    venueType: 'club',
    city: 'Bend',
    geoSlug: 'bend',
    address: '875 NW Brooks St',
    lat: 44.0588,
    lng: -121.3162,
    blurb:
      'A downtown Bend cafe and taproom that doubles as a community hub, with open mic nights and concerts in the adjacent Mirror Pond Plaza.',
    officialUrl: 'https://www.thecommonsbend.com/',
    calendarUrl: 'https://www.thecommonsbend.com/events',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'high-desert-music-hall',
    name: 'High Desert Music Hall',
    kind: 'music',
    venueType: 'hall',
    city: 'Redmond',
    geoSlug: 'redmond',
    address: '818 SW Forest Ave',
    lat: 44.2718,
    lng: -121.1745,
    blurb:
      'A dedicated live music venue and events hall in downtown Redmond, with a bar and outdoor food carts. It hosts touring and local acts across genres through the year.',
    officialUrl: 'https://highdesertmusichall.com/',
    calendarUrl: 'https://highdesertmusichall.com/calendar/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'general-duffys-waterhole',
    name: "General Duffy's Waterhole",
    kind: 'music',
    venueType: 'brewery-stage',
    city: 'Redmond',
    geoSlug: 'redmond',
    address: '404 SW Forest Ave',
    lat: 44.2698,
    lng: -121.177,
    blurb:
      "A veteran owned taphouse and food court in Redmond with two event spaces. Its Summer Kickin' Concert Series brings national country and touring acts to town.",
    officialUrl: 'https://generalduffys.com/',
    calendarUrl: 'https://generalduffys.com/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'sunriver-resort-concerts',
    name: 'Sunriver Resort',
    kind: 'music',
    venueType: 'amphitheater',
    city: 'Sunriver',
    geoSlug: 'sunriver',
    address: '17600 Center Dr',
    lat: 43.8918,
    lng: -121.4407,
    blurb:
      "The resort's Backyard hosts an outdoor summer concert series on weekends from late June into August, and its Great Hall is a stage for the Sunriver Music Festival each August.",
    officialUrl: 'https://www.sunriverresort.com/',
    calendarUrl: 'https://www.sunriverresort.com/holidays-events/summer-concert-series',
    lastVerified: '2026-07-03',
  },

  // ── More performing-arts + arthouse venues (verified 2026-07-03) ──
  {
    slug: 'tin-pan-theater',
    name: 'Tin Pan Theater',
    kind: 'performing-arts',
    venueType: 'theater',
    city: 'Bend',
    geoSlug: 'bend',
    address: '869 NW Tin Pan Alley',
    lat: 44.0588,
    lng: -121.313,
    capacity: 28,
    blurb:
      "Bend's arthouse cinema on Tin Pan Alley downtown, run by BendFilm. It seats a few dozen in vintage theater chairs and shows independent and international films you will not find at the multiplex.",
    officialUrl: 'https://tinpantheater.com/',
    calendarUrl: 'https://tinpantheater.com/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'open-space-event-studios',
    name: 'Open Space Event Studios',
    kind: 'both',
    venueType: 'multi-use',
    city: 'Bend',
    geoSlug: 'bend',
    address: '220 NE Lafayette Ave',
    lat: 44.0632,
    lng: -121.3095,
    blurb:
      "An adaptable event space in Bend's Central District that hosts performances, film, workshops, markets, and gatherings. Its calendar runs music, comedy, and creative events through the year.",
    officialUrl: 'https://www.openspace.studio/',
    calendarUrl: 'https://www.openspace.studio/events',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'sisters-movie-house',
    name: 'Sisters Movie House',
    kind: 'performing-arts',
    venueType: 'theater',
    city: 'Sisters',
    geoSlug: 'sisters',
    address: '720 Desperado Court',
    lat: 44.2872,
    lng: -121.5449,
    blurb:
      'A cinema and cafe in Sisters showing first run films, with beer, wine, and a full menu. Doors open half an hour before the first showtime and seating is first come, first served.',
    officialUrl: 'https://www.sistersmoviehouse.com/',
    calendarUrl: 'https://www.sistersmoviehouse.com/',
    lastVerified: '2026-07-03',
  },
  {
    slug: 'sunriver-stars',
    name: 'Sunriver Stars Community Theater',
    kind: 'performing-arts',
    venueType: 'playhouse',
    city: 'Sunriver',
    geoSlug: 'sunriver',
    address: 'Sunriver Nature Center Amphitheater',
    lat: 43.876,
    lng: -121.439,
    blurb:
      'The outdoor amphitheater at the Sunriver Nature Center is home to the Sunriver Stars, whose free summer family plays and youth drama camp showcases run each August.',
    officialUrl: 'https://sunriverstars.org/',
    calendarUrl: 'https://sunriverstars.org/upcoming-plays/',
    lastVerified: '2026-07-03',
  },
]

/** Direct slug lookup. */
export function getVenueBySlug(slug: string): CoVenue | undefined {
  return CO_VENUES.find((v) => v.slug === slug)
}
