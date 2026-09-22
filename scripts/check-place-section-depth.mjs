#!/usr/bin/env node
/**
 * check-place-section-depth.mjs — SITE-116 section-depth ratchet.
 *
 * WHY: Place pages (city, neighborhood, community, subdivision) lost sections
 * when the KB register was swapped for v3. Amenities became Quiet chips.
 * contentFloor holds measured counts; this gate holds NAMED sections in source
 * so a later rebuild cannot strip #atlas / #faq / #amenities by deleting the
 * mount and lowering a floor in the same commit.
 *
 * RULES:
 *   1. Each place route keeps the listed `id="…"` mounts.
 *   2. Community homes stay on the page as PlaceSubdivisionHomes. The
 *      amenity section names each authored place (Matt 2026-09-22: improve
 *      the list, do not replace it with a share bar, do not drop it).
 *   3. The amenity board reads the authored amenities list and publishes
 *      each place's description. It does not mount AllocationCard.
 *
 * Usage: node scripts/check-place-section-depth.mjs
 * Wired as ci:place-section-depth.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const ROUTES = [
  {
    key: 'community',
    file: 'app/communities/[slug]/page.tsx',
    ids: ['atlas', 'homes', 'amenities', 'alerts', 'market', 'belonging', 'faq'],
  },
  {
    key: 'city',
    file: 'app/cities/[slug]/page.tsx',
    ids: ['atlas', 'alerts', 'homes', 'market', 'faq'],
  },
  {
    key: 'neighborhood',
    file: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    ids: ['atlas', 'alerts', 'homes', 'market', 'faq'],
  },
  {
    key: 'subdivision',
    file: 'app/subdivisions/[slug]/page.tsx',
    ids: ['atlas', 'alerts', 'homes', 'faq'],
  },
]

const AMENITY_BOARD = 'app/communities/[slug]/_v3/community-amenities.ts'
const AMENITY_CLIENT = 'app/communities/[slug]/_v3/CommunityAmenities.client.tsx'
const AMENITY_PRIMITIVE = 'components/site/v3/V3Amenities.tsx'

// Mirrors lib/place/place-homes-heading.ts EVERY_HOME_LECTURE_REFUSE.
const EVERY_HOME_LECTURE_REFUSE = /\bevery home for sale in\b/i
const PLACE_INVENTORY_KEYS = new Set(['subdivision'])

const read = (rel) => {
  const path = join(ROOT, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const failures = []

function hasSectionId(src, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`id=["'\`]${escaped}["'\`]`).test(src)
}

for (const route of ROUTES) {
  const src = read(route.file)
  if (src == null) {
    failures.push(`${route.file}: missing — ${route.key} has nowhere to keep its sections.`)
    continue
  }
  for (const id of route.ids) {
    if (!hasSectionId(src, id)) {
      failures.push(`${route.file}: missing id="${id}" — SITE-116 place pages cannot drop named sections.`)
    }
  }
  for (const token of route.mustMatch ?? []) {
    if (!src.includes(token)) {
      failures.push(`${route.file}: missing \`${token}\` — the amenity section mount cannot be stripped.`)
    }
  }
  if (route.key === 'community') {
    const code = stripComments(src)
    if (!/\bPlaceSubdivisionHomes\b/.test(code)) {
      failures.push(`${route.file}: missing PlaceSubdivisionHomes — the home carousel stays on the community page.`)
    }
    if (!/<V3Amenities\b/.test(code) || !/\bCommunityAmenities\b/.test(code)) {
      failures.push(`${route.file}: missing the amenity section. Name each place. Do not drop the section.`)
    }
    if (/has on the ground/.test(code) || /AllocationCard/.test(code)) {
      failures.push(`${route.file}: amenities are the places and what they are, not a share bar or "on the ground".`)
    }
  }
  if (PLACE_INVENTORY_KEYS.has(route.key)) {
    const code = stripComments(src)
    if (EVERY_HOME_LECTURE_REFUSE.test(code)) {
      failures.push(`${route.file}: lecture heading "every home for sale in" is refused on place inventory.`)
    }
    if (/\bPlaceSplitView\b/.test(code) || /\bSearchFilters\b/.test(code)) {
      failures.push(`${route.file}: scrolling search / PlaceSplitView is not the inventory surface.`)
    }
    if (!/\bV3PlaceInventory\b/.test(code)) {
      failures.push(`${route.file}: missing V3PlaceInventory — typed stock stays on the place page.`)
    }
  }
}

const board = read(AMENITY_BOARD)
if (board == null) {
  failures.push(`${AMENITY_BOARD}: missing — amenities have no board.`)
} else {
  for (const token of ['amenities', 'description', 'buildCommunityAmenityBoard']) {
    if (!board.includes(token)) {
      failures.push(`${AMENITY_BOARD}: missing \`${token}\`.`)
    }
  }
  if (/integerShares|AllocationCard/.test(board)) {
    failures.push(`${AMENITY_BOARD}: amenity shares are not a figure.`)
  }
  if (!/amenities/.test(board)) {
    failures.push(`${AMENITY_BOARD}: must read the authored amenities list.`)
  }
}

const client = read(AMENITY_CLIENT)
if (client == null) {
  failures.push(`${AMENITY_CLIENT}: missing.`)
} else {
  if (!/place\.description/.test(client)) {
    failures.push(`${AMENITY_CLIENT}: each place prints its description.`)
  }
  if (/AllocationCard|InsightCards|integerShares/.test(client)) {
    failures.push(`${AMENITY_CLIENT}: the amenity list is not an allocation bar.`)
  }
}

const primitive = read(AMENITY_PRIMITIVE)
if (primitive == null) {
  failures.push(`${AMENITY_PRIMITIVE}: missing — the amenity section has no house primitive.`)
} else if (!/id/.test(primitive) || !/V3Heading/.test(primitive)) {
  failures.push(`${AMENITY_PRIMITIVE}: must keep a named heading section.`)
}

if (failures.length) {
  console.error('ci:place-section-depth FAIL')
  for (const line of failures) console.error(`  ${line}`)
  process.exit(1)
}

console.log(
  `ci:place-section-depth OK — ${ROUTES.length} place routes hold their named sections.`,
)
