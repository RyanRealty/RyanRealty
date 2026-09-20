/**
 * place-typed-inventory.mjs — SITE-129 Tip Ready lock.
 *
 * Community + subdivision inventory stays on the page, typed by buyer
 * bucket. Empty types omit. PlaceSplitView / price scrubber / morphing
 * search cannot return on those two grains.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const PLACE_TYPED_INVENTORY_GATE = 'ci:place-typed-inventory'
export const PLACE_TYPED_INVENTORY_SCRIPT = 'scripts/check-place-typed-inventory.mjs'
export const PLACE_TYPED_INVENTORY_KIND = 'place-typed-inventory'
export const PLACE_TYPED_INVENTORY_PARITY = 'lib/place/place-typed-inventory.parity.json'

const PATHS = Object.freeze({
  community: 'app/communities/[slug]/page.tsx',
  subdivision: 'app/subdivisions/[slug]/page.tsx',
  atlas: 'components/site/v3/V3Atlas.client.tsx',
  inventory: 'components/site/v3/V3PlaceInventory.tsx',
  stock: 'lib/place/place-inventory-stock.ts',
  communityFold: 'app/communities/[slug]/_v3/community-fold.css',
  platFold: 'app/subdivisions/[slug]/_v3/plat-fold.css',
  parity: PLACE_TYPED_INVENTORY_PARITY,
})

const REQUIRED_LOCKS = Object.freeze([
  'typed-stock-on-page',
  'empty-types-omit',
  'no-split-search',
  'scrubber-unmounted',
])

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

export function isPlaceTypedInventoryDocument(d) {
  return isPlainObject(d) && d.kind === PLACE_TYPED_INVENTORY_KIND
}

function placePageProblems(rel, src) {
  const p = []
  if (src == null) {
    p.push(`${rel}: missing place template.`)
    return p
  }
  const code = stripComments(src)
  if (!/\bV3PlaceInventory\b/.test(code)) {
    p.push(`${rel}: typed stock stays on the page as V3PlaceInventory.`)
  }
  if (!/\bplaceStockSectionsFromTiles\b/.test(code)) {
    p.push(`${rel}: must group live tiles through placeStockSectionsFromTiles.`)
  }
  if (!/\bhidePriceScrubber\b/.test(code)) {
    p.push(`${rel}: Atlas must pass hidePriceScrubber so the price range does not mount.`)
  }
  if (/\bPlaceSplitView\b/.test(code) || /\bSearchFilters\b/.test(code)) {
    p.push(`${rel}: scrolling search / PlaceSplitView is not the inventory surface.`)
  }
  if (/\bMorphingSearch\b/.test(code) || /\bmorphing-search\b/.test(code)) {
    p.push(`${rel}: morphing search is not the inventory surface.`)
  }
  return p
}

export function placeTypedInventorySourceProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  p.push(...placePageProblems(PATHS.community, readRel(root, PATHS.community, files.community ?? files[PATHS.community])))
  p.push(
    ...placePageProblems(
      PATHS.subdivision,
      readRel(root, PATHS.subdivision, files.subdivision ?? files[PATHS.subdivision]),
    ),
  )

  const atlas = readRel(root, PATHS.atlas, files.atlas ?? files[PATHS.atlas])
  if (atlas == null) {
    p.push(`${PATHS.atlas}: missing V3Atlas.`)
  } else {
    const code = stripComments(atlas)
    if (!/\bhidePriceScrubber\b/.test(code)) {
      p.push(`${PATHS.atlas}: hidePriceScrubber must exist so community/subdivision can unmount the range.`)
    }
    if (!/hidePriceScrubber \? null : \(/.test(code) || !/className="v3-atlas__scrub"/.test(code)) {
      p.push(`${PATHS.atlas}: hidePriceScrubber must skip mounting .v3-atlas__scrub. CSS hide is not enough.`)
    }
  }

  const inventory = readRel(root, PATHS.inventory, files.inventory ?? files[PATHS.inventory])
  if (inventory == null) {
    p.push(`${PATHS.inventory}: missing V3PlaceInventory.`)
  } else if (!/section\.rows\.length > 0/.test(stripComments(inventory))) {
    p.push(`${PATHS.inventory}: empty type sections must omit (rows.length > 0).`)
  }

  const stock = readRel(root, PATHS.stock, files.stock ?? files[PATHS.stock])
  if (stock == null) {
    p.push(`${PATHS.stock}: missing place-inventory-stock.`)
  } else {
    const code = stripComments(stock)
    if (!/PLACE_STOCK_SECTION_ORDER = \['sfr', 'multifamily', 'attached', 'land'\]/.test(code)) {
      p.push(`${PATHS.stock}: four buyer buckets are sfr / multifamily / attached / land.`)
    }
    if (!/if \(rows\.length === 0\) return \[\]/.test(code)) {
      p.push(`${PATHS.stock}: a type with zero actives is omitted — no empty stub.`)
    }
    for (const heading of ['Single-family homes', 'Multifamily homes', 'Townhomes and condos', 'Land']) {
      if (!code.includes(heading)) {
        p.push(`${PATHS.stock}: missing heading "${heading}".`)
      }
    }
  }

  const communityFold = readRel(root, PATHS.communityFold, files.communityFold ?? files[PATHS.communityFold])
  if (communityFold == null) {
    p.push(`${PATHS.communityFold}: missing community fold CSS.`)
  } else if (!/\.community-fold__drawing \.v3-atlas__scrub[\s\S]{0,200}display:\s*none/.test(communityFold)) {
    p.push(`${PATHS.communityFold}: belt-and-suspenders CSS hide of .v3-atlas__scrub must stay.`)
  }

  const platFold = readRel(root, PATHS.platFold, files.platFold ?? files[PATHS.platFold])
  if (platFold == null) {
    p.push(`${PATHS.platFold}: missing plat fold CSS.`)
  } else if (!/\.plat-fold__drawing \.v3-atlas__scrub[\s\S]{0,200}display:\s*none/.test(platFold)) {
    p.push(`${PATHS.platFold}: belt-and-suspenders CSS hide of .v3-atlas__scrub must stay.`)
  }

  return p
}

export function placeTypedInventoryParityContractProblems(d) {
  if (!isPlaceTypedInventoryDocument(d)) {
    return [`${PLACE_TYPED_INVENTORY_PARITY}: kind must be ${PLACE_TYPED_INVENTORY_KIND}.`]
  }
  const p = []
  const locks = Array.isArray(d.locks) ? d.locks.map(String) : []
  for (const lock of REQUIRED_LOCKS) {
    if (!locks.includes(lock)) {
      p.push(`${PLACE_TYPED_INVENTORY_PARITY}: locks must include ${lock}.`)
    }
  }
  if (d.gate !== PLACE_TYPED_INVENTORY_GATE) {
    p.push(`${PLACE_TYPED_INVENTORY_PARITY}: gate must be ${PLACE_TYPED_INVENTORY_GATE}.`)
  }
  if (
    !isPlainObject(d.evidencePath) ||
    !d.evidencePath.typedStockOnPage ||
    !d.evidencePath.emptyTypesOmit ||
    !d.evidencePath.noSplitSearch ||
    !d.evidencePath.scrubberUnmounted
  ) {
    p.push(`${PLACE_TYPED_INVENTORY_PARITY}: evidencePath must keep typed stock, empty omit, no split, scrubber unmounted.`)
  }
  return p
}

export function placeTypedInventoryCiProblems({ root = process.cwd(), files = {} } = {}) {
  const p = placeTypedInventorySourceProblems({ root, files })
  const raw = readRel(root, PATHS.parity, files.parity ?? files[PATHS.parity])
  if (raw == null) {
    p.push(`${PATHS.parity}: missing place-typed-inventory evidence stub.`)
    return p
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    p.push(`${PATHS.parity}: invalid JSON.`)
    return p
  }
  p.push(...placeTypedInventoryParityContractProblems(parsed))
  return p
}

export function placeTypedInventoryShipProblems(d, { root = process.cwd(), files = {} } = {}) {
  const p = []
  if (isPlaceTypedInventoryDocument(d)) p.push(...placeTypedInventoryParityContractProblems(d))
  p.push(...placeTypedInventorySourceProblems({ root, files }))
  return p
}
