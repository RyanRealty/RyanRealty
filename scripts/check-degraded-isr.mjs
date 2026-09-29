#!/usr/bin/env node
/**
 * check-degraded-isr.mjs (ci:degraded-isr) — SITE-118
 *
 * ISR pages that race published-section reads through withTimeoutFallback
 * must wrap the render in `runPublishedPageRender`. A timeout used to persist
 * the thin fallback for the full revalidate window (PR #252 /cities, /zip
 * under load). The wrapper notes those reads and shortens that render's ISR
 * lifetime to DEGRADED_ISR_REVALIDATE_S through unstable_cache.
 *
 * AND IT MUST NEVER CALL unstable_noStore() (P3 — DATA-6, DATA-1, SEO-2,
 * EXP-7, 2026-09-23). It did from 2026-09-16, and inside a runtime ISR render
 * Next 16 answers noStore() by throwing "Dynamic server usage: Route
 * /subdivisions/[slug] couldn't be rendered statically because it used
 * unstable_noStore()" (E550, digest DYNAMIC_SERVER_USAGE), which is HTTP 500:
 * every degraded cold render of /subdivisions/* was a 500
 * (/subdivisions/elkai-woods on every fetch), and every degraded regeneration
 * of the prebuilt place pages failed into the error log. The second check
 * below holds that shut.
 *
 * THE WHOLE CLASS (2026-09-25): the bug is not specific to the place-page
 * race — it is ANY app/**\/page.tsx or route.ts that exports a bounded,
 * numeric `revalidate` (real ISR — `false` and `0` both make Next render the
 * route dynamically on every request, so neither ever reaches the
 * `prerender-legacy` work unit this bug lives in) and ALSO references
 * unstable_noStore, whether imported, aliased, or called under any name
 * containing it. commercial-space-for-lease and site-index both did this: an
 * empty read called noStore() instead of shortening the ISR lifetime, so the
 * empty case degraded straight to a 500 on regeneration. The third check
 * below scans every such file in the repo, not just the fixed list PAGES
 * names — a NEW page copying the noStore() pattern must fail this gate the
 * same day it lands, not get discovered on the next incident. `dynamic =
 * 'force-dynamic'` exempts a file from this scan: Next ignores `revalidate`
 * entirely once a route is forced dynamic, so it never becomes the
 * `prerender-legacy` unit noStore() blows up inside, and noStore() there is a
 * (redundant but harmless) no-op — see app/api/cron/warm-geo-pages/route.ts,
 * which mentions noStore() only in a comment and carries no `revalidate` at
 * all, so it never reaches this scan in the first place.
 *
 * Do not loosen `ci:route-content-floor`. This gate only holds the mechanism.
 *
 * Usage: node scripts/check-degraded-isr.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = process.cwd()

export const PAGES = [
  'app/cities/page.tsx',
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/cities/[slug]/types/[type]/page.tsx',
  'app/communities/[slug]/page.tsx',
  'app/communities/[slug]/types/[type]/page.tsx',
  'app/subdivisions/[slug]/page.tsx',
  'app/zip/[zip]/page.tsx',
  'app/about/page.tsx',
  'app/cities/[slug]/types/[type]/_v3/PlaceTypeAtlasSection.tsx',
]

// The mechanism itself: shorten, never opt out. Comments are stripped so the
// header's own explanation of the old bug does not trip the check.
const MECHANISM = 'lib/site/degraded-isr.ts'

/**
 * Char-by-char comment/string scanner shared by the two scrubs below (same
 * technique check-site-index-freshness.mjs's stripNonCode uses): a delimiter
 * (quote or comment marker) never corrupts the walk because state, not a
 * chained regex, tracks where it is. `blankStrings` decides whether string /
 * template CONTENTS survive — delimiters are always kept either way.
 */
function scrub(src, blankStrings) {
  let out = ''
  let state = 'code' // code | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const c2 = src[i + 1]
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i++; continue }
      if (c === '/' && c2 === '*') { state = 'block'; i++; continue }
      if (c === "'") { state = 'sq'; out += blankStrings ? "''" : c; continue }
      if (c === '"') { state = 'dq'; out += blankStrings ? '""' : c; continue }
      if (c === '`') { state = 'tpl'; out += blankStrings ? '``' : c; continue }
      out += c
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c }
    } else if (state === 'sq' || state === 'dq' || state === 'tpl') {
      const closer = state === 'sq' ? "'" : state === 'dq' ? '"' : '`'
      if (c === '\\') {
        if (!blankStrings) out += c + (c2 ?? '')
        i++
      } else if (c === closer) {
        if (!blankStrings) out += c
        state = 'code'
      } else if (!blankStrings) {
        out += c
      }
    } else if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'code'; i++ }
    }
  }
  return out
}

/**
 * Blank out comments only. String/template CONTENTS pass through unchanged —
 * needed so a real `export const dynamic = 'force-dynamic'` is still visible
 * (the OTHER scrub below blanks it, which silently ate the force-dynamic
 * exemption when this file first shipped: `stripNonCode` turned
 * `dynamic = 'force-dynamic'` into `dynamic = ''` and the exemption never
 * matched anything). A decoy `// export const dynamic = 'force-dynamic'`
 * comment cannot exempt a real bug this way — comments are gone, not kept.
 */
export function stripComments(src) {
  return scrub(src, false)
}

/**
 * Blank out comments AND string/template literal CONTENTS (delimiters kept)
 * so a doc comment that only NARRATES the old noStore() bug — subdivisions/
 * [slug], price-drops and price-drops/[city] all explain it in their header,
 * in prose that contains the literal text "noStore()" — is never a false
 * positive for the class-wide scan below, and a decoy string can never fool
 * it either. Same char-by-char technique check-site-index-freshness.mjs uses.
 */
export function stripNonCode(src) {
  return scrub(src, true)
}

// A bounded, numeric revalidate — `false` and the literal `0` both make Next
// render dynamically on every request, so neither is ISR (same rule
// check-site-index-freshness.mjs uses for "a positive integer, not false/0").
// Checked against stripComments (NOT stripNonCode): the value is never
// meaningfully hidden inside a string, and this way a page whose OWN
// revalidate literal happens to sit next to a quote is still read correctly.
const BOUNDED_REVALIDATE = /export const revalidate\s*=\s*[1-9]\d*\b/
// A route this precise shape exempts: `revalidate` does nothing once the
// segment is forced dynamic, so the file never reaches the `prerender-legacy`
// work unit noStore() throws inside. Checked against stripComments: the
// literal string 'force-dynamic' MUST survive stripping for this to ever
// match — stripNonCode would blank it to '' and the exemption would never
// fire (see stripComments's own doc comment for how this broke once already).
const FORCE_DYNAMIC = /export const dynamic\s*=\s*['"]force-dynamic['"]/
// unstable_noStore, however it is imported, aliased, or spelled at the call
// site — `unstable_noStore(` and any `...noStore(` call both match. Checked
// against the fuller stripNonCode (comments AND strings blanked): this is the
// pattern a decoy — a doc comment narrating the old bug in prose — has
// actually collided with in this repo, so it gets the stricter scrub.
const NOSTORE_REFERENCE = /\bunstable_noStore\b|\bnoStore\s*\(/

/**
 * True for a page/route file's RAW source that is the SITE-118 class of bug:
 * a bounded ISR revalidate that also references unstable_noStore, and is not
 * exempted by force-dynamic. Does its own scrubbing internally (comments
 * only for the two `export const` checks, comments+strings for the
 * noStore reference) rather than trusting a caller to pre-strip the right
 * way — see stripComments's doc comment for the bug that shipped once
 * because a caller pre-stripped with the wrong scrub.
 */
export function isDegradedIsrClassHit(raw) {
  const commentsOnly = stripComments(raw)
  if (!BOUNDED_REVALIDATE.test(commentsOnly)) return false
  if (FORCE_DYNAMIC.test(commentsOnly)) return false
  return NOSTORE_REFERENCE.test(stripNonCode(raw))
}

function walkAppFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      walkAppFiles(full, out)
    } else if (name === 'page.tsx' || name === 'route.ts') {
      out.push(full)
    }
  }
  return out
}

/** Every app/**\/page.tsx or route.ts hitting the SITE-118 class, repo-root relative, sorted. */
export function findDegradedIsrClassHits(root) {
  const hits = []
  for (const abs of walkAppFiles(join(root, 'app'))) {
    let raw
    try {
      raw = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    if (isDegradedIsrClassHit(raw)) {
      hits.push(relative(root, abs).replace(/\\/g, '/'))
    }
  }
  return hits.sort()
}

function main() {
  const missing = []
  for (const rel of PAGES) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      missing.push(`${rel} — file not found (route moved? update this gate)`)
      continue
    }
    const src = readFileSync(abs, 'utf8')
    if (!src.includes('runPublishedPageRender')) {
      missing.push(`${rel} — missing runPublishedPageRender (degraded ISR persist)`)
    }
    if (!src.includes('withTimeoutFallback')) {
      missing.push(`${rel} — missing withTimeoutFallback (published reads must still be timeout-guarded)`)
    }
  }

  {
    const abs = join(ROOT, MECHANISM)
    if (!existsSync(abs)) {
      missing.push(`${MECHANISM} — file not found (mechanism moved? update this gate)`)
    } else {
      const code = readFileSync(abs, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      if (/\bunstable_noStore\b|\bnoStore\s*\(/.test(code)) {
        missing.push(
          `${MECHANISM} — calls unstable_noStore(); inside a runtime ISR render that throws DYNAMIC_SERVER_USAGE (E550) and answers HTTP 500, not an opt-out`,
        )
      }
      if (!/\bunstable_cache\s*\(/.test(code) || !/DEGRADED_ISR_REVALIDATE_S/.test(code)) {
        missing.push(`${MECHANISM} — must shorten a degraded render's ISR lifetime through unstable_cache({ revalidate: DEGRADED_ISR_REVALIDATE_S })`)
      }
    }
  }

  // THE WHOLE CLASS: any app/**/page.tsx or route.ts exporting a bounded
  // revalidate AND referencing unstable_noStore — not just the fixed PAGES
  // list above, so a new page copying the pattern is caught the day it lands.
  const classHits = findDegradedIsrClassHits(ROOT)
  if (classHits.length) {
    missing.push(
      `THE WHOLE CLASS — ${classHits.length} file(s) export a bounded ISR \`revalidate\` AND reference unstable_noStore. Inside a runtime ISR render Next 16 answers noStore() with DYNAMIC_SERVER_USAGE (E550) = HTTP 500 the moment that branch runs, exactly like the old mechanism-file bug this gate already holds shut:\n` +
        classHits.map((f) => `      - ${f}`).join('\n') +
        `\n    Fix: replace the noStore() call with \`await refuseDegradedIsr(label, labels)\` from '@/lib/site/degraded-isr' (see app/site-index/page.tsx). If the file is genuinely dynamic, add \`export const dynamic = 'force-dynamic'\` — that exempts it here, since \`revalidate\` no longer makes it ISR.`,
    )
  }

  if (missing.length) {
    console.error('ci:degraded-isr FAILED — place/ISR pages missing the SITE-118 degraded-copy guard:')
    for (const m of missing) console.error(`  - ${m}`)
    console.error('\nWrap the page body in runPublishedPageRender from @/lib/site/degraded-isr.')
    process.exit(1)
  }
  console.log(
    `ci:degraded-isr passed (${PAGES.length} ISR pages refuse a degraded persist; 0 other app/**/page.tsx or route.ts exports a bounded revalidate alongside unstable_noStore).`,
  )
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === __filename
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
