/**
 * Hero image URLs for content pages (buy, sell, about, contact, etc.).
 * Curated to match page intent: trust, conversion, and authority.
 * Uses high-quality Unsplash images; no text, no logos.
 */

export const CONTENT_HERO_IMAGES = {
  /** Buy: family/couple finding a home — aspiration and trust */
  buy: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80',
  /** Sell: professional listing / home presentation */
  sell: 'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=1920&q=80',
  /** About: team, partnership, local expertise */
  about: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80',
  /** Contact: handshake, connection, ready to help */
  contact: 'https://images.unsplash.com/photo-1423666639041-f56000c27a9a?w=1920&q=80',
  /** Open houses: welcoming front door / open house moment */
  openHouses: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80',
  /** Team: professional real estate team */
  team: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1920&q=80',
  /** Listings: beautiful home / search */
  listings: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1920&q=80',
  /** Join: career, growth, team */
  join: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80',
  /** Reports: data, market, insight */
  reports: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80',
  /** Area guides: place, community, lifestyle */
  areaGuides: 'https://images.unsplash.com/photo-1552678038-1fb7bb8d29be?w=1920&q=80',
} as const

export type ContentHeroKey = keyof typeof CONTENT_HERO_IMAGES
