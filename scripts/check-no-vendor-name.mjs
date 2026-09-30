#!/usr/bin/env node
/**
 * check-no-vendor-name.mjs — ci:no-vendor-name.
 *
 * Matt (2026-09-25): the outside monthly-report appraiser we are replacing may
 * not be named anywhere in this repo's tracked text — source, SQL, migrations
 * (including historic ones), generated types, scripts, comments, docs,
 * CHANGELOG. The only two permitted occurrences of the word:
 *   1. The browser API `navigator.sendBeacon` / `sendBeacon` (identifier and
 *      prose that names that API).
 *   2. Third-party data we do not author: an MLS subdivision literally named
 *      with it (data/search-metadata/spark-metadata.snapshot.json), and street
 *      addresses in docs/research/*.json.
 *
 * The vendor word is assembled from two pieces below (VENDOR_WORD) so this
 * gate file itself never carries the name.
 *
 * Usage: node scripts/check-no-vendor-name.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)

// Assembled from two pieces — see the file header — so this gate never spells
// the vendor's name in its own source.
export const VENDOR_WORD = ['bea', 'con'].join('')

const BINARY_RE =
  /\.(png|jpe?g|webp|gif|ico|avif|heic|pdf|mp4|mov|webm|mp3|wav|otf|ttf|woff2?|eot|zip|gz|tar|bin)$/i

// This gate's own files: excluded so editing this file (which necessarily
// discusses the word it forbids) can never fail itself.
const SELF_PATHS = new Set([
  'scripts/check-no-vendor-name.mjs',
  'scripts/__tests__/check-no-vendor-name.test.mjs',
])

/**
 * Third-party data we do not author. See the file header and CLAUDE.md §6.
 */
export function isThirdPartyDataPath(filePath) {
  if (filePath === 'data/search-metadata/spark-metadata.snapshot.json') return true
  if (/^docs\/research\/[^/]+\.json$/.test(filePath)) return true
  return false
}

/**
 * True when the match at `index` (VENDOR_WORD.length characters long) inside
 * `line` is part of the literal token `sendBeacon` — the one permitted
 * identifier. Checked as an exact 10-character, case-insensitive window
 * ("send" + the vendor word) ending where the match ends.
 */
export function isPermittedApiToken(line, index) {
  const window = line.slice(Math.max(0, index - 4), index + VENDOR_WORD.length).toLowerCase()
  return window === 'send' + VENDOR_WORD
}

/** 1-based columns of every disallowed occurrence in one line. */
export function findLineViolations(line) {
  const re = new RegExp(VENDOR_WORD, 'gi')
  const cols = []
  let m
  while ((m = re.exec(line)) !== null) {
    if (!isPermittedApiToken(line, m.index)) cols.push(m.index + 1)
  }
  return cols
}

/** Violations in one file's content, honoring the third-party allowlist. */
export function findFileViolations(filePath, content) {
  if (isThirdPartyDataPath(filePath)) return []
  const violations = []
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    for (const col of findLineViolations(line)) {
      violations.push({ file: filePath, line: i + 1, col, text: line.trim().slice(0, 160) })
    }
  })
  return violations
}

function main() {
  const tracked = execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean)

  const violations = []
  let scanned = 0
  for (const f of tracked) {
    if (SELF_PATHS.has(f) || BINARY_RE.test(f)) continue
    let content
    try {
      content = readFileSync(f, 'utf8')
    } catch {
      continue // unreadable (binary despite extension, submodule, etc.)
    }
    scanned++
    violations.push(...findFileViolations(f, content))
  }

  console.log('Vendor-name gate (ci:no-vendor-name)')
  console.log('=====================================')
  console.log(`files scanned: ${scanned}`)

  if (violations.length) {
    console.error(`\n✗ ci:no-vendor-name — ${violations.length} disallowed occurrence(s):`)
    for (const v of violations) console.error(`  ${v.file}:${v.line}: ${v.text}`)
    console.error(
      '\nThe outside report vendor\'s name may not appear in tracked text (Matt 2026-09-25).' +
        ' Reword it. If this is genuinely the sendBeacon API or third-party data we do not' +
        ' author, extend the allowlist in scripts/check-no-vendor-name.mjs with a reason.',
    )
    process.exit(1)
  }
  console.log('\n✓ No vendor-name occurrences outside the sendBeacon API and third-party data.')
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
