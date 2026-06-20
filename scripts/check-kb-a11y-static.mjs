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
import { readFileSync } from 'node:fs'

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

console.log('KB static a11y guard (kb.css)')
console.log('============================')
if (failures.length) {
  console.error(`\nFAIL — ${failures.length} issue(s):\n`)
  for (const f of failures) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log('No sub-AA text tokens; every focus state keeps a visible indicator.')
