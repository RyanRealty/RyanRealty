/**
 * Rich community profiles for Central Oregon resort and luxury communities.
 * Used on community/subdivision pages for detailed content.
 * 
 * Tier 1: Resort communities — premium treatment with full amenity details
 * Tier 2: Luxury non-resort — high-end communities not flagged as resort
 * Tier 3: Standard subdivisions — no custom profile, use auto-generated content
 */

export type CommunityTier = 'resort' | 'luxury' | 'standard'

export type CommunityProfile = {
  name: string
  tier: CommunityTier
  city: string
  tagline: string
  description: string
  amenities: string[]
  lifestyle: string[]
  priceRange?: string
  heroSearch?: string // Unsplash search query for finding a relevant hero image
  highlights?: string[]
}

export const COMMUNITY_PROFILES: Record<string, CommunityProfile> = {
  // ═══ BEND — Resort Communities ═══
  'pronghorn': {
    name: 'Pronghorn (Juniper Preserve)',
    tier: 'resort',
    city: 'Bend',
    tagline: 'Championship golf, Cascade views, and 20,000 acres of protected high desert',
    description: 'Pronghorn is a premier resort community set on 20,000 acres of protected BLM land with sweeping Cascade Mountain views. Home to two championship 18-hole courses — a Jack Nicklaus Signature Course and a Tom Fazio Championship Course — the community offers fewer than 300 homesites for an exclusive, low-density lifestyle. Now operating under the Juniper Preserve brand, residents enjoy a full-service spa, fitness center, pools, fine dining, and a world-class golf academy with Sportsbox AI swing analysis.',
    amenities: ['Jack Nicklaus golf course', 'Tom Fazio golf course', 'Juniper Spa', 'Fitness center', 'Swimming pools', 'Multiple restaurants', 'Golf academy', 'Wedding venues', 'Cascade Mountain views'],
    lifestyle: ['Golf', 'Spa & wellness', 'Fine dining', 'Mountain views', 'Privacy'],
    priceRange: '$800K — $5M+',
    heroSearch: 'Pronghorn golf Bend Oregon',
    highlights: ['Ranked #1 Best Bend Resort by U.S. News', 'Only Jack Nicklaus course in Oregon', 'Fewer than 300 homesites'],
  },

  'tetherow': {
    name: 'Tetherow',
    tier: 'resort',
    city: 'Bend',
    tagline: '700 acres of luxury living bordering the Deschutes National Forest',
    description: 'Tetherow is a 700-acre luxury resort community just 7 minutes from The Old Mill District and 20 minutes from Mt. Bachelor. The award-winning David McLay Kidd championship golf course (architect of Bandon Dunes) anchors the community, complemented by a boutique hotel, three restaurants, a fitness center with yoga and sauna, pool, and event pavilion. With approximately 400 custom homesites across varied neighborhoods, Tetherow offers everything from vacation lock-and-leave homes to custom estates.',
    amenities: ['David McLay Kidd golf course', 'Boutique hotel', '3 restaurants', 'Tetherow Sport fitness', 'Pool & pavilion', 'Sauna & hot tubs', 'Yoga studio', 'Dog-friendly'],
    lifestyle: ['Golf', 'Mountain biking', 'Skiing (Mt. Bachelor)', 'Hiking', 'Fine dining'],
    priceRange: '$1.3M — $7.7M',
    heroSearch: 'Tetherow golf resort Bend',
    highlights: ['Bandon Dunes architect golf course', '7 min from Old Mill District', '20 min from Mt. Bachelor', 'Borders Deschutes National Forest'],
  },

  'caldera-springs': {
    name: 'Caldera Springs',
    tier: 'resort',
    city: 'Sunriver',
    tagline: 'A resort within a resort — premium Sunriver living with private amenities',
    description: 'Caldera Springs is a resort community within the greater Sunriver area, offering an elevated vacation-home lifestyle with private pools, a lakeside beach, and curated outdoor experiences. The community features modern mountain architecture with homes designed for both personal enjoyment and vacation rental income. Located along the Deschutes River corridor, residents have easy access to hiking, biking, kayaking, and world-class skiing at Mt. Bachelor.',
    amenities: ['Private pools', 'Lakeside beach', 'Bike paths', 'Kayaking', 'Fitness center', 'Event spaces'],
    lifestyle: ['Vacation rentals', 'Water sports', 'Mountain biking', 'Skiing', 'Family recreation'],
    priceRange: '$600K — $2M',
    heroSearch: 'Sunriver resort Oregon pool',
  },

  'eagle-crest': {
    name: 'Eagle Crest Resort',
    tier: 'resort',
    city: 'Redmond',
    tagline: 'Central Oregon\'s premier destination resort with golf, pools, and mountain views',
    description: 'Eagle Crest is a destination resort community in Redmond featuring multiple golf courses, swimming pools, tennis courts, and miles of trails with panoramic Cascade Mountain views. The resort offers a range of real estate from condos to custom homes, with many properties available for vacation rental. Its central location provides easy access to Bend, Smith Rock, and all of Central Oregon\'s outdoor adventures.',
    amenities: ['Multiple golf courses', 'Swimming pools', 'Tennis courts', 'Trail system', 'Spa', 'Restaurant', 'Equestrian center'],
    lifestyle: ['Golf', 'Tennis', 'Hiking', 'Horseback riding', 'Vacation rentals'],
    priceRange: '$200K — $1M',
    heroSearch: 'Eagle Crest resort Redmond Oregon golf',
  },

  'black-butte-ranch': {
    name: 'Black Butte Ranch',
    tier: 'resort',
    city: 'Sisters',
    tagline: 'A timeless mountain retreat at the base of the Three Sisters',
    description: 'Black Butte Ranch is a legendary Central Oregon resort community near Sisters, set at the base of the Cascade Range with views of the Three Sisters, Mt. Washington, and Black Butte. Established in the 1970s, the ranch offers two golf courses, a pool and spa complex, tennis courts, miles of bike paths, and access to world-class hiking and skiing. Properties range from cozy cabins to spacious custom homes on large, forested lots.',
    amenities: ['2 golf courses', 'Pool & spa', 'Tennis courts', 'Bike paths', 'Hiking trails', 'Equestrian', 'Restaurant', 'General store'],
    lifestyle: ['Golf', 'Hiking', 'Cross-country skiing', 'Bird watching', 'Fishing', 'Family recreation'],
    priceRange: '$400K — $3M',
    heroSearch: 'Black Butte Ranch Sisters Oregon mountains',
  },

  // ═══ BEND — Luxury Non-Resort ═══
  'awbrey-butte': {
    name: 'Awbrey Butte',
    tier: 'luxury',
    city: 'Bend',
    tagline: 'Elevated living with panoramic Cascade views above downtown Bend',
    description: 'Awbrey Butte is one of Bend\'s most sought-after luxury neighborhoods, perched on a volcanic butte with unobstructed panoramic views of the Cascade Range including Mt. Bachelor, Broken Top, and the Three Sisters. The neighborhood features custom homes on larger lots, a private trail system, and proximity to both downtown Bend and the Deschutes River trail. Properties here command premium prices for their views, privacy, and established character.',
    amenities: ['Panoramic mountain views', 'Private trail system', 'Large lots', 'Close to downtown'],
    lifestyle: ['Views', 'Privacy', 'Hiking', 'Luxury living'],
    priceRange: '$800K — $4M',
    heroSearch: 'Cascade mountain view luxury home Bend',
  },

  'broken-top': {
    name: 'Broken Top',
    tier: 'luxury',
    city: 'Bend',
    tagline: 'Private golf community with stunning mountain backdrops',
    description: 'Broken Top is an exclusive private golf community in Bend featuring a Tom Weiskopf-designed championship course winding through juniper and pine forest with dramatic views of Broken Top mountain. The gated community offers custom homes, townhomes, and homesites with access to a clubhouse, fitness center, pool, and tennis courts. Known for its mature landscaping and established neighborhood feel.',
    amenities: ['Tom Weiskopf golf course', 'Clubhouse', 'Pool', 'Fitness center', 'Tennis courts', 'Gated community'],
    lifestyle: ['Golf', 'Privacy', 'Mountain views', 'Luxury living'],
    priceRange: '$600K — $3M',
    heroSearch: 'Broken Top golf Bend Oregon mountain',
  },

  'petrosa': {
    name: 'Petrosa',
    tier: 'luxury',
    city: 'Bend',
    tagline: 'Modern luxury in the heart of Bend\'s west side',
    description: 'Petrosa is a newer luxury development on Bend\'s desirable west side, featuring modern mountain-contemporary architecture with high-end finishes, open floor plans, and energy-efficient design. The community offers walkable access to trails, restaurants, and breweries, with easy proximity to both downtown and Mt. Bachelor. Homes here appeal to buyers seeking new construction with a sophisticated, low-maintenance lifestyle.',
    amenities: ['Modern architecture', 'Trail access', 'Walkable to dining', 'Energy-efficient homes'],
    lifestyle: ['Modern living', 'Walkability', 'Outdoor access', 'Low maintenance'],
    priceRange: '$700K — $1.5M',
    heroSearch: 'modern luxury home Bend Oregon',
  },
}

/**
 * Get a community profile by subdivision name (case-insensitive slug match).
 */
export function getCommunityProfile(subdivisionName: string): CommunityProfile | null {
  const slug = subdivisionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return COMMUNITY_PROFILES[slug] ?? null
}

/**
 * Get the tier for a community. Returns 'standard' if not in profiles.
 */
export function getCommunityTier(subdivisionName: string): CommunityTier {
  return getCommunityProfile(subdivisionName)?.tier ?? 'standard'
}
