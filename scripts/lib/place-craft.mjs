/**
 * place-craft.mjs — SITE-128 / place explorer Tip Ready lock.
 *
 * Matt LOCK via Cos 2026-09-18: Tip Ready / --ship for place craft is refuse
 * unless evidence includes BOTH:
 *   1) Competitor first-look — named peer (Redfin or a Bend competitor place
 *      page) + side-by-side or sequential shots proving we do not lose on
 *      first look.
 *   2) Map-drives-hierarchy — Atlas regions drive child places; no
 *      "Subdivisions in …" dump above neighborhood bars.
 *
 * Gate only. Does not invent place UI. Cos prose is not Tip Ready.
 *
 * Evidence path:
 *   node scripts/lib/taste-receipt.mjs --ship lib/place/place-craft.parity.json
 *   competitorFirstLook on that file (or tasteReview.competitorFirstLook)
 *   ci:place-craft holds the hierarchy lock on every push.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

export const PLACE_CRAFT_GATE = 'ci:place-craft'
export const PLACE_CRAFT_SCRIPT = 'scripts/check-place-craft.mjs'
export const PLACE_CRAFT_KIND = 'place-craft'
export const PLACE_CRAFT_PARITY = 'lib/place/place-craft.parity.json'
export const PLACE_CRAFT_LOCKED_AT = '2026-09-18'
export const PLACE_CRAFT_LOCKS = Object.freeze(['map-drives-hierarchy', 'competitor-first-look'])

export const PLACE_CRAFT_KITS = Object.freeze([
  'city',
  'community',
  'neighborhood',
  'subdivision',
  'place-type',
  'place-type-community',
])

const PATHS = Object.freeze({
  city: 'app/cities/[slug]/page.tsx',
  community: 'app/communities/[slug]/page.tsx',
  neighborhood: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  subdivision: 'app/subdivisions/[slug]/page.tsx',
  parity: PLACE_CRAFT_PARITY,
})

const PLACEHOLDER_PEER_RE =
  /^(the\s+)?(peer|competitor|tbd|todo|n\/?a|none|example|placeholder|named peer|e\.g\.|eg\.|redfin\?|bend competitor|competitor first-look)$/i

const SHOT_EXT_RE = /\.(png|jpe?g|webp|gif)$/i

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

export function isPlaceCraftKit(kit) {
  return PLACE_CRAFT_KITS.includes(String(kit ?? ''))
}

export function isPlaceCraftDocument(d) {
  return isPlainObject(d) && d.kind === PLACE_CRAFT_KIND
}

export function isPlaceCraftShip(d, { kit, rel, versionGap } = {}) {
  if (isPlaceCraftDocument(d)) return true
  if (d?.placeCraft === true) return true
  const path = String(rel ?? '').replace(/\\/g, '/')
  if (path.endsWith(PLACE_CRAFT_PARITY) || path.includes('place-craft.parity.json')) return true
  if (/SITE-128/.test(String(versionGap ?? '')) && isPlaceCraftKit(kit)) return true
  return false
}

export function isPlaceCraftDoneClaim(evidence, versionGap) {
  const text = String(evidence ?? '')
  const gap = String(versionGap ?? '')
  if (/\bplace-craft\b/i.test(text) || /\bplace craft\b/i.test(text)) return true
  if (/lib\/place\/place-craft\.parity\.json/.test(text)) return true
  if (/SITE-128/.test(gap) && /\b(explorer|first-look|first look)\b/i.test(text)) return true
  return false
}

/**
 * Map drives hierarchy (SITE-128 craft #3 lock). Atlas-drawn plats / GIS ring
 * are the children. A city-wide "Subdivisions in …" dump is refuse.
 */
export function mapDrivesHierarchyProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const city = readRel(root, PATHS.city, files.city ?? files[PATHS.city])
  if (city == null) {
    p.push(`${PATHS.city}: missing place template — map-drives-hierarchy lock cannot run.`)
  } else {
    if (/getIndexableSubdivisions/.test(city)) {
      p.push(`${PATHS.city}: getIndexableSubdivisions dump is refuse. Atlas regions drive child places.`)
    }
    if (/CITY_PLAT_INDEX_CAP/.test(city)) {
      p.push(`${PATHS.city}: CITY_PLAT_INDEX_CAP is the plat-index dump. Map-drives-hierarchy killed it.`)
    }
    if (/heading=\{[^}]*Subdivisions in/.test(city)) {
      p.push(`${PATHS.city}: "Subdivisions in …" list heading is refuse. Name-only child cards after the map.`)
    }
    if (!/childPlatEntries[\s\S]{0,80}atlasRegions/.test(city)) {
      p.push(`${PATHS.city}: child plats must come from atlasRegions (the map), not a sales-index dump.`)
    }
    if (!/id="atlas"/.test(city) || !/<V3Atlas/.test(city)) {
      p.push(`${PATHS.city}: V3Atlas #atlas is the drawing that drives hierarchy.`)
    }
    const nbh = city.indexOf('id="neighborhoods"')
    const kids = city.indexOf('id="child-places"')
    if (nbh === -1 || kids === -1 || nbh > kids) {
      p.push(`${PATHS.city}: #neighborhoods must sit above #child-places. Atlas-drawn plats follow the bars.`)
    }
    if (!/nameOnly/.test(city)) {
      p.push(`${PATHS.city}: child place cards must be nameOnly.`)
    }
  }

  const community = readRel(root, PATHS.community, files.community ?? files[PATHS.community])
  if (community == null) {
    p.push(`${PATHS.community}: missing place template.`)
  } else {
    if (/heading=\{[^}]*Neighborhoods in/.test(community) || /heading=\{[^}]*Subdivisions in/.test(community)) {
      p.push(`${PATHS.community}: "Neighborhoods in …" / "Subdivisions in …" heading is refuse.`)
    }
    if (!/id="child-places"/.test(community) || !/nameOnly/.test(community)) {
      p.push(`${PATHS.community}: children are name-only #child-places cards, not a ledger dump.`)
    }
  }

  const neighborhood = readRel(root, PATHS.neighborhood, files.neighborhood ?? files[PATHS.neighborhood])
  if (neighborhood == null) {
    p.push(`${PATHS.neighborhood}: missing place template.`)
  } else {
    if (!/id="child-places"/.test(neighborhood) || !/nameOnly/.test(neighborhood)) {
      p.push(`${PATHS.neighborhood}: children are name-only #child-places cards.`)
    }
    if (/id="subdivisions"/.test(neighborhood) || /heading=\{[^}]*Subdivisions/.test(neighborhood)) {
      p.push(`${PATHS.neighborhood}: Subdivisions ledger / heading is refuse.`)
    }
  }

  const subdivision = readRel(root, PATHS.subdivision, files.subdivision ?? files[PATHS.subdivision])
  if (subdivision == null) {
    p.push(`${PATHS.subdivision}: missing place template.`)
  } else {
    if (!/nearbySubdivisionPeers/.test(subdivision) || !/getSubdivisionRing/.test(subdivision)) {
      p.push(`${PATHS.subdivision}: keep-exploring must be GIS ring + resort peers, not a city-wide sales dump.`)
    }
    if (!/id="nearby-subdivisions"/.test(subdivision) || !/nameOnly/.test(subdivision)) {
      p.push(`${PATHS.subdivision}: nearby peers are name-only #nearby-subdivisions cards.`)
    }
    if (/entries=\{sisterEntries\}/.test(subdivision)) {
      p.push(`${PATHS.subdivision}: sisterEntries city dump is refuse. Map / GIS ring drives peers.`)
    }
    if (!/otherCommunitySubdivs/.test(subdivision) || !/id="other-subdivs"/.test(subdivision)) {
      p.push(`${PATHS.subdivision}: same-community siblings are name-only #other-subdivs, not a city dump.`)
    }
    if (/getIndexableSubdivisions[\s\S]{0,200}otherCommunitySubdivs/.test(subdivision)) {
      p.push(`${PATHS.subdivision}: other-subdivs must not read the indexable city dump.`)
    }
  }

  return p
}

export function resolveCompetitorFirstLook(d, tr) {
  if (isPlainObject(d?.competitorFirstLook)) return d.competitorFirstLook
  if (isPlainObject(tr?.competitorFirstLook)) return tr.competitorFirstLook
  if (isPlainObject(d?.evidence?.competitorFirstLook)) return d.evidence.competitorFirstLook
  if (isPlainObject(d?.tasteReview?.competitorFirstLook)) return d.tasteReview.competitorFirstLook
  return null
}

function resolveShotPath(root, rel) {
  const t = String(rel ?? '').trim()
  if (!t) return null
  return isAbsolute(t) ? t : join(root, t)
}

function shotExists(root, rel) {
  const abs = resolveShotPath(root, rel)
  return Boolean(abs && existsSync(abs) && SHOT_EXT_RE.test(abs))
}

function collectFirstLookShots(look) {
  const shots = isPlainObject(look?.shots) ? look.shots : {}
  const out = []
  if (typeof shots.sideBySide === 'string') out.push({ key: 'sideBySide', rel: shots.sideBySide })
  if (typeof shots.ours === 'string') out.push({ key: 'ours', rel: shots.ours })
  if (typeof shots.peer === 'string') out.push({ key: 'peer', rel: shots.peer })
  if (Array.isArray(shots.sequence)) {
    for (const [i, rel] of shots.sequence.entries()) {
      if (typeof rel === 'string') out.push({ key: `sequence[${i}]`, rel })
    }
  }
  return out
}

function hasSideBySideOrSequential(look, root) {
  const shots = isPlainObject(look?.shots) ? look.shots : {}
  if (shotExists(root, shots.sideBySide)) return true
  if (shotExists(root, shots.ours) && shotExists(root, shots.peer)) return true
  if (Array.isArray(shots.sequence) && shots.sequence.filter((rel) => shotExists(root, rel)).length >= 2) {
    return true
  }
  return false
}

/**
 * Competitor first-look. Named peer + files on disk. Cos prose / invented
 * true is refuse. The shots are the proof we do not lose on first look.
 */
export function competitorFirstLookProblems(look, { root = process.cwd() } = {}) {
  const refuse =
    'place craft Tip Ready requires competitor first-look: named peer (Redfin or a Bend competitor place page) + side-by-side or sequential shots on disk proving we do not lose on first look. Omit is refuse. Cos prose is not Tip Ready.'
  if (!isPlainObject(look)) return [refuse]
  const p = []
  const peer = typeof look.peer === 'string' ? look.peer.trim() : ''
  if (peer.length < 4 || PLACEHOLDER_PEER_RE.test(peer) || !/[A-Za-z]/.test(peer)) {
    p.push(
      'competitorFirstLook.peer must name the page we sat next to (e.g. Redfin Bend homes, or a Bend competitor place page). Placeholder "competitor" / "peer" / "tbd" is refuse.',
    )
  }
  if (look.peerUrl != null) {
    const url = String(look.peerUrl).trim()
    if (url && !/^https?:\/\//i.test(url)) {
      p.push('competitorFirstLook.peerUrl must be http(s) when present.')
    }
  }
  const listed = collectFirstLookShots(look)
  if (listed.length === 0) {
    p.push(
      'competitorFirstLook.shots must name a side-by-side file, or sequential ours+peer (or shots.sequence of 2+). Empty shots are refuse.',
    )
    return p
  }
  for (const { key, rel } of listed) {
    if (!SHOT_EXT_RE.test(rel)) {
      p.push(`competitorFirstLook.shots.${key} must be an image path (.png / .jpg / .webp / .gif).`)
      continue
    }
    if (!shotExists(root, rel)) {
      p.push(`competitorFirstLook.shots.${key} is not on disk (${rel}). Invented paths are refuse.`)
    }
  }
  if (!hasSideBySideOrSequential(look, root)) {
    p.push(
      'competitor first-look needs side-by-side OR sequential ours+peer shots that exist on disk. One lonely house shot is not a first look.',
    )
  }
  return p
}

export function placeCraftParityContractProblems(d) {
  if (!isPlaceCraftDocument(d)) return [`${PLACE_CRAFT_PARITY}: kind must be ${PLACE_CRAFT_KIND}.`]
  const p = []
  const locks = Array.isArray(d.locks) ? d.locks.map(String) : []
  for (const lock of PLACE_CRAFT_LOCKS) {
    if (!locks.includes(lock)) {
      p.push(`${PLACE_CRAFT_PARITY}: locks must include ${lock}. Evidence path is not optional.`)
    }
  }
  const path = d.evidencePath
  if (!isPlainObject(path) || !isPlainObject(path.competitorFirstLook)) {
    p.push(
      `${PLACE_CRAFT_PARITY}: evidencePath.competitorFirstLook must document the named-peer + shots path. Gate only — do not invent UI.`,
    )
  } else if (path.competitorFirstLook.required !== true) {
    p.push(`${PLACE_CRAFT_PARITY}: evidencePath.competitorFirstLook.required must stay true.`)
  }
  if (!isPlainObject(path) || typeof path.mapDrivesHierarchy !== 'string' || !path.mapDrivesHierarchy.trim()) {
    p.push(`${PLACE_CRAFT_PARITY}: evidencePath.mapDrivesHierarchy must name the hierarchy lock.`)
  }
  if (d.gate !== PLACE_CRAFT_GATE) {
    p.push(`${PLACE_CRAFT_PARITY}: gate must be ${PLACE_CRAFT_GATE}.`)
  }
  return p
}

export function placeCraftShipProblems(d, { root = process.cwd(), files = {}, tr } = {}) {
  const p = []
  if (isPlaceCraftDocument(d)) p.push(...placeCraftParityContractProblems(d))
  p.push(...mapDrivesHierarchyProblems({ root, files }))
  p.push(...competitorFirstLookProblems(resolveCompetitorFirstLook(d, tr), { root }))
  return p
}

export function placeCraftCiProblems({ root = process.cwd(), files = {} } = {}) {
  const p = mapDrivesHierarchyProblems({ root, files })
  const raw = readRel(root, PATHS.parity, files.parity ?? files[PATHS.parity])
  if (raw == null) {
    p.push(`${PATHS.parity}: missing place-craft evidence-path stub.`)
    return p
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    p.push(`${PATHS.parity}: invalid JSON.`)
    return p
  }
  p.push(...placeCraftParityContractProblems(parsed))
  return p
}
