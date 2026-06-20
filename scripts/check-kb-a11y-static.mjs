#!/usr/bin/env node
/**
 * check-kb-a11y-static.mjs — static WCAG guard for the KB design system.
 *
 * Locks the two accessibility regressions found + fixed in the 2026-06-19 KB
 * a11y pass (axe-core baseline 28 -> 0 real violations). Both are FUNCTIONAL
 * bugs, not cosmetics — invisible text and a lost keyboard focus ring — so they
 * belong in the crash-guard tier, not as prose.
 *
 * Check 1 — no sub-AA token used as TEXT.
 *   `color:var(--cream-40 | --cream-12 | --cream-05)` resolves to < 4.5:1 on
 *   navy and fails WCAG 1.4.3. Those tokens are for faint lines/dividers only.
 *   Muted text uses `--cream-muted` (.60 -> 5.99:1) or `--cream-70`. The check
 *   targets the `color` property specifically — `border-color`, `scrollbar-color`,
 *   gradients, and borders may still use `--cream-40`.
 *
 * Check 2 — a :focus / :focus-visible / :focus-within rule must not remove the
 *   outline (`outline:none|0`) without providing a replacement indicator
 *   (a non-zero outline, a box-shadow ring, or a border). WCAG 2.4.7. A resting
 *   `outline:0` reset OUTSIDE a focus selector is fine (the global
 *   `:focus-visible` rule restores it).
 *
 * Usage: node scripts/check-kb-a11y-static.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const FILE = 'components/site/kb/kb.css'
const raw = readFileSync(FILE, 'utf8')
// Strip /* ... */ comments so a comment mentioning a banned pattern is not flagged.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')

const failures = []

// ── Check 1: sub-AA token as text color ──────────────────────────────────────
// `color:` not preceded by a word char or hyphen (so not `-color` / `scrollbar-color`).
const subAaText = /(?<![-\w])color\s*:\s*var\(\s*--cream-(40|12|05)\b/g
let m
while ((m = subAaText.exec(css)) !== null) {
  const line = css.slice(0, m.index).split('\n').length
  failures.push(
    `${FILE}:${line}  color:var(--cream-${m[1]}) used as TEXT — fails WCAG 1.4.3 (< 4.5:1 on navy). ` +
      `Use var(--cream-muted) or var(--cream-70) for muted text; keep --cream-40 for lines only.`,
  )
}

// ── Check 2: focus state strips the outline with no replacement ──────────────
// Match each rule whose selector list contains :focus and capture its body.
const ruleRe = /([^{}]*\{)/g // step through selector blocks
// Simpler: iterate selector{body} pairs.
const pairRe = /([^{}]+)\{([^{}]*)\}/g
let r
while ((r = pairRe.exec(css)) !== null) {
  const selector = r[1]
  const body = r[2]
  if (!/:focus(-visible|-within)?\b/.test(selector)) continue
  const stripsOutline = /outline\s*:\s*(none|0)\b/.test(body)
  if (!stripsOutline) continue
  const hasReplacement =
    /outline\s*:\s*[^;]*\b(solid|dashed|dotted|double|groove|ridge|inset|outset|[1-9]\d*px|0\.\d+em|\.\d+em|[1-9]\d*em)/.test(
      body,
    ) ||
    /box-shadow\s*:\s*(?!none)[^;]+/.test(body) ||
    /\bborder(-\w+)?\s*:\s*(?!0|none)[^;]+/.test(body)
  if (!hasReplacement) {
    const line = css.slice(0, r.index).split('\n').length
    failures.push(
      `${FILE}:~${line}  focus selector "${selector.trim().slice(0, 60)}" removes the outline ` +
        `(outline:none|0) with no replacement — keyboard users lose the focus ring (WCAG 2.4.7). ` +
        `Add a visible outline, box-shadow ring, or border in the same rule.`,
    )
  }
}

// ── Check 3: sub-AA navy-alpha as a TEXT color in site components ────────────
// The navy-side analog of cream-40: navy at < 0.64 alpha on cream/white is < 4.5:1.
// Muted text on light surfaces must use navy-70+ (rgba(16,39,66,0.7) → 5.56:1).
// Scans components/site (inline styles), excluding gradients/backgrounds (those
// don't use the `color:` property).
function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.tsx')) out.push(p)
  }
  return out
}
// Any navy rgba used as a `color:` with alpha < 0.64 fails AA on cream/white
// (navy-0.64 ≈ 4.5:1). Parse the alpha rather than enumerate values, so 0.42 etc.
// can't slip through.
const navyText = /\bcolor\s*:\s*['"]rgba\(\s*16\s*,\s*39\s*,\s*66\s*,\s*(0?\.\d+|0|1)\s*\)['"]/g
for (const file of walk('components/site')) {
  const src = readFileSync(file, 'utf8')
  let mm
  while ((mm = navyText.exec(src)) !== null) {
    const alpha = parseFloat(mm[1])
    if (alpha >= 0.64) continue
    const line = src.slice(0, mm.index).split('\n').length
    failures.push(
      `${file}:${line}  color rgba(16,39,66,${mm[1]}) used as TEXT — navy < 0.64 alpha on cream/white fails WCAG 1.4.3 (< 4.5:1). ` +
        `Use rgba(16,39,66,0.72) (5.8:1) or var(--navy-70) for muted text.`,
    )
  }
}

console.log('KB static a11y guard (kb.css + site inline styles)')
console.log('============================')
if (failures.length) {
  console.error(`\nFAIL — ${failures.length} issue(s):\n`)
  for (const f of failures) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log('No sub-AA text tokens; every focus state keeps a visible indicator.')
