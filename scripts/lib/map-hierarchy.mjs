/**
 * map-hierarchy.mjs — SITE-128 Tip Ready #2 lock.
 *
 * Holds subject-polygon-only + child-select-zooms + readable subdiv grain.
 * Does not invent geometry. place-craft first-look refuse stays on that gate.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const MAP_HIERARCHY_GATE = 'ci:map-hierarchy'
export const MAP_HIERARCHY_SCRIPT = 'scripts/check-map-hierarchy.mjs'
export const MAP_HIERARCHY_KIND = 'map-hierarchy'
export const MAP_HIERARCHY_PARITY = 'lib/place/map-hierarchy.parity.json'

const PATHS = Object.freeze({
  neighborhood: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  community: 'app/communities/[slug]/page.tsx',
  subdivision: 'app/subdivisions/[slug]/page.tsx',
  atlas: 'components/site/v3/V3Atlas.client.tsx',
  atlasCss: 'components/site/v3/V3Atlas.css',
  map: 'components/SearchMapClustered.tsx',
  lib: 'lib/place/map-hierarchy.ts',
  parity: MAP_HIERARCHY_PARITY,
  placeCraft: 'lib/place/place-craft.parity.json',
  placeCraftCheck: 'scripts/check-place-craft.mjs',
})

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

export function isMapHierarchyDocument(d) {
  return isPlainObject(d) && d.kind === MAP_HIERARCHY_KIND
}

export function mapHierarchySourceProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const nbh = readRel(root, PATHS.neighborhood, files.neighborhood ?? files[PATHS.neighborhood])
  if (nbh == null) {
    p.push(`${PATHS.neighborhood}: missing neighborhood template.`)
  } else {
    if (/regions=\{atlasRegions\.filter\(\(r\) => r\.kind === 'town' \|\| r\.kind === 'neighborhood'\)\}/.test(nbh)) {
      p.push(
        `${PATHS.neighborhood}: Atlas must highlight the neighborhood ring only — town||neighborhood painted Old Bend as 20 plats.`,
      )
    }
    if (!/subjectAtlasRegions/.test(nbh) || !/childAtlasRegions/.test(nbh)) {
      p.push(`${PATHS.neighborhood}: must split subjectAtlasRegions / childAtlasRegions.`)
    }
    if (!/childRegions=\{/.test(nbh)) {
      p.push(`${PATHS.neighborhood}: child plats pass as childRegions (select → zoom), not default highlight.`)
    }
  }

  const community = readRel(root, PATHS.community, files.community ?? files[PATHS.community])
  if (community == null) {
    p.push(`${PATHS.community}: missing community template.`)
  } else {
    if (!/foldAtlasRegions/.test(community) || !/kind === 'town'/.test(community)) {
      p.push(`${PATHS.community}: fold Atlas highlights the community town ring only.`)
    }
    if (!/childRegions=\{platRegions\}/.test(community) && !/childRegions=\{/.test(community)) {
      p.push(`${PATHS.community}: child plats are childRegions for select-zoom. No subject geom → no invented highlight.`)
    }
  }

  const subdiv = readRel(root, PATHS.subdivision, files.subdivision ?? files[PATHS.subdivision])
  if (subdiv == null) {
    p.push(`${PATHS.subdivision}: missing subdivision template.`)
  } else if (!/subjectGrain/.test(subdiv)) {
    p.push(`${PATHS.subdivision}: subjectGrain keeps the plat ring readable (DRW).`)
  }

  const atlas = readRel(root, PATHS.atlas, files.atlas ?? files[PATHS.atlas])
  if (atlas == null) {
    p.push(`${PATHS.atlas}: missing V3Atlas.`)
  } else {
    if (!/childRegions/.test(atlas) || !/fitCamToShape/.test(atlas) || !/subjectGrain/.test(atlas)) {
      p.push(`${PATHS.atlas}: must keep childRegions, fitCamToShape (child zoom), and subjectGrain.`)
    }
    if (!/atlasFramePad/.test(atlas)) {
      p.push(`${PATHS.atlas}: subject grain must use atlasFramePad — 0.6 pad made DRW faint/tiny.`)
    }
    if (!/hierarchyChildIdSet/.test(atlas)) {
      p.push(`${PATHS.atlas}: --child paint/zoom is only for childRegions — not every homepage city.`)
    }
  }

  const css = readRel(root, PATHS.atlasCss, files.atlasCss ?? files[PATHS.atlasCss])
  if (css == null) {
    p.push(`${PATHS.atlasCss}: missing Atlas CSS.`)
  } else {
    if (!/v3-atlas--subject-grain/.test(css) || !/v3-atlas__place--child/.test(css)) {
      p.push(`${PATHS.atlasCss}: subject-grain stroke + child hit-only paint are the hierarchy look.`)
    }
  }

  const map = readRel(root, PATHS.map, files.map ?? files[PATHS.map])
  if (map == null) {
    p.push(`${PATHS.map}: missing SearchMapClustered.`)
  } else {
    if (/onClick=\{cell\.href \? \(\) => router\.push\(cell\.href!\)/.test(map)) {
      p.push(`${PATHS.map}: overlay click must zoom the child boundary, not router.push.`)
    }
    if (!/selectChildOverlay|childZoomBounds|data-map-hierarchy/.test(map)) {
      p.push(`${PATHS.map}: child overlay select must fit recorded bounds (data-map-hierarchy).`)
    }
    if (!/MAP_HIERARCHY_CHILD_HIT|child-hit|selected-child/.test(map)) {
      p.push(`${PATHS.map}: unselected child overlays are hit-only — not 20 highlighted plats.`)
    }
  }

  const lib = readRel(root, PATHS.lib, files.lib ?? files[PATHS.lib])
  if (lib == null) {
    p.push(`${PATHS.lib}: missing map-hierarchy helpers.`)
  } else if (/Invented|hand-drawn|approximate/.test(lib) && /coordinates:\s*\[\[-1(2[01])/.test(lib)) {
    p.push(`${PATHS.lib}: do not invent Central Oregon coordinates.`)
  }

  return p
}

export function mapHierarchyParityContractProblems(d) {
  if (!isMapHierarchyDocument(d)) return [`${MAP_HIERARCHY_PARITY}: kind must be ${MAP_HIERARCHY_KIND}.`]
  const p = []
  const locks = Array.isArray(d.locks) ? d.locks.map(String) : []
  for (const lock of [
    'subject-polygon-only',
    'child-select-zooms-boundary',
    'subdiv-poly-readable',
    'place-craft-first-look-refuse',
  ]) {
    if (!locks.includes(lock)) {
      p.push(`${MAP_HIERARCHY_PARITY}: locks must include ${lock}.`)
    }
  }
  if (d.gate !== MAP_HIERARCHY_GATE) {
    p.push(`${MAP_HIERARCHY_PARITY}: gate must be ${MAP_HIERARCHY_GATE}.`)
  }
  if (!isPlainObject(d.evidencePath) || !d.evidencePath.placeCraftFirstLook) {
    p.push(`${MAP_HIERARCHY_PARITY}: evidencePath.placeCraftFirstLook must keep the #1 refuse.`)
  }
  return p
}

export function mapHierarchyCiProblems({ root = process.cwd(), files = {} } = {}) {
  const p = mapHierarchySourceProblems({ root, files })
  const raw = readRel(root, PATHS.parity, files.parity ?? files[PATHS.parity])
  if (raw == null) {
    p.push(`${PATHS.parity}: missing map-hierarchy evidence stub.`)
    return p
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    p.push(`${PATHS.parity}: invalid JSON.`)
    return p
  }
  p.push(...mapHierarchyParityContractProblems(parsed))

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
  return p
}

export function mapHierarchyShipProblems(d, { root = process.cwd(), files = {} } = {}) {
  const p = []
  if (isMapHierarchyDocument(d)) p.push(...mapHierarchyParityContractProblems(d))
  p.push(...mapHierarchySourceProblems({ root, files }))
  return p
}
