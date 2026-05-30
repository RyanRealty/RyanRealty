#!/usr/bin/env node
/**
 * check-tool-discipline.mjs  —  G36 (AI-tool discipline + skill auto-load contract)
 *
 * Turns the tool-mastery + viral-playbook skills from PROSE into ENFORCED GATES,
 * per Matt's directive 2026-05-29 ("make sure these are coded and enforced as
 * gates, not simply prose that does nothing") and the standing
 * feedback_enforcement_over_audits rule.
 *
 * Two enforcement layers:
 *
 *  ── LAYER 1: skill auto-load contract (HARD — always enforced) ──
 *  The two new skills only matter if they actually load when content is made.
 *  The load chokepoints are the content-engine bus (every content:* action
 *  routes through it) and the producer TEMPLATE (every new producer inherits
 *  it). This layer FAILS the build if either chokepoint stops referencing
 *  either skill — so the wiring can never silently rot back to "prose nobody
 *  reads." It also fails if either skill file goes missing.
 *
 *  ── LAYER 2: inline AI-tool-call discipline (RATCHETED) ──
 *  The slop source found in the canonical-lib audit was inline ElevenLabs /
 *  Replicate calls with drifted settings instead of the shared helpers. This
 *  layer bans NEW inline callers while grandfathering the known current ones
 *  via a baseline file that can only SHRINK (same ratchet pattern as G3/G6/G8).
 *    - All VO must go through scripts/_voice_lib.py or lib/voice/*.
 *    - All Replicate video must go through the shared video helper
 *      (lib/replicate-video.* once it exists).
 *  Run `node scripts/check-tool-discipline.mjs --write-baseline` ONCE on a
 *  clean tree to capture the current violators; thereafter the set may only
 *  shrink. A new inline caller fails CI.
 *
 * USAGE:
 *   node scripts/check-tool-discipline.mjs                # CI mode — exit 1 on any violation
 *   node scripts/check-tool-discipline.mjs --report       # print status, never exit 1
 *   node scripts/check-tool-discipline.mjs --write-baseline  # capture current inline-call violators
 *
 * Exit 0 = clean. Exit 1 = a contract break or a NEW inline caller.
 *
 * ACTIVATION (do these 3 wiring edits on a clean channel first, or Layer 1 fails):
 *   1. automation_skills/content_engine/SKILL.md  — reference tool-mastery + viral-playbook
 *      in its mandatory-references / required-reading section.
 *   2. marketing_brain_skills/producers/TEMPLATE.md — add viral-playbook to the Tier 2
 *      list and tool-mastery to the Tier 3 list (both the inline refs and the
 *      bottom "Related skills" lists).
 *   3. marketing_brain_skills/producers/REGISTRY.md — register both under Section G.
 *   Then: add `ci:tool-discipline` to package.json and into the ci:gates chain,
 *   run `--write-baseline` once, and document as G36 in docs/MECHANICAL_GATES.md.
 */

import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = process.argv.slice(2)
const REPORT_ONLY = args.includes('--report')
const WRITE_BASELINE = args.includes('--write-baseline')

const BASELINE_PATH = join(ROOT, 'scripts/.tool-discipline-baseline.json')

// ── the two skills under enforcement ──────────────────────────────────────────
const SKILLS = [
  { name: 'tool-mastery', path: 'video_production_skills/tool-mastery/SKILL.md' },
  { name: 'viral-playbook', path: 'video_production_skills/viral-playbook/SKILL.md' },
]

// Load chokepoints that MUST reference both skills (Layer 1).
const LOAD_CHOKEPOINTS = [
  'automation_skills/content_engine/SKILL.md',
  'marketing_brain_skills/producers/TEMPLATE.md',
]

// ── Layer 2 config: inline-call bans + allowed homes ──────────────────────────
const INLINE_RULES = [
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
    // Direct Replicate predictions calls naming a video model slug.
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

// Dirs to scan for Layer 2 (code only).
const SCAN_DIRS = ['scripts', 'lib', 'video', 'listing_video_v4', 'app']
const SCAN_EXTS = ['.py', '.ts', '.tsx', '.mjs', '.js']

// ── helpers ───────────────────────────────────────────────────────────────────
function read(p) {
  try { return readFileSync(join(ROOT, p), 'utf8') } catch { return null }
}

function walk(dir, acc) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return acc
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const rel = join(dir, e.name)
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
    if (e.isDirectory()) walk(rel, acc)
    else if (SCAN_EXTS.some((x) => e.name.endsWith(x))) acc.push(rel)
  }
  return acc
}

function isAllowed(relPath, allowedHomes) {
  return allowedHomes.some((h) => relPath === h || relPath.startsWith(h))
}

// ── Layer 1: skill auto-load contract ──────────────────────────────────────────
const layer1 = []
for (const skill of SKILLS) {
  if (!existsSync(join(ROOT, skill.path))) {
    layer1.push(`MISSING SKILL: ${skill.path} does not exist.`)
  }
}
for (const cp of LOAD_CHOKEPOINTS) {
  const src = read(cp)
  if (src === null) {
    layer1.push(`MISSING CHOKEPOINT: ${cp} not found — cannot verify skill auto-load.`)
    continue
  }
  for (const skill of SKILLS) {
    if (!src.includes(skill.name)) {
      layer1.push(`UNWIRED: ${cp} does not reference "${skill.name}" — the skill will not auto-load for content production.`)
    }
  }
}

// ── Layer 2: inline-call discipline (ratcheted) ────────────────────────────────
const files = []
for (const d of SCAN_DIRS) walk(d, files)

const currentViolations = []
for (const f of files) {
  const src = read(f)
  if (src === null) continue
  for (const rule of INLINE_RULES) {
    if (isAllowed(f, rule.allowedHomes)) continue
    if (rule.pattern.test(src)) {
      currentViolations.push(`${rule.id}::${f}`)
    }
  }
}
currentViolations.sort()

if (WRITE_BASELINE) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ generated: 'manual', violations: currentViolations }, null, 2) + '\n')
  console.log(`Wrote ${currentViolations.length} grandfathered inline-call violation(s) to scripts/.tool-discipline-baseline.json`)
  console.log('These are allowed to remain but the set may only SHRINK. Migrate them to the shared helpers over time.')
  process.exit(0)
}

let baseline = { violations: [] }
if (existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) } catch { /* treat as empty */ }
}
const baselineSet = new Set(baseline.violations ?? [])
const newViolations = currentViolations.filter((v) => !baselineSet.has(v))
const fixedViolations = [...baselineSet].filter((v) => !currentViolations.includes(v))

// ── report ─────────────────────────────────────────────────────────────────────
console.log('AI-tool discipline + skill auto-load contract (G36)')
console.log('===================================================')
console.log(`Layer 1 (skill auto-load contract): ${layer1.length === 0 ? 'OK' : layer1.length + ' break(s)'}`)
for (const l of layer1) console.log(`  ✗ ${l}`)
console.log(`Layer 2 (inline-call discipline): ${currentViolations.length} current · ${baselineSet.size} grandfathered · ${newViolations.length} NEW · ${fixedViolations.length} fixed`)
for (const v of newViolations) console.log(`  ✗ NEW inline call: ${v.replace('::', ' → ')}`)
if (fixedViolations.length > 0) {
  console.log(`  ✓ ${fixedViolations.length} baseline violation(s) fixed — run --write-baseline to tighten the ratchet.`)
}

const failed = layer1.length > 0 || newViolations.length > 0

if (REPORT_ONLY) {
  console.log(`\n(--report mode: not failing the build. Would ${failed ? 'FAIL' : 'pass'}.)`)
  process.exit(0)
}

if (failed) {
  console.error('')
  console.error('G36 FAILED.')
  if (layer1.length > 0) {
    console.error('• Skill auto-load contract broken: wire tool-mastery + viral-playbook into the')
    console.error('  content_engine bus and producers/TEMPLATE.md so they actually load at produce-time.')
  }
  if (newViolations.length > 0) {
    console.error('• New inline AI-tool call: route VO through scripts/_voice_lib.py / lib/voice and')
    console.error('  Replicate video through the shared helper. Do not inline the API with drifted settings.')
  }
  process.exit(1)
}

console.log('\nTool discipline clean.')
process.exit(0)
