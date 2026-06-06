#!/usr/bin/env node
/**
 * check-email-brand-tokens.mjs — CI gate: no retired brand tokens in the
 * email / PDF / HTML generators that the design-token gate cannot see.
 *
 * Why this gate exists: scripts/lint-design-tokens.js (G4/G24) scans ONLY
 * `app/` + `components/`. Every client-facing surface that builds an HTML
 * string or a PDF outside those two dirs — the CMA delivery email, the broker
 * digests, the FSBO/expired alerts, the cron report emails — was invisible to
 * it. The 2026-06-05 sweep found retired gold (#D4AF37), retired old-cream
 * (#F2EBDD), retired sand (#e8e2d4), and retired web fonts (Inter, Arial,
 * Helvetica) shipping in those emails, copied forward across sessions because
 * nothing failed. Per Matt's directive "gates not prose," that becomes a check.
 *
 * Scans lib/ and app/api/ (.ts/.tsx/.js/.jsx). Flags:
 *   - Retired brand HEX: #D4AF37 / #C8A864 (gold), #F2EBDD (old cream),
 *     #e8e2d4 (sand), #0a1a2e (navy-deep), #2e4a3a (fir), #8fb8d4 (sky).
 *   - Retired-everywhere FONTS inside a font-family:/fontFamily: declaration:
 *     Playfair, Helvetica, Inter, Arial.
 *
 * Deliberately NOT flagged (legitimate per Design System v2):
 *   - AzoSans — retired on the web but KEPT for print; lib/pdf/* uses it.
 *   - system-ui / ui-sans-serif — valid modern OS-font keyword, used in map
 *     InfoWindows and transient OAuth/system pages.
 * The fix for a flagged token: import EMAIL_FONT_STACK / EMAIL_NAVY /
 * EMAIL_CREAM / EMAIL_BORDER from lib/email/brand.ts (the source of truth).
 *
 * Zero tolerance, no baseline — the tree is clean as of 2026-06-05 and these
 * tokens are never the right answer on a client-facing surface.
 *
 * Usage:
 *   node scripts/check-email-brand-tokens.mjs            # CI mode, exit 1 on hit
 *   node scripts/check-email-brand-tokens.mjs --report   # list hits, never exit 1
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = new Set(process.argv.slice(2))
const REPORT = args.has('--report')

const SCAN_DIRS = ['lib', 'app/api']
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])
// The source of truth documents the retired tokens in its comments by design.
const EXCLUDED_FILES = new Set(['lib/email/brand.ts'])

const RETIRED_HEX = [
  { hex: '#d4af37', label: 'gold #D4AF37', fix: 'EMAIL_NAVY (#102742) or EMAIL_CREAM (#faf8f4)' },
  { hex: '#c8a864', label: 'gold #C8A864', fix: 'EMAIL_NAVY (#102742) or EMAIL_CREAM (#faf8f4)' },
  { hex: '#f2ebdd', label: 'old cream #F2EBDD', fix: 'EMAIL_CREAM (#faf8f4)' },
  { hex: '#e8e2d4', label: 'sand #e8e2d4', fix: 'EMAIL_BORDER (rgba(16,39,66,0.08))' },
  { hex: '#0a1a2e', label: 'navy-deep #0a1a2e', fix: 'rgba(16,39,66,0.85)' },
  { hex: '#2e4a3a', label: 'fir #2e4a3a', fix: 'EMAIL_NAVY (#102742)' },
  { hex: '#8fb8d4', label: 'sky #8fb8d4', fix: 'EMAIL_NAVY (#102742)' },
]

// Retired-everywhere fonts (AzoSans + system-ui intentionally excluded — see header).
const RETIRED_FONT_RE =
  /(?:font-family|fontFamily)\s*:\s*[^;}\n]*?\b(Playfair|Helvetica|Inter|Arial)\b/i

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

function isCommentLine(trimmed) {
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*/') ||
    trimmed.startsWith('<!--')
  )
}

const hits = []
for (const scanDir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, scanDir))) {
    const rel = relative(ROOT, file)
    if (EXCLUDED_FILES.has(rel)) continue
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (isCommentLine(trimmed)) return
      const lower = line.toLowerCase()
      for (const r of RETIRED_HEX) {
        if (lower.includes(r.hex)) {
          hits.push({ file: rel, line: i + 1, label: r.label, fix: r.fix })
        }
      }
      const fontMatch = line.match(RETIRED_FONT_RE)
      if (fontMatch) {
        hits.push({
          file: rel,
          line: i + 1,
          label: `retired font "${fontMatch[1]}" in font-family`,
          fix: 'EMAIL_FONT_STACK',
        })
      }
    })
  }
}

if (hits.length === 0) {
  console.log('Email-brand-tokens check: CLEAN — no retired brand tokens in lib/ or app/api/ HTML/email/PDF generators.')
  process.exit(0)
}

console.log('Email-brand-tokens check: FAIL')
console.log('==============================')
console.log(
  `${hits.length} retired brand token(s) found in client-facing generators. ` +
    `Import the canonical tokens from lib/email/brand.ts.\n`,
)
for (const h of hits) {
  console.log(`  ${h.file}:${h.line}  ${h.label}   (use: ${h.fix})`)
}
console.log('\nThis gate has NO baseline — these tokens are never correct on a client-facing surface.')

process.exit(REPORT ? 0 : 1)
