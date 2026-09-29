/**
 * Resolve and load hook for ci:outbound-tracking.
 *
 * The render pass imports the real builders. Two things get in the way:
 *
 *   1. This repo has no "type": "module", so tsx classifies .ts as CommonJS.
 *      Node then require()s the file while the ESM import of the same file is
 *      still evaluating, and dies with ERR_REQUIRE_CYCLE_MODULE. This hook
 *      transforms .ts/.tsx with esbuild and returns format "module", so the
 *      builders stay real ESM and the cycle never starts.
 *   2. `server-only` throws outside the Next bundler, and `next/cache` /
 *      `next/headers` / `next/navigation` need a runtime the CLI does not
 *      have. Those specifiers are short-circuited to inert modules. The
 *      import never touches the network or a database.
 *
 * `@/` is the tsconfig path alias. Extensionless relative imports are
 * resolved the way the Next bundler resolves them (.ts, .tsx, then .js).
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transformSync } from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function dataUrl(code) {
  return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code)
}

const STUBS = {
  'server-only': dataUrl('export {}\n'),
  'client-only': dataUrl('export {}\n'),
  'next/cache': dataUrl(`
export function unstable_cache(fn) { return fn }
export function revalidatePath() {}
export function revalidateTag() {}
export function revalidate() {}
export function cacheLife() {}
export function cacheTag() {}
export function unstable_noStore() {}
export function updateTag() {}
`),
  'next/headers': dataUrl(`
export function cookies() {
  return { get() {}, getAll() { return [] }, set() {}, delete() {}, has() { return false } }
}
export function headers() {
  return { get() { return null }, has() { return false } }
}
export function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} }
}
`),
  'next/navigation': dataUrl(`
export function redirect() { throw new Error('redirect') }
export function permanentRedirect() { throw new Error('redirect') }
export function notFound() { throw new Error('notFound') }
export function useRouter() { return {} }
export function usePathname() { return '/' }
export function useSearchParams() { return new URLSearchParams() }
export function useParams() { return {} }
`),
}

const EXTS = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.cjs', '.json']

function isFile(p) {
  try {
    return existsSync(p) && statSync(p).isFile()
  } catch {
    return false
  }
}

function resolveFile(base) {
  if (isFile(base)) return base
  for (const ext of EXTS) {
    if (isFile(base + ext)) return base + ext
  }
  for (const ext of EXTS) {
    const idx = join(base, 'index' + ext)
    if (isFile(idx)) return idx
  }
  if (base.endsWith('.js')) {
    const stem = base.slice(0, -3)
    for (const ext of ['.ts', '.tsx', '.mts']) {
      if (isFile(stem + ext)) return stem + ext
    }
  }
  return null
}

function loaderFor(file) {
  if (file.endsWith('.tsx')) return 'tsx'
  if (file.endsWith('.jsx')) return 'jsx'
  if (file.endsWith('.json')) return 'json'
  return 'ts'
}

// esbuild drops `assert` / `with { type: 'json' }`. Node refuses a JSON
// import that has no attribute, so put the attribute back on the way out.
function restoreJsonImportAttributes(code) {
  return code.replace(
    /(from\s*)(['"])([^'"]+\.json)\2(?!\s*(?:with|assert)\b)/g,
    '$1$2$3$2 with { type: "json" }',
  )
}

// The real builders live next to the data layer. Importing the send file
// evaluates those imports. The render path never calls them. A named-export
// stub lets the module finish loading without a database, a network call, or
// the Next server runtime. The function we then call is still the real one.
function shouldStub(spec) {
  if (spec === '@/lib/data' || spec.startsWith('@/lib/data/')) return true
  if (spec.startsWith('@/app/')) return true
  if (spec === 'next/server') return true
  if (spec.startsWith('next/font')) return true
  if (spec.startsWith('next/image')) return true
  if (spec === 'next/link' || spec === 'next/script' || spec === 'next/dynamic') return true
  if (spec === 'next/document' || spec === 'next/head' || spec === 'next/og') return true
  return false
}

function parseImportClause(clause) {
  const names = []
  const brace = clause.match(/\{([^}]*)\}/)
  if (brace) {
    for (const part of brace[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      const m = t.match(/^(?:type\s+)?([A-Za-z0-9_$]+)(?:\s+as\s+[A-Za-z0-9_$]+)?$/)
      if (m) names.push(m[1])
    }
  }
  const star = /\*\s+as\s+[A-Za-z0-9_$]+/.test(clause) || clause.trim() === '*'
  const rest = clause
    .replace(/\{[^}]*\}/, '')
    .replace(/\*\s+as\s+[A-Za-z0-9_$]+/, '')
    .replace(/^\s*\*\s*$/, '')
    .trim()
    .replace(/,$/, '')
    .trim()
  const defMatch = rest.match(/^(?:type\s+)?([A-Za-z0-9_$]+)$/)
  const defaultName = defMatch && defMatch[1] !== 'type' ? defMatch[1] : null
  return { names, star, defaultName }
}

function stubModuleSource(parsed) {
  const lines = []
  if (parsed.defaultName || parsed.star) {
    lines.push('const __stub = new Proxy(function () { throw new Error("outbound-tracking data stub") }, { get() { return __stub } });')
    lines.push('export default __stub;')
  }
  for (const name of parsed.names) {
    lines.push(
      `export const ${name} = new Proxy(function () { throw new Error(${JSON.stringify('outbound-tracking data stub: ' + name)}) }, { get() { return ${name} } });`,
    )
  }
  if (lines.length === 0) lines.push('export {};')
  return lines.join('\n')
}

function stubHeavyImports(code) {
  return code.replace(
    /\b(import|export)\s+([\s\S]*?)\s+from\s*(['"])([^'"]+)\3/g,
    (full, kind, clause, _q, spec) => {
      if (!shouldStub(spec)) return full
      const src = stubModuleSource(parseImportClause(clause))
      return `${kind} ${clause} from ${JSON.stringify(dataUrl(src))}`
    },
  )
}

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(STUBS, specifier)) {
    return { url: STUBS[specifier], shortCircuit: true }
  }
  if (specifier.startsWith('node:') || specifier.startsWith('data:')) {
    return nextResolve(specifier, context)
  }

  let mapped = null
  if (specifier.startsWith('@/')) {
    mapped = join(ROOT, specifier.slice(2))
  } else if (specifier.startsWith('.')) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : join(ROOT, 'package.json')
    mapped = join(dirname(parent), specifier)
  } else if (specifier.startsWith('file:')) {
    mapped = fileURLToPath(specifier)
  }

  if (mapped) {
    const file = resolveFile(mapped)
    if (file && !file.includes(`${join('node_modules')}`)) {
      return { url: pathToFileURL(file).href, shortCircuit: true }
    }
  }

  // Bare package specifiers. Node's ESM resolver will not add .js for a
  // package that has no "exports" map (next/server is the one that showed up
  // first). require.resolve uses the CJS algorithm, which finds the file.
  if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:')) {
    try {
      const hit = require.resolve(specifier)
      if (isFile(hit)) return { url: pathToFileURL(hit).href, shortCircuit: true }
    } catch {
      // fall through to the default resolver
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('data:text/javascript')) {
    const comma = url.indexOf(',')
    const source = decodeURIComponent(url.slice(comma + 1))
    return { format: 'module', source, shortCircuit: true }
  }
  if (!url.startsWith('file:')) return nextLoad(url, context)
  const file = fileURLToPath(url)
  if (file.includes(`${join('node_modules')}`)) return nextLoad(url, context)
  if (file.endsWith('.json')) {
    return { format: 'json', source: readFileSync(file, 'utf8'), shortCircuit: true }
  }
  if (!/\.(ts|tsx|mts|jsx)$/.test(file)) return nextLoad(url, context)
  const source = readFileSync(file, 'utf8')
  const transformed = transformSync(source, {
    loader: loaderFor(file),
    format: 'esm',
    sourcefile: file,
    target: 'es2022',
    jsx: 'automatic',
  })
  const sourceOut = stubHeavyImports(restoreJsonImportAttributes(transformed.code))
  return { format: 'module', source: sourceOut, shortCircuit: true }
}
