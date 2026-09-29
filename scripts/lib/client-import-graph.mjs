/**
 * Static import graph for the CLIENT bundle: which 'use client' files can reach
 * a given module, and by which chain.
 *
 * Built for ci:server-only-imports (G43), whose direct-import rule missed the
 * transitive case that shipped data/resort-communities.json (~44 KB minified)
 * into 26 client route chunks (1.15 MB, 2026-09-29): a client component imports
 * lib/search-filters, which imports lib/neighborhood-areas, which imports the
 * JSON. No client file imported the JSON, so the direct rule never fired.
 *
 * What the model follows, and why:
 *   - roots: files whose first statement is 'use client' (the real client
 *     boundary; a server component that imports a heavy module is fine).
 *   - value imports, `export ... from`, dynamic `import()` and `require()`.
 *     Dynamic imports still land in a client chunk, so they count.
 *   - NOT `import type` / `import { type X }` / `export type`: erased.
 *   - 'use server' files are a boundary. A client import of a server-action
 *     module is replaced by a reference stub, so its imports never ship.
 *   - barrels are followed by NAME. package.json declares sideEffects, so an
 *     import of `{ A }` from a pure re-export barrel pulls only A's module, not
 *     every module the barrel lists. Following the whole barrel would report
 *     paths that do not ship.
 *
 * Deliberately conservative where the truth needs a real bundler (a namespace
 * import follows everything; `export *` follows every target). The bundle
 * budget stays the ground truth; this is the cheap early guard.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'

const DEFAULT_DIRS = ['app', 'components', 'lib', 'hooks', 'data', 'contexts', 'context']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', '.claude', 'public', 'docs', 'supabase'])
const CODE = /\.(tsx?|jsx?|mjs|json)$/
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js']

const ALL = '*'

const DIRECTIVE = (word) =>
  new RegExp(`^\\s*(?:(?:\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)\\s*)*['"]${word}['"]`)
const USE_CLIENT = DIRECTIVE('use client')
const USE_SERVER = DIRECTIVE('use server')

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

/** `Def, { a as b, type C }` / `* as N` / `{ a }` -> names, or null when type-only. */
function clauseNames(clause) {
  const c = clause.trim()
  if (/\*\s*as\s/.test(c)) return [ALL]
  const names = []
  const brace = c.match(/\{([^}]*)\}/)
  const head = brace ? c.slice(0, brace.index).replace(/,\s*$/, '').trim() : c
  if (head) names.push('default')
  if (brace) {
    for (const raw of brace[1].split(',')) {
      const item = raw.trim()
      if (!item || /^type\s/.test(item)) continue
      const local = item.split(/\s+as\s+/)[0].trim()
      names.push(local)
    }
  }
  return names.length > 0 ? names : null
}

function reexportItems(list) {
  const out = []
  for (const raw of list.split(',')) {
    const item = raw.trim()
    if (!item || /^type\s/.test(item)) continue
    const [local, exported] = item.split(/\s+as\s+/).map((s) => s.trim())
    out.push({ local, exported: exported ?? local })
  }
  return out
}

/**
 * @typedef {{ to: string, names: string[] }} Edge
 * @typedef {{ to: string, star: boolean, items: {local:string, exported:string}[], ns: boolean }} ReExport
 */

export function loadProject(root, { dirs = DEFAULT_DIRS } = {}) {
  const absRoot = resolve(root)
  const files = new Set()
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue
      const f = join(dir, e.name)
      if (e.isDirectory()) walk(f)
      else if (CODE.test(e.name) && !/\.d\.ts$/.test(e.name)) files.add(f)
    }
  }
  for (const d of dirs) {
    const p = join(absRoot, d)
    if (existsSync(p)) walk(p)
  }

  const resolveSpec = (from, spec) => {
    let base
    if (spec.startsWith('@/')) base = join(absRoot, spec.slice(2))
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
    else return null
    for (const s of RESOLVE_SUFFIXES) if (files.has(base + s)) return base + s
    return null
  }

  const parsed = new Map()
  const parse = (file) => {
    let p = parsed.get(file)
    if (p) return p
    p = { client: false, server: false, barrel: false, edges: [], reexports: [] }
    parsed.set(file, p)
    if (file.endsWith('.json')) return p
    const raw = readFileSync(file, 'utf8')
    p.client = USE_CLIENT.test(raw.slice(0, 4000))
    p.server = USE_SERVER.test(raw.slice(0, 4000))
    const src = stripComments(raw)

    const reRe = /export\s+(type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{([^}]*)\})\s*from\s*['"]([^'"]+)['"]\s*;?/g
    let m
    while ((m = reRe.exec(src))) {
      if (m[1]) continue
      const to = resolveSpec(file, m[3])
      if (!to) continue
      const whole = m[0]
      const star = /^export\s+\*/.test(whole)
      p.reexports.push({
        to,
        star: star && !/\*\s+as\s/.test(whole),
        ns: star && /\*\s+as\s/.test(whole),
        items: m[2] != null ? reexportItems(m[2]) : [],
      })
    }
    // Barrel = nothing but re-exports (and type exports).
    const residue = src
      .replace(reRe, '')
      .replace(/export\s+type\s+(?:\{[^}]*\}|\*)\s*from\s*['"][^'"]+['"]\s*;?/g, '')
      .replace(/export\s+type\s+\{[^}]*\}\s*;?/g, '')
      .replace(/^\s*(?:['"]use (?:client|server)['"];?)/, '')
      .trim()
    p.barrel = p.reexports.length > 0 && residue === ''

    const imRe = /(?:^|[;\n}])\s*import\s+(?!type[\s{*])([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g
    while ((m = imRe.exec(src))) {
      const names = clauseNames(m[1])
      if (!names) continue
      const to = resolveSpec(file, m[2])
      if (to) p.edges.push({ to, names })
    }
    const sideRe = /(?:^|[;\n}])\s*import\s*['"]([^'"]+)['"]/g
    while ((m = sideRe.exec(src))) {
      const to = resolveSpec(file, m[1])
      if (to) p.edges.push({ to, names: [ALL] })
    }
    const dynRe = /\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((m = dynRe.exec(src))) {
      const to = resolveSpec(file, m[1])
      if (to) p.edges.push({ to, names: [ALL] })
    }
    // A non-barrel file that also re-exports keeps its re-export targets live.
    if (!p.barrel) for (const r of p.reexports) p.edges.push({ to: r.to, names: [ALL] })
    return p
  }

  const roots = () => [...files].filter((f) => parse(f).client)
  return { root: absRoot, files, parse, roots, rel: (f) => relative(absRoot, f) }
}

/**
 * Shortest chain from every 'use client' root to `target`, one per root.
 * @returns {{ root: string, chain: string[] }[]} repo-relative paths
 */
export function clientPathsTo(project, target) {
  const tgt = resolve(project.root, target)
  const out = []
  for (const rootFile of project.roots()) {
    const chain = shortestChain(project, rootFile, tgt)
    if (chain) out.push({ root: project.rel(rootFile), chain: chain.map(project.rel) })
  }
  return out
}

function shortestChain(project, start, tgt) {
  // State = (file, name). name ALL means "the whole module is live".
  const prev = new Map()
  const key = (f, n) => `${f}\u0000${n}`
  const queue = [[start, ALL]]
  prev.set(key(start, ALL), null)
  while (queue.length > 0) {
    const [file, name] = queue.shift()
    if (file === tgt) {
      const chain = []
      let k = key(file, name)
      while (k) {
        const [f] = k.split('\u0000')
        if (chain[0] !== f) chain.unshift(f)
        k = prev.get(k)
      }
      return chain
    }
    const p = project.parse(file)
    if (p.server && file !== start) continue // 'use server' boundary: stub only
    const push = (to, n) => {
      // Only a barrel cares which name is asked for; anything else is live whole.
      if (!project.parse(to).barrel) n = ALL
      const k = key(to, n)
      if (prev.has(k)) return
      prev.set(k, key(file, name))
      queue.push([to, n])
    }
    if (p.barrel && name !== ALL) {
      // Only the re-exports that provide `name`.
      let matched = false
      for (const r of p.reexports) {
        const hit = r.items.find((i) => i.exported === name)
        if (hit) {
          matched = true
          push(r.to, hit.local)
        }
      }
      if (!matched) for (const r of p.reexports) if (r.star || r.ns) push(r.to, r.ns ? ALL : name)
      continue
    }
    if (p.barrel) {
      for (const r of p.reexports) push(r.to, ALL)
      continue
    }
    for (const e of p.edges) for (const n of e.names) push(e.to, n)
  }
  return null
}
