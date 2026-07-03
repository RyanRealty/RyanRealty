/**
 * Trail hero photo credits — same sourcing ladder as the golf/venue heroes
 * (docs/CONTENT_ENGINE_SPEC.md §11b): a real trail photo from Wikimedia Commons
 * where one exists, otherwise a licensed Central Oregon outdoor/lifestyle photo,
 * always with photographer recognition. Files in public/images/trails/. Trails
 * without an entry fall back to the canonical Central Oregon lifestyle hero.
 */

export type TrailHeroCredit = {
  image: string
  credit: string
  creditUrl: string
  source: string
  license: string
}

export const TRAIL_HERO_CREDITS: Record<string, TrailHeroCredit> = {
  // Populated by the hero-sourcing pass once trails land.
}
