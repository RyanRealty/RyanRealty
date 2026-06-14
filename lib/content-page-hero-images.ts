/**
 * Hero image URLs for content pages.
 * All images are local Central Oregon photos served from public/.
 */

export const CONTENT_HERO_IMAGES = {
  // ─── BROKERAGE PAGES ───────────────────────────────────────────────
  /** About: Old Mill District drone — the canonical brand photo */
  about: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Team: Old Mill District drone — canonical brand hero (screenshot image purged 2026-06-10) */
  team: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Contact: canonical brand hero */
  contact: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Reviews: Old Mill District drone — brand anchor */
  reviews: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Join: canonical brand hero */
  join: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Sell: canonical brand hero */
  sell: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Buy: canonical brand hero */
  buy: '/images/hero/hero-old-mill-master-4k.jpg',

  // ─── LISTING-RELATED PAGES ─────────────────────────────────────────
  /** Open houses: Deschutes aerial — broad Central Oregon context */
  openHouses: '/images/hero-poster.webp',
  /** Listings: canonical brand hero */
  listings: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Reports: Old Mill District drone — authority and local grounding */
  reports: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Area guides: canonical brand hero */
  areaGuides: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Videos: canonical brand hero */
  videos: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Schools index: canonical brand hero */
  schools: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Parks index: canonical brand hero */
  parks: '/images/hero/hero-old-mill-master-4k.jpg',
  /** Trails index: canonical brand hero */
  trails: '/images/hero/hero-old-mill-master-4k.jpg',
} as const

export type ContentHeroKey = keyof typeof CONTENT_HERO_IMAGES
