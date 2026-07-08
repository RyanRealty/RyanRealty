/**
 * check-css-cascade-layers — the gate behind design-audit P0 #1.
 *
 * Tailwind v4 puts every utility in `@layer utilities`. UN-LAYERED author CSS
 * beats ALL layered CSS regardless of specificity, so an innocent-looking
 * un-layered rule like `.kb-root a { color: inherit }` silently overrides
 * `.text-white` on every link inside that subtree. That exact rule rendered
 * invisible navy-on-navy CTA text on the seller money path for weeks.
 *
 * Rule: in imported component/app CSS files, a rule whose selector TARGETS
 * BARE LINKS OR BUTTONS (ends with ` a`, `a`, ` button`, etc. — no class on
 * the element itself) and DECLARES `color:` must live inside an `@layer`
 * block (so utilities keep winning). Element selectors that only set
 * non-color properties, and class-targeted selectors, are out of scope —
 * this gate is deliberately narrow to the incident class.
 *
 * Ratchet: existing offenders live in the baseline (may only shrink).
 *   node scripts/check-css-cascade-layers.mjs            # check
 *   node scripts/check-css-cascade-layers.mjs --write    # regenerate baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['components', 'app']
const BASELINE_PATH = join(ROOT, 'scripts', 'css-cascade-layers-baseline.json')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      walk(p, out)
    } else if (name.endsWith('.css')) {
      out.push(p)
    }
  }
  return out
}

/** Strip comments, then find top-level rules (not inside @layer) whose selector
 *  targets a bare `a` or `button` element and whose body sets `color:`. */
function findOffenders(css, file) {
  const offenders = []
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // Track @layer nesting depth by scanning braces.
  let i = 0
  let depth = 0
  let layerDepths = [] // depths at which an @layer block opened
  let selStart = 0
  while (i < noComments.length) {
    const ch = noComments[i]
    if (ch === '{') {
      const chunk = noComments.slice(selStart, i).trim()
      const lastAt = chunk.lastIndexOf('@')
      const atRule = lastAt >= 0 ? chunk.slice(lastAt) : ''
      if (/^@layer\b/.test(atRule)) layerDepths.push(depth)
      depth += 1
      // Only inspect rules OUTSIDE any @layer block.
      if (layerDepths.length === 0 && chunk && !chunk.startsWith('@')) {
        const selectors = chunk.split('\n').pop().split(',').map((s) => s.trim())
        const bareLink = selectors.some((sel) => /(^|[\s>+~])(a|button)(:[a-z-]+(\([^)]*\))?)*$/.test(sel))
        if (bareLink) {
          const bodyEnd = noComments.indexOf('}', i)
          const body = noComments.slice(i + 1, bodyEnd === -1 ? undefined : bodyEnd)
          if (/(^|[;{\s])color\s*:/.test(body)) {
            const line = noComments.slice(0, i).split('\n').length
            offenders.push(`${file}:${line} ${selectors.join(', ').slice(0, 80)}`)
          }
        }
      }
      selStart = i + 1
    } else if (ch === '}') {
      depth -= 1
      if (layerDepths.length && layerDepths[layerDepths.length - 1] === depth) layerDepths.pop()
      selStart = i + 1
    } else if (ch === ';') {
      selStart = i + 1
    }
    i += 1
  }
  return offenders
}

const files = SCAN_DIRS.flatMap((d) => (existsSync(join(ROOT, d)) ? walk(join(ROOT, d)) : []))
const offenders = []
for (const f of files) {
  const rel = relative(ROOT, f)
  if (rel === 'app/globals.css') continue // Tailwind entry — already layer-managed
  offenders.push(...findOffenders(readFileSync(f, 'utf8'), rel))
}

const writeMode = process.argv.includes('--write')
if (writeMode) {
  writeFileSync(BASELINE_PATH, JSON.stringify({
    $comment:
      'Ratchet baseline for check-css-cascade-layers.mjs. Each entry is an un-layered ' +
      'bare-element link/button color rule (file:line selector). May only SHRINK: move the ' +
      'rule into @layer base (so Tailwind utilities keep winning) and remove its entry.',
    offenders,
  }, null, 2) + '\n')
  console.log(`Baseline written: ${offenders.length} offender(s)`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).offenders ?? [])
  : new Set()
const fresh = offenders.filter((o) => !baseline.has(o))

console.log('CSS cascade-layer gate (un-layered element color rules)')
console.log('========================================================')
console.log(`Offenders (live): ${offenders.length} · baseline: ${baseline.size} · NEW: ${fresh.length}`)
if (fresh.length) {
  console.log('\nNEW un-layered element color rules (these fail CI):')
  for (const o of fresh) console.log(`  ${o}`)
  console.log('\nFix: wrap the rule in `@layer base { ... }` so Tailwind color utilities')
  console.log('(.text-white etc.) keep winning — un-layered CSS beats the entire utilities')
  console.log('layer regardless of specificity (the invisible-CTA-text P0, 2026-07-08).')
  process.exit(1)
}
console.log('✓ no new un-layered element color rules')
