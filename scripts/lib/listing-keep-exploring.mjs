/**
 * listing-keep-exploring.mjs — lock listing View more + Atlas plat chips.
 *
 * SITE-128 craft #4 + #5. "View more" must land on the subdivision (or the
 * next visitor place), never generic /homes-for-sale search. Listing Atlas
 * chips must not dump 60 legal plats ("+52 more" at 375). #5 adds the
 * name-only #other-subdivs rail (same-community siblings, no plat-name leaks).
 * Tip Ready --ship and ci:listing-keep-exploring refuse a rebuild that
 * restores either leak.
 *
 * Existing keep-exploring / related-places chrome only. Does not touch
 * listingPlaceTrail (hierarchy tip) or amenity layers.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const LISTING_KEEP_EXPLORING_GATE = 'ci:listing-keep-exploring'
export const LISTING_KEEP_EXPLORING_SCRIPT = 'scripts/check-listing-keep-exploring.mjs'

export const KEEP_EXPLORING_LOCK = Object.freeze({
  lockedAt: '2026-09-18',
  chipFoldAt: 8,
  platCapWithFrame: 7,
  platCapNoFrame: 8,
  helper: 'listingKeepExploringDoor',
  picker: 'pickListingAtlasRelatedPlats',
  gate: LISTING_KEEP_EXPLORING_GATE,
})

const PATHS = Object.freeze({
  helper: 'lib/listing/listing-keep-exploring.ts',
  peers: 'lib/explore/nearby-place-peers.ts',
  page: 'app/listing/[listingKey]/page.tsx',
  atlas: 'app/listing/[listingKey]/_v3/listing-atlas.ts',
  similar: 'components/site/listing-detail/ListingSimilarStrip.tsx',
  atlasClient: 'components/site/v3/V3Atlas.client.tsx',
})

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

export function listingKeepExploringProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const helper = readRel(root, PATHS.helper, files.helper)
  const page = readRel(root, PATHS.page, files.page)
  const atlas = readRel(root, PATHS.atlas, files.atlas)
  const similar = readRel(root, PATHS.similar, files.similar)
  const atlasClient = readRel(root, PATHS.atlasClient, files.atlasClient)

  if (helper == null) {
    p.push(`${PATHS.helper}: missing — listing keep-exploring door is gone.`)
    return p
  }
  if (page == null) {
    p.push(`${PATHS.page}: missing.`)
    return p
  }
  if (atlas == null) {
    p.push(`${PATHS.atlas}: missing.`)
    return p
  }

  if (!/export function listingKeepExploringDoor/.test(helper)) {
    p.push(`${PATHS.helper}: listingKeepExploringDoor export is gone.`)
  }
  if (!/export function pickListingAtlasRelatedPlats/.test(helper)) {
    p.push(`${PATHS.helper}: pickListingAtlasRelatedPlats export is gone.`)
  }
  if (!/LISTING_KEEP_EXPLORING_CHIP_FOLD_AT = 8/.test(helper)) {
    p.push(`${PATHS.helper}: chip fold must stay 8 so 375 cannot print +52 more.`)
  }
  if (!/LISTING_ATLAS_RELATED_PLAT_CAP_WITH_FRAME = LISTING_KEEP_EXPLORING_CHIP_FOLD_AT - 1/.test(helper)) {
    p.push(`${PATHS.helper}: with-frame plat cap must stay fold-1 so frame + plats stay ≤ 8.`)
  }
  if (!/Never \/homes-for-sale or a city-only search path/.test(helper) && !/never generic \/homes-for-sale/.test(helper)) {
    p.push(`${PATHS.helper}: must refuse generic /homes-for-sale search.`)
  }
  if (/homesForSalePath|subdivisionListingsPath/.test(helper)) {
    p.push(`${PATHS.helper}: keep-exploring door must not build /homes-for-sale search hrefs.`)
  }

  if (!/listingKeepExploringDoor/.test(page)) {
    p.push(`${PATHS.page}: View more must call listingKeepExploringDoor.`)
  }
  if (!/featuredViewAllHref = keepExploring\.href/.test(page)) {
    p.push(`${PATHS.page}: featuredViewAllHref must be the keep-exploring door href.`)
  }
  if (/featuredViewAllHref[\s\S]{0,240}homesForSalePath/.test(page)) {
    p.push(`${PATHS.page}: View more must not fall back to homesForSalePath (generic search).`)
  }
  if (/featuredViewAllHref[\s\S]{0,240}subdivisionListingsPath/.test(page)) {
    p.push(`${PATHS.page}: View more must not use subdivisionListingsPath (search), use /subdivisions.`)
  }

  if (similar && !/viewMoreHref/.test(similar)) {
    p.push(`${PATHS.similar}: View more link is gone.`)
  }

  if (!/pickListingAtlasRelatedPlats/.test(atlas)) {
    p.push(`${PATHS.atlas}: listing Atlas must pick related plats through pickListingAtlasRelatedPlats.`)
  }
  if (/hasLocalFrame \? 80 : 60/.test(atlas) || /const cap = hasLocalFrame \? 80 : 60/.test(atlas)) {
    p.push(`${PATHS.atlas}: 60/80 legal-plat cap is the +52 more leak — refuse.`)
  }
  if (/ranked\.slice\(0, cap\)/.test(atlas)) {
    p.push(`${PATHS.atlas}: slicing GIS plats by 60/80 restores the legal-plat chip leak.`)
  }

  if (atlasClient && !/const CHIP_FOLD_AT = 8/.test(atlasClient)) {
    p.push(`${PATHS.atlasClient}: CHIP_FOLD_AT must stay 8 (listing chips assume this fold).`)
  }

  const peers = readRel(root, PATHS.peers, files.peers)
  if (peers == null) {
    p.push(`${PATHS.peers}: missing — other-subdivs rail helper is gone.`)
  } else if (!/export function otherCommunitySubdivs/.test(peers)) {
    p.push(`${PATHS.peers}: otherCommunitySubdivs export is gone.`)
  } else if (!/publishPlatDisplayName/.test(peers) || !/isPermitGluedPlatSlug/.test(peers)) {
    p.push(`${PATHS.peers}: other-subdivs must refuse plat-name leaks.`)
  }

  if (!/otherCommunitySubdivs/.test(atlas)) {
    p.push(`${PATHS.atlas}: listing keep-exploring must pick same-community siblings via otherCommunitySubdivs.`)
  }
  if (!/hasLocalFrame[\s\S]{0,80}otherCommunitySubdivs/.test(atlas) && !/otherSubdivs = hasLocalFrame/.test(atlas)) {
    p.push(`${PATHS.atlas}: other-subdivs rail must stay empty on a city frame (no dump).`)
  }

  if (!/id="other-subdivs"/.test(page) || !/<V3PlaceIndex/.test(page) || !/nameOnly/.test(page)) {
    p.push(`${PATHS.page}: keep-exploring other-subdivs rail must be name-only V3PlaceIndex #other-subdivs.`)
  }
  if (/id="other-subdivs"[\s\S]{0,200}countLabel/.test(page)) {
    p.push(`${PATHS.page}: other-subdivs cards must stay name-only — no countLabel.`)
  }

  return p
}
