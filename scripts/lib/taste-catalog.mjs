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
 * catalog as a second design system is refused. A missing house primitive is
 * a NEW file in the v3 barrel (OPEN set), not a skip.
 */
import { readFileSync } from 'node:fs'
import { isNonEmptyString, isPlainObject } from './taste-receipt.mjs'

export const CATALOG_PATH = 'design_system/public/taste-catalog.json'
export const CATALOG_KINDS = Object.freeze(['house', 'admin', 'external'])

/** The five URLs from EXM7777. All must be in catalogUrls. */
export const EXM7777_URLS = Object.freeze([
  'https://beautifului.dev',
  'https://beui.dev',
  'https://rareui.com',
  'https://transitions.dev',
  'https://ui.shadcn.com',
])
export const EXM7777_IDS = Object.freeze(['beautifului', 'beui', 'rareui', 'transitions', 'shadcn'])

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
  const catalogUrls = Array.isArray(raw.catalogUrls) ? raw.catalogUrls.map((u) => String(u).replace(/\/$/, '')) : []
  for (const u of EXM7777_URLS) {
    if (!catalogUrls.includes(u)) problems.push(`catalogUrls must include ${u}`)
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
    const primitivesToAdd = Array.isArray(entry.primitivesToAdd)
      ? entry.primitivesToAdd.filter((n) => isNonEmptyString(n))
      : []
    classes[key] = { layoutLock: entry.layoutLock ?? '', modules, primitivesToAdd }
  }
  for (const required of ['listing-detail', 'homepage-v6', 'search', 'sell', 'city']) {
    if (!classes[required]) problems.push(`classes must include "${required}" so a lane has a catalog, not adjectives`)
  }
  if (!classes['listing-detail']?.primitivesToAdd?.includes('V3Carousel')) {
    problems.push('classes.listing-detail.primitivesToAdd must include V3Carousel — missing house primitive is a new barrel file, not a skip')
  }
  if (!classes['listing-detail']?.primitivesToAdd?.includes('V3ButtonGroup')) {
    problems.push('classes.listing-detail.primitivesToAdd must include V3ButtonGroup')
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
  if (shadcnComponents.length < 50) {
    problems.push('shadcn.components must be the fetched ui.shadcn.com/docs/components list (50+ names)')
  }

  const catalogIds = new Set(catalogs.map((c) => c.id))
  for (const id of EXM7777_IDS) {
    if (!catalogIds.has(id)) problems.push(`catalogs must include "${id}" (EXM7777 set)`)
  }

  const lists = {}
  const listsRaw = isPlainObject(raw.lists) ? raw.lists : {}
  for (const id of EXM7777_IDS) {
    if (id === 'shadcn') continue
    const block = listsRaw[id]
    const minById = { beautifului: 20, beui: 40, rareui: 15, transitions: 25 }
    const min = minById[id] ?? 3
    if (!isPlainObject(block) || !Array.isArray(block.components) || block.components.length < min) {
      problems.push(`lists.${id} must freeze the fetched catalog (${min}+ named components), not a handful`)
      continue
    }
    const components = []
    for (const [i, c] of block.components.entries()) {
      if (!isPlainObject(c) || !isNonEmptyString(c.name) || !isNonEmptyString(c.url)) {
        problems.push(`lists.${id}.components[${i}]: need name and url`)
        continue
      }
      const surfaces = Array.isArray(c.surfaces)
        ? c.surfaces.filter((s) => ['public', 'admin', 'product'].includes(s))
        : c.take === true
          ? ['public']
          : []
      components.push({
        name: c.name,
        url: c.url,
        take: c.take === true,
        surfaces,
        jobs: Array.isArray(c.jobs) ? c.jobs.filter((j) => isNonEmptyString(j)) : [],
      })
    }
    lists[id] = { url: block.url ?? EXM7777_URLS[EXM7777_IDS.indexOf(id)], components }
  }

  const routeClasses = {}
  const routeRaw = isPlainObject(raw.routeClasses) ? raw.routeClasses : {}
  for (const [routeKey, mapped] of Object.entries(routeRaw)) {
    if (isNonEmptyString(routeKey) && isNonEmptyString(mapped)) routeClasses[routeKey] = mapped
  }

  return {
    source: raw.source,
    catalogUrls,
    catalogUrl: isNonEmptyString(raw.catalogUrl) ? raw.catalogUrl : null,
    refuse: Array.isArray(raw.refuse) ? raw.refuse : [],
    catalogs,
    classes,
    lists,
    routeClasses,
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

/** Takeable modules from beautifului / beui / rareui / transitions for this class. */
export function listPicksForClass(catalog, classKey) {
  if (!isPlainObject(catalog?.lists) || !isNonEmptyString(classKey)) return []
  const prefix = `${classKey}:`
  const out = []
  for (const [listId, block] of Object.entries(catalog.lists)) {
    for (const c of block.components ?? []) {
      if (!c.take) continue
      if (!c.jobs.some((j) => j === classKey || j.startsWith(prefix))) continue
      out.push({ listId, name: c.name, url: c.url, id: `${listId}:${c.name}` })
    }
  }
  return out
}

export function layoutLockForClass(catalog, classKey) {
  return catalog.classes?.[classKey]?.layoutLock ?? null
}

export function classForRoute(catalog, routeKey) {
  if (!isPlainObject(catalog) || !isNonEmptyString(routeKey)) return null
  const mapped = catalog.routeClasses?.[routeKey]
  if (isNonEmptyString(mapped) && catalog.classes?.[mapped]) return mapped
  if (catalog.classes?.[routeKey]) return routeKey
  return null
}

export function primitivesToAddForClass(catalog, classKey) {
  if (!isPlainObject(catalog) || !isNonEmptyString(classKey)) return []
  const list = catalog.classes?.[classKey]?.primitivesToAdd
  return Array.isArray(list) ? list : []
}

/**
 * Short prompt the evaluator and the table inject so a node is judged against
 * the catalog, not against "clean". Keep it short — the grok CLI prompt budget
 * is the shots plus this, not the whole inventory.
 */
export function evaluatorBrief(catalog, classKey) {
  const key = isNonEmptyString(classKey) ? classKey : ''
  const lock = layoutLockForClass(catalog, key)
  const modules = modulesForClass(catalog, key)
  const shadcn = shadcnPicksForClass(catalog, key)
  const lists = listPicksForClass(catalog, key)
  const add = primitivesToAddForClass(catalog, key)
  const lines = [
    'CATALOG (Machina / EXM7777). Fetch the named module, adapt the JOB into the house barrel. Do not install a second look. Growing components/site/v3 with a new primitive IS the OPEN pattern set. A second kit, a second stylesheet, or a catalog palette on a public page is Frankenstein.',
    'Registers: public = components/site/v3 (tokens.css). Admin = components/admin/v2. Product/console/account = components/ui (npx shadcn add allowed there only).',
  ]
  if (lock) lines.push(`Layout lock: ${lock}`)
  if (add.length) lines.push(`If missing, ADD these house primitives: ${add.join(', ')}.`)
  for (const m of modules) lines.push(`- ${m.id}: ${m.job} (${m.url})`)
  for (const c of shadcn.slice(0, 8)) lines.push(`- shadcn:${c.name} ${c.docs}`)
  for (const c of lists.slice(0, 12)) lines.push(`- ${c.id} ${c.url}`)
  lines.push(
    'A stacked-section page that ignored this catalog is a defect. Name replaceWith as a house primitive (V3Carousel, V3ButtonGroup, V3Sheet, V3Segmented, …) or a catalog module id. Refuse purple, orbs, gooey, magnetic/metallic buttons, and agent-chat chrome on a public page. Navy #102742, cream #faf8f4, Geist, Amboqia stay.',
  )
  return lines.join('\n')
}

/**
 * A lane that built a NEW or REPLACED section must name the module it adapted.
 * Empty is a miss — that is how SITE-45 invented a column hero from an adjective.
 */
export function adaptedFromProblems(catalog, classKey, adaptedFrom) {
  const modules = modulesForClass(catalog, classKey)
  const shadcn = shadcnPicksForClass(catalog, classKey)
  const lists = listPicksForClass(catalog, classKey)
  if (modules.length === 0 && shadcn.length === 0 && lists.length === 0) {
    return [`no catalog modules for class "${classKey}"`]
  }
  if (!Array.isArray(adaptedFrom) || adaptedFrom.length === 0) {
    return ['adaptedFrom is empty — fetch a catalog module before building; do not invent a layout']
  }
  const allowed = new Set([
    ...modules.flatMap((m) => [m.id, m.url]),
    ...shadcn.flatMap((c) => [c.name, `shadcn:${c.name}`, c.docs]),
    ...lists.flatMap((c) => [c.id, c.name, c.url, `${c.listId}:${c.name}`]),
    ...primitivesToAddForClass(catalog, classKey),
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
  // Third-party registries and named novelty kits onto the public tree = Frankenstein.
  // `npx shadcn add carousel` into components/ui (console/account) is the product path.
  if (/npx shadcn add\s+@/i.test(blob)) return true
  if (/npx shadcn add.+(?:app\/|components\/site\/)/i.test(blob)) return true
  return /(?:^|[^\w])(@beui\/|@rare-ui|magicui|aceternity|fluid-orb|gravity.?letter)/i.test(blob)
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
    console.log(
      JSON.stringify(
        { catalogUrls: loaded.catalogUrls, catalogs: loaded.catalogs.map((c) => ({ id: c.id, url: c.url })), classes: Object.keys(loaded.classes) },
        null,
        2,
      ),
    )
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
        catalogUrls: loaded.catalogUrls,
        catalogUrl: loaded.catalogUrl,
        layoutLock: layoutLockForClass(loaded, classKey),
        modules,
        shadcn: shadcnPicksForClass(loaded, classKey),
        lists: listPicksForClass(loaded, classKey),
        primitivesToAdd: primitivesToAddForClass(loaded, classKey),
        evaluatorBrief: evaluatorBrief(loaded, classKey),
        refuse: loaded.refuse,
        fetch:
          'Fetch the five EXM7777 catalogs. Open each named module URL. Adapt the JOB into the house barrel. If the job has no house primitive, ADD one to components/site/v3 (public) or components/admin/v2 (admin). Do not npm-install a catalog onto app/ or components/site/. Navy, cream, Geist, Amboqia stay.',
      },
      null,
      2,
    ),
  )
}

if (process.argv[1] && process.argv[1].endsWith('taste-catalog.mjs')) main()
