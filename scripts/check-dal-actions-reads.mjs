#!/usr/bin/env node
/**
 * check-dal-actions-reads.mjs (ci:dal-actions-reads) — audit p2.1 remainder.
 *
 * The DAL boundary gate (check-dal-boundary.mjs) fully EXEMPTS app/actions/**,
 * app/api/**, and app/admin/** so that legitimate WRITES can live there. That
 * exemption also lets raw READS (`.from('<table>').select(...)`) accumulate in
 * app/actions with no pressure to move them into a cached lib/data reader — the
 * audit counted hundreds.
 *
 * This gate is the SAFE, additive first slice of closing that hole: a read-vs-
 * write classifier scoped to app/actions/** that RATCHETS the raw-read count.
 * It moves no code and changes no runtime behavior — it only freezes the count
 * so app/actions reads can shrink (as they migrate into lib/data) but never grow.
 * The actual read relocation into lib/data is the larger refactor remainder
 * (needs next build + render-verify) and is intentionally NOT done here.
 *
 * A "read" = a `.from('<table>')` whose first chained Supabase verb (within a
 * short window, across line breaks) is `.select`. `.insert/.update/.upsert/
 * .delete` are writes (legitimate in actions) and are NOT counted. A `.from()`
 * with no nearby verb (e.g. a builder split far from its terminal call) is
 * ambiguous and conservatively NOT counted — the baseline tracks clear reads.
 *
 * Ratchet shape mirrors scripts/dal-boundary-baseline.json: { total, byFile }.
 *
 * Usage:
 *   node scripts/check-dal-actions-reads.mjs                  # check vs baseline
 *   node scripts/check-dal-actions-reads.mjs --report         # human report
 *   node scripts/check-dal-actions-reads.mjs --write-baseline # record current
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { walkFiles } from './lib/walk.mjs'

const __filename = fileURLToPath(import.meta.url)
const BASELINE = 'scripts/dal-actions-reads-baseline.json'
const SCAN_DIR = 'app/actions'

// Same table-name matcher the boundary gate uses (excludes Buffer.from/Array.from).
const FROM_REGEX = /(?<!Buffer)(?<!Array)\.from\(\s*['"`]([a-z][a-z0-9_]*)['"`]/g
const VERB_REGEX = /\.(select|insert|update|upsert|delete)\s*\(/
const WINDOW = 300

/** Count raw `.from('table').select(...)` reads in one file's source. */
export function countActionReads(content) {
  let reads = 0
  for (const m of content.matchAll(FROM_REGEX)) {
    const after = content.slice(m.index + m[0].length, m.index + m[0].length + WINDOW)
    const verb = VERB_REGEX.exec(after)
    if (verb && verb[1] === 'select') reads += 1
  }
  return reads
}

function scan() {
  const byFile = {}
  let total = 0
  for (const f of walkFiles(SCAN_DIR)) {
    if (/\.test\.(ts|tsx)$/.test(f)) continue
    const n = countActionReads(readFileSync(f, 'utf8'))
    if (n > 0) {
      byFile[f] = n
      total += n
    }
  }
  return { total, byFile }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const { total, byFile } = scan()

  if (args.includes('--write-baseline')) {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          note: 'Raw `.from(table).select` reads in app/actions/** (the DAL-exempt zone). Count may only SHRINK as reads migrate into cached lib/data readers. Regenerate with `node scripts/check-dal-actions-reads.mjs --write-baseline`.',
          total,
          byFile,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`✓ Baseline written: ${total} app/actions reads across ${Object.keys(byFile).length} files → ${BASELINE}`)
    process.exit(0)
  }

  if (args.includes('--report')) {
    console.log(`app/actions raw-read scan — ${total} reads across ${Object.keys(byFile).length} files\n`)
    for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
      console.log(`  ${String(n).padStart(4)} ${f}`)
    }
    process.exit(0)
  }

  const baseline = loadBaseline()
  if (!baseline) {
    console.error('✗ No baseline at ' + BASELINE)
    console.error('  Run: node scripts/check-dal-actions-reads.mjs --write-baseline')
    process.exit(2)
  }

  console.log('app/actions read ratchet (ci:dal-actions-reads)')
  console.log('===============================================')

  if (total > baseline.total) {
    console.error(`✗ app/actions raw reads increased: ${total} vs baseline ${baseline.total} (+${total - baseline.total})`)
    console.error('')
    console.error('Files with more raw reads than baseline:')
    for (const [f, n] of Object.entries(byFile)) {
      const was = baseline.byFile?.[f] ?? 0
      if (n > was) console.error(`  ${f}: ${n} (baseline ${was}) — +${n - was}`)
    }
    console.error('')
    console.error('Read data through a cached reader in lib/data/ instead of a raw .from().select in an action.')
    console.error('See docs/DATA_ACCESS_LAYER.md. If a new raw read is genuinely unavoidable, re-baseline with --write-baseline.')
    process.exit(1)
  }

  if (total < baseline.total) {
    console.log(`✓ Improved: ${total} reads vs baseline ${baseline.total} (−${baseline.total - total}) — re-baseline to lock the gain.`)
  } else {
    console.log(`✓ Stable: ${total} app/actions raw reads (= baseline)`)
  }
  process.exit(0)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
