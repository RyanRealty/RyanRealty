#!/usr/bin/env node
/**
 * G58 — default-chrome footer scoping gate.
 *
 * 2026-07-29: SiteFooter was removed from the root layout. It used to render on
 * EVERY route behind the HideChrome CSS gate (display:none on KB/LP/admin
 * routes), which shipped a hidden 48-link <footer> in the HTML of every page on
 * the site — dead DOM weight on the whole SEO surface, and Google discounts
 * display:none links. The footer is now rendered server-side by exactly the
 * routes that show it (lib/site/chrome-routes.ts § shouldHideDefaultChrome ===
 * false): legal, auth, account, dashboard, utility pages, and the legacy
 * 2-segment /housing-market report branch.
 *
 * This gate freezes both directions of that contract:
 *
 *  1. app/layout.tsx must NOT reference SiteFooter — re-adding it there brings
 *     the hidden footer back on every page.
 *  2. Every public app/**\/page.tsx must end up with SOME footer:
 *       - a KB page (renders kb-root / KbFooter; G53 enforces the KbNav pairing), or
 *       - a v3 page (renders V3_ROOT_CLASS / V3Footer, the public-product
 *         destination register locked 2026-08-11), or
 *       - SiteFooter in the page itself or an ancestor layout.tsx, or
 *       - a one-level local import that provides either of the above
 *         (delegating pages), or
 *       - the explicit no-footer allowlist (redirect-only pages).
 *  3. A pure KB page must NOT also render SiteFooter (double footer). The
 *     dual-register /housing-market/[...slug] page legitimately renders both
 *     (one per branch) and is allowlisted.
 *
 * Usage: node scripts/check-default-chrome-footer.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ROOT = 'app'

/** Routes that render no footer at all, by design. */
const NO_FOOTER_PREFIXES = [
  'app/admin/', // admin shell carries its own chrome
  'app/lp/', // LPs are conversion-focused, no marketing chrome
  'app/sign/', // distraction-free e-signature surface
  'app/concept/', // KB design previews carry their own chrome
  'app/dev/', // dev-only design prototypes: noindex, unlinked, own chrome by definition
]

/** Redirect-only pages — they never render UI, so they need no footer. */
const REDIRECT_ONLY = new Set([
  'app/feed/page.tsx', // P3 lock: 301 /feed into /videos?view=feed
  'app/reports/[slug]/[geoName]/page.tsx', // permanentRedirect to /housing-market
  'app/housing-market/reports/[slug]/[geoName]/page.tsx', // re-exports the redirect above
  'app/listing/by-key/[listingKey]/page.tsx', // permanentRedirect to canonical listing URL
  'app/motivated-sellers/page.tsx', // IA lock: 308 into /price-drops
  'app/motivated-sellers/[city]/page.tsx', // IA lock: 308 into /price-drops/[city]
])

/** Pages that legitimately render BOTH KbFooter and SiteFooter (one per branch). */
const DUAL_REGISTER = new Set([
  'app/housing-market/[...slug]/page.tsx', // 1-seg = KB city report, 2-seg = legacy default-chrome report
])

function pageFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) pageFiles(full, out)
    else if (name === 'page.tsx') out.push(full)
  }
  return out
}

/**
 * Strip comments so doc mentions don't count (same as G53). Line comments go
 * FIRST: a glob like `@/app/actions/*` inside a `//` comment carries the literal
 * `/*`, and stripping block comments first opens a phantom comment there that
 * swallows the rest of the file. Three market pages were saved from a false
 * verdict here only because `KbFooter` also survived the swallow (found
 * 2026-08-12, docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 2.1).
 */
function code(src) {
  return src.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')
}

const hasKb = (c) => /kb-root/.test(c) || /\bKbFooter\b/.test(c)
/**
 * The public v3 register (components/site/v3) carries its own footer, V3Footer,
 * and opens its token scope with V3_ROOT_CLASS. It satisfies rule 2 exactly the
 * way a KB page does. Without this arm the first migrated page fails here with no
 * honest page-side fix: the one-level import escape below cannot reach the barrel,
 * because the real file is components/site/v3/index.ts and `index.ts` is not among
 * the resolver's candidate filenames. Visual lock 2026-08-11,
 * docs/plans/PUBLIC_PRODUCT/decisions.md.
 */
const hasV3 = (c) => /\bV3Footer\b/.test(c) || /\bV3_ROOT_CLASS\b/.test(c)
const hasSiteFooter = (c) => /\bSiteFooter\b/.test(c)

/** Resolve a page's local imports one level deep and return their code. */
function importedCode(file, src) {
  const dir = dirname(file)
  const out = []
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    let spec = m[1]
    if (spec.startsWith('@/')) spec = spec.slice(2)
    else if (spec.startsWith('.')) spec = join(dir, spec)
    else continue
    for (const cand of [spec, `${spec}.tsx`, `${spec}.ts`, join(spec, 'index.tsx'), join(spec, 'page.tsx')]) {
      if (existsSync(cand) && statSync(cand).isFile()) {
        out.push(code(readFileSync(cand, 'utf8')))
        break
      }
    }
  }
  return out.join('\n')
}

/** True if any layout.tsx between the page's dir and app/ (exclusive of the root
 *  layout, which rule 1 keeps footer-free) renders SiteFooter. */
function ancestorLayoutHasFooter(file) {
  let dir = dirname(file)
  while (dir !== ROOT && dir !== '.') {
    const layout = join(dir, 'layout.tsx')
    if (existsSync(layout) && hasSiteFooter(code(readFileSync(layout, 'utf8')))) return true
    dir = dirname(dir)
  }
  return false
}

const fails = []

// Rule 1 — the root layout stays footer-free.
const rootLayout = code(readFileSync(join(ROOT, 'layout.tsx'), 'utf8'))
if (hasSiteFooter(rootLayout)) {
  fails.push(
    'app/layout.tsx references SiteFooter. The root layout must NOT render it — that ships a hidden footer on every KB/LP/admin page. Render SiteFooter only in the routes that show it.',
  )
}

for (const file of pageFiles(ROOT)) {
  const rel = file
  if (NO_FOOTER_PREFIXES.some((p) => rel.startsWith(p))) continue
  if (REDIRECT_ONLY.has(rel)) continue

  const src = readFileSync(file, 'utf8')
  const c = code(src)
  const kb = hasKb(c)
  const v3 = hasV3(c)
  const site = hasSiteFooter(c)

  // Rule 3 — no double footer. Two registers' footers on one page is the same
  // defect as a register footer beside SiteFooter, so v3 is counted the same way.
  if ((kb || v3) && site && !DUAL_REGISTER.has(rel)) {
    fails.push(`${rel} renders BOTH a register footer (KbFooter/V3Footer) and SiteFooter — a visible double footer. Pick the register the route belongs to (lib/site/chrome-routes.ts).`)
    continue
  }
  if (kb && v3 && !DUAL_REGISTER.has(rel)) {
    fails.push(`${rel} renders BOTH KbFooter and V3Footer — a visible double footer. A migrating page carries exactly one.`)
    continue
  }
  if (kb || v3 || site) continue
  if (ancestorLayoutHasFooter(file)) continue
  // Delegating pages: follow local imports one level.
  const imported = importedCode(file, c)
  if (hasKb(imported) || hasV3(imported) || hasSiteFooter(imported)) continue

  fails.push(
    `${rel} renders no footer: not a KB page (no kb-root/KbFooter), not a v3 page (no V3Footer/V3_ROOT_CLASS), no SiteFooter in the page or an ancestor layout, not redirect-only. ` +
      `If the route shows default chrome (shouldHideDefaultChrome === false), render <SiteFooter /> after </main>; if it is on a register, render that register's footer; if it never renders UI, add it to REDIRECT_ONLY here with a reason.`,
  )
}

if (fails.length) {
  console.error(`\n✗ default-chrome-footer: ${fails.length} violation(s):\n`)
  for (const f of fails) console.error('  • ' + f)
  console.error('')
  process.exit(1)
}
console.log('✓ default-chrome-footer: root layout is footer-free and every public page resolves to exactly one footer.')
process.exit(0)
