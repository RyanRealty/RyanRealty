/**
 * Hero image URLs for content pages.
 * All images are local Central Oregon photos served from public/.
 */

export const CONTENT_HERO_IMAGES = {
  // ─── BROKERAGE PAGES ───────────────────────────────────────────────
  /** About: Old Mill District drone — the canonical brand photo */
  about: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Team: Deschutes River — Central Oregon waterfront scene */
  team: '/images/lp/hero-deschutes-clean.jpg',
  /** Contact: downtown Bend streetscape */
  contact: '/images/lp/hero-bend-downtown.png',
  /** Reviews: Old Mill District drone — brand anchor */
  reviews: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Join: Cascade alpine view — wide open Central Oregon horizon */
  join: '/images/lp/hero-bend-alpine.png',
  /** Sell: downtown Bend — where sellers live and list */
  sell: '/images/lp/hero-bend-downtown.png',
  /** Buy: Deschutes River — where buyers want to land */
  buy: '/images/lp/hero-deschutes-clean.jpg',

  // ─── LISTING-RELATED PAGES ─────────────────────────────────────────
  /** Open houses: Deschutes aerial — broad Central Oregon context */
  openHouses: '/images/hero-poster.webp',
  /** Listings: Cascade alpine — high country backdrop for property search */
  listings: '/images/lp/hero-bend-alpine.png',
  /** Reports: Old Mill District drone — authority and local grounding */
  reports: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Area guides: Deschutes River — connects geography to lifestyle */
  areaGuides: '/images/lp/hero-deschutes-clean.jpg',
  /** Videos: downtown Bend — visual anchor for local market content */
  videos: '/images/lp/hero-bend-downtown.png',
} as const

export type ContentHeroKey = keyof typeof CONTENT_HERO_IMAGES
