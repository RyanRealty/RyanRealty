/**
 * hierarchy-naming.mjs — SITE-128 Tip Ready #4 lock.
 *
 * Community ≠ neighborhood in Atlas chrome. Name-only child cards.
 * Twin-slug collapse. Sitewide crumbs match place-page density.
 * Does not invent geometry. first-look / map-hierarchy / amenity stay.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const HIERARCHY_NAMING_GATE = 'ci:hierarchy-naming'
export const HIERARCHY_NAMING_SCRIPT = 'scripts/check-hierarchy-naming.mjs'
export const HIERARCHY_NAMING_KIND = 'hierarchy-naming'
export const HIERARCHY_NAMING_PARITY = 'lib/place/hierarchy-naming.parity.json'

const PATHS = Object.freeze({
  atlas: 'components/site/v3/V3Atlas.client.tsx',
  childRings: 'lib/place/child-rings.ts',
  listingAtlas: 'app/listing/[listingKey]/_v3/listing-atlas.ts',
  city: 'app/cities/[slug]/page.tsx',
  community: 'app/communities/[slug]/page.tsx',
  neighborhood: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  subdivision: 'app/subdivisions/[slug]/page.tsx',
  peers: 'lib/explore/nearby-place-peers.ts',
  knowledge: 'app/communities/[slug]/_v3/place-knowledge.ts',
  trail: 'lib/site/place-trail.ts',
  crumb: 'components/site/v3/V3Breadcrumb.tsx',
  search: 'app/search/[...slug]/page.tsx',
  compare: 'app/compare/page.tsx',
  leftover: 'lib/market/publish-leftover-hud.ts',
  parity: HIERARCHY_NAMING_PARITY,
  placeCraft: 'lib/place/place-craft.parity.json',
  placeCraftCheck: 'scripts/check-place-craft.mjs',
  mapHierarchy: 'lib/place/map-hierarchy.parity.json',
  mapHierarchyCheck: 'scripts/check-map-hierarchy.mjs',
})

const REQUIRED_LOCKS = Object.freeze([
  'community-not-neighborhood',
  'name-only-child-cards',
  'plat-kind-subdivision',
  'twin-slug-collapse',
  'breadcrumb-sameness',
  'place-craft-first-look-refuse',
  'map-hierarchy-lock',
  'amenity-layers-intact',
])

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

export function isHierarchyNamingDocument(d) {
  return isPlainObject(d) && d.kind === HIERARCHY_NAMING_KIND
}

export function hierarchyNamingSourceProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []

  const atlas = readRel(root, PATHS.atlas, files.atlas ?? files[PATHS.atlas])
  if (atlas == null) {
    p.push(`${PATHS.atlas}: missing V3Atlas.`)
  } else {
    if (!/AtlasRegionKind = 'town' \| 'community' \| 'neighborhood' \| 'subdivision'/.test(atlas)) {
      p.push(`${PATHS.atlas}: AtlasRegionKind must include subdivision so plats are not neighborhoods.`)
    }
    if (!/subdivision:\s*'Subdivision'/.test(atlas)) {
      p.push(`${PATHS.atlas}: KIND_LABEL.subdivision must be Subdivision.`)
    }
  }

  const rings = readRel(root, PATHS.childRings, files.childRings ?? files[PATHS.childRings])
  if (rings == null) {
    p.push(`${PATHS.childRings}: missing child-rings.`)
  } else {
    if (/kind:\s*'neighborhood'/.test(rings)) {
      p.push(`${PATHS.childRings}: child plats must be kind:'subdivision', not neighborhood.`)
    }
    if (!/kind:\s*'subdivision'/.test(rings)) {
      p.push(`${PATHS.childRings}: regionsFromChildCells must emit kind:'subdivision'.`)
    }
  }

  const listing = readRel(root, PATHS.listingAtlas, files.listingAtlas ?? files[PATHS.listingAtlas])
  if (listing == null) {
    p.push(`${PATHS.listingAtlas}: missing listing Atlas.`)
  } else if (/kind:\s*'neighborhood',\s*\n\s*kindLabel:\s*'Subdivision'/.test(listing) || /kind:\s*'neighborhood',\s*kindLabel:\s*'Subdivision'/.test(listing)) {
    p.push(`${PATHS.listingAtlas}: plat cells must be kind:'subdivision', not neighborhood + Subdivision label.`)
  }

  const city = readRel(root, PATHS.city, files.city ?? files[PATHS.city])
  if (city == null) {
    p.push(`${PATHS.city}: missing city template.`)
  } else {
    if (/kind:\s*'neighborhood',\s*kindLabel:\s*'Subdivision'/.test(city)) {
      p.push(`${PATHS.city}: non-Bend plats must be kind:'subdivision'.`)
    }
    if (/Communities and subdivisions/.test(city)) {
      p.push(`${PATHS.city}: mixed "Communities and subdivisions" heading is refuse. Communities stay communities.`)
    }
    if (!/nameOnlyChildEntries/.test(city) || !/nameOnly/.test(city)) {
      p.push(`${PATHS.city}: child plats must be name-only cards through nameOnlyChildEntries.`)
    }
  }

  const community = readRel(root, PATHS.community, files.community ?? files[PATHS.community])
  if (community == null) {
    p.push(`${PATHS.community}: missing community template.`)
  } else if (!/nameOnlyChildEntries/.test(community) || !/nameOnly/.test(community)) {
    p.push(`${PATHS.community}: child cards stay name-only.`)
  }

  const neighborhood = readRel(root, PATHS.neighborhood, files.neighborhood ?? files[PATHS.neighborhood])
  if (neighborhood == null) {
    p.push(`${PATHS.neighborhood}: missing neighborhood template.`)
  } else if (!/nameOnlyChildEntries/.test(neighborhood) || !/nameOnly/.test(neighborhood)) {
    p.push(`${PATHS.neighborhood}: child cards stay name-only.`)
  }

  const knowledge = readRel(root, PATHS.knowledge, files.knowledge ?? files[PATHS.knowledge])
  if (knowledge == null) {
    p.push(`${PATHS.knowledge}: missing place-knowledge.`)
  } else if (/Subdivisions in \$\{input\.name\}/.test(knowledge) || /Subdivisions in \$\{/.test(knowledge)) {
    p.push(`${PATHS.knowledge}: "Subdivisions in X" term is refuse. Name the MLS aliases, do not retitle the grain.`)
  }

  const peers = readRel(root, PATHS.peers, files.peers ?? files[PATHS.peers])
  if (peers == null) {
    p.push(`${PATHS.peers}: missing nearby-place-peers.`)
  } else {
    if (!/isTwoTokenSuffixTwin/.test(peers) || !/collapseTwinChildEntries/.test(peers)) {
      p.push(`${PATHS.peers}: nameOnlyChildEntries must collapse 2+ token suffix twins (River Woods).`)
    }
    if (!/shorter\.length < 2/.test(peers)) {
      p.push(`${PATHS.peers}: single-token suffix (woods ⊂ deschutes-river-woods) must not collapse.`)
    }
  }

  const trail = readRel(root, PATHS.trail, files.trail ?? files[PATHS.trail])
  if (trail == null) {
    p.push(`${PATHS.trail}: missing place-trail.`)
  } else if (!/export function nameOnlyCrumbs/.test(trail) || !/GRAIN_INDEX_LABELS/.test(trail)) {
    p.push(`${PATHS.trail}: nameOnlyCrumbs must strip Home and grain-index ancestors.`)
  }

  const crumb = readRel(root, PATHS.crumb, files.crumb ?? files[PATHS.crumb])
  if (crumb == null) {
    p.push(`${PATHS.crumb}: missing V3Breadcrumb.`)
  } else {
    if (!/nameOnlyCrumbs/.test(crumb)) {
      p.push(`${PATHS.crumb}: sitewide crumbs must run nameOnlyCrumbs so every page matches place density.`)
    }
    if (!/rungs\.length >= 3/.test(crumb) || !/overlayCompact/.test(crumb)) {
      p.push(`${PATHS.crumb}: collapse at 3+ / overlayCompact must stay.`)
    }
  }

  const search = readRel(root, PATHS.search, files.search ?? files[PATHS.search])
  if (search == null) {
    p.push(`${PATHS.search}: missing search page.`)
  } else if (/<V3Breadcrumb belowNav=\{false\}/.test(search)) {
    p.push(`${PATHS.search}: belowNav={false} is density drift. Use the same surface default as place pages.`)
  }

  const compare = readRel(root, PATHS.compare, files.compare ?? files[PATHS.compare])
  if (compare == null) {
    p.push(`${PATHS.compare}: missing compare page.`)
  } else if (/<V3Breadcrumb[\s\S]{0,80}belowNav=\{false\}/.test(compare)) {
    p.push(`${PATHS.compare}: belowNav={false} is density drift.`)
  }

  const leftover = readRel(root, PATHS.leftover, files.leftover ?? files[PATHS.leftover])
  if (leftover != null && /Invented|hand-drawn|approximate/.test(leftover) && /coordinates:\s*\[\[-1(2[01])/.test(leftover)) {
    p.push(`${PATHS.leftover}: do not invent Central Oregon coordinates.`)
  }

  return p
}

export function hierarchyNamingParityContractProblems(d) {
  if (!isHierarchyNamingDocument(d)) return [`${HIERARCHY_NAMING_PARITY}: kind must be ${HIERARCHY_NAMING_KIND}.`]
  const p = []
  const locks = Array.isArray(d.locks) ? d.locks.map(String) : []
  for (const lock of REQUIRED_LOCKS) {
    if (!locks.includes(lock)) {
      p.push(`${HIERARCHY_NAMING_PARITY}: locks must include ${lock}.`)
    }
  }
  if (d.gate !== HIERARCHY_NAMING_GATE) {
    p.push(`${HIERARCHY_NAMING_PARITY}: gate must be ${HIERARCHY_NAMING_GATE}.`)
  }
  if (!isPlainObject(d.evidencePath) || !d.evidencePath.breadcrumbSameness || !d.evidencePath.placeCraftFirstLook) {
    p.push(`${HIERARCHY_NAMING_PARITY}: evidencePath must keep breadcrumb sameness and the #1 first-look refuse.`)
  }
  return p
}

export function hierarchyNamingPriorLockProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const craft = readRel(root, PATHS.placeCraft, files.placeCraft ?? files[PATHS.placeCraft])
  if (craft == null) {
    p.push(`${PATHS.placeCraft}: place-craft first-look refuse must stay on disk.`)
  } else {
    let craftDoc
    try {
      craftDoc = JSON.parse(craft)
    } catch {
      p.push(`${PATHS.placeCraft}: invalid JSON — first-look refuse cannot run.`)
      craftDoc = null
    }
    if (craftDoc && !(Array.isArray(craftDoc.locks) && craftDoc.locks.includes('competitor-first-look'))) {
      p.push(`${PATHS.placeCraft}: competitor-first-look lock must stay. This tip does not invent shots.`)
    }
  }
  if (!existsSync(join(root, PATHS.placeCraftCheck))) {
    p.push(`${PATHS.placeCraftCheck}: ci:place-craft must stay wired.`)
  }

  const map = readRel(root, PATHS.mapHierarchy, files.mapHierarchy ?? files[PATHS.mapHierarchy])
  if (map == null) {
    p.push(`${PATHS.mapHierarchy}: map-hierarchy lock must stay on disk.`)
  } else {
    let mapDoc
    try {
      mapDoc = JSON.parse(map)
    } catch {
      p.push(`${PATHS.mapHierarchy}: invalid JSON — map hierarchy lock cannot run.`)
      mapDoc = null
    }
    if (mapDoc && !(Array.isArray(mapDoc.locks) && mapDoc.locks.includes('subject-polygon-only'))) {
      p.push(`${PATHS.mapHierarchy}: subject-polygon-only lock must stay.`)
    }
  }
  if (!existsSync(join(root, PATHS.mapHierarchyCheck))) {
    p.push(`${PATHS.mapHierarchyCheck}: ci:map-hierarchy must stay wired.`)
  }

  const subdiv = readRel(root, PATHS.subdivision, files.subdivision ?? files[PATHS.subdivision])
  if (subdiv == null) {
    p.push(`${PATHS.subdivision}: missing subdivision template.`)
  } else if (!/amenities=\{amenityLayers\}/.test(subdiv)) {
    p.push(`${PATHS.subdivision}: amenity wiring amenities={amenityLayers} must stay. This tip does not invent geom.`)
  }
  return p
}

export function hierarchyNamingCiProblems({ root = process.cwd(), files = {} } = {}) {
  const p = [
    ...hierarchyNamingSourceProblems({ root, files }),
    ...hierarchyNamingPriorLockProblems({ root, files }),
  ]
  const raw = readRel(root, PATHS.parity, files.parity ?? files[PATHS.parity])
  if (raw == null) {
    p.push(`${PATHS.parity}: missing hierarchy-naming evidence stub.`)
    return p
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    p.push(`${PATHS.parity}: invalid JSON.`)
    return p
  }
  p.push(...hierarchyNamingParityContractProblems(parsed))
  return p
}

export function hierarchyNamingShipProblems(d, { root = process.cwd(), files = {} } = {}) {
  const p = []
  if (isHierarchyNamingDocument(d)) p.push(...hierarchyNamingParityContractProblems(d))
  p.push(...hierarchyNamingSourceProblems({ root, files }))
  p.push(...hierarchyNamingPriorLockProblems({ root, files }))
  return p
}
