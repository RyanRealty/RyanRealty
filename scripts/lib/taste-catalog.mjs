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
 * BUILDER CARD (house files to open, ≤8 catalog URLs to fetch AND install,
 * primitives still missing from the barrel), and records which one it adapted.
 * The five sites are the UX bar (Matt 2026-09-10): install the real source,
 * restyle navy/cream/Geist/Amboqia/Iconoir, keep the interaction. A cream box
 * with the catalog name is not adapted. catalogUrls is a floor of five, then
 * any URL Matt pastes. A missing house primitive is a NEW v3 file that still
 * matches the demo. Submoduling a catalog's demo app is refused.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isNonEmptyString, isPlainObject } from './taste-receipt.mjs'

/** Remote catalog URLs a lane fetches for one class. The rest of the inventory stays in the JSON. */
export const BUILDER_FETCH_CAP = 8

export const CATALOG_PATH = 'design_system/public/taste-catalog.json'
export const CATALOG_KINDS = Object.freeze(['house', 'admin', 'external'])

/** Floor of five (EXM7777). catalogUrls may grow; it must never drop these. */
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
    const layoutLockChecks = []
    for (const [k, c] of (Array.isArray(entry.layoutLockChecks) ? entry.layoutLockChecks : []).entries()) {
      if (!isPlainObject(c) || !isNonEmptyString(c.path)) {
        problems.push(`classes.${key}.layoutLockChecks[${k}]: need path`)
        continue
      }
      if (!isNonEmptyString(c.mustMatch) && !isNonEmptyString(c.forbid)) {
        problems.push(`classes.${key}.layoutLockChecks[${k}]: need mustMatch or forbid`)
        continue
      }
      layoutLockChecks.push({
        path: c.path,
        mustMatch: isNonEmptyString(c.mustMatch) ? c.mustMatch : null,
        forbid: isNonEmptyString(c.forbid) ? c.forbid : null,
      })
    }
    const demoStates = Array.isArray(entry.demoStates)
      ? entry.demoStates.filter((s) => isNonEmptyString(s))
      : []
    classes[key] = { layoutLock: entry.layoutLock ?? '', modules, primitivesToAdd, layoutLockChecks, demoStates }
  }
  for (const required of ['listing-detail', 'homepage-v6', 'search', 'sell', 'city']) {
    if (!classes[required]) problems.push(`classes must include "${required}" so a lane has a catalog, not adjectives`)
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

  const installById = {}
  const installRaw = isPlainObject(raw.installById) ? raw.installById : {}
  for (const [id, spec] of Object.entries(installRaw)) {
    if (!isNonEmptyString(id) || !isPlainObject(spec)) {
      problems.push(`installById.${id}: not an object`)
      continue
    }
    if (isNonEmptyString(spec.aliasOf)) {
      installById[id] = { aliasOf: spec.aliasOf }
      continue
    }
    if (!isNonEmptyString(spec.add) || !isNonEmptyString(spec.file) || !isNonEmptyString(spec.import)) {
      problems.push(`installById.${id}: need add, file, and import`)
      continue
    }
    installById[id] = {
      add: spec.add,
      file: spec.file,
      import: spec.import,
      house: isNonEmptyString(spec.house) ? spec.house : null,
    }
  }
  if (Object.keys(installById).length > 0) {
    if (!resolveInstallSpec(installById, 'shadcn-carousel')) {
      problems.push('installById must include shadcn-carousel (the smoking-gun wrap)')
    }
    if (!resolveInstallSpec(installById, 'beui-morphing-search')) {
      problems.push('installById must include beui-morphing-search')
    }
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
    installById,
    problems,
  }
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

function fileImportsSpecifier(src, specifier) {
  const needle = String(specifier ?? '')
  if (!needle || !src) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)\\s*import(?:[\\s\\S]{0,400}?)from\\s+['"]${escaped}['"]`).test(src)
}

/**
 * A catalog adaptedFrom id is only real when the installed file exists and
 * the house primitive (or the scanned route files) imports it. A comment is
 * not an import. motion/react on a wrapper is not the catalog component.
 */
export function catalogInstallProblems(catalog, adaptedFrom, io = {}) {
  const exists = io.existsSync ?? existsSync
  const read = io.readFileSync ?? readFileSync
  const extraFiles = Array.isArray(io.scanFiles) ? io.scanFiles : []
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
  }
  return problems
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

/**
 * Every public page class the table can seed must map to a catalog class
 * with modules. A new SITE node for a class with no catalog invents a layout.
 */
export function catalogCoverageProblems(catalog, classKeys) {
  const keys = Array.isArray(classKeys) ? classKeys.filter((k) => isNonEmptyString(k)) : []
  const problems = []
  for (const key of keys) {
    const mapped = classForRoute(catalog, key)
    if (!mapped) {
      problems.push(
        `taste class "${key}" has no catalog class — a new SITE node would invent a layout. Add classes.${key} or routeClasses["${key}"].`,
      )
      continue
    }
    const modules = catalog.classes?.[mapped]?.modules
    if (!Array.isArray(modules) || modules.length < 2) {
      problems.push(`catalog class "${mapped}" (for ${key}) needs at least two modules (house + something to beat)`)
    }
  }
  return problems
}

export function primitivesToAddForClass(catalog, classKey) {
  if (!isPlainObject(catalog) || !isNonEmptyString(classKey)) return []
  const list = catalog.classes?.[classKey]?.primitivesToAdd
  return Array.isArray(list) ? list : []
}

/** True when the named v3 primitive already exists as a barrel file. */
export function housePrimitiveExists(name) {
  if (!isNonEmptyString(name)) return false
  return existsSync(`components/site/v3/${name}.tsx`) || existsSync(`components/site/v3/${name}.client.tsx`)
}

/** primitivesToAdd minus files already in the barrel — the gap the lane still owes. */
export function missingPrimitivesForClass(catalog, classKey) {
  return primitivesToAddForClass(catalog, classKey).filter((n) => !housePrimitiveExists(n))
}

/**
 * The card a lane actually works from. House files to open, catalog jobs to
 * fetch (capped). Not the whole inventory.
 */
export function builderCard(catalog, classKey) {
  const key = classForRoute(catalog, classKey) || (isNonEmptyString(classKey) ? classKey : '')
  const modules = modulesForClass(catalog, key)
  const add = missingPrimitivesForClass(catalog, key)
  const open = []
  const remote = []
  for (const m of modules) {
    const http = String(m.url ?? '').startsWith('http')
    const row = { id: m.id, url: m.url, job: m.job }
    if (http) remote.push(row)
    else open.push({ id: m.id, path: m.url, job: m.job })
  }
  for (const c of shadcnPicksForClass(catalog, key)) {
    remote.push({ id: `shadcn:${c.name}`, url: c.docs, job: (c.jobs && c.jobs[0]) || c.name })
  }
  for (const c of listPicksForClass(catalog, key)) {
    remote.push({ id: c.id, url: c.url, job: c.name })
  }
  const seen = new Set()
  const fetch = []
  for (const row of remote) {
    if (!row?.id || seen.has(row.id) || seen.has(row.url)) continue
    seen.add(row.id)
    seen.add(row.url)
    fetch.push(row)
    if (fetch.length >= BUILDER_FETCH_CAP) break
  }
  return {
    classKey: key,
    layoutLock: layoutLockForClass(catalog, key),
    open,
    fetch,
    add,
    demoStates: demoStateSpecs(catalog, key),
    refuse: Array.isArray(catalog?.refuse) ? catalog.refuse : [],
  }
}

export function formatBuilderCard(card) {
  const lines = [`# ${card.classKey || '(no class)'}`, '']
  if (card.layoutLock) lines.push(`Layout lock: ${card.layoutLock}`, '')
  lines.push('## Open these house files')
  if (card.open.length === 0) lines.push('- (none named)')
  else for (const o of card.open) lines.push(`- ${o.path} — ${o.job}`)
  lines.push('', '## Fetch these catalog jobs (install the source; restyle tokens; keep the interaction)')
  if (card.fetch.length === 0) lines.push('- (none named)')
  else for (const f of card.fetch) lines.push(`- ${f.id}: ${f.job}  ${f.url}`)
  if (card.add.length) {
    lines.push('', '## If missing, ADD to components/site/v3')
    for (const a of card.add) lines.push(`- ${a}`)
  }
  if (card.refuse.length) {
    lines.push('', '## Refuse')
    for (const r of card.refuse) lines.push(`- ${r}`)
  }
  lines.push('', '## Comprehensive pass (all three, or not done)')
  lines.push('- SEO increment: title, JSON-LD, crawlable internal links, and/or payload/LCP better than HEAD.')
  lines.push('- Information increment: listing cards show price + address + beds/baths/sqft; listing detail keeps the 13-row house contract; sourced figures stay.')
  lines.push('- UX increment: install the catalog jobs above (`npx shadcn add`); demo match; navy/cream.')
  lines.push('', 'Record adaptedFrom with the ids you used. Empty adaptedFrom is inventing a layout.')
  lines.push('ci:catalog-install fails a named catalog id whose file is missing or whose house primitive does not import it.')
  lines.push('Rebaseline is not done. A taste score below 70 is not done.')
  if (Array.isArray(card.demoStates) && card.demoStates.length) {
    lines.push(`Demo-match shots (take-route-shots captures these without --states): ${card.demoStates.join('; ')}`)
  }
  return lines.join('\n')
}

/**
 * Short prompt the evaluator injects. Jobs, not the inventory dump.
 */
export function evaluatorBrief(catalog, classKey) {
  const card = builderCard(catalog, classKey)
  const lock = card.layoutLock ? String(card.layoutLock).slice(0, 280) : ''
  const lines = [
    'COMPREHENSIVE LOOP: SEO, listing/page information, and UX all rise on the same pass. A prettier page with no SEO increment and no inventory increment is not done. Blocking if a title, JSON-LD, crawlable link, ask, sourced figure, required section, or listing fact is worse than HEAD.',
    'CATALOG is the UX bar. Diagnose the JOB from our shots, then pick replaceWith from the option list below (id + demo URL). Do not invent a house primitive that already lost. A cream box with the catalog name is a defect — open the demo and our control; a person must recognize the same interaction. Growing v3 with a new primitive that still matches the demo is the OPEN set; a second kit (their Inter/purple/demo app) is Frankenstein.',
  ]
  if (lock) lines.push(`Layout lock: ${lock}`)
  if (card.add.length) lines.push(`House primitives this class owes: ${card.add.join(', ')}.`)
  for (const o of card.open.slice(0, 5)) lines.push(`- ${o.id}: ${o.job}`)
  for (const f of card.fetch.slice(0, 6)) {
    lines.push(`- ${f.id}: ${f.job}  ${f.url}`)
  }
  lines.push(
    'Each defect names replaceWith from that list, or null if the finding is craft/honesty/SEO not form. Refuse purple, orbs, gooey, magnetic buttons, agent-chat chrome on public, and 320x240 Spark thumbs on a card/hero. Navy #102742, cream #faf8f4, Geist, Amboqia stay.',
  )
  return lines.join('\n')
}

/** Ids the evaluator may put on replaceWith for this class (card open + fetch + add). */
export function optionListIds(catalog, classKey) {
  const ids = new Set()
  const key = classForRoute(catalog, classKey) || (isNonEmptyString(classKey) ? classKey : '')
  if (!key) return ids
  const card = builderCard(catalog, key)
  for (const o of card.open ?? []) if (o?.id) ids.add(o.id)
  for (const f of card.fetch ?? []) if (f?.id) ids.add(f.id)
  for (const a of card.add ?? []) if (a) ids.add(a)
  for (const m of modulesForClass(catalog, key)) if (m?.id) ids.add(m.id)
  for (const [id, spec] of Object.entries(catalog?.installById ?? {})) {
    if (ids.has(id) && spec && isNonEmptyString(spec.aliasOf)) ids.add(spec.aliasOf)
    if (spec && isNonEmptyString(spec.aliasOf) && ids.has(spec.aliasOf)) ids.add(id)
  }
  return ids
}

/** Capture specs (`name=SEL!click`) the shot tool runs so the evaluator can see the demo. */
export function demoStateSpecs(catalog, routeKey) {
  const key = classForRoute(catalog, routeKey) || (isNonEmptyString(routeKey) ? routeKey : '')
  const list = catalog?.classes?.[key]?.demoStates
  return Array.isArray(list) ? list.filter((s) => isNonEmptyString(s)) : []
}

/**
 * replaceWith must be on the builder-card option list, or null for craft/honesty/SEO.
 * A house primitive that already lost (V3Pulse on home) is how cream boxes close.
 */
export function replaceWithOptionProblems(catalog, classKey, tr) {
  if (!isPlainObject(tr) || !Array.isArray(tr.defects)) return []
  const allowed = optionListIds(catalog, classKey)
  if (allowed.size === 0) return []
  const p = []
  for (const [i, d] of tr.defects.entries()) {
    if (!isPlainObject(d) || !('replaceWith' in d)) continue
    if (d.replaceWith == null) continue
    if (!isNonEmptyString(d.replaceWith)) {
      p.push(`defects[${i}] replaceWith must be a module id or null`)
      continue
    }
    if (!allowed.has(d.replaceWith)) {
      p.push(
        `defects[${i}] (${d.section ?? '?'}) replaceWith "${d.replaceWith}" is not on the option list for ${classKey}. Pick an id from the builder card (catalog job or house module), or null if craft/honesty/SEO not form.`,
      )
    }
  }
  return p
}

/** A receipt on a catalog class must name the modules it adapted, and each defect names replaceWith. */
export function catalogReceiptProblems(catalog, classKey, tr) {
  if (!isPlainObject(catalog) || !isNonEmptyString(classKey) || !catalog.classes?.[classKey]) return []
  const p = adaptedFromProblems(catalog, classKey, isPlainObject(tr) ? tr.adaptedFrom : null)
  if (!isPlainObject(tr) || !Array.isArray(tr.defects)) return p
  for (const [i, d] of tr.defects.entries()) {
    if (!isPlainObject(d)) continue
    if (!('replaceWith' in d)) {
      p.push(
        `defects[${i}] (${d.section ?? '?'}) needs replaceWith: a house primitive or catalog id, or null if the finding is craft/honesty not form`,
      )
    } else if (d.replaceWith != null && !isNonEmptyString(d.replaceWith)) {
      p.push(`defects[${i}] replaceWith must be a module id or null`)
    }
  }
  return p
}

/**
 * Mechanical layout lock: the files that must still contain (or must not
 * reintroduce) the locked form. SITE-45 was `heroInMain` on the listing pages.
 */
export function layoutLockProblems(catalog, io = {}) {
  const exists = io.existsSync ?? existsSync
  const read = io.readFileSync ?? readFileSync
  const problems = []
  for (const [key, entry] of Object.entries(catalog?.classes ?? {})) {
    for (const c of entry.layoutLockChecks ?? []) {
      if (!exists(c.path)) {
        problems.push(`${key} layout lock: ${c.path} is missing`)
        continue
      }
      let src = ''
      try {
        src = String(read(c.path, 'utf8') ?? '')
      } catch {
        problems.push(`${key} layout lock: ${c.path} could not be read`)
        continue
      }
      if (c.mustMatch) {
        try {
          if (!new RegExp(c.mustMatch).test(src)) {
            problems.push(`${key} layout lock: ${c.path} must still match /${c.mustMatch}/`)
          }
        } catch {
          problems.push(`${key} layout lock: mustMatch /${c.mustMatch}/ is not a valid regex`)
        }
      }
      if (c.forbid) {
        try {
          if (new RegExp(c.forbid).test(src)) {
            problems.push(
              `${key} layout lock: ${c.path} reintroduced /${c.forbid}/ — that is the SITE-45 shrink. Restore the locked layout.`,
            )
          }
        } catch {
          problems.push(`${key} layout lock: forbid /${c.forbid}/ is not a valid regex`)
        }
      }
    }
  }
  return problems
}

/** House files exist and the class layout lock still holds. Run before composing. */
export function preflightProblems(catalog, classKey) {
  const card = builderCard(catalog, classKey)
  const p = []
  for (const o of card.open) {
    if (o.path && !existsSync(o.path)) p.push(`house file missing: ${o.path}`)
  }
  const prefix = `${classKey} layout lock:`
  for (const row of layoutLockProblems(catalog, { existsSync, readFileSync })) {
    if (row.startsWith(prefix)) p.push(row)
  }
  return p
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
  // Installing source into components/ui or v3, then restyling, is the path.
  // Writing a catalog onto app/ or as a second public kit is Frankenstein.
  if (/npx shadcn add.+(?:app\/|components\/site\/(?!v3))/i.test(blob)) return true
  if (/git submodule.+(beui|rare-ui|beautiful-ui|transitions)/i.test(blob)) return true
  return /(?:fluid-orb|gravity.?letter|tilt-card|shader-background|cylinder-carousel|magnetic button)/i.test(
    blob,
  )
}

function main() {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  const loaded = loadTasteCatalog(raw)
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const preflight = argv.includes('--preflight')
  const classKey = argv.find((a) => a && !a.startsWith('--'))
  if (loaded.problems.length) {
    console.error(loaded.problems.join('\n'))
    process.exit(2)
  }
  if (!classKey) {
    const payload = {
      catalogUrls: loaded.catalogUrls,
      catalogs: loaded.catalogs.map((c) => ({ id: c.id, url: c.url })),
      classes: Object.keys(loaded.classes),
    }
    console.log(
      asJson
        ? JSON.stringify(payload, null, 2)
        : `classes: ${payload.classes.join(', ')}\npass a class for the builder card, e.g. node scripts/lib/taste-catalog.mjs listing-detail --preflight`,
    )
    return
  }
  const resolved = classForRoute(loaded, classKey) ?? classKey
  const modules = modulesForClass(loaded, resolved)
  if (modules.length === 0) {
    console.error(`taste-catalog: no modules for "${classKey}"`)
    process.exit(2)
  }
  const card = builderCard(loaded, resolved)
  if (preflight) {
    const issues = preflightProblems(loaded, resolved)
    if (issues.length) {
      console.error(issues.join('\n'))
      process.exit(2)
    }
  }
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ...card,
          modules,
          shadcn: shadcnPicksForClass(loaded, resolved),
          lists: listPicksForClass(loaded, resolved),
          evaluatorBrief: evaluatorBrief(loaded, resolved),
          preflight: preflight ? 'ok' : undefined,
        },
        null,
        2,
      ),
    )
    return
  }
  console.log(formatBuilderCard(card))
  if (preflight) console.log('\npreflight OK')
}

if (process.argv[1] && process.argv[1].endsWith('taste-catalog.mjs')) main()
