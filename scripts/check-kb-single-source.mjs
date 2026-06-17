/**
 * G50 — KB sections single-source guard.
 *
 * The kinetic-brutalist sections in components/site/kb/ are the reusable single
 * source of truth (see components/site/kb/README.md). Each `Kb*` section
 * component must be DEFINED only there, so a page reuses it via props and an
 * adjustment to a section propagates to every page that uses it. A forked /
 * duplicated copy elsewhere would drift — a fix would reach one page but not the
 * others, exactly the "do the painful process all over again" failure we are
 * preventing.
 *
 * This gate fails if any `export function Kb<Name>` / `export const Kb<Name> =`
 * (a KB section component) is defined OUTSIDE components/site/kb/.
 *
 * Usage: node scripts/check-kb-single-source.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const KB_DIR = 'components/site/kb'
const SCAN = ['app', 'components', 'lib']
// `Kb` + CapitalLetter, exported as a function or const (a component). Types /
// interfaces (export type/interface Kb...) are data shapes, not components — not matched.
const RE = /export\s+(?:async\s+)?(?:function|const)\s+(Kb[A-Z][A-Za-z0-9]*)/g

function walk(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.next') continue
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

const offenders = []
for (const rel of SCAN.flatMap((d) => walk(d))) {
  if (rel.startsWith(KB_DIR + '/')) continue // the canonical home
  const src = readFileSync(join(ROOT, rel), 'utf8')
  let m
  while ((m = RE.exec(src)) !== null) {
    offenders.push(`${rel} -> ${m[1]}`)
  }
}

if (offenders.length) {
  console.error(`\n✗ kb-single-source: ${offenders.length} KB section(s) defined outside ${KB_DIR}/ (a fork):\n`)
  for (const o of offenders) console.error('  • ' + o)
  console.error(
    '\n  KB sections are the reusable single source of truth — never fork one. Move it to\n' +
      `  ${KB_DIR}/ and import it, or generalize the existing component with a prop. See\n` +
      '  components/site/kb/README.md.',
  )
  process.exit(1)
}
console.log(`✓ kb-single-source: every Kb* section is defined only in ${KB_DIR}/ (reusable, no forks).`)
