#!/usr/bin/env node
/**
 * check-catalog-install.mjs — a catalog name on a receipt is not adapted.
 *
 * Matt 2026-09-10: the UX bar is the shadcn / beUI / Rare / Beautiful UI /
 * Transitions source via `npx shadcn add`, restyled navy/cream. Workers were
 * wrapping cream boxes, putting the catalog id in adaptedFrom, and marking
 * the node done. ci:taste-canon only checked that the id string was allowed.
 *
 * This gate: every non-house adaptedFrom id on a public parity.json must
 * resolve through taste-catalog.json installById, the installed file must
 * exist, and the house primitive named on that spec must import it.
 *
 * Wired as ci:catalog-install.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  CATALOG_PATH,
  catalogInstallProblems,
  classForRoute,
  loadTasteCatalog,
} from './lib/taste-catalog.mjs'

const ROOT = process.cwd()
const KITS = 'design_system/ryan-realty/ui_kits'
const failures = []

function loadCatalog() {
  const abs = join(ROOT, CATALOG_PATH)
  if (!existsSync(abs)) {
    failures.push(`${CATALOG_PATH} is missing`)
    return null
  }
  try {
    return loadTasteCatalog(JSON.parse(readFileSync(abs, 'utf8')))
  } catch (err) {
    failures.push(`${CATALOG_PATH} is malformed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

const catalog = loadCatalog()
if (catalog?.problems?.length) {
  for (const p of catalog.problems) failures.push(`${CATALOG_PATH}: ${p}`)
}

const kitDirs = existsSync(join(ROOT, KITS))
  ? readdirSync(join(ROOT, KITS), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `${KITS}/${e.name}/parity.json`)
      .filter((rel) => existsSync(join(ROOT, rel)))
  : []

let checked = 0
if (catalog && catalog.problems.length === 0) {
  for (const rel of kitDirs) {
    let d
    try {
      d = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
    } catch {
      continue
    }
    const route = typeof d.route === 'string' ? d.route.trim() : ''
    if (!route.startsWith('app/') || route.startsWith('app/admin')) continue
    const tr = d.tasteReview
    if (!tr || typeof tr !== 'object' || !Array.isArray(tr.adaptedFrom)) continue
    const kit = rel.split('/').at(-2)
    const classKey = classForRoute(catalog, kit) || kit
    const problems = catalogInstallProblems(catalog, tr.adaptedFrom, {
      existsSync: (p) => existsSync(join(ROOT, p)),
      readFileSync: (p, enc) => readFileSync(join(ROOT, p), enc),
    })
    checked += 1
    for (const p of problems) failures.push(`${rel} (${classKey}): ${p}`)
  }
}

console.log('catalog install (ci:catalog-install)')
console.log('====================================')
console.log(`${checked} catalog-class receipt(s) checked.`)
if (failures.length) {
  console.log(`\n${failures.length} violation(s):`)
  for (const f of failures) console.log(`  - ${f}`)
  console.log('\nInstall the registry item (`npx shadcn add`), restyle the house primitive so it imports that file, then name the id. A cream box with the catalog name is not adapted.')
  process.exit(1)
}
console.log('OK - every claimed catalog id is installed and imported.')
