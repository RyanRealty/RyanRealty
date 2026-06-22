#!/usr/bin/env node
/**
 * check-dal-boundary.mjs
 *
 * Enforces the Data Access Layer boundary: only files inside lib/data/ may call
 * supabase.from('<table>') for the canonical domain tables. Every page,
 * component, action, or script outside lib/data/ must import from @/lib/data/.
 *
 * Modes:
 *   node scripts/check-dal-boundary.mjs                 → check against baseline, exit 1 if violations INCREASED
 *   node scripts/check-dal-boundary.mjs --write-baseline → snapshot current state to scripts/dal-boundary-baseline.json
 *   node scripts/check-dal-boundary.mjs --report         → human-readable report, never exits 1
 *
 * Ratchet behavior: as Wave 1-3 migrates pages to the DAL, the baseline drops.
 * Once it hits 0, eslint.config.mjs flips the rule from `warn` to `error` and
 * this script becomes pure regression insurance.
 *
 * See docs/DATA_ACCESS_LAYER.md for the contract.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/dal-boundary-baseline.json')

const SCAN_DIRS = ['app', 'components', 'lib']
const ALLOWED_PREFIX = 'lib/data/'
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])

// Tables that MUST go through lib/data/. Adding a table here requires a matching
// rule in eslint.config.mjs and a doc update in docs/DATA_ACCESS_LAYER.md.
//
// Gate 6 expansion (2026-06-09): blog_posts, guides, and market_reports are now
// fully covered by cached DAL readers. Consumer pages must import from @/lib/data
// — not from app/actions/blog.ts, app/actions/guides.ts, or market-reports.ts.
// Admin/write paths (saveBlogPost, saveGuide, upsertMarketReport…) remain in the
// action files and are allowed because the gate skips app/api/** and app/admin/**.
// reviews is added because getBrokerReviews DAL reader was created to cover the
// per-broker review fetch in the team page; the only remaining raw `.from('reviews')`
// call is in app/actions/agents.ts (getAgentReviews / getReviewStatsForBroker) which
// is a write-adjacent stats composite, not a consumer page direct read.
const BANNED_TABLES = [
  'listings',
  'listing_videos',
  'video_tours_cache',
  'listing_history',
  'market_stats_cache',
  'market_pulse_live',
  'engagement_metrics',
  'properties',
  'neighborhoods',
  'communities',
  'cities',
  'listing_photos',
  'listing_agents',
  'open_houses',
  'boundaries',
  'neighborhood_subdivisions',
  'subdivision_flags',
  'app_config',
  'activity_events',
  'expired_listings',
  'cmas',
  'cma_comps',
  'guest_search_alerts',
  // Wave 3 additions — DAL readers now exist for these; consumer pages must use them.
  'blog_posts',
  'guides',
  'market_reports',
]

// Tables that are BANNED for consumer-page reads but allowed in write-path
// action/API files. These tables have DAL readers for consumer use; writes and
// admin mutations legitimately live in app/actions/* or app/api/*.
//
// A file path matching any of these prefixes is allowed to call .from('<table>')
// for the listed tables. Consumer pages (app/<page>/page.tsx, components/*) that
// call these tables directly are still flagged.
const WRITE_PATH_PREFIXES = [
  // Action files own the write path for all tables (admin + user mutations).
  // Consumer pages that previously imported read functions from actions/* have
  // been repointed to @/lib/data/ as of Wave 3 (2026-06-09).
  'app/actions/',
  // API routes + crons are server-side write/mutation paths — not consumer reads.
  'app/api/',
  // Admin UI has direct table access by design (internal tool, not consumer-facing).
  'app/admin/',
]

// Default-deny (audit p2.1): flag `.from('<table>')` for ANY lowercase snake_case
// table name outside lib/data/ (+ the write-path prefixes below). Previously this
// matched only the 26-table BANNED_TABLES denylist, so any UNLISTED table could be
// read raw from a page/component without tripping the gate. The BANNED_TABLES list
// is retained above only as the eslint-mirrored reference set. Lookbehind excludes
// `Buffer.from(` / `Array.from(` (not Supabase calls).
const FROM_REGEX = /(?<!Buffer)(?<!Array)\.from\(\s*['"`]([a-z][a-z0-9_]*)['"`]/g

function normalize(p) {
  return p.split(sep).join('/')
}

function shouldSkip(relPath) {
  const norm = normalize(relPath)
  // Skip files inside lib/data/ — they're allowed.
  if (norm.startsWith(ALLOWED_PREFIX)) return true
  // Skip test files.
  if (norm.includes('/__tests__/') || norm.endsWith('.test.ts') || norm.endsWith('.test.tsx')) return true
  // Skip migration files (they reference table names in SQL strings, not Supabase client calls).
  if (norm.includes('supabase/migrations/')) return true
  // Skip write-path zones (actions, API routes, admin UI).
  for (const prefix of WRITE_PATH_PREFIXES) {
    if (norm.startsWith(prefix)) return true
  }
  return false
}

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      yield* walk(full)
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (FILE_EXTS.has(ext)) yield full
    }
  }
}

function scanFile(absPath) {
  const relPath = normalize(relative(ROOT, absPath))
  if (shouldSkip(relPath)) return null

  let content
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    return null
  }

  const matches = [...content.matchAll(FROM_REGEX)]
  if (matches.length === 0) return null

  const violations = matches.map((m) => {
    const lineNum = content.slice(0, m.index).split('\n').length
    return { table: m[1], line: lineNum }
  })

  return { file: relPath, count: matches.length, violations }
}

function scanAll() {
  const results = []
  for (const dir of SCAN_DIRS) {
    const absDir = join(ROOT, dir)
    if (!existsSync(absDir)) continue
    for (const file of walk(absDir)) {
      const r = scanFile(file)
      if (r) results.push(r)
    }
  }
  results.sort((a, b) => b.count - a.count)
  return results
}

function summarize(results) {
  const total = results.reduce((s, r) => s + r.count, 0)
  const byFile = Object.fromEntries(results.map((r) => [r.file, r.count]))
  return { total, byFile }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const writeBaseline = args.includes('--write-baseline')
  const reportOnly = args.includes('--report')

  const results = scanAll()
  const summary = summarize(results)

  if (writeBaseline) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: summary.total,
          byFile: summary.byFile,
          note: 'Generated by scripts/check-dal-boundary.mjs --write-baseline. Total must monotonically decrease toward 0 as Wave 1-3 migrates pages to lib/data/.',
        },
        null,
        2
      ) + '\n'
    )
    console.log(`✓ Baseline written: ${summary.total} violations across ${results.length} files.`)
    console.log(`  → ${BASELINE_PATH}`)
    process.exit(0)
  }

  if (reportOnly) {
    console.log(`DAL boundary scan — ${summary.total} violations across ${results.length} files\n`)
    for (const r of results.slice(0, 30)) {
      console.log(`  ${r.count.toString().padStart(4)} ${r.file}`)
    }
    if (results.length > 30) console.log(`  ... and ${results.length - 30} more files`)
    process.exit(0)
  }

  // Default mode: ratchet check against baseline.
  const baseline = loadBaseline()
  if (!baseline) {
    console.error('✗ No baseline found at scripts/dal-boundary-baseline.json')
    console.error('  Run: node scripts/check-dal-boundary.mjs --write-baseline')
    process.exit(2)
  }

  if (summary.total > baseline.total) {
    console.error(`✗ DAL boundary regression: ${summary.total} violations vs baseline ${baseline.total}`)
    console.error('')
    console.error('Files with new violations vs baseline:')
    for (const r of results) {
      const baselineCount = baseline.byFile[r.file] ?? 0
      if (r.count > baselineCount) {
        console.error(`  ${r.file}: ${r.count} (baseline: ${baselineCount}) — +${r.count - baselineCount}`)
        for (const v of r.violations.slice(0, 5)) {
          console.error(`    line ${v.line}: .from('${v.table}')`)
        }
      }
    }
    console.error('')
    console.error('See docs/DATA_ACCESS_LAYER.md. New code must import from @/lib/data/.')
    process.exit(1)
  }

  if (summary.total < baseline.total) {
    console.log(`✓ DAL boundary improved: ${summary.total} violations vs baseline ${baseline.total} (−${baseline.total - summary.total})`)
    console.log('  Consider updating baseline: node scripts/check-dal-boundary.mjs --write-baseline')
  } else {
    console.log(`✓ DAL boundary stable: ${summary.total} violations (= baseline)`)
  }
  process.exit(0)
}

main()
