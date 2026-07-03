/**
 * Resolve a per-course hero image for /central-oregon/golf/[slug] from the
 * broker-shot Snowdrift Visuals course photography already on disk under
 * public/lp/central-oregon-golf/img/ (the same photos the golf LP uses). Courses
 * without a course-specific photo fall back to the canonical Central Oregon hero
 * — we never invent or mis-attribute a photo to a course it does not show.
 */

const IMG = '/lp/central-oregon-golf/img'

/** Course slug -> best available on-disk photo. Only clear matches are mapped. */
const GOLF_HERO_BY_SLUG: Record<string, string> = {
  'tetherow-golf-club': `${IMG}/tetherow-hero.jpg`,
  'awbrey-glen': `${IMG}/awbrey-glen-01.jpg`,
  'brasada-canyons': `${IMG}/brasada-01.jpg`,
  crosswater: `${IMG}/crosswater-01.jpg`,
  'eagle-crest-resort': `${IMG}/eagle-crest-01.jpg`,
  'eagle-crest-ridge': `${IMG}/eagle-crest-01.jpg`,
  'eagle-crest-challenge': `${IMG}/eagle-crest-01.jpg`,
  'pronghorn-nicklaus': `${IMG}/pronghorn-01.jpg`,
  'pronghorn-fazio': `${IMG}/pronghorn-01.jpg`,
  'sunriver-meadows': `${IMG}/sunriver-river.jpg`,
  'sunriver-woodlands': `${IMG}/sunriver-river.jpg`,
  'caldera-links': `${IMG}/sunriver-river.jpg`,
  'widgi-creek': `${IMG}/widgi-creek-01.jpg`,
  // Sisters / Black Butte courses sit directly under the Cascade peaks.
  'black-butte-big-meadow': `${IMG}/three-sisters-backdrop.jpg`,
  'black-butte-glaze-meadow': `${IMG}/three-sisters-backdrop.jpg`,
  'aspen-lakes': `${IMG}/three-sisters-backdrop.jpg`,
}

export function golfHeroFor(slug: string): string | null {
  return GOLF_HERO_BY_SLUG[slug] ?? null
}
