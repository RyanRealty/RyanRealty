#!/usr/bin/env node
/**
 * taste-catalog.mjs — the Lego the loop fetches before it builds.
 *
 * Machina (@EXM7777, 2026-08-25): don't use a taste skill. Send the agent a
 * catalog URL, fetch the full list, integrate into the existing foundation.
 * https://x.com/EXM7777/status/2092250905655812121
 *
 * This module is that contract for Ryan Realty: the catalog lives at
 * design_system/public/taste-catalog.json. A lane names the class, gets the
 * modules it must fetch, and records which one it adapted. Installing the
 * catalog as a second design system is refused.
 */
import { readFileSync } from 'node:fs'
import { isNonEmptyString, isPlainObject } from './taste-receipt.mjs'

export const CATALOG_PATH = 'design_system/public/taste-catalog.json'
export const CATALOG_KINDS = Object.freeze(['house', 'admin', 'external'])

export function loadTasteCatalog(raw) {
  const problems = []
  if (!isPlainObject(raw)) {
    return { catalogs: [], classes: {}, problems: ['taste-catalog.json must be an object.'] }
  }
  if (!isNonEmptyString(raw.source) || !/^https:\/\/x\.com\//.test(raw.source)) {
    problems.push('source must be the X post URL')
  }
  if (!Array.isArray(raw.refuse) || raw.refuse.length < 3) {
    problems.push('refuse must name at least three hard nos')
  }
  const catalogs = []
  const seen = new Set()
  for (const [i, c] of (Array.isArray(raw.catalogs) ? raw.catalogs : []).entries()) {
    if (!isPlainObject(c)) {
      problems.push(`catalogs[${i}]: not an object`)
      continue
    }
    if (!isNonEmptyString(c.id) || seen.has(c.id)) {
      problems.push(`catalogs[${i}]: missing or duplicate id`)
      continue
    }
    if (!CATALOG_KINDS.includes(c.kind)) problems.push(`"${c.id}": kind must be house | admin | external`)
    if (!isNonEmptyString(c.url)) problems.push(`"${c.id}": missing url`)
    if (!isNonEmptyString(c.take, 20)) problems.push(`"${c.id}": take must say what we copy, 20+ characters`)
    if (!isNonEmptyString(c.refuse, 10)) problems.push(`"${c.id}": refuse must say what we do not install`)
    seen.add(c.id)
    catalogs.push({
      id: c.id,
      name: String(c.name ?? c.id),
      url: c.url,
      kind: c.kind,
      take: c.take,
      refuse: c.refuse,
    })
  }
  const classes = {}
  for (const [key, entry] of Object.entries(isPlainObject(raw.classes) ? raw.classes : {})) {
    if (!isPlainObject(entry)) {
      problems.push(`classes.${key}: not an object`)
      continue
    }
    if (!isNonEmptyString(entry.layoutLock, 40)) {
      problems.push(`classes.${key}: layoutLock must name the layout that must not shrink, 40+ characters`)
    }
    const modules = []
    for (const [j, m] of (Array.isArray(entry.modules) ? entry.modules : []).entries()) {
      if (!isPlainObject(m) || !isNonEmptyString(m.id) || !isNonEmptyString(m.url) || !isNonEmptyString(m.job, 20)) {
        problems.push(`classes.${key}.modules[${j}]: need id, url, and a 20+ character job`)
        continue
      }
      modules.push({ id: m.id, catalog: m.catalog ?? null, url: m.url, job: m.job })
    }
    if (modules.length < 2) problems.push(`classes.${key}: need at least two modules (house + something to beat)`)
    classes[key] = { layoutLock: entry.layoutLock ?? '', modules }
  }

  const shadcnRaw = isPlainObject(raw.shadcn) ? raw.shadcn : {}
  const shadcnComponents = []
  for (const [i, c] of (Array.isArray(shadcnRaw.components) ? shadcnRaw.components : []).entries()) {
    if (!isPlainObject(c) || !isNonEmptyString(c.name)) {
      problems.push(`shadcn.components[${i}]: need a name`)
      continue
    }
    shadcnComponents.push({
      name: c.name,
      docs: `https://ui.shadcn.com/docs/components/${c.name}`,
      installed: isNonEmptyString(c.installed) ? c.installed : null,
      jobs: Array.isArray(c.jobs) ? c.jobs.filter((j) => isNonEmptyString(j)) : [],
    })
  }
  if (shadcnComponents.length < 20) problems.push('shadcn.components must be the fetched list from ui.shadcn.com/docs/components (20+ names)')

  return {
    source: raw.source,
    catalogUrl: isNonEmptyString(raw.catalogUrl) ? raw.catalogUrl : null,
    refuse: Array.isArray(raw.refuse) ? raw.refuse : [],
    catalogs,
    classes,
    shadcn: { docs: shadcnRaw.docs ?? 'https://ui.shadcn.com/docs/components', components: shadcnComponents },
    problems,
  }
}

export function modulesForClass(catalog, classKey) {
  if (!isPlainObject(catalog) || !isNonEmptyString(classKey)) return []
  return catalog.classes?.[classKey]?.modules ?? []
}

/** shadcn components whose `jobs` start with this class. The EXM7777 fetch-the-list step. */
export function shadcnPicksForClass(catalog, classKey) {
  const list = catalog?.shadcn?.components
  if (!Array.isArray(list) || !isNonEmptyString(classKey)) return []
  const prefix = `${classKey}:`
  return list.filter((c) => c.jobs.some((j) => j === classKey || j.startsWith(prefix)))
}

export function layoutLockForClass(catalog, classKey) {
  return catalog.classes?.[classKey]?.layoutLock ?? null
}

/**
 * A lane that built a NEW or REPLACED section must name the module it adapted.
 * Empty is a miss — that is how SITE-45 invented a column hero from an adjective.
 */
export function adaptedFromProblems(catalog, classKey, adaptedFrom) {
  const modules = modulesForClass(catalog, classKey)
  const shadcn = shadcnPicksForClass(catalog, classKey)
  if (modules.length === 0 && shadcn.length === 0) return [`no catalog modules for class "${classKey}"`]
  if (!Array.isArray(adaptedFrom) || adaptedFrom.length === 0) {
    return ['adaptedFrom is empty — fetch a catalog module before building; do not invent a layout']
  }
  const allowed = new Set([
    ...modules.flatMap((m) => [m.id, m.url]),
    ...shadcn.flatMap((c) => [c.name, `shadcn:${c.name}`, c.docs]),
  ])
  const problems = []
  for (const [i, hit] of adaptedFrom.entries()) {
    const id = isPlainObject(hit) ? hit.id : hit
    if (!isNonEmptyString(id) || !allowed.has(id)) {
      problems.push(`adaptedFrom[${i}] "${id}" is not a module for ${classKey}`)
    }
  }
  return problems
}

export function publicInstallForbidden(text) {
  const blob = String(text ?? '')
  return /npx shadcn add|@beui\/|@rare-ui|magicui|aceternity|fluid-orb|gravity.?letter/i.test(blob)
}

function main() {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  const loaded = loadTasteCatalog(raw)
  const classKey = process.argv[2]
  if (loaded.problems.length) {
    console.error(loaded.problems.join('\n'))
    process.exit(2)
  }
  if (!classKey) {
    console.log(JSON.stringify({ catalogs: loaded.catalogs.map((c) => c.id), classes: Object.keys(loaded.classes) }, null, 2))
    return
  }
  const modules = modulesForClass(loaded, classKey)
  if (modules.length === 0) {
    console.error(`taste-catalog: no modules for "${classKey}"`)
    process.exit(2)
  }
  console.log(
    JSON.stringify(
      {
        classKey,
        catalogUrl: loaded.catalogUrl,
        layoutLock: layoutLockForClass(loaded, classKey),
        modules,
        shadcn: shadcnPicksForClass(loaded, classKey),
        refuse: loaded.refuse,
        fetch:
          'Fetch each shadcn docs URL (or the local installed file). Adapt into v3. Do not npx shadcn add onto app/ or components/site/.',
      },
      null,
      2,
    ),
  )
}

if (process.argv[1] && process.argv[1].endsWith('taste-catalog.mjs')) main()
