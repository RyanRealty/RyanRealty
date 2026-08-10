/**
 * Static and data-driven content for community (subdivision) and resort pages.
 * Resort pages: overview, amenities, recreation, real estate mix.
 * Regular communities get substantive about copy so search engines and LLMs don't see thin content.
 *
 * Layer B body only. Community H1 / title / meta stay on the route (Layer A).
 */

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export type ResortCommunityContent = {
  overview: string
  /** Lifestyle, amenities, HOA, trails, etc. */
  amenities?: string
  /** Golf, recreation, skiing, etc. */
  golf_recreation?: string
  /** Real estate mix, buyer profile, market note */
  real_estate?: string
  /** Optional short history or development story */
  history?: string
}

/** Key = "city:subdivision" normalized (lowercase, single spaces). */
const resortContent: Record<string, ResortCommunityContent> = {
  'sunriver:sunriver': {
    overview:
      'Sunriver is a planned resort and residential community south of Bend, among ponderosa pines along the Deschutes River. Built in the 1960s, it now mixes vacation homes, full-time residences, and short-term rentals under strict design and open-space rules. The path system, three golf courses, and resort amenities are the main draws.',
    amenities:
      'Sunriver has a private path network for walking and biking, pools, tennis, Sunriver Resort and Lodge, and the Village with shops and dining. Many homes share HOA recreation centers. You can reach most of the community on foot or by bike without a car.',
    golf_recreation:
      'Golf sits at the center: Crosswater, Meadows at Sunriver, and Woodlands. The Deschutes River runs through for fishing and floating. Mt. Bachelor is a short drive for winter sports. Trails, parks, and the Sunriver Nature Center fill the rest of the calendar.',
    real_estate:
      'Inventory includes single-family homes, townhomes, and condos across a wide price range. Many buyers use Sunriver as a second home or short-term rental; others live here year-round. Browse the listings below for what is active now.',
  },
  'sunriver:sunriver resort': {
    overview:
      'Sunriver Resort is the lodging, dining, and recreation core of the Sunriver community. Real estate near the resort includes condos and homes within a short walk of the lodge, golf, and the Village. Buyers often look here for vacation use or rental demand.',
    real_estate:
      'Properties near the resort trade on walkable access to the lodge, golf, and amenities. The mix is condos and single-family homes. Current pricing and availability are in the listings below.',
  },
  'bend:pronghorn': {
    overview:
      'Pronghorn is a resort community outside Bend built around two golf courses (Nicklaus Design and Tom Fazio) and a members club. Homes sit with mountain and high-desert views, trails, and club access. It is a short drive into Bend and to the rest of Central Oregon recreation.',
    amenities:
      'Residents use the Club at Pronghorn for dining and events, 36 holes of golf, a fitness center, and trails. Design standards keep the streetscape consistent. Many homes are second residences; some owners live here full time.',
    golf_recreation:
      'The Nicklaus and Fazio courses are the centerpiece. Hiking and biking trails link into the wider Bend network. Mt. Bachelor, Smith Rock, and the Deschutes River are all a short drive.',
    real_estate:
      'Stock is mostly custom and production homes, often on larger lots with views. Prices run from the mid six figures into the millions. Active listings are below.',
  },
  'sisters:black butte ranch': {
    overview:
      'Black Butte Ranch is a resort and residential community west of Sisters, under the Cascades. Two golf courses, a pool complex, tennis, and miles of trails define daily use. Vacation homes and year-round residents share the same ranch setting.',
    amenities:
      'Two 18-hole golf courses, multiple pools, tennis and pickleball, dining at the Lodge, and a general store. Trails support walking, biking, and horseback riding. HOA standards protect the ranch character and open land.',
    golf_recreation:
      'Big Meadow and Glaze Meadow are the two courses. The ranch sits against the Deschutes National Forest, with hiking, fishing, and skiing at Hoodoo or Mt. Bachelor within a drive.',
    real_estate:
      'Homes range from cabins and condos to large custom builds. Many buyers hold them as second homes or vacation rentals. Listings below show what is for sale now.',
  },
  'bend:tetherow': {
    overview:
      'Tetherow is a golf and resort community in Bend around a David McLay Kidd course and a modern lodge. Homes and lots carry mountain and fairway views, with pool, fitness, and dining on site. Bend proper is a short drive.',
    amenities:
      'Access includes the Tetherow Lodge, golf, pool, and fitness. Design standards keep the built look consistent for both vacation and full-time use.',
    golf_recreation:
      'The Tetherow course is links-style with Cascade views. Bend trails, Mt. Bachelor, and the Deschutes River sit nearby for everything else.',
    real_estate:
      'Inventory is single-family homes and lots. Price varies by size and location inside the community. Active listings are below.',
  },
  'redmond:eagle crest resort': {
    overview:
      'Eagle Crest is a large resort community in Redmond with multiple golf courses, a spa, pools, and dining. It serves vacationers and full-time residents who want resort amenities at a lower price point than Bend or Sunriver.',
    amenities:
      'Fifty-four holes of golf, multiple pools and hot tubs, fitness, spa, and several dining options. Condos and single-family homes sit across the property; many are available as vacation rentals.',
    golf_recreation:
      'Three courses give variety. Smith Rock, the Deschutes River, and Redmond Municipal Airport are close for outdoor days and travel.',
    real_estate:
      'Stock is condos and single-family homes. Buyers often buy a second home or an investment. Current listings are below.',
  },
  'powell butte:brasada ranch': {
    overview:
      'Brasada Ranch is a resort community east of Bend in Powell Butte, built around a Cupp Design golf course and a ranch-style lodge. Homes and cabins sit on high-desert and mountain views, with golf, pools, dining, and trails on site. Bend is a short drive.',
    amenities:
      'Brasada Canyons golf, Sage Canyon Sports Club (pool and fitness), and the Ranch House for dining. The layout keeps the high-desert landscape and long views.',
    golf_recreation:
      'Golf at Brasada Canyons is the main amenity. Hiking and biking start from the property. Bend and Prineville are both a short drive.',
    real_estate:
      'Inventory includes cabins and custom homes, from simpler cabins up to higher-end builds. Active listings are below.',
  },
  'bend:petrosa': {
    overview:
      'Petrosa is a residential neighborhood in Bend with single-family homes, nearby schools and services, and access to trails, parks, and the Deschutes River.',
    amenities:
      'Residents use Bend path systems, nearby parks, and local schools and services. Shopping, dining, and healthcare are close. Mt. Bachelor, the river, and the Cascade Lakes are a short drive.',
    real_estate:
      'Homes span a range of sizes and prices. Listings below show what is active. Call a Ryan Realty broker if you want comps for a specific address.',
  },
}

export function getResortCommunityContent(city: string, subdivision: string): ResortCommunityContent | null {
  const key = `${normalizeKey(city)}:${normalizeKey(subdivision)}`
  return resortContent[key] ?? null
}
