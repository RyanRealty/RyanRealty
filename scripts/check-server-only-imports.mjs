#!/usr/bin/env node
/**
 * check-server-only-imports.mjs — G43: server-only modules stay out of the
 * client bundle.
 *
 * Some modules embed multi-MB data or server credentials and must never be
 * imported (as a VALUE) from client code. The founding case: the asset-library
 * manifest (data/asset-library/manifest.json, imported by
 * lib/pulse-asset-library.ts) grew past 1.4 MB and shipped inside the /pulse
 * client chunk because a 'use client' component imported a module that
 * imported it. The bundle-budget gate caught the symptom post-build; this gate
 * kills the class statically and names the exact import to fix.
 *
 * Rule: no file under components/**, and no file anywhere whose head carries
 * 'use client', may VALUE-import a SERVER_ONLY module. `import type { X }`
 * is allowed — type-only imports are erased at compile time.
 *
 * Extend SERVER_ONLY when a new heavy/secret module appears. Resolution is
 * suffix-based on the import specifier (covers @/ aliases and relative paths).
 *
 * Usage: node scripts/check-server-only-imports.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

// Module specifier suffixes that are server-only. Keep entries justified.
const SERVER_ONLY = [
  // Embeds data/asset-library/manifest.json (multi-MB). Resolve assets
  // server-side (lib/pulse-lifestyle-cards.server.ts) and pass props.
  'lib/pulse-asset-library',
  'pulse-asset-library',
  // The manifest itself — no client file may import it directly either.
  'data/asset-library/manifest.json',
  'asset-library/manifest.json',
  // Server-side card resolution (imports the manifest transitively).
  'lib/pulse-lifestyle-cards.server',
  'pulse-lifestyle-cards.server',
]

const SCAN_DIRS = ['app', 'components', 'lib']
const EXT = /\.(ts|tsx)$/

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else if (EXT.test(name)) acc.push(p)
  }
  return acc
}

function isClientFile(rel, src) {
  if (rel.startsWith('components/')) return true
  return /^\s*['"]use client['"]/m.test(src.slice(0, 600))
}

// Match value imports: `import X from '...'`, `import { a, b } from '...'`,
// `import * as X from '...'`, bare `import '...'`, `require('...')`,
// `import('...')`. Skip pure `import type { ... } from '...'`.
const IMPORT_RE = /import\s+(type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g

function main() {
  const violations = []
  for (const dir of SCAN_DIRS) {
    let files = []
    try { files = walk(join(ROOT, dir)) } catch { continue }
    for (const file of files) {
      const rel = relative(ROOT, file)
      const src = readFileSync(file, 'utf8')
      // The server modules themselves are exempt.
      if (SERVER_ONLY.some((s) => rel.replace(/\.(ts|tsx)$/, '').endsWith(s.replace(/\.(ts|tsx)$/, '')))) continue
      if (!isClientFile(rel, src)) continue
      let m
      IMPORT_RE.lastIndex = 0
      while ((m = IMPORT_RE.exec(src)) !== null) {
        const isTypeOnly = Boolean(m[1])
        const spec = m[2] ?? m[3] ?? m[4] ?? m[5]
        if (!spec || isTypeOnly) continue
        if (SERVER_ONLY.some((s) => spec === s || spec.endsWith('/' + s) || spec.endsWith(s))) {
          const line = src.slice(0, m.index).split('\n').length
          violations.push(`${rel}:${line}  imports '${spec}'`)
        }
      }
    }
  }

  console.log('Server-only import check (G43)')
  console.log('==============================')
  if (violations.length === 0) {
    console.log('No client file value-imports a server-only module.')
    process.exit(0)
  }
  console.log(`${violations.length} violation(s):`)
  for (const v of violations) console.log('  ' + v)
  console.log()
  console.log('Fix: resolve the data server-side and pass it as a prop (see')
  console.log('lib/pulse-lifestyle-cards.server.ts), or use `import type` if only')
  console.log('the types are needed.')
  process.exit(1)
}

main()
