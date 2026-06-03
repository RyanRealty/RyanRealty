/**
 * Central Oregon parks registry.
 *
 * Source of truth for the /parks index + /parks/[slug] detail pages. Each entry
 * pairs a park with its verified location, a sourced factual description, a
 * traceable amenities list, and (where available) an official boundary polygon
 * stored in the `boundaries` table under geo_type='park'.
 *
 * Data provenance (CLAUDE.md §0 — verified + cited, never invented):
 *   - lat/lng are the centroid of the official boundary polygon (computed from
 *     the same geometry stored in `boundaries`, so the map frame and the
 *     "homes near here" query agree).
 *   - acreage for STATE parks is the GIS_ACRES value from the Oregon State Parks
 *     FeatureServer (cross-checked against the PostGIS area of the stored
 *     polygon). For CITY parks it is the size published on the managing agency's
 *     official park page (BPRD / City of Redmond / City of Sisters / CCPRD).
 *   - blurb + amenities trace to the `sourceUrl` (the park's official agency
 *     page). Where a fact could not be verified it is omitted, not guessed.
 *
 * Boundary polygons (all SRID 4326, stored as MultiPolygon):
 *   - State parks: Oregon State Parks FeatureServer (Oregon GEO / OPRD),
 *     https://maps.prd.state.or.us/arcgis/rest/services/Land_ownership/Oregon_State_Parks/FeatureServer/0
 *   - City parks: OpenStreetMap contributors (sourced via the Overpass API).
 *   - Inserted by migration 20260603130000_park_boundaries.sql. The map fetches
 *     them via getParkBoundaryGeoJSON (boundary_geojson RPC, geo_type='park').
 *
 * Every park in this registry hasPolygon=true. If a future park cannot get an
 * accurate polygon, set hasPolygon=false and omit its `boundaries` row — the
 * detail page then frames the map on the centroid + nearby homes only, rather
 * than drawing a wrong shape (CLAUDE.md §0).
 */

export type ParkType = 'state' | 'city' | 'natural-area'

export type CoPark = {
  /** kebab-case slug. Stable, unique, and equal to the boundaries.geo_slug. */
  slug: string
  /** Display name. */
  name: string
  type: ParkType
  /** Managing agency for the attribution line. */
  agency: string
  /** Primary city the park sits in or near (matches a listings "City" value). */
  city: string
  /** Polygon-centroid latitude (WGS84). Frames the map + anchors the homes query. */
  lat: number
  /** Polygon-centroid longitude (WGS84). */
  lng: number
  /** Verified size in acres (state: FeatureServer GIS_ACRES; city: agency page). */
  acres?: number
  /** Short factual description, brand-voice sanitized, traceable to sourceUrl. */
  blurb: string
  /** Traceable amenities (each present on the official source). */
  amenities: string[]
  /** Official agency page the blurb + amenities trace to. */
  sourceUrl: string
  /** True when a boundaries row (geo_type='park', geo_slug=slug) exists. */
  hasPolygon: boolean
}

/** kebab-case a park name for its slug. */
export function slugifyParkName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── STATE PARKS ───────────────────────────────────────────────────────────
const STATE: CoPark[] = [
  {
    slug: 'smith-rock',
    name: 'Smith Rock State Park',
    type: 'state',
    agency: 'Oregon State Parks',
    city: 'Terrebonne',
    lat: 44.36694,
    lng: -121.1399,
    acres: 686,
    blurb:
      'Smith Rock State Park rises above the Crooked River near Terrebonne and is widely regarded as the birthplace of American sport climbing, with several thousand routes on its tuff and basalt walls. Miles of hiking and mountain biking trails wind through the canyon, and a footbridge over the river connects the front of the park to the climbing areas.',
    amenities: [
      'Rock climbing (thousands of routes)',
      'Hiking trails',
      'Mountain biking trails',
      'Crooked River access',
      'Footbridge over the river',
      'Wildlife viewing (eagles, falcons, deer, otter)',
      'Picnic and day-use area',
    ],
    sourceUrl: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=36',
    hasPolygon: true,
  },
  {
    slug: 'tumalo',
    name: 'Tumalo State Park',
    type: 'state',
    agency: 'Oregon State Parks',
    city: 'Bend',
    lat: 44.12576,
    lng: -121.33735,
    acres: 339,
    blurb:
      'Tumalo State Park sits on the banks of the Deschutes River just northwest of Bend, with a riverfront day-use area shaded by large ponderosa pines, junipers, and alders. A wading area and a 2.4-mile segment of the Deschutes River Trail make it a popular spot for camping and a day on the water.',
    amenities: [
      'Riverfront day-use area',
      'Deschutes River wading area',
      'Campground (full hookup and tent sites)',
      'Yurts',
      'Showers',
      'Group picnic areas (seasonal)',
      'Deschutes River Trail access',
    ],
    sourceUrl: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=34',
    hasPolygon: true,
  },
  {
    slug: 'pilot-butte',
    name: 'Pilot Butte State Scenic Viewpoint',
    type: 'state',
    agency: 'Oregon State Parks',
    city: 'Bend',
    lat: 44.05967,
    lng: -121.28269,
    acres: 121,
    blurb:
      'Pilot Butte is an old cinder cone on the east side of Bend with three trails that climb through juniper and sage to the summit. From the top you get a panoramic view of the high desert and, to the west, the snowcapped Cascades, including the Three Sisters, Mt. Jefferson, Black Butte, and Mt. Hood.',
    amenities: [
      'Three summit trails',
      'Seasonal summit road',
      'Panoramic Cascade and high-desert views',
      'Year-round trail access from the east parking lot',
      'Interpretive guide',
    ],
    sourceUrl: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=33',
    hasPolygon: true,
  },
  {
    slug: 'lapine',
    name: 'La Pine State Park',
    type: 'state',
    agency: 'Oregon State Parks',
    city: 'La Pine',
    lat: 43.77968,
    lng: -121.50773,
    acres: 2350,
    blurb:
      'La Pine State Park follows a scenic bend of the Deschutes River south of Bend and is home to Oregon\'s largest ponderosa pine, thought to be more than 500 years old. The park stays open year-round for camping and day-use, with 14 miles of trails reached from the McGregor Memorial Viewpoint.',
    amenities: [
      'Campground (year-round south loop)',
      'Cabins',
      'Deschutes River day-use area and swim beach',
      'The Big Tree (Oregon\'s largest ponderosa pine)',
      '14 miles of trails',
      'McGregor Memorial Viewpoint',
      'Boat ramp for hand-carry watercraft (seasonal)',
      'Fishing',
    ],
    sourceUrl: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=32',
    hasPolygon: true,
  },
  {
    slug: 'the-cove-palisades',
    name: 'The Cove Palisades State Park',
    type: 'state',
    agency: 'Oregon State Parks',
    city: 'Culver',
    lat: 44.56711,
    lng: -121.33105,
    acres: 7266,
    blurb:
      'The Cove Palisades State Park wraps the Deschutes and Crooked River canyons around Lake Billy Chinook near Culver, a year-round destination for camping and water sports. Two campgrounds, three day-use boat launches, and a full-service marina put boating, paddling, and lakeside camping within easy reach.',
    amenities: [
      'Lake Billy Chinook access',
      'Two campgrounds',
      'Deluxe lakeview cabins',
      'Three day-use areas with boat launches',
      'Accessible kayak launches',
      'Swim beaches (no lifeguard)',
      'Marina with boat and houseboat rentals',
      'More than three miles of hiking trails',
    ],
    sourceUrl: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=24',
    hasPolygon: true,
  },
  {
    slug: 'cline-falls',
    name: 'Cline Falls State Scenic Viewpoint',
    type: 'state',
    agency: 'Oregon State Parks',
    city: 'Redmond',
    lat: 44.27033,
    lng: -121.25628,
    acres: 12,
    blurb:
      'Cline Falls State Scenic Viewpoint is a shaded day-use stop on the banks of the Deschutes River between Redmond and Sisters. It is a quiet place to picnic in the shade, relax in the sun, and reach the river for fishing.',
    amenities: [
      'Riverfront day-use area',
      'Shaded picnic area',
      'Deschutes River fishing access',
    ],
    sourceUrl: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=30',
    hasPolygon: true,
  },
]

// ── CITY PARKS ──────────────────────────────────────────────────────────────
const CITY: CoPark[] = [
  {
    slug: 'drake-park',
    name: 'Drake Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.05846,
    lng: -121.31955,
    acres: 13,
    blurb:
      'Drake Park stretches along nearly half a mile of the Deschutes River and Mirror Pond in downtown Bend, one of the city\'s longest-standing and best-known parks. Its riverfront lawn, beach, and outdoor stage host community events through spring, summer, and fall.',
    amenities: [
      'Mirror Pond and Deschutes River frontage',
      'River access and beach',
      'Deschutes River Trail (paved)',
      'Open lawn and picnic areas',
      'Outdoor stage',
      'Public art',
      'Year-round restrooms',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/drake-park/',
    hasPolygon: true,
  },
  {
    slug: 'shevlin-park',
    name: 'Shevlin Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.07445,
    lng: -121.38108,
    acres: 981,
    blurb:
      'Shevlin Park covers nearly 1,000 acres along Tumalo Creek on the west edge of Bend, with old-growth ponderosa pine and a canyon laced with trails. A 6-mile loop trail follows the canyon rim and crosses the creek, and a separate mountain bike trail links to the Deschutes National Forest system.',
    amenities: [
      'Tumalo Creek',
      '6-mile loop trail',
      'Tumalo Creek Trail (2.5 miles)',
      'Mountain bike trail',
      'Old-growth ponderosa pine',
      'Stocked fishing pond',
      'Accessible multi-use path and restrooms',
      'Footbridges over the creek',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/shevlin-park/',
    hasPolygon: true,
  },
  {
    slug: 'riverbend-park',
    name: 'Riverbend Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.04188,
    lng: -121.32497,
    acres: 13,
    blurb:
      'Riverbend Park sits in the Old Mill District along the Deschutes River, with year-round river access from several entry points and miles of paved and unpaved paths. It is a favorite launch point for floating the river in summer.',
    amenities: [
      'Deschutes River access (multiple points)',
      'Float and boat launch',
      'Off-leash dog area with river access',
      'Small dog area',
      'Deschutes River Trail (paved and unpaved)',
      'Picnic shelter',
      'Fitness loop',
      'Year-round restrooms',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/riverbend-park/',
    hasPolygon: true,
  },
  {
    slug: 'farewell-bend-park',
    name: 'Farewell Bend Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.03759,
    lng: -121.32475,
    acres: 22,
    blurb:
      'Farewell Bend Park runs along the Deschutes River near the base of the Bill Healy Memorial Bridge and is a popular launch point for float trips. A lumber-mill-themed playground, a bouldering area, and a beach sit alongside the Deschutes River Trail that links it to the neighboring parks.',
    amenities: [
      'Deschutes River access and float launch',
      'Beach area',
      'Lumber-mill-themed playground',
      'Bouldering and climbing area',
      'Picnic shelters',
      'Boardwalk along the river',
      'Paved paths and fitness loop',
      'Year-round restrooms',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/farewell-bend-park/',
    hasPolygon: true,
  },
  {
    slug: 'sawyer-park',
    name: 'Sawyer Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.08751,
    lng: -121.3132,
    acres: 53,
    blurb:
      'Sawyer Park stretches along both sides of the Deschutes River on the north end of Bend, with green space, river access, and natural areas. It is a well-known birding site, with more than 140 species documented, and fishing is allowed year-round.',
    amenities: [
      'Deschutes River access (both banks)',
      'Paved and unpaved trails',
      'Deschutes River Trail connection',
      'Birding (140-plus species)',
      'Year-round fishing',
      'Picnic tables',
      'Natural areas',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/sawyer-park/',
    hasPolygon: true,
  },
  {
    slug: 'pine-nursery-park',
    name: 'Pine Nursery Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.0911,
    lng: -121.26617,
    acres: 159,
    blurb:
      'Pine Nursery Park is a 159-acre community park in northeast Bend built for sports and recreation. It carries softball and multi-purpose fields, a 16-court pickleball complex, an 18-hole disc golf course, a 14-acre off-leash dog area, and an all-abilities playground.',
    amenities: [
      'Softball fields',
      'Multi-purpose fields (soccer, lacrosse, rugby, football)',
      '16-court pickleball complex',
      '18-hole disc golf course',
      '14-acre off-leash dog area and small dog park',
      'Sand volleyball',
      'All-abilities playground',
      'Stocked fishing pond',
      'Paved and unpaved paths',
      'Picnic shelters',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/pine-nursery-park/',
    hasPolygon: true,
  },
  {
    slug: 'juniper-park',
    name: 'Juniper Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.05727,
    lng: -121.29642,
    acres: 22,
    blurb:
      'Juniper Park is a forested park in the heart of Bend, set among native conifers and open lawn around the Juniper Swim & Fitness Center. A 2020 renovation added a modern playground with sound and tactile play elements.',
    amenities: [
      'Juniper Swim & Fitness Center',
      'Playground with sound and tactile elements',
      'Four tennis courts',
      'Softball field',
      'Horseshoe pits',
      'Paved and unpaved walking paths',
      'Year-round restrooms',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/juniper-park/',
    hasPolygon: true,
  },
  {
    slug: 'big-sky-park',
    name: 'Big Sky Park',
    type: 'city',
    agency: 'Bend Park & Recreation District',
    city: 'Bend',
    lat: 44.0694,
    lng: -121.23858,
    acres: 97,
    blurb:
      'Big Sky Park and the Luke Damon Sports Complex spread across 97 acres on the east side of Bend, with baseball, softball, soccer, and lacrosse fields. The park also holds the Big Sky Bike Park, a BMX track, and a natural off-leash dog area with walking trails.',
    amenities: [
      'Baseball, softball, soccer, and lacrosse fields',
      'Big Sky Bike Park (pump track, skills course, singletrack)',
      'BMX track',
      'Off-leash dog area with natural trails',
      'Playground',
      'Covered picnic shelters',
      'Perimeter trail',
    ],
    sourceUrl: 'https://www.bendparksandrec.org/park/big-sky-park/',
    hasPolygon: true,
  },
  {
    slug: 'dry-canyon',
    name: 'Dry Canyon',
    type: 'city',
    agency: 'City of Redmond',
    city: 'Redmond',
    lat: 44.28026,
    lng: -121.18497,
    blurb:
      'Dry Canyon is a paved trail and park system that runs through the center of Redmond, lined with juniper groves and rock cliffs. The mostly flat path connects an off-leash dog park, a disc golf course, sports courts, and American Legion Community Park at the south end.',
    amenities: [
      'Paved walking and biking trail',
      'Off-leash dog park (small and large dog areas)',
      'Disc golf course',
      'Tennis and pickleball courts',
      'Softball',
      'Pavilion and picnic areas',
      'Restrooms and water refill stations',
    ],
    sourceUrl: 'https://www.redmondoregon.gov/Home/Components/FacilityDirectory/FacilityDirectory/24/2751',
    hasPolygon: true,
  },
  {
    slug: 'american-legion-park',
    name: 'American Legion Community Park',
    type: 'city',
    agency: 'City of Redmond',
    city: 'Redmond',
    lat: 44.2679,
    lng: -121.19127,
    blurb:
      'American Legion Community Park anchors the south end of the Dry Canyon in Redmond, with sports fields, an outdoor amphitheater, and a rock climbing wall. A bike and walking trail connects it to the rest of the Dry Canyon system.',
    amenities: [
      'Baseball and softball fields',
      'Outdoor amphitheater and stage',
      'Rock climbing wall',
      'Playground',
      'Dry Canyon Trail access',
      'Picnic tables and barbecue',
      'Restrooms',
    ],
    sourceUrl: 'https://www.redmondoregon.gov/Home/Components/FacilityDirectory/FacilityDirectory/12/2751',
    hasPolygon: true,
  },
  {
    slug: 'village-green-city-park',
    name: 'Village Green City Park',
    type: 'city',
    agency: 'City of Sisters',
    city: 'Sisters',
    lat: 44.28916,
    lng: -121.54936,
    blurb:
      'Village Green City Park is a shaded gathering place in the heart of Sisters, with a covered gazebo, a covered barbecue area, and a playground among the shade trees. The city allows the park to be reserved for events such as craft shows, weddings, and reunions.',
    amenities: [
      'Covered gazebo',
      'Covered barbecue area with tables',
      'Playground',
      'Picnic tables',
      'Public restrooms and showers',
      'Bike lockers and repair station',
      'Reservable for events',
    ],
    sourceUrl: 'https://www.ci.sisters.or.us/publicworks/page/village-green-park',
    hasPolygon: true,
  },
  {
    slug: 'ochoco-creek-park',
    name: 'Ochoco Creek Park',
    type: 'city',
    agency: 'Crook County Parks & Recreation District',
    city: 'Prineville',
    lat: 44.30434,
    lng: -120.83846,
    acres: 15,
    blurb:
      'Ochoco Creek Park is the most popular park in the Crook County Parks & Recreation District, set along Ochoco Creek in Prineville. It carries a large children\'s play structure, an outdoor amphitheater, sports courts, and a network of trails for walking and biking.',
    amenities: [
      'Ochoco Creek frontage',
      'Large children\'s play structure',
      'Outdoor amphitheater',
      'Two lighted tennis courts',
      'Two basketball courts',
      'Skate track',
      'Covered picnic shelter and barbecues',
      'Accessible fishing platform and footbridge',
      'Walking and biking trails',
    ],
    sourceUrl: 'https://www.cityofprineville.com/cityadministration/page/ochoco-creek-park',
    hasPolygon: true,
  },
]

/** The full registry, state parks first then city parks. */
export const CO_PARKS: ReadonlyArray<CoPark> = [...STATE, ...CITY]

const BY_SLUG: ReadonlyMap<string, CoPark> = new Map(CO_PARKS.map((p) => [p.slug, p]))

/** Look up a registry entry by slug. Returns undefined when absent. */
export function getParkBySlug(slug: string): CoPark | undefined {
  return BY_SLUG.get(slug)
}

/**
 * Find the notable parks near a point (e.g. a listing) within `radiusMiles`,
 * ordered nearest-first. Used by the listing-detail "Parks & recreation nearby"
 * section. Pure registry math against polygon centroids — no DB query.
 */
export function findParksNear(
  lat: number,
  lng: number,
  radiusMiles = 3,
  limit = 6,
): Array<CoPark & { distanceMiles: number }> {
  return CO_PARKS.map((park) => ({
    ...park,
    distanceMiles: haversineMiles(lat, lng, park.lat, park.lng),
  }))
    .filter((p) => p.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit)
}

/** Great-circle distance in miles between two lat/lng points. */
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.7613 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
