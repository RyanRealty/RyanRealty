/**
 * Curated Central Oregon lifestyle and city hero images from Unsplash.
 * 
 * These images represent the active outdoor lifestyle of Central Oregon:
 * mountain biking, fly fishing, hiking, skiing, and the Cascade Mountains.
 * 
 * Each city has a primary hero image and each lifestyle activity has images
 * that can be used across the site for visual variety.
 */

/** City-specific hero images — recognizable landmarks and landscapes for each city */
export const CITY_HERO_IMAGES: Record<string, string> = {
  // Bend: Mt. Bachelor view from Bend, Deschutes River valley
  'bend': 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1920&q=80',
  // Redmond/Terrebonne: Smith Rock State Park
  'redmond': 'https://images.unsplash.com/photo-1573111651542-961c4080bc18?w=1920&q=80',
  'terrebonne': 'https://images.unsplash.com/photo-1693719205045-dc0f15254790?w=1920&q=80',
  // Sisters: Three Sisters mountains
  'sisters': 'https://images.unsplash.com/photo-1568666062525-111347cc88e4?w=1920&q=80',
  // Sunriver: Deschutes River through forest
  'sunriver': 'https://images.unsplash.com/photo-1619626484761-e0ac2b597aad?w=1920&q=80',
  // La Pine: Pine forest and volcanic landscape
  'la-pine': 'https://images.unsplash.com/photo-1609041210494-1a8008ea12b3?w=1920&q=80',
  // Madras: Lake Billy Chinook canyon
  'madras': 'https://images.unsplash.com/photo-1593331965923-c6fab335c898?w=1920&q=80',
  // Prineville: Crooked River canyon
  'prineville': 'https://images.unsplash.com/photo-1645493754114-50cb7af6f8b9?w=1920&q=80',
  // Powell Butte: High desert with Cascade views
  'powell-butte': 'https://images.unsplash.com/photo-1724533687925-aa205b97e60e?w=1920&q=80',
  // Tumalo: Tumalo Falls area
  'tumalo': 'https://images.unsplash.com/photo-1564640612809-5a775ce2bc91?w=1920&q=80',
  // Crooked River Ranch: river canyon
  'crooked-river-ranch': 'https://images.unsplash.com/photo-1693719206693-f6eb4600aac2?w=1920&q=80',
  // Black Butte Ranch: mountain meadow
  'black-butte-ranch': 'https://images.unsplash.com/photo-1724536523240-1cfdf382f590?w=1920&q=80',
}

/** Central Oregon lifestyle/activity images — use for variety across the site */
export const LIFESTYLE_IMAGES = {
  mountainBiking: 'https://images.unsplash.com/photo-1645520719499-6856445fe4ad?w=1920&q=80',
  mountainBiking2: 'https://images.unsplash.com/photo-1635126039432-1742dbb90506?w=1920&q=80',
  flyFishing: 'https://images.unsplash.com/photo-1720645338498-f67f76d566e7?w=1920&q=80',
  hiking: 'https://images.unsplash.com/photo-1654541696506-b71d8fbc8766?w=1920&q=80',
  hikingTrail: 'https://images.unsplash.com/photo-1652972756751-4de8e9ef9e77?w=1920&q=80',
  skiing: 'https://images.unsplash.com/photo-1700957952693-a9028dfa323c?w=1920&q=80',
  snowboarding: 'https://images.unsplash.com/photo-1710197232572-13e1ace07d16?w=1920&q=80',
  camping: 'https://images.unsplash.com/photo-1698270446024-d84db27837d2?w=1920&q=80',
  cascadeMountains: 'https://images.unsplash.com/photo-1750045850708-8e650d8ab71d?w=1920&q=80',
  snowyPines: 'https://images.unsplash.com/photo-1581309167217-9f88f107e77f?w=1920&q=80',
  mountainSunset: 'https://images.unsplash.com/photo-1724533687925-aa205b97e60e?w=1920&q=80',
} as const

/** Default fallback for cities not in the curated list */
export const DEFAULT_CITY_HERO = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80'

/**
 * Get the best hero image for a city page.
 * Returns curated image if available, otherwise returns default.
 */
export function getCityHeroImage(citySlug: string): string {
  const slug = citySlug.toLowerCase().replace(/\s+/g, '-')
  return CITY_HERO_IMAGES[slug] ?? DEFAULT_CITY_HERO
}

/**
 * Get a rotating lifestyle image for variety across the site.
 * Uses the page name as a seed for consistent but varied selection.
 */
export function getLifestyleImage(seed: string): string {
  const images = Object.values(LIFESTYLE_IMAGES)
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return images[hash % images.length]!
}
