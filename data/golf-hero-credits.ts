/**
 * Golf-course hero photo credits — same sourcing ladder as event/venue heroes
 * (docs/CONTENT_ENGINE_SPEC.md §11b): a real course photo from Wikimedia Commons
 * where one exists, otherwise a licensed golf/high-desert lifestyle photo, always
 * with photographer recognition. Files in public/images/golf/. Courses without an
 * entry fall back to the canonical Central Oregon lifestyle hero.
 */

export type GolfHeroCredit = {
  image: string
  credit: string
  creditUrl: string
  source: string
  license: string
}

export const GOLF_HERO_CREDITS: Record<string, GolfHeroCredit> = {
  // Populated by the hero-sourcing pass once courses land.
}
