#!/usr/bin/env node
/**
 * check-cma-routing.mjs — G47: CMA single-path routing + no-duplicate gate.
 *
 * Matt directive 2026-06-13: "all CMAs must only route through this skill / gates."
 * A parallel session built a second CMA for the SAME property under a different
 * slug (`cma-62285-deer` vs `cma-62285-deer-usa`). Two CMAs for one address =
 * two answers, drift, and a routing leak. This gate makes that impossible to commit.
 *
 * It enforces, against COMMITTED CMA output (`public/cmas/`):
 *   1. NO duplicate CMA for the same property — two distinct slugs that normalize
 *      to the same address (or where one slug is a prefix of another, the
 *      `-usa`/country-suffix case) is a hard fail.
 *   2. Every CMA dir is well-formed (has `cma.html`).
 *   3. The legacy `scripts/build_cma_wrapper.py` is NOT a live rogue builder —
 *      it must be retired/guarded (it used to COPY a canonical example CMA and
 *      relabel it, which would ship a wrong-property CMA outside the skill).
 *
 * `public/drafts/` is gitignored (scratch), so it is checked only when present
 * and reported as a WARNING locally — it never fails CI.
 *
 * The ONLY sanctioned way to produce a CMA is the agent running
 * `marketing_brain_skills/producers/cma/SKILL.md` against a `content:cma`
 * action row. The canonical slug = the action row's `target` slug
 * (`cma:<slug>`), derived once from the address. Never invent a second slug.
 *
 * Usage: node scripts/check-cma-routing.mjs            (fail on violation)
 *        node scripts/check-cma-routing.mjs --report   (list, never fail)
 */
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT = process.argv.includes('--report')
const errs = []
const warns = []

/** Normalize a CMA slug to an address key for duplicate detection. */
function normSlug(slug) {
  let s = slug.replace(/^cma-/, '')
  // strip trailing country / state / city tokens that create accidental aliases
  s = s.replace(/-(usa|us|oregon|or|bend)$/i, '')
  return s.replace(/-+$/, '')
}

/** Two slugs collide if normalized-equal OR one normalized is a prefix of the
 *  other at a dash boundary (`62285-deer` vs `62285-deer-usa`). */
function collide(a, b) {
  const na = normSlug(a), nb = normSlug(b)
  if (na === nb) return true
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na]
  return long === short || long.startsWith(short + '-')
}

function cmaSlugs(dir) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('cma-'))
    .map((e) => e.name)
}

// ── 1 + 2: committed CMAs in public/cmas ──────────────────────────────────────
const committed = cmaSlugs('public/cmas')
for (const slug of committed) {
  if (!existsSync(join(ROOT, 'public/cmas', slug, 'cma.html'))) {
    errs.push(`public/cmas/${slug}/ has no cma.html (malformed CMA dir).`)
  }
}
for (let i = 0; i < committed.length; i++) {
  for (let j = i + 1; j < committed.length; j++) {
    if (collide(committed[i], committed[j])) {
      errs.push(
        `Duplicate CMA for the same property: "${committed[i]}" and "${committed[j]}" ` +
          `both normalize to "${normSlug(committed[i])}". One property = one CMA = one slug ` +
          `(the action row's target slug). Consolidate to the canonical slug and remove the other.`,
      )
    }
  }
}

// ── 3: the legacy wrapper must not be a live rogue builder ─────────────────────
const wrapper = join(ROOT, 'scripts/build_cma_wrapper.py')
if (existsSync(wrapper)) {
  const body = readFileSync(wrapper, 'utf8')
  const isRetired = /retired|RETIRED|raise SystemExit|sys\.exit\(\s*1/.test(body)
  const stillCopiesExample = /copytree|shutil\.copy/.test(body) && !isRetired
  if (stillCopiesExample) {
    errs.push(
      'scripts/build_cma_wrapper.py is a live rogue CMA builder (it copies a canonical ' +
        'example CMA and relabels it — would ship a wrong-property CMA outside the skill). ' +
        'Retire it: replace the body with a guard that refuses and points to ' +
        'marketing_brain_skills/producers/cma/SKILL.md.',
    )
  }
}

// ── drafts: warn-only (gitignored scratch) ────────────────────────────────────
const drafts = cmaSlugs('public/drafts')
const all = [...committed.map((s) => ['cmas', s]), ...drafts.map((s) => ['drafts', s])]
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const [da, sa] = all[i], [db, sb] = all[j]
    if (sa !== sb && collide(sa, sb)) {
      const msg = `Two slugs for one property across draft/committed: ${da}/${sa} vs ${db}/${sb}.`
      // only WARN if at least one side is a draft (local scratch); committed-vs-committed already errored above
      if (da === 'drafts' || db === 'drafts') warns.push(msg + ' Consolidate to the canonical slug before finalizing.')
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────────
console.log(`check-cma-routing: ${committed.length} committed CMA(s), ${drafts.length} draft(s)`)
for (const w of warns) console.warn(`  ! WARN ${w}`)
if (errs.length === 0) {
  console.log('✓ CMA routing clean — one property, one slug, single path.')
  process.exit(0)
}
console.error(`\n✗ ${errs.length} CMA-routing violation(s):`)
for (const e of errs) console.error(`  • ${e}`)
console.error('\nFix: every CMA routes through marketing_brain_skills/producers/cma/SKILL.md, one canonical slug per property.')
process.exit(REPORT ? 0 : 1)
