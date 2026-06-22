#!/usr/bin/env node
/**
 * check-tool-discipline.mjs  —  G36 (inline AI-tool-call discipline, RATCHETED)
 *
 * The slop source found in the canonical-lib audit was inline ElevenLabs /
 * Replicate calls with drifted settings instead of the shared helpers. This gate
 * bans NEW inline callers while grandfathering the known current ones via a
 * baseline that may only SHRINK (same ratchet pattern as G3/G6/G8).
 *   - All VO must go through scripts/_voice_lib.py or lib/voice/* (CLAUDE.md
 *     "every VO call goes through scripts/_voice_lib.py").
 *   - All Replicate video must go through the shared video helper.
 *
 * HISTORY: this gate originally also carried a "Layer 1" skill-auto-load contract
 * tying two skills (video_production_skills/tool-mastery, viral-playbook) into the
 * content-engine bus. Both skill files were deleted, so Layer 1 asserted against
 * non-existent files and always-failed — and the gate ran nowhere (orphan). Layer
 * 1 was RETIRED 2026-06-22 and the surviving inline-call ratchet was wired into
 * ci:gates. If those skills are ever reintroduced, the auto-load contract can be
 * re-added as a separate gate.
 *
 * USAGE:
 *   node scripts/check-tool-discipline.mjs                # CI mode — exit 1 on a NEW inline caller
 *   node scripts/check-tool-discipline.mjs --report       # print status, never exit 1
 *   node scripts/check-tool-discipline.mjs --write-baseline  # capture current inline-call violators
 */

import { readFileSync, existsSync, writeFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/.tool-discipline-baseline.json')

// ── inline-call bans + allowed homes ──────────────────────────────────────────
export const INLINE_RULES = [
  {
    id: 'elevenlabs-inline',
    label: 'inline ElevenLabs API call',
    // Any direct hit to the ElevenLabs HTTP API…
    pattern: /api\.elevenlabs\.io|text-to-speech\/|\/v1\/sound-generation|\/v1\/music\b/,
    // …is allowed ONLY inside the shared voice libraries.
    allowedHomes: [
      'scripts/_voice_lib.py',
      'lib/voice/',
      'scripts/check-tool-discipline.mjs', // this file names the API in comments
    ],
  },
  {
    id: 'replicate-video-inline',
    label: 'inline Replicate video-model call',
    pattern: /api\.replicate\.com\/v1\/predictions/,
    allowedHomes: [
      'lib/replicate-video.ts',
      'lib/replicate-video.mjs',
      'lib/replicate.ts',
      'scripts/check-tool-discipline.mjs',
      'video_production_skills/', // skill docs may show example calls
      'docs/', // research docs show example calls
    ],
  },
]

// Dirs to scan (code only).
const SCAN_DIRS = ['scripts', 'lib', 'video', 'listing_video_v4', 'app']
const SCAN_EXTS = ['.py', '.ts', '.tsx', '.mjs', '.js']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '__tests__'])
const isTestFile = (p) => /\.test\.(py|ts|tsx|mjs|js)$/.test(p)

export function isAllowed(relPath, allowedHomes) {
  return allowedHomes.some((h) => relPath === h || relPath.startsWith(h))
}

/** Inline-call rule ids violated by ONE file's source (exported for the test). */
export function inlineViolations(relPath, content) {
  const out = []
  for (const rule of INLINE_RULES) {
    if (isAllowed(relPath, rule.allowedHomes)) continue
    if (rule.pattern.test(content)) out.push(rule.id)
  }
  return out
}

function read(p) {
  try { return readFileSync(join(ROOT, p), 'utf8') } catch { return null }
}

function walk(dir, acc) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return acc
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const rel = join(dir, e.name)
    if (e.isDirectory()) walk(rel, acc)
    else if (SCAN_EXTS.some((x) => e.name.endsWith(x)) && !isTestFile(e.name)) acc.push(rel)
  }
  return acc
}

function scanAll() {
  const files = []
  for (const d of SCAN_DIRS) walk(d, files)
  const violations = []
  for (const f of files) {
    const src = read(f)
    if (src === null) continue
    for (const id of inlineViolations(f, src)) violations.push(`${id}::${f}`)
  }
  violations.sort()
  return violations
}

function main() {
  const args = process.argv.slice(2)
  const REPORT_ONLY = args.includes('--report')
  const WRITE_BASELINE = args.includes('--write-baseline')

  const currentViolations = scanAll()

  if (WRITE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify({ generated: 'manual', violations: currentViolations }, null, 2) + '\n')
    console.log(`Wrote ${currentViolations.length} grandfathered inline-call violation(s) to scripts/.tool-discipline-baseline.json`)
    console.log('These may remain but the set may only SHRINK. Migrate them to the shared helpers over time.')
    process.exit(0)
  }

  let baseline = { violations: [] }
  if (existsSync(BASELINE_PATH)) {
    try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* treat as empty */ }
  }
  const baselineSet = new Set(baseline.violations ?? [])
  const newViolations = currentViolations.filter((v) => !baselineSet.has(v))
  const fixedViolations = [...baselineSet].filter((v) => !currentViolations.includes(v))

  console.log('AI-tool discipline — inline-call ratchet (G36)')
  console.log('=============================================')
  console.log(`${currentViolations.length} current · ${baselineSet.size} grandfathered · ${newViolations.length} NEW · ${fixedViolations.length} fixed`)
  for (const v of newViolations) console.log(`  ✗ NEW inline call: ${v.replace('::', ' → ')}`)
  if (fixedViolations.length > 0) {
    console.log(`  ✓ ${fixedViolations.length} baseline violation(s) fixed — run --write-baseline to tighten the ratchet.`)
  }

  if (REPORT_ONLY) {
    console.log(`\n(--report mode: not failing the build. Would ${newViolations.length ? 'FAIL' : 'pass'}.)`)
    process.exit(0)
  }

  if (newViolations.length > 0) {
    console.error('\nG36 FAILED.')
    console.error('• New inline AI-tool call: route VO through scripts/_voice_lib.py / lib/voice and')
    console.error('  Replicate video through the shared helper. Do not inline the API with drifted settings.')
    process.exit(1)
  }

  console.log('\nTool discipline clean.')
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
