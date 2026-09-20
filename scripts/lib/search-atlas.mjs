/**
 * search-atlas.mjs — SITE-110 Tip Ready lock.
 *
 * Search stays Atlas-grade cartography plus a list. The 40/60 portal
 * split, mute comparison hairline, and seven uniform pills cannot return.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SEARCH_ATLAS_GATE = 'ci:search-atlas'
export const SEARCH_ATLAS_SCRIPT = 'scripts/check-search-atlas.mjs'
export const SEARCH_ATLAS_KIND = 'search-atlas'
export const SEARCH_ATLAS_PARITY = 'lib/search/search-atlas.parity.json'

const PATHS = Object.freeze({
  page: 'app/search/page.tsx',
  catalog: 'app/search/_v3/search-catalog.ts',
  compare: 'app/search/_v3/SearchCompareMark.tsx',
  empty: 'app/search/_v3/SearchEmpty.tsx',
  pager: 'app/search/_v3/SearchPager.tsx',
  command: 'app/search/_v3/SearchCommand.tsx',
  card: 'components/search/SplitListingCard.tsx',
  filters: 'components/search/SearchFilters.tsx',
  sheet: 'components/search/AllFiltersSheet.tsx',
  css: 'components/search/search-ledger.css',
  tokens: 'components/site/v3/tokens.css',
  parity: SEARCH_ATLAS_PARITY,
})

const REQUIRED_LOCKS = Object.freeze([
  'map-dominant',
  'labeled-compare',
  'house-sheet-filters',
  'no-portal-pills',
  'catalog-route-import',
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

export function isSearchAtlasDocument(d) {
  return isPlainObject(d) && d.kind === SEARCH_ATLAS_KIND
}

export function searchAtlasSourceProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []

  const page = readRel(root, PATHS.page, files.page ?? files[PATHS.page])
  if (page == null) {
    p.push(`${PATHS.page}: missing search page.`)
  } else {
    const code = stripComments(page)
    if (!/\bsrch-atlas\b/.test(code)) {
      p.push(`${PATHS.page}: search frame must wear srch-atlas so the map stays the field.`)
    }
    if (!/search\/_v3\/search-catalog/.test(code) && !/_v3\/search-catalog/.test(code)) {
      p.push(`${PATHS.page}: must import app/search/_v3/search-catalog for Tip Ready route imports.`)
    }
  }

  const catalog = readRel(root, PATHS.catalog, files.catalog ?? files[PATHS.catalog])
  if (catalog == null) {
    p.push(`${PATHS.catalog}: missing search catalog barrel.`)
  } else {
    for (const spec of [
      '@/components/motion/morphing-search',
      '@/components/motion/range-slider',
      '@/components/ui/command',
      '@/components/ui/checkbox',
      '@/components/ui/empty',
      '@/components/ui/input',
      '@/components/ui/pagination',
    ]) {
      if (!catalog.includes(spec)) {
        p.push(`${PATHS.catalog}: must import ${spec}.`)
      }
    }
  }

  const compare = readRel(root, PATHS.compare, files.compare ?? files[PATHS.compare])
  if (compare == null) {
    p.push(`${PATHS.compare}: missing labeled comparison mark.`)
  } else if (!/\.srch-ppsf__label/.test(compare) && !/srch-ppsf__label/.test(compare)) {
    p.push(`${PATHS.compare}: comparison must print .srch-ppsf__label.`)
  }

  const card = readRel(root, PATHS.card, files.card ?? files[PATHS.card])
  if (card == null) {
    p.push(`${PATHS.card}: missing split card.`)
  } else if (!/\bSearchCompareMark\b/.test(stripComments(card))) {
    p.push(`${PATHS.card}: split cards must render SearchCompareMark.`)
  }

  const filters = readRel(root, PATHS.filters, files.filters ?? files[PATHS.filters])
  if (filters == null) {
    p.push(`${PATHS.filters}: missing SearchFilters.`)
  } else {
    const code = stripComments(filters)
    if (!/\bsrch-chip--sheet\b/.test(code)) {
      p.push(`${PATHS.filters}: For sale / Price pill / Baths / Home type must wear srch-chip--sheet.`)
    }
    if (!/\bV3MorphSearch\b/.test(code) || !/\bV3Range\b/.test(code)) {
      p.push(`${PATHS.filters}: morph search and price ticks stay in the first viewport.`)
    }
  }

  const sheet = readRel(root, PATHS.sheet, files.sheet ?? files[PATHS.sheet])
  if (sheet == null) {
    p.push(`${PATHS.sheet}: missing All-filters sheet.`)
  } else if (!/\bsrch-sheet\b/.test(sheet)) {
    p.push(`${PATHS.sheet}: All-filters stays the house sheet (.srch-sheet).`)
  }

  const css = readRel(root, PATHS.css, files.css ?? files[PATHS.css])
  if (css == null) {
    p.push(`${PATHS.css}: missing search ledger CSS.`)
  } else {
    if (!/\.srch-atlas\b/.test(css) || !/\.srch-atlas \.map-search-list/.test(css)) {
      p.push(`${PATHS.css}: .srch-atlas .map-search-list must set the map-dominant list share.`)
    }
    if (!/\.srch-chip--sheet/.test(css) || !/display:\s*none/.test(css)) {
      p.push(`${PATHS.css}: .srch-chip--sheet must hide the portal pill set.`)
    }
    if (!/\.srch-ppsf__label/.test(css)) {
      p.push(`${PATHS.css}: .srch-ppsf__label must stay painted.`)
    }
  }

  return p
}

export function searchAtlasParityContractProblems(d) {
  if (!isSearchAtlasDocument(d)) {
    return [`${SEARCH_ATLAS_PARITY}: kind must be ${SEARCH_ATLAS_KIND}.`]
  }
  const p = []
  const locks = Array.isArray(d.locks) ? d.locks.map(String) : []
  for (const lock of REQUIRED_LOCKS) {
    if (!locks.includes(lock)) {
      p.push(`${SEARCH_ATLAS_PARITY}: locks must include ${lock}.`)
    }
  }
  if (d.gate !== SEARCH_ATLAS_GATE) {
    p.push(`${SEARCH_ATLAS_PARITY}: gate must be ${SEARCH_ATLAS_GATE}.`)
  }
  if (
    !isPlainObject(d.evidencePath) ||
    !d.evidencePath.mapDominant ||
    !d.evidencePath.labeledCompare ||
    !d.evidencePath.houseSheetFilters ||
    !d.evidencePath.noPortalPills ||
    !d.evidencePath.catalogRouteImport
  ) {
    p.push(`${SEARCH_ATLAS_PARITY}: evidencePath must keep map-dominant, labeled compare, house sheet, no portal pills, catalog route import.`)
  }
  return p
}

export function searchAtlasCiProblems({ root = process.cwd(), files = {} } = {}) {
  const p = searchAtlasSourceProblems({ root, files })
  const raw = readRel(root, PATHS.parity, files.parity ?? files[PATHS.parity])
  if (raw == null) {
    p.push(`${PATHS.parity}: missing search-atlas evidence stub.`)
    return p
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    p.push(`${PATHS.parity}: invalid JSON.`)
    return p
  }
  p.push(...searchAtlasParityContractProblems(parsed))
  return p
}

export function searchAtlasShipProblems(d, { root = process.cwd(), files = {} } = {}) {
  const p = []
  if (isSearchAtlasDocument(d)) p.push(...searchAtlasParityContractProblems(d))
  p.push(...searchAtlasSourceProblems({ root, files }))
  return p
}
