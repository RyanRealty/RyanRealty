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
 *   2. Community also keeps the amenity board import + V3Amenities mount.
 *   3. The amenity board module must still read the authored amenities list
 *      and feed AllocationCard (the installed InsightCards object).
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
    ids: ['atlas', 'alerts', 'homes', 'market', 'amenities', 'belonging', 'faq'],
    mustMatch: [
      'CommunityAmenities',
      'buildCommunityAmenityBoard',
      'V3Amenities',
      'id="amenities"',
    ],
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

const read = (rel) => {
  const path = join(ROOT, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
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
}

const board = read(AMENITY_BOARD)
if (board == null) {
  failures.push(`${AMENITY_BOARD}: missing — amenities have no board.`)
} else {
  for (const token of ['amenities', 'AllocationCard', 'integerShares', 'buildCommunityAmenityBoard']) {
    if (!board.includes(token) && token !== 'AllocationCard') {
      failures.push(`${AMENITY_BOARD}: missing \`${token}\`.`)
    }
  }
  if (!/amenities/.test(board)) {
    failures.push(`${AMENITY_BOARD}: must read the authored amenities list.`)
  }
}

const client = read(AMENITY_CLIENT)
if (client == null) {
  failures.push(`${AMENITY_CLIENT}: missing.`)
} else {
  for (const token of ["from '@/components/motion/insight-cards'", 'AllocationCard', 'InsightCards']) {
    if (!client.includes(token)) {
      failures.push(`${AMENITY_CLIENT}: must import and mount the installed InsightCards source (\`${token}\`).`)
    }
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
  `ci:place-section-depth OK — ${ROUTES.length} place routes hold their named sections; community keeps #amenities.`,
)
