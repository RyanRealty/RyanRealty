#!/usr/bin/env node
/**
 * check-vm-parity.mjs — the mechanical guarantee behind "anything I can do on
 * local I can do on the VM" (Matt directive 2026-07-25, when the Mac mini was
 * retired as a workstation).
 *
 * Four classes of regression are blocked in live code paths:
 *
 *  1. macOS-only shell commands (`osascript`, `sips`, `afplay`, `pbcopy`,
 *     `pbpaste`, `say`). Use lib/platform/notify.mjs for alerts and `sharp`
 *     for image work — both run on Linux.
 *  2. Hardcoded `/Users/...` paths. A cloud VM checks out somewhere else.
 *     Resolve from `repoRoot` in lib/platform/env.mjs or `process.cwd()`.
 *  3. Hard reads of `.env.local`. A cloud session has no such file and a
 *     bare `readFileSync('.env.local')` THROWS there. Use loadEnv().
 *  4. Headed-browser launches (`headless: false`) outside the capture script.
 *     There is no display on the VM.
 *
 * Scope is deliberately LIVE code only: lib/, app/, and non-underscore
 * scripts/. `scripts/_*` are historical one-shots that already ran; rewriting
 * them buys nothing and would bury the signal.
 *
 * Baseline: scripts/vm-parity-baseline.json holds the known offenders. The
 * count may only shrink. A new violation fails the build.
 *
 * Usage:
 *   node scripts/check-vm-parity.mjs
 *   node scripts/check-vm-parity.mjs --refresh   # re-record the baseline (only to burn it down)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const BASELINE = 'scripts/vm-parity-baseline.json'
const REFRESH = process.argv.includes('--refresh')

const RULES = [
  {
    id: 'macos-command',
    re: /\b(osascript|\bsips\b|afplay|pbcopy|pbpaste)\b/,
    hint: 'macOS-only command. Use lib/platform/notify.mjs (alerts) or sharp (images).',
  },
  {
    // Case-SENSITIVE on purpose. macOS homes are `/Users/<name>`; matching
    // case-insensitively also catches REST paths like `/2/users/me` (lib/x.ts)
    // and produces false positives.
    id: 'hardcoded-home',
    re: /\/Users\/[a-z]/,
    hint: 'Hardcoded macOS home path. Resolve from repoRoot (lib/platform/env.mjs) or process.cwd().',
  },
  {
    id: 'hard-dotenv-read',
    re: /readFileSync\([^)]*\.env\.local/,
    hint: 'Throws on a cloud VM (no .env.local). Use loadEnv() from lib/platform/env.mjs.',
  },
  {
    id: 'headed-browser',
    re: /headless:\s*false/,
    hint: 'No display on the VM. Default to headless; gate any headed path behind a flag.',
  },
]

/** Live code only — git-tracked, excluding one-shot scripts and vendored trees. */
function liveFiles() {
  const out = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(mjs|js|cjs|ts|tsx)$/.test(f))
    .filter((f) => f.startsWith('lib/') || f.startsWith('app/') || f.startsWith('scripts/'))
    .filter((f) => !f.startsWith('scripts/_')) // historical one-shots
    .filter((f) => !f.includes('node_modules/'))
    .filter((f) => f !== 'scripts/check-vm-parity.mjs') // this file names the patterns
}

const violations = []
for (const file of liveFiles()) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip comment-only lines: a rule named in prose is documentation, not a call.
    const trimmed = line.trim()
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('#')) continue
    for (const rule of RULES) {
      if (rule.re.test(line)) violations.push(`${rule.id}\t${file}:${i + 1}`)
    }
  }
}
violations.sort()

if (REFRESH) {
  writeFileSync(BASELINE, JSON.stringify({ generated: 'manual-refresh', violations }, null, 2) + '\n')
  console.log(`Baseline refreshed: ${violations.length} known violations recorded in ${BASELINE}`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error(`Missing ${BASELINE}. Run: node scripts/check-vm-parity.mjs --refresh`)
  process.exit(1)
}

const known = new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).violations)
const added = violations.filter((v) => !known.has(v))
const fixed = [...known].filter((k) => !violations.includes(k))

if (added.length) {
  console.error('\n✗ VM parity gate — new macOS-only dependencies introduced:\n')
  for (const v of added) {
    const [id, loc] = v.split('\t')
    const hint = RULES.find((r) => r.id === id)?.hint ?? ''
    console.error(`  ${loc}\n    ${id}: ${hint}\n`)
  }
  console.error(`${added.length} new violation(s). The VM cannot run these.\n`)
  process.exit(1)
}

if (fixed.length) {
  console.log(`✓ VM parity gate — ${fixed.length} violation(s) fixed since baseline.`)
  console.log('  Burn them down permanently: node scripts/check-vm-parity.mjs --refresh')
}
console.log(`✓ VM parity gate — no new macOS-only dependencies (${violations.length} known, baselined).`)
