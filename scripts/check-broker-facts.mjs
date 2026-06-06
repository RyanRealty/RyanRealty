#!/usr/bin/env node
/**
 * check-broker-facts.mjs — CI gate G38: broker/brokerage facts stay centralized.
 *
 * The canonical source of truth is lib/brand/contact.ts (BRAND / CONTACT /
 * BROKERS). Before it, the brokerage phone numbers and social-profile URLs were
 * copied as literals into ~30 files, so a phone or handle change meant a
 * repo-wide find-and-replace certain to leave a stale copy. This gate bans those
 * canonical literals from reappearing in app/ + components/ RENDER code: every
 * surface imports `CONTACT.phoneDirect`, `CONTACT.phoneFub`, `BRAND.social.*`
 * instead of typing the digits/URL.
 *
 * RATCHETED, per-file COUNT baseline (matches the design-tokens gate). The
 * centralization is a multi-batch migration, so existing literals are
 * grandfathered in scripts/broker-facts-baseline.json. A file may only ever
 * have FEWER hits than its baseline — adding a new literal (count goes up) fails.
 * As each file is migrated to the module, drop its (now-lower) count and
 * re-baseline; when it hits 0, remove it. New files start at baseline 0, so any
 * literal in a new file fails immediately.
 *
 * Scope: app/ + components/, .ts/.tsx. lib/ is excluded (the module + roster +
 * listing-cta legitimately hold the literals). Emails are NOT gated (too many
 * legitimate non-render uses). Escape hatch: end a line with `broker-facts-ok`.
 *
 * Usage:
 *   node scripts/check-broker-facts.mjs                  # CI mode
 *   node scripts/check-broker-facts.mjs --report          # list all hits, never fail
 *   node scripts/check-broker-facts.mjs --write-baseline  # capture current counts
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')
const WRITE_BASELINE = args.has('--write-baseline')

const SCAN_DIRS = ['app', 'components']
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const BASELINE_PATH = join(ROOT, 'scripts/broker-facts-baseline.json')

// Banned canonical literals. No \b anchors — the digit run is specific enough
// that substring matching safely catches the dotted (541.213.6706), hyphen
// (541-213-6706), bare (5412136706), and E.164 (+1-541-213-6706 / +15412136706)
// forms in one pattern. Use the module instead: CONTACT.phoneDirect / .phoneFub
// / .phoneDirectTel / .phoneFubTel, and BRAND.social.* for profile URLs.
const BANNED = [
  { key: 'CONTACT.phoneDirect (541.213.6706)', re: /541[.\- ]?213[.\- ]?6706/ },
  { key: 'CONTACT.phoneFub (541.703.3095)', re: /541[.\- ]?703[.\- ]?3095/ },
  {
    key: 'BRAND.social.* (ryanrealtybend profile URL)',
    re: /(instagram|facebook|youtube|tiktok|linkedin|pinterest|threads|x|twitter)\.(com|net)\/@?ryanrealtybend/i,
  },
]

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      walk(join(dir, entry.name), out)
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name) &&
      // Server email/SMS/action + API code is out of scope — those phone
      // literals are transactional-comms signatures, not website render, and
      // the module is a second-pass migration there (see plan §3 EXCLUDED).
      !/^(route|actions)\.tsx?$/.test(entry.name)
    ) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

// Collect hits keyed by file.
const hitsByFile = new Map() // relFile -> [{ line, key, text }]
for (const scanDir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, scanDir))) {
    const rel = relative(ROOT, file).split('\\').join('/')
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
      if (line.includes('broker-facts-ok')) return
      for (const b of BANNED) {
        if (b.re.test(line)) {
          if (!hitsByFile.has(rel)) hitsByFile.set(rel, [])
          hitsByFile.get(rel).push({ line: i + 1, key: b.key, text: trimmed.slice(0, 110) })
        }
      }
    })
  }
}

const currentCounts = {}
for (const [file, list] of hitsByFile) currentCounts[file] = list.length

if (WRITE_BASELINE) {
  const sorted = Object.fromEntries(Object.entries(currentCounts).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n')
  const total = Object.values(sorted).reduce((s, n) => s + n, 0)
  console.log(`Broker-facts baseline written: ${total} grandfathered literal(s) across ${Object.keys(sorted).length} file(s).`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}

if (REPORT) {
  const total = Object.values(currentCounts).reduce((s, n) => s + n, 0)
  console.log(`Broker-facts report — ${total} literal(s) across ${hitsByFile.size} file(s):`)
  for (const [file, list] of [...hitsByFile].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n  ${file}  (baseline ${baseline[file] ?? 0})`)
    for (const h of list) console.log(`    ${h.line}  ${h.key}\n        ${h.text}`)
  }
  process.exit(0)
}

// Fail on any file whose count exceeds its baseline.
const regressions = []
for (const [file, list] of hitsByFile) {
  const allowed = baseline[file] ?? 0
  if (list.length > allowed) regressions.push({ file, count: list.length, allowed, list })
}

if (regressions.length === 0) {
  const total = Object.values(currentCounts).reduce((s, n) => s + n, 0)
  console.log(`Broker-facts gate passed — no new hardcoded broker facts (${total} grandfathered, trending down).`)
  process.exit(0)
}

console.error('\nBroker-facts gate FAILED — new hardcoded broker fact(s) in app/ or components/:')
for (const r of regressions) {
  console.error(`\n  ${r.file}  (${r.count} hits, baseline ${r.allowed})`)
  for (const h of r.list) console.error(`    ${h.line}  ${h.key}\n        ${h.text}`)
}
console.error('\nImport from lib/brand/contact.ts (CONTACT.phoneDirect / .phoneFub / BRAND.social.*)')
console.error('instead of typing the literal. After migrating a file, run --write-baseline to ratchet down.')
console.error('Auditable exception: append `broker-facts-ok` to the line.')
process.exit(1)
