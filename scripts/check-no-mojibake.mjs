#!/usr/bin/env node
/**
 * check-no-mojibake.mjs — CI gate: no UTF-8 mojibake in user-facing source.
 *
 * Mojibake is text that was UTF-8 but got decoded as Latin-1 (or cp1252) and
 * re-encoded as UTF-8, so a middle dot "·" becomes "Â·", an en dash "–" becomes
 * "â€“", an emoji becomes "ðŸ"…". It is ALWAYS a bug — never intentional — so this
 * gate is NOT ratcheted: zero tolerance, no baseline. If it fires, fix the bytes
 * at the source (replace the corrupted sequence with the correct character).
 *
 * Why a gate and not prose: the search-page rebuild (2026-05-30) found "Â·"
 * shipped in SearchResults, the map InfoWindow, the open-house badge, the admin
 * sync panel, and the geo admin page — copied forward across sessions because
 * nothing failed the build. Per Matt's directive "gates not prose," corruption
 * that keeps recurring becomes a mechanical check, not a reminder.
 *
 * Scans app/ and components/ (.ts/.tsx/.js/.jsx). These are the surfaces whose
 * string literals reach a browser.
 *
 * Usage:
 *   node scripts/check-no-mojibake.mjs            # CI mode, exit 1 on any hit
 *   node scripts/check-no-mojibake.mjs --report   # list hits, never exit 1
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')

const SCAN_DIRS = ['app', 'components']
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

/**
 * Canonical mojibake byte sequences. Each is the UTF-8-decoded-as-Latin-1
 * re-encoding of a common character. We match on RAW BYTES so a correctly
 * encoded "·" (0xC2 0xB7) never trips the gate — only the corrupted
 * "Â·" (0xC3 0x82 0xC2 0xB7) does.
 */
const MOJIBAKE = [
  { label: 'middle dot ·  → "Â·"', fix: '·', bytes: Buffer.from([0xc3, 0x82, 0xc2, 0xb7]) },
  { label: 'en dash –  → "â€“"', fix: '–', bytes: Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x80, 0x9c]) },
  { label: 'em dash —  → "â€”"', fix: '—', bytes: Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x80, 0x9d]) },
  { label: 'left quote “  → "â€œ"', fix: '“', bytes: Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc5, 0x93]) },
  { label: 'right quote ”  → "â€"', fix: '”', bytes: Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc2, 0x9d]) },
  { label: "apostrophe '  → \"â€™\"", fix: '’', bytes: Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xe2, 0x84, 0xa2]) },
  { label: 'bullet •  → "â€¢"', fix: '•', bytes: Buffer.from([0xc3, 0xa2, 0xe2, 0x82, 0xac, 0xc2, 0xa2]) },
  { label: 'emoji (4-byte) → "ðŸ…"', fix: '(emoji)', bytes: Buffer.from([0xc3, 0xb0, 0xc5, 0xb8]) },
  { label: 'NBSP / stray Â', fix: '(remove)', bytes: Buffer.from([0xc3, 0x82, 0xc2, 0xa0]) },
]

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      yield* walk(join(dir, entry.name))
    } else {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (FILE_EXTS.has(ext)) yield join(dir, entry.name)
    }
  }
}

function lineOf(buf, index) {
  let line = 1
  for (let i = 0; i < index && i < buf.length; i++) {
    if (buf[i] === 0x0a) line++
  }
  return line
}

const hits = []
for (const scanDir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, scanDir))) {
    const buf = readFileSync(file)
    for (const m of MOJIBAKE) {
      let from = 0
      let idx
      while ((idx = buf.indexOf(m.bytes, from)) !== -1) {
        hits.push({ file: relative(ROOT, file), line: lineOf(buf, idx), label: m.label, fix: m.fix })
        from = idx + m.bytes.length
      }
    }
  }
}

if (hits.length === 0) {
  console.log('Mojibake check: CLEAN — no corrupted UTF-8 sequences in app/ or components/.')
  process.exit(0)
}

console.log('Mojibake check: FAIL')
console.log('================')
console.log(`${hits.length} corrupted UTF-8 sequence(s) found. These are always bugs — fix the bytes at the source.\n`)
for (const h of hits) {
  console.log(`  ${h.file}:${h.line}  ${h.label}   (should be: ${h.fix})`)
}
console.log('\nHow to fix: replace the corrupted sequence with the correct character shown above.')
console.log('This gate has NO baseline — mojibake is never intentional.')

process.exit(REPORT ? 0 : 1)
