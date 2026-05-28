#!/usr/bin/env node
// scripts/index-dal.mjs
//
// Generate docs/DAL_INDEX.md by walking lib/data/**/*.ts and pulling
// out every function that calls `.from('<table>')` along with the
// columns it selects, the cache key, the cache TTL window, and the
// cache tags.
//
// Read this file to find an existing DAL function before writing a
// new query. The CLAUDE.md "Data Access Discipline" section enforces:
// no raw queries when a DAL function covers the access pattern.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = resolve('lib/data')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|mjs)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

// Tighten the parser: collapse template-literal column lists across
// multiple lines so the .select(...) extraction sees one string. The
// DAL frequently uses `.select('foo, bar, baz, ' + 'more')` to keep
// each line under 80 chars.
function normalize(src) {
  return src.replace(/\s*\+\s*/g, '')
}

const TABLE_PAT = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g
const SELECT_PAT = /\.select\(\s*['"`]([^'"`]+)['"`]/g
const EXPORT_FN_PAT = /export\s+(?:async\s+)?(?:const|function)\s+([a-zA-Z0-9_]+)/g
const CACHE_KEY_PAT = /unstable_cache\(\s*[^,]+,\s*\[\s*['"`]([^'"`]+)['"`]/g
const CACHE_TAG_PAT = /tags:\s*\[\s*([^\]]+)\]/g
const CACHE_TTL_PAT = /revalidate:\s*CACHE_WINDOWS\.([a-zA-Z0-9_]+)/g

function scan(file) {
  const raw = readFileSync(file, 'utf8')
  const src = normalize(raw)
  const tables = [...new Set([...src.matchAll(TABLE_PAT)].map((m) => m[1]))]
  const selects = [...src.matchAll(SELECT_PAT)].map((m) => m[1])
  const exports = [...raw.matchAll(EXPORT_FN_PAT)].map((m) => m[1])
  const cacheKeys = [...src.matchAll(CACHE_KEY_PAT)].map((m) => m[1])
  const cacheTags = [...src.matchAll(CACHE_TAG_PAT)].map((m) => m[1].trim())
  const cacheTTLs = [...src.matchAll(CACHE_TTL_PAT)].map((m) => m[1])
  return { tables, selects, exports, cacheKeys, cacheTags, cacheTTLs }
}

const files = walk(ROOT).sort()
console.error(`index-dal: walking ${files.length} files in lib/data/...`)

const out = []
out.push('# DAL function index')
out.push('')
out.push(`**Generated:** ${new Date().toISOString()}`)
out.push('')
out.push('**Source of truth:** auto-generated from `lib/data/**/*.ts`. Do NOT hand-edit. Re-run `npm run ci:data-access -- --refresh` to regenerate.')
out.push('')
out.push('Read this file BEFORE running any `execute_sql` or before writing a new DAL function. If an existing function already covers the access pattern, call it. The CLAUDE.md "Data Access Discipline" section enforces this for the agent.')
out.push('')
out.push('Companion files:')
out.push('- `docs/DATABASE_SCHEMA_SNAPSHOT.md` — every column in every public table / view / matview.')
out.push('- `docs/DATABASE_FOR_AI_AGENTS.md` — prose narrative reference (cache freshness windows, slug formats, mixed-case quoting rules).')
out.push('')
out.push('---')
out.push('')

// Group by table for the lookup index.
const byTable = new Map()

for (const file of files) {
  const rel = relative(ROOT, file)
  const info = scan(file)
  if (info.tables.length === 0 && info.exports.length === 0) continue

  out.push(`### \`lib/data/${rel}\``)
  out.push('')
  if (info.exports.length > 0) {
    out.push(`**Exports:** ${info.exports.map((e) => `\`${e}\``).join(', ')}`)
    out.push('')
  }
  if (info.tables.length > 0) {
    out.push(`**Tables:** ${info.tables.map((t) => `\`${t}\``).join(', ')}`)
    out.push('')
    for (const t of info.tables) {
      if (!byTable.has(t)) byTable.set(t, [])
      byTable.get(t).push({ file: rel, fns: info.exports })
    }
  }
  if (info.selects.length > 0) {
    const cols = new Set()
    for (const sel of info.selects) {
      for (const part of sel.split(/[, ]+/)) {
        const p = part.trim()
        if (p && p !== '*') cols.add(p)
      }
    }
    if (cols.size > 0) {
      out.push(`**Selected columns:** ${[...cols].slice(0, 40).map((c) => `\`${c}\``).join(', ')}${cols.size > 40 ? ` (+${cols.size - 40} more)` : ''}`)
      out.push('')
    }
  }
  if (info.cacheKeys.length > 0) {
    out.push(`**Cache keys:** ${info.cacheKeys.map((k) => `\`${k}\``).join(', ')}`)
    out.push('')
  }
  if (info.cacheTTLs.length > 0) {
    out.push(`**TTL windows:** ${[...new Set(info.cacheTTLs)].map((t) => `\`CACHE_WINDOWS.${t}\``).join(', ')}`)
    out.push('')
  }
  if (info.cacheTags.length > 0) {
    out.push(`**Cache tags:** ${[...new Set(info.cacheTags)].map((t) => `\`${t}\``).join(', ')}`)
    out.push('')
  }
  out.push('---')
  out.push('')
}

// Reverse index: table → functions.
out.push('## Reverse index: table → functions')
out.push('')
out.push('| Table | DAL functions |')
out.push('|---|---|')
const sortedTables = [...byTable.keys()].sort()
for (const t of sortedTables) {
  const entries = byTable.get(t)
  const fnNames = [...new Set(entries.flatMap((e) => e.fns))]
  const fileLinks = [...new Set(entries.map((e) => `\`lib/data/${e.file}\``))]
  out.push(
    `| \`${t}\` | ${fnNames.map((f) => `\`${f}()\``).join(', ')} <br /> ${fileLinks.join(' · ')} |`,
  )
}
out.push('')

const target = resolve('docs/DAL_INDEX.md')
writeFileSync(target, out.join('\n'))
console.error(`index-dal: wrote ${target} (${out.length} lines, ${byTable.size} tables touched).`)
