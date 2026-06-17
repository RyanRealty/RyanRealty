/**
 * G47 — shadcn burn-down ratchet.
 *
 * The kinetic-brutalist (KB) design system replaces shadcn surface-by-surface.
 * This gate counts files on the MIGRATION-TARGET surfaces that import
 * `@/components/ui` and ratchets that count DOWN: a migration removes shadcn
 * imports, never adds. New site work uses KB, not shadcn.
 *
 * Scope EXCLUDES surfaces that legitimately keep shadcn forever:
 *   - components/ui/**        (shadcn itself)
 *   - app/admin/**, app/components/admin/**, components/admin/** (admin = its own design system)
 *   - app/lp/**               (paid LPs, migrate via the ad/LP track, not KB site shell)
 *   - app/sign/**, components/tc/** (e-sign / transaction-coordinator surfaces)
 *
 * Usage:
 *   node scripts/check-shadcn-burndown.mjs                # ratchet (CI)
 *   node scripts/check-shadcn-burndown.mjs --write-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const BASELINE = join(ROOT, 'scripts/shadcn-burndown-baseline.json')
const WRITE = process.argv.includes('--write-baseline')

const SCAN = ['app', 'components']
const EXCLUDE = [
  'components/ui/',
  'app/admin/',
  'app/components/admin/',
  'components/admin/',
  'app/lp/',
  'app/sign/',
  'components/tc/',
]

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const full = join(dir, name)
    const rel = relative(ROOT, full).replace(/\\/g, '/')
    if (statSync(full).isDirectory()) {
      if (EXCLUDE.some((e) => `${rel}/`.startsWith(e))) continue
      walk(full, out)
    } else if (/\.(tsx|ts)$/.test(name)) {
      if (EXCLUDE.some((e) => rel.startsWith(e))) continue
      out.push(rel)
    }
  }
  return out
}

const importers = walk(join(ROOT, 'app'))
  .concat(walk(join(ROOT, 'components')))
  .filter((f) => /from\s+['"]@\/components\/ui\//.test(readFileSync(join(ROOT, f), 'utf8')))
  .sort()

if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify({ count: importers.length, files: importers }, null, 2) + '\n')
  console.log(`Wrote shadcn-burndown baseline: ${importers.length} files import @/components/ui (migration surfaces).`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error('✗ No shadcn-burndown baseline. Run: node scripts/check-shadcn-burndown.mjs --write-baseline')
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const now = importers.length
if (now > baseline.count) {
  const added = importers.filter((f) => !baseline.files.includes(f))
  console.error(`\n✗ shadcn burn-down regression: ${now} files import @/components/ui vs baseline ${baseline.count} (+${now - baseline.count}).`)
  console.error('  New site surfaces must use the KB design system, not shadcn. New importers:')
  added.forEach((f) => console.error(`   - ${f}`))
  console.error('  (Migrate the surface to KB, or if it legitimately needs shadcn forever, add its dir to EXCLUDE in this gate.)')
  process.exit(1)
}
if (now < baseline.count) {
  console.log(`✓ shadcn burn-down improved: ${now} vs baseline ${baseline.count} (−${baseline.count - now}). Run --write-baseline to ratchet down.`)
} else {
  console.log(`✓ shadcn burn-down stable: ${now} files import @/components/ui (= baseline).`)
}
