/**
 * Hero image URLs for content pages.
 * Curated to match page intent with Central Oregon lifestyle imagery.
 * Uses high-quality Unsplash images; no text, no logos.
 */

export const CONTENT_HERO_IMAGES = {
  // ─── LUXURY / PROFESSIONAL (brokerage pages) ───────────────────────
  /** About: modern luxury home with pool at dusk — sophistication and trust */
  about: 'https://images.unsplash.com/photo-1767950470198-c9cd97f8ed87?w=1920&q=80',
  /** Team: luxury living room with fireplace — premium feel */
  team: 'https://images.unsplash.com/photo-1638885930125-85350348d266?w=1920&q=80',
  /** Contact: professional workspace with tech — modern and accessible */
  contact: 'https://images.unsplash.com/photo-1564888679011-bdb38fd3ae9d?w=1920&q=80',
  /** Reviews: luxury modern home interior — client satisfaction */
  reviews: 'https://images.unsplash.com/photo-1638972691611-69633a3d3127?w=1920&q=80',
  /** Join: luxury modern kitchen — aspiration and career growth */
  join: 'https://images.unsplash.com/photo-1639405069836-f82aa6dcb900?w=1920&q=80',
  /** Sell: luxury home staging — professional presentation */
  sell: 'https://images.unsplash.com/photo-1643034738686-d69e7bc047e1?w=1920&q=80',
  /** Buy: modern architecture with pool — aspirational homeownership */
  buy: 'https://images.unsplash.com/photo-1767950470198-c9cd97f8ed87?w=1920&q=80',

  // ─── CENTRAL OREGON LIFESTYLE (listing-related pages) ─────────────
  /** Open houses: beautiful home exterior */
  openHouses: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80',
  /** Listings: mountain biking — active Central Oregon lifestyle */
  listings: 'https://images.unsplash.com/photo-1645520719499-6856445fe4ad?w=1920&q=80',
  /** Reports: Cascade mountain panorama — authority and data */
  reports: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
  /** Area guides: Three Sisters mountain sunset */
  areaGuides: 'https://images.unsplash.com/photo-1724533687925-aa205b97e60e?w=1920&q=80',
  /** Videos: Smith Rock — dramatic landscape */
  videos: 'https://images.unsplash.com/photo-1693719205045-dc0f15254790?w=1920&q=80',
} as const

export type ContentHeroKey = keyof typeof CONTENT_HERO_IMAGES
