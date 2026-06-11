/**
 * Blog hero images — verified local Central Oregon photography (P0-4 fix).
 *
 * Every blog hero must be a LOCAL photo served from public/. The blog_posts
 * table historically carried images.unsplash.com URLs (generic stock; one of
 * them — photo-1600566753190 — went 404 upstream and broke the /blog featured
 * card through /_next/image). resolveBlogHeroImage() is applied in the blog
 * DAL (lib/data/blog/*) so NO remote/stock/dead hero ever reaches a page:
 *
 *   - hero_image_url already local (starts with '/')  → kept as-is
 *   - hero_image_url remote or null                   → slug map → category
 *     default → canonical brand hero
 *
 * Sources: data/asset-library/manifest.json — every pick is vision_quality A,
 * vision_watermark false, geo/subject-matched per post. Place-specific posts
 * (Tetherow, Caldera Springs, Sunriver, Sisters, Redmond, NW Crossing) only
 * use assets whose geo_tags verify the place; resorts without a verified
 * asset (Brasada, Black Butte Ranch, Eagle Crest, Broken Top) use regional
 * landscape shots with non-specific framing (CLAUDE.md §0 honesty rule).
 * Derivatives generated at 1600px max / JPEG q68 into public/images/blog/.
 * The asset-library id for each pick is in the comment above its entry.
 */

export const DEFAULT_BLOG_HERO = '/images/hero/hero-old-mill-master-4k.jpg'

export const BLOG_HERO_BY_SLUG: Record<string, string> = {
  // f540f957 · central-oregon · aerial-residential
  'adu-rules-changing-bend-two-units': '/images/blog/adu-rules-changing-bend-two-units.jpg',
  // fecfc19f · bend, downtown-bend · Tower Theatre street fair
  'arts-culture-central-oregon': '/images/blog/arts-culture-central-oregon.jpg',
  // 69f57b25 · central-oregon · riverside path along irrigation canal
  'bend-approves-new-sdc-methodology': '/images/blog/bend-approves-new-sdc-methodology.jpg',
  // 11452d83 · bend · new subdivision aerial
  'bend-building-permit-timeline-construction': '/images/blog/bend-building-permit-timeline-construction.jpg',
  // 4842585b · bend, pilot-butte · highway interchange + river aerial
  'bend-infrastructure-water-sewer-roads-growth': '/images/blog/bend-infrastructure-water-sewer-roads-growth.jpg',
  // aab6f55b · bend, drake-park · river channel aerial
  'bend-juniper-ridge-homelessness-housing-strategy': '/images/blog/bend-juniper-ridge-homelessness-housing-strategy.jpg',
  // aa132eaa · bend, old-mill-district · smokestacks aerial
  'bend-oregon-market-report-june-2026': '/images/blog/bend-oregon-market-report-june-2026.jpg',
  // 13e87524 · bend, pilot-butte · homes in ponderosa forest (WUI)
  'bend-wildfire-resistant-building-standards': '/images/blog/bend-wildfire-resistant-building-standards.jpg',
  // 3b9a7aba · central-oregon · neighborhood park + playground aerial
  'best-neighborhoods-bend-families': '/images/blog/best-neighborhoods-bend-families.jpg',
  // 87010cd4 · bend, drake-park · calm river pond aerial
  'best-neighborhoods-bend-retirees': '/images/blog/best-neighborhoods-bend-retirees.jpg',
  // 4fece4f8 · central-oregon · suburban residential aerial
  'best-time-to-buy-home-central-oregon': '/images/blog/best-time-to-buy-home-central-oregon.jpg',
  // 8e26bddb · bend, pilot-butte · river + fall-color neighborhood
  'best-time-to-sell-home-central-oregon': '/images/blog/best-time-to-sell-home-central-oregon.jpg',
  // 9c01260e · three-sisters · regional landscape (non-specific framing)
  'black-butte-ranch-guide': '/images/blog/black-butte-ranch-guide.jpg',
  // 19d4d133 · three-sisters · high-desert plateau (non-specific framing)
  'brasada-ranch-central-oregon': '/images/blog/brasada-ranch-central-oregon.jpg',
  // 51c0017d · central-oregon · golf fairway (non-specific framing)
  'broken-top-bend-golf-community': '/images/blog/broken-top-bend-golf-community.jpg',
  // 53a6958e · sunriver, caldera-springs · lakeside community center
  'caldera-springs-buyers-guide': '/images/blog/caldera-springs-buyers-guide.jpg',
  // 72dfb597 · central-oregon · craft beer flight on patio
  'dining-craft-beer-bend': '/images/blog/dining-craft-beer-bend.jpg',
  // e5edfc75 · central-oregon · high-desert resort golf (non-specific framing)
  'eagle-crest-affordable-resort-redmond': '/images/blog/eagle-crest-affordable-resort-redmond.jpg',
  // 41417eab · central-oregon · homes in pine forest, Cascade peaks
  'first-time-home-buyer-guide-central-oregon': '/images/blog/first-time-home-buyer-guide-central-oregon.jpg',
  // fc74fcc1 · mt-bachelor, cascade-lakes · peak reflected in alpine lake
  'four-seasons-central-oregon-living': '/images/blog/four-seasons-central-oregon-living.jpg',
  // d7f06007 · bend, cascade-lakes · highway toward volcanic peak
  'getting-around-central-oregon-transportation': '/images/blog/getting-around-central-oregon-transportation.jpg',
  // 4c9036d1 · central-oregon · community clubhouse + tennis court aerial
  'hoa-guide-central-oregon': '/images/blog/hoa-guide-central-oregon.jpg',
  // a63f1c6a · central-oregon · kitchen interior
  'home-inspection-checklist-oregon-buyers': '/images/blog/home-inspection-checklist-oregon-buyers.jpg',
  // 9bb6cc81 · central-oregon · staged dining nook interior
  'home-staging-tips-central-oregon': '/images/blog/home-staging-tips-central-oregon.jpg',
  // 45ee98f1 · bend · canal-side residential aerial
  'how-to-sell-your-home-bend': '/images/blog/how-to-sell-your-home-bend.jpg',
  // ba294855 · bend · Deschutes footbridge between riverside parks
  'living-in-nw-crossing-bend': '/images/blog/living-in-nw-crossing-bend.jpg',
  // 30a2365e · central-oregon · dense residential neighborhood aerial
  'middle-housing-reshaping-bend-neighborhoods': '/images/blog/middle-housing-reshaping-bend-neighborhoods.jpg',
  // 75a8cd5a · bend, old-mill-district · smokestacks + Pilot Butte aerial
  'moving-to-bend-relocation-guide': '/images/blog/moving-to-bend-relocation-guide.jpg',
  // d18c0ff9 · redmond · downtown Redmond aerial with mural
  'moving-to-redmond-oregon-guide': '/images/blog/moving-to-redmond-oregon-guide.jpg',
  // 66bb2b0f · sisters · downtown Sisters + Three Sisters peaks aerial
  'moving-to-sisters-oregon-guide': '/images/blog/moving-to-sisters-oregon-guide.jpg',
  // 809ec3d9 · central-oregon · new subdivision under buildout aerial
  'new-construction-guide-central-oregon': '/images/blog/new-construction-guide-central-oregon.jpg',
  // 06295516 · central-oregon · homes lining a road through pines
  'oregons-hb-2001-middle-housing-bend': '/images/blog/oregons-hb-2001-middle-housing-bend.jpg',
  // fac590b7 · central-oregon · paddleboarders + volcanic peak aerial
  'outdoor-recreation-central-oregon-homebuyer': '/images/blog/outdoor-recreation-central-oregon-homebuyer.jpg',
  // 7cec4db2 · central-oregon · open-concept kitchen/dining interior
  'preparing-home-for-sale-checklist': '/images/blog/preparing-home-for-sale-checklist.jpg',
  // ce1e0b9c · central-oregon · kids rafting a calm river
  'raising-kids-bend-parents-guide': '/images/blog/raising-kids-bend-parents-guide.jpg',
  // 79599b72 · central-oregon · tree-lined neighborhood + peaks aerial
  'retirement-central-oregon': '/images/blog/retirement-central-oregon.jpg',
  // 7ddafca3 · sisters, pine-meadow-village · homes + athletic field aerial
  'schools-central-oregon-guide-families': '/images/blog/schools-central-oregon-guide-families.jpg',
  // 55cc1c02 · la-pine · undeveloped high-desert meadow (UGB expansion land)
  'senate-bill-1537-bend-ugb-expansion': '/images/blog/senate-bill-1537-bend-ugb-expansion.jpg',
  // 15fce9ab · sunriver, crosswater · golf green + peak aerial
  'sunriver-year-round-living-vs-vacation': '/images/blog/sunriver-year-round-living-vs-vacation.jpg',
  // c5a01c8a · bend, tetherow · Tetherow golf + homes aerial
  'tetherow-resort-living-real-estate': '/images/blog/tetherow-resort-living-real-estate.jpg',
  // 1d5070e6 · central-oregon · subdivision entrance monument
  'understanding-earnest-money-oregon': '/images/blog/understanding-earnest-money-oregon.jpg',
  // a0fd0415 · central-oregon · lodge-style home + pond aerial
  'understanding-home-appraisals': '/images/blog/understanding-home-appraisals.jpg',
  // 0c6348ed · central-oregon · river + log cabins in pines
  'vacation-rental-rules-bend-deschutes': '/images/blog/vacation-rental-rules-bend-deschutes.jpg',
  // 46a56bdc · central-oregon · subdivision curved streets aerial
  'what-happens-between-offer-accepted-and-closing': '/images/blog/what-happens-between-offer-accepted-and-closing.jpg',
  // 4a8123ab · bend, downtown-bend · cafe interior
  'working-remote-central-oregon': '/images/blog/working-remote-central-oregon.jpg',
}

/**
 * Category fallbacks for future posts that publish before a slug entry (or a
 * proper local hero_image_url) exists. Reuses already-shipped derivatives.
 */
export const BLOG_HERO_BY_CATEGORY: Record<string, string> = {
  'Market Reports': '/images/blog/bend-oregon-market-report-june-2026.jpg',
  'Local Housing News': '/images/blog/bend-infrastructure-water-sewer-roads-growth.jpg',
  'Community Spotlights': '/images/blog/retirement-central-oregon.jpg',
  'Lifestyle & Living': '/images/blog/outdoor-recreation-central-oregon-homebuyer.jpg',
  'Relocation Guides': '/images/blog/getting-around-central-oregon-transportation.jpg',
  'Selling Guides': '/images/blog/preparing-home-for-sale-checklist.jpg',
  'Buying Guides': '/images/blog/first-time-home-buyer-guide-central-oregon.jpg',
  'Investment & Finance': '/images/blog/vacation-rental-rules-bend-deschutes.jpg',
  'First-Time Buyers': '/images/blog/first-time-home-buyer-guide-central-oregon.jpg',
}

/**
 * Resolve the hero image for a blog post. Local URLs pass through; remote
 * URLs (stock Unsplash, anything that can 404 upstream) and nulls are
 * replaced with a verified local photo.
 */
export function resolveBlogHeroImage(
  slug: string,
  category: string | null,
  heroImageUrl: string | null,
): string {
  if (heroImageUrl && heroImageUrl.startsWith('/')) return heroImageUrl
  return (
    BLOG_HERO_BY_SLUG[slug] ??
    (category ? BLOG_HERO_BY_CATEGORY[category] : undefined) ??
    DEFAULT_BLOG_HERO
  )
}
