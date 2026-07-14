/**
 * Hero image URLs for content pages.
 * All images are local Central Oregon photos served from public/.
 *
 * design-audit CMP-2: these were ALL the same Old Mill District drone, so every
 * content page looked identical and templated. Each page now carries a distinct,
 * on-topic local photo. The Old Mill drone stays the homepage's canonical hero.
 */

export const CONTENT_HERO_IMAGES = {
  // ─── BROKERAGE PAGES ───────────────────────────────────────────────
  /** About: the Ryan Realty Bend office — the people, not a stock drone */
  about: '/images/office/ryan-realty-bend-office-interior-01.jpg',
  /** Team: the Ryan Realty office (second angle) */
  team: '/images/office/ryan-realty-bend-office-interior-02.jpg',
  /** Contact: Three Sisters at sunrise — approachable Cascade scene */
  contact: '/images/kb/three-sisters-sunrise.jpg',
  /** Reviews: Drake Park + the Deschutes, downtown Bend community */
  reviews: '/images/homepage/bend-drake-park-aerial.jpg',
  /** Join: downtown Redmond aerial */
  join: '/images/kb/redmond-downtown-aerial.jpg',
  /** Sell: Tetherow golf resort aerial — upscale homes */
  sell: '/images/homepage/tetherow-golf-aerial.jpg',
  /** Buy: downtown Sisters under the Three Sisters — a town to buy into */
  buy: '/images/homepage/sisters-downtown-three-peaks.jpg',

  // ─── LISTING-RELATED PAGES ─────────────────────────────────────────
  /** Open houses: Deschutes River at Sunriver */
  openHouses: '/images/kb/sunriver-deschutes-river.jpg',
  /** Listings: Smith Rock / Crooked River, Terrebonne */
  listings: '/images/homepage/smith-rock-terrebonne.jpg',
  /** Reports: a Cascade mountain scene — market authority + local grounding */
  reports: '/images/lp/hero-mountain.jpg',
  /** Area guides: Green Lakes under South Sister */
  areaGuides: '/images/trails/green-lakes.jpg',
  /** Videos: a Central Oregon pond scene */
  videos: '/images/lp/hero-pond.jpg',
  /** Schools index: downtown Sisters (family town) */
  schools: '/images/homepage/sisters-downtown-three-peaks.jpg',
  /** Parks index: Benham Falls on the Deschutes */
  parks: '/images/trails/benham-falls.jpg',
  /** Trails index: Misery Ridge, Smith Rock */
  trails: '/images/trails/misery-ridge.jpg',
  /** Events index: Hayden Homes Amphitheater, Old Mill */
  events: '/images/venues/hayden-homes-amphitheater.jpg',
  /** Venues index: High Desert Music Hall, Redmond */
  venues: '/images/venues/high-desert-music-hall.jpg',
  /** Golf index: Tetherow golf resort aerial */
  golf: '/images/homepage/tetherow-golf-aerial.jpg',
} as const

export type ContentHeroKey = keyof typeof CONTENT_HERO_IMAGES
