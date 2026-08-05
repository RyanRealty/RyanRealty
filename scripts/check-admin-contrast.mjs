#!/usr/bin/env node
/**
 * check-admin-contrast.mjs — computed AA spot-check on the locked admin
 * tokens (P10, 2026-08-05). ADMIN_UI.md §4 shipped with computed ratios; this
 * gate RECOMPUTES them from design_system/admin/tokens.css on every run so a
 * token edit can never silently break a contrast pair (computed, not claimed).
 *
 * Pairs + thresholds (WCAG 2.x):
 *   - body text pairs ≥ 4.5 (AA normal text)
 *   - state words on their washes ≥ 4.5 (they render at 11-12px, bold —
 *     held to the normal-text bar deliberately)
 *   - solid button fg/bg ≥ 4.5
 * Checked in BOTH themes (light :root block, [data-theme="dark"] block).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS = readFileSync(join(process.cwd(), 'design_system/admin/tokens.css'), 'utf8')

function blockVars(block) {
  const out = {}
  for (const m of block.matchAll(/--(a-[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)) out[`--${m[1]}`] = m[2]
  return out
}
const DARK_SEL = '\n[data-theme="dark"] {'
const darkAt = CSS.indexOf(DARK_SEL)
const lightBlock = darkAt === -1 ? CSS : CSS.slice(0, darkAt)
const darkBlock = darkAt === -1 ? '' : CSS.slice(darkAt)
const THEMES = { light: blockVars(lightBlock), dark: blockVars(darkBlock) }

function lum(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// [foreground, background, minimum]
const PAIRS = [
  ['--a-text', '--a-bg', 4.5],
  ['--a-text', '--a-surface', 4.5],
  ['--a-text-2', '--a-bg', 4.5],
  ['--a-text-2', '--a-surface', 4.5],
  ['--a-accent', '--a-bg', 4.5],
  ['--a-accent', '--a-accent-wash', 4.5],
  ['--a-btn-fg', '--a-btn-bg', 4.5],
  ['--a-ok', '--a-ok-wash', 4.5],
  ['--a-warn', '--a-warn-wash', 4.5],
  ['--a-danger', '--a-danger-wash', 4.5],
]

const failures = []
for (const [theme, vars] of Object.entries(THEMES)) {
  if (Object.keys(vars).length < 10) {
    failures.push(`${theme}: token block parse found only ${Object.keys(vars).length} hex vars — check the block markers`)
    continue
  }
  for (const [fg, bg, min] of PAIRS) {
    const f = vars[fg]
    const b = vars[bg]
    if (!f || !b) {
      failures.push(`${theme}: missing token ${!f ? fg : bg} for pair ${fg} on ${bg}`)
      continue
    }
    const r = ratio(f, b)
    if (r < min) failures.push(`${theme}: ${fg} on ${bg} = ${r.toFixed(2)}:1 (< ${min}:1) — ${f} on ${b}`)
  }
}

if (failures.length) {
  console.error('✗ admin contrast gate failed:')
  for (const f of failures) console.error('  ' + f)
  process.exit(1)
}
console.log(`✓ admin contrast: ${PAIRS.length} pairs ≥ AA in both themes (computed from the locked tokens).`)
