/**
 * catalog-install.mjs — ci:catalog-install check, reused by Tip Ready --ship.
 *
 * Extracted so taste-receipt.mjs can call the SAME import / mustContain
 * logic without a circular import through taste-catalog.mjs.
 *
 * Tip Ready adds requireRouteImport: the route's page/_v3 files must import
 * the catalog specifier. House-only import (spec.house) is not enough.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'])

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function isNonEmptyString(v, min = 1) {
  return typeof v === 'string' && v.trim().length >= min
}

/** House ids are files we already own. Catalog ids must resolve through installById. */
export function isHouseAdaptedId(id) {
  const s = String(id ?? '')
  return /^(house-|listing-|V3)/.test(s) || s.startsWith('components/')
}

export function resolveInstallSpec(installById, id, seen = new Set()) {
  if (!isNonEmptyString(id) || !isPlainObject(installById)) return null
  if (seen.has(id)) return null
  const spec = installById[id]
  if (!isPlainObject(spec)) return null
  if (isNonEmptyString(spec.aliasOf)) {
    seen.add(id)
    return resolveInstallSpec(installById, spec.aliasOf, seen)
  }
  if (!isNonEmptyString(spec.file) || !isNonEmptyString(spec.import)) return null
  return spec
}

/** A real ESM/CJS import of the specifier. A comment is not an import. */
export function fileImportsSpecifier(src, specifier) {
  const needle = String(specifier ?? '')
  if (!needle || !src) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)\\s*import(?:[\\s\\S]{0,400}?)from\\s+['"]${escaped}['"]`).test(src)
}

/**
 * A catalog adaptedFrom id is only real when the installed file exists and
 * the house primitive (or the scanned route files) imports it.
 *
 * io.requireRouteImport (Tip Ready): ALSO require the import in scanFiles
 * (the route page/_v3 set). spec.house alone is not Tip Ready.
 */
export function catalogInstallProblems(catalog, adaptedFrom, io = {}) {
  const exists = io.existsSync ?? existsSync
  const read = io.readFileSync ?? readFileSync
  const extraFiles = Array.isArray(io.scanFiles) ? io.scanFiles : []
  const requireRoute = io.requireRouteImport === true
  const problems = []
  if (!Array.isArray(adaptedFrom)) return ['adaptedFrom is missing']
  for (const [i, hit] of adaptedFrom.entries()) {
    const id = isPlainObject(hit) ? hit.id : hit
    if (!isNonEmptyString(id) || isHouseAdaptedId(id)) continue
    const spec = resolveInstallSpec(catalog?.installById, id)
    if (!spec) {
      problems.push(
        `adaptedFrom[${i}] "${id}" has no install spec — npx shadcn add the registry item, record it in installById, and import the file. Do not keep the catalog name on a cream box.`,
      )
      continue
    }
    if (!exists(spec.file)) {
      problems.push(`adaptedFrom[${i}] "${id}": ${spec.file} is missing. Run: npx shadcn add ${spec.add}`)
      continue
    }
    const files = spec.house ? [spec.house, ...extraFiles] : extraFiles
    let found = false
    for (const rel of files) {
      if (!exists(rel)) continue
      let src = ''
      try {
        src = String(read(rel, 'utf8') ?? '')
      } catch {
        continue
      }
      if (fileImportsSpecifier(src, spec.import)) {
        found = true
        break
      }
    }
    if (!found) {
      const where = spec.house || 'the route'
      problems.push(
        `adaptedFrom[${i}] "${id}": ${where} must import ${spec.import} from the installed source. A comment is not an import. motion/react on a house wrapper is not the component.`,
      )
    }
    if (requireRoute) {
      let routeFound = false
      for (const rel of extraFiles) {
        if (!exists(rel)) continue
        let src = ''
        try {
          src = String(read(rel, 'utf8') ?? '')
        } catch {
          continue
        }
        if (fileImportsSpecifier(src, spec.import)) {
          routeFound = true
          break
        }
      }
      if (!routeFound) {
        problems.push(
          extraFiles.length === 0
            ? `adaptedFrom[${i}] "${id}": the route page/v3 files must import ${spec.import}. Empty route scan is not Tip Ready.`
            : `adaptedFrom[${i}] "${id}": the route page/v3 files must import ${spec.import}. House-only import is not Tip Ready. A comment is not an import.`,
        )
      }
    }
    const needles = Array.isArray(spec.mustContain) ? spec.mustContain.filter((s) => isNonEmptyString(s)) : []
    if (needles.length && exists(spec.file)) {
      let src = ''
      try {
        src = String(read(spec.file, 'utf8') ?? '')
      } catch {
        src = ''
      }
      for (const needle of needles) {
        if (!src.includes(needle)) {
          problems.push(
            `adaptedFrom[${i}] "${id}": ${spec.file} is not the catalog source (missing ${JSON.stringify(needle)}). Copy from ${spec.repo || spec.add}, do not fork the demo out.`,
          )
        }
      }
    }
  }
  return problems
}

/**
 * The route's page file plus sibling `_v3/**` code files.
 * parity.route looks like `app/about/page.tsx`.
 */
export function listRoutePageV3Files(route, { root = process.cwd(), readdirSync: rd = readdirSync, existsSync: ex = existsSync } = {}) {
  if (!isNonEmptyString(route)) return []
  const rel = route.trim().replace(/^\.\//, '')
  const out = []
  const pageAbs = join(root, rel)
  if (ex(pageAbs) || ex(rel)) out.push(rel)
  const dir = dirname(rel)
  if (!dir || dir === '.' || dir === '/') return out
  const v3Rel = join(dir, '_v3')
  const v3Abs = join(root, v3Rel)
  if (ex(v3Abs) || ex(v3Rel)) {
    walkDir(v3Rel, ex(v3Abs) ? v3Abs : v3Rel, rd, out)
  }
  return out
}

function walkDir(relDir, absDir, rd, out) {
  let entries
  try {
    entries = rd(absDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const rel = join(relDir, e.name)
    const abs = join(absDir, e.name)
    if (e.isDirectory()) walkDir(rel, abs, rd, out)
    else if (CODE_EXT.has(extname(e.name))) out.push(rel)
  }
}

/**
 * Tip Ready catalog-install: same check as ci:catalog-install, plus the
 * route page/_v3 set must import each claimed catalog specifier.
 */
export function tipReadyCatalogInstallProblems(adaptedFrom, { catalog, route, root = process.cwd(), catalogIo = null } = {}) {
  if (!Array.isArray(adaptedFrom)) return []
  const catalogIds = adaptedFrom
    .map((hit) => (isPlainObject(hit) ? hit.id : hit))
    .filter((id) => isNonEmptyString(id) && !isHouseAdaptedId(id))
  if (catalogIds.length === 0) return []
  if (!catalog || !isPlainObject(catalog.installById)) {
    return [
      `adaptedFrom names catalog modules (${catalogIds.join(', ')}) but ci:catalog-install has no installById catalog. Cannot prove a real import.`,
    ]
  }
  const scanFiles = Array.isArray(catalogIo?.scanFiles)
    ? catalogIo.scanFiles
    : listRoutePageV3Files(route, { root, readdirSync: catalogIo?.readdirSync, existsSync: catalogIo?.existsSync })
  return catalogInstallProblems(catalog, adaptedFrom, {
    existsSync: catalogIo?.existsSync ?? ((p) => existsSync(join(root, p)) || existsSync(p)),
    readFileSync:
      catalogIo?.readFileSync ??
      ((p, enc) => {
        try {
          return readFileSync(join(root, p), enc)
        } catch {
          return readFileSync(p, enc)
        }
      }),
    scanFiles,
    requireRouteImport: true,
  })
}
