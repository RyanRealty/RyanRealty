#!/usr/bin/env node
/**
 * check-listing-facts-sheet.mjs — Facts sheet + hero mosaic stay honest (SITE-115).
 *
 * WHY: The twelve-section rebuild dropped beds/baths/sqft from PropertySpecs and
 * left a thin type · lot · year · HOA · $/sqft row. Live 2026-09-11 on Broken Top
 * still painted ore/800x600 on the hero while MosaicStill claimed 1600. The DAL
 * already selects the Spark record; the renderer and the photo plate are what
 * regress. A comment cannot catch either (gates-not-prose).
 *
 * RULES:
 *   1. PropertySpecs must reference beds, baths, and living sqft (sqft /
 *      totalLivingAreaSqFt) so a rebuild cannot drop the fact sheet again.
 *   2. ListingHero MosaicStill must call preferListingMosaicPhotoUrl.
 *   3. PhotoGalleryLightbox stage must call preferListingMosaicPhotoUrl.
 *   4. The listing route must lock real navigations to LISTING_MOSAIC_LEAD_PHOTO_SIZE
 *      (1600) and keep speculative prefetch on LISTING_FIELD_LEAD_PHOTO_SIZE (800)
 *      so SITE-60 still holds.
 *
 * Usage: node scripts/check-listing-facts-sheet.mjs
 * Wired as ci:listing-facts-sheet.
 */
import { readFileSync, existsSync } from 'node:fs'

const SPECS = 'components/site/listing-detail/PropertySpecs.tsx'
const HERO = 'components/site/listing-detail/ListingHero.tsx'
const LIGHTBOX = 'components/site/listing-detail/PhotoGalleryLightbox.tsx'
const PAGE = 'app/listing/[listingKey]/page.tsx'
const ROW = 'lib/listing/row-photo.ts'
const MOSAIC = 'lib/listing/publish-listing-mosaic.ts'

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)
const failures = []

const specs = read(SPECS)
if (specs == null) {
  failures.push(`${SPECS}: missing — Facts has nowhere to live.`)
} else {
  for (const token of ['listing.beds', 'listing.baths', 'Living area', 'Garage', 'Bedrooms', 'Bathrooms']) {
    if (!specs.includes(token)) {
      failures.push(`${SPECS}: missing \`${token}\` — SITE-115 fact sheet must render beds/baths/sqft/garage when present.`)
    }
  }
  if (!/sqft|totalLivingAreaSqFt/.test(specs)) {
    failures.push(`${SPECS}: never reads living area (sqft / totalLivingAreaSqFt).`)
  }
  if (!/publishListingHoa/.test(specs) || !/<Price value=\{hoa\.monthly\} exact \/>/.test(specs)) {
    failures.push(`${SPECS}: HOA must still gate through publishListingHoa + Price exact.`)
  }
}

const hero = read(HERO)
if (hero == null) {
  failures.push(`${HERO}: missing.`)
} else if (!/const live = preferListingMosaicPhotoUrl\(src\)/.test(hero)) {
  failures.push(`${HERO}: MosaicStill must call preferListingMosaicPhotoUrl(src) for the lead frame.`)
}

const lightbox = read(LIGHTBOX)
if (lightbox == null) {
  failures.push(`${LIGHTBOX}: missing.`)
} else if (!/preferListingMosaicPhotoUrl\(current\.url\)/.test(lightbox)) {
  failures.push(`${LIGHTBOX}: gallery stage must call preferListingMosaicPhotoUrl(current.url).`)
}

const page = read(PAGE)
if (page == null) {
  failures.push(`${PAGE}: missing.`)
} else {
  if (!/LISTING_MOSAIC_LEAD_PHOTO_SIZE/.test(page)) {
    failures.push(`${PAGE}: real navigations must lock gallery URLs to LISTING_MOSAIC_LEAD_PHOTO_SIZE.`)
  }
  if (!/LISTING_FIELD_LEAD_PHOTO_SIZE/.test(page)) {
    failures.push(`${PAGE}: speculative prefetch must still use LISTING_FIELD_LEAD_PHOTO_SIZE (SITE-60).`)
  }
  if (!/preferListingMosaicPhotoUrl/.test(page)) {
    failures.push(`${PAGE}: must preferListingMosaicPhotoUrl on the real-navigation gallery path.`)
  }
}

const row = read(ROW)
if (row == null || !/LISTING_MOSAIC_LEAD_PHOTO_SIZE = '1600x1200'/.test(row)) {
  failures.push(`${ROW}: must export LISTING_MOSAIC_LEAD_PHOTO_SIZE = '1600x1200'.`)
}

const mosaic = read(MOSAIC)
if (mosaic == null || !/export function preferListingMosaicPhotoUrl/.test(mosaic)) {
  failures.push(`${MOSAIC}: preferListingMosaicPhotoUrl missing.`)
}


const V3_ROW = 'components/site/v3/V3ListingRow.tsx'
const SPLIT_MEDIA = 'components/site/v3/SplitCardMedia.tsx'
const SPLIT_CARD = 'components/search/SplitListingCard.tsx'
const LISTING_CARD = 'components/site/ListingCard.tsx'
const VIDEO_CARD = 'components/site/VideoListingCard.tsx'

const v3row = read(V3_ROW)
if (v3row == null) {
  failures.push(`${V3_ROW}: missing.`)
} else if (!/className="v3-lrow__photo-link"/.test(v3row) || !/href=\{listing\.href\}/.test(v3row)) {
  failures.push(`${V3_ROW}: split media must link the photo to listing.href (SITE-115 card door).`)
}

const splitMedia = read(SPLIT_MEDIA)
if (splitMedia == null) {
  failures.push(`${SPLIT_MEDIA}: missing.`)
} else if (!/href\?: string/.test(splitMedia) || !/v3-lrow__photo-link/.test(splitMedia)) {
  failures.push(`${SPLIT_MEDIA}: must accept href and wrap the lead still in v3-lrow__photo-link.`)
}

const splitCard = read(SPLIT_CARD)
if (splitCard == null) {
  failures.push(`${SPLIT_CARD}: missing.`)
} else if (!/href=\{href\}/.test(splitCard) || !/<SplitCardMedia[\s\S]*href=\{href\}/.test(splitCard)) {
  failures.push(`${SPLIT_CARD}: must pass href into SplitCardMedia so the photo opens detail.`)
}

const listingCard = read(LISTING_CARD)
if (listingCard == null) {
  failures.push(`${LISTING_CARD}: missing.`)
} else if (!/<Link[\s\S]*href=\{listing\.href\}/.test(listingCard)) {
  failures.push(`${LISTING_CARD}: whole card must remain a Link to listing.href.`)
}

const videoCard = read(VIDEO_CARD)
if (videoCard == null) {
  failures.push(`${VIDEO_CARD}: missing.`)
} else if (!/href=\{listing\.href\}/.test(videoCard)) {
  failures.push(`${VIDEO_CARD}: must keep a detail href on the card chrome (play may stay a separate control).`)
}


if (failures.length > 0) {
  console.error('ci:listing-facts-sheet FAILED\n')
  for (const f of failures) console.error(`  ✗ ${f}\n`)
  process.exit(1)
}

console.log(
  'ci:listing-facts-sheet — OK: Facts keeps beds/baths/sqft; hero + lightbox lock to 1600 mosaic; SITE-60 prefetch stays 800; listing card photos open detail.',
)
