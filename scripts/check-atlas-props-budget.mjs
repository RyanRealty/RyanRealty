#!/usr/bin/env node
/**
 * check-atlas-props-budget.mjs (ci:atlas-props-budget) — UXLIVE-3 / SEO-10 /
 * DATA-5 / COMP-4, visibility audit 2026-09-22.
 *
 * THE CLASS. The Atlas on the public place pages and /about was handed its
 * whole population as client props, so every listing on the map, every raw
 * county vertex and the basemap were serialized into the RSC payload and a
 * sales-heat SVG was drawn from the dots on the server. Measured on
 * production 2026-09-23 with scripts/lib/atlas-props-weight.mjs:
 *
 *   route                       page HTML    Atlas props
 *   /about                      4,670,269 B  3,151,812 B (dots 2.0 MB, regions 1.09 MB)
 *   /cities/bend                3,775,773 B  1,236,869 B (dots 594 KB, amenities 326 KB)
 *   /cities/bend/awbrey-butte   2,013,723 B    794,820 B (plats 583 KB)
 *   /cities/redmond             1,648,105 B    342,889 B (dots 200 KB)
 *   /communities/tetherow         924,288 B    109,157 B
 *
 * Field LCP p75 on mobile (gsc-trend-9, 08-24..09-20) was 9.9 s on
 * neighborhood pages and 5.1 s on city pages. Nothing failed while it grew.
 *
 * THE FIX this gate holds: the page renders the Atlas's counts, outlines and
 * text on the server and hands it a URL for the dots and one for the basemap
 * (lib/atlas/atlas-deferred.ts); boundaries ship at the precision the frame
 * can draw. After the fix the Atlas props are /cities/bend 146,090 B and
 * Awbrey Butte 140,610 B served by `next dev` on the fix branch (page HTML
 * 4,425,652 -> 2,521,165 B and 2,804,855 -> 1,620,956 B in dev, same data),
 * and /about 87,817 B, Redmond 49,829 B, Tetherow 30,362 B recomputed from
 * the production props with the same deferredAtlasProps.
 *
 * THE BUDGET: 192 KiB (196,608 bytes) of Atlas props per route, decoded JSON
 * with row references resolved and `children` excluded. That is 1.35x the
 * heaviest measured route (Bend, 146,090 B): room for the plat and park
 * records to grow, and a third of the smallest regression it must catch
 * (Bend's dots alone were 593,740 B). A second rule catches the small pages
 * the byte budget would not: on every route below, the Atlas's inline `dots`
 * must be empty.
 *
 * TWO LAYERS.
 *   1. Static, always (secret-less ci:gates chain): each route file builds its
 *      Atlas through deferredAtlasProps and passes dots, dotsSrc, dotsSummary
 *      and basemapSrc from it; no inline `basemap=`; V3Atlas keeps the
 *      after-paint loader.
 *   2. Runtime, when ATLAS_PROPS_BASE_URL points at a running server (CI runs
 *      it after route smoke against the built server, beside ci:page-payload):
 *      fetches each route, weighs every Atlas's props, and fails over budget
 *      or on inline dots. A route with no Atlas found is a failed measurement;
 *      an Atlas rendered from a short read prints a WARN (see runtimeFailures).
 *
 * Usage:
 *   node scripts/check-atlas-props-budget.mjs
 *   ATLAS_PROPS_BASE_URL=http://127.0.0.1:3000 node scripts/check-atlas-props-budget.mjs
 *   node scripts/check-atlas-props-budget.mjs --html saved.html [--html more.html]
 */
import { readFileSync, existsSync } from 'node:fs'
import { weighAtlasProps } from './lib/atlas-props-weight.mjs'
import { CI_PROBE_USER_AGENT } from './lib/ci-probe-ua.mjs'

export const ATLAS_PROPS_BUDGET_BYTES = 196_608

/** The public routes whose Atlas is deferred, by source file and a sample URL. */
export const ATLAS_ROUTES = [
  { file: 'app/about/page.tsx', path: '/about' },
  { file: 'app/cities/[slug]/page.tsx', path: '/cities/bend' },
  { file: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx', path: '/cities/bend/awbrey-butte' },
  { file: 'app/communities/[slug]/page.tsx', path: '/communities/tetherow' },
]
/** Extra sample URLs for the runtime layer (same templates, other sizes). */
const EXTRA_PATHS = ['/cities/redmond']

const ATLAS = 'components/site/v3/V3Atlas.client.tsx'

export function staticFailures(read = (f) => readFileSync(f, 'utf8')) {
  const failures = []
  for (const { file } of ATLAS_ROUTES) {
    if (!existsSync(file)) {
      failures.push(`${file}: missing (update ATLAS_ROUTES in this gate)`)
      continue
    }
    const src = read(file)
    if (!/deferredAtlasProps\(\{/.test(src)) {
      failures.push(`${file}: build the Atlas props through deferredAtlasProps (lib/atlas/atlas-deferred.ts)`)
    }
    for (const prop of ['dots', 'dotsSrc', 'dotsSummary', 'basemapSrc', 'regions']) {
      if (!new RegExp(`\\b${prop}=\\{atlasProps\\.${prop}\\}`).test(src)) {
        failures.push(`${file}: pass ${prop}={atlasProps.${prop}} to the Atlas`)
      }
    }
    if (/\bbasemap=\{/.test(src)) {
      failures.push(`${file}: no inline basemap= on the Atlas — pass basemapSrc (the browser fetches the clipped subset)`)
    }
    if (/\bdots=\{(?:atlas|atlasView|atlasRead)\.dots\}/.test(src)) {
      failures.push(`${file}: the Atlas's dots load after paint — pass dots={atlasProps.dots}`)
    }
  }
  const atlas = read(ATLAS)
  for (const needle of ['dotsSrc', 'dotsSummary', 'basemapSrc', 'whenNearAndIdle', 'atlasFrameBox']) {
    if (!atlas.includes(needle)) failures.push(`${ATLAS}: must keep ${needle} (the after-paint loader and the server summary)`)
  }
  return failures
}

/**
 * Failures for one served page's HTML. An Atlas the page rendered from a
 * SHORT read (`incomplete`) is not held to the rules: deferredAtlasProps keeps
 * a short read's dots inline on purpose, because the dots route could not
 * rebuild that population, and a database hiccup on the CI server is not a
 * payload regression. It is reported in `warnings` instead, so it never goes
 * quiet; the static layer still holds the wiring either way.
 */
export function runtimeFailures(label, html, budget = ATLAS_PROPS_BUDGET_BYTES, warnings = []) {
  const atlases = weighAtlasProps(html)
  if (atlases.length === 0) return [`${label}: no Atlas props found in the served page (a failed measurement, not a pass)`]
  const failures = []
  for (const a of atlases) {
    if (a.incomplete) {
      warnings.push(`${label} #${a.id}: the page's listing read came back short (incomplete), so this Atlas was not weighed`)
      continue
    }
    if (a.bytes > budget) {
      failures.push(
        `${label} #${a.id}: Atlas props ${a.bytes.toLocaleString('en-US')} B over the ${budget.toLocaleString('en-US')} B budget (${JSON.stringify(a.byKey)})`,
      )
    }
    if ((a.byKey.dots ?? 0) > 2) {
      failures.push(`${label} #${a.id}: ${a.byKey.dots.toLocaleString('en-US')} B of inline dots — they load after paint from dotsSrc`)
    }
  }
  return failures
}

async function fetchHtml(base, path) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'User-Agent': CI_PROBE_USER_AGENT, Accept: 'text/html', 'Accept-Encoding': 'identity' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function main() {
  const failures = staticFailures()
  const warnings = []
  const report = []
  const htmlArgs = []
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--html' && process.argv[i + 1]) htmlArgs.push(process.argv[(i += 1)])
  }
  for (const f of htmlArgs) {
    const html = readFileSync(f, 'utf8')
    failures.push(...runtimeFailures(f, html, ATLAS_PROPS_BUDGET_BYTES, warnings))
    report.push(`${f}: ${weighAtlasProps(html).map((a) => `#${a.id} ${a.bytes.toLocaleString('en-US')} B`).join(', ')}`)
  }
  const base = (process.env.ATLAS_PROPS_BASE_URL ?? '').replace(/\/+$/, '')
  if (base) {
    for (const path of [...ATLAS_ROUTES.map((r) => r.path), ...EXTRA_PATHS]) {
      try {
        const html = await fetchHtml(base, path)
        failures.push(...runtimeFailures(path, html, ATLAS_PROPS_BUDGET_BYTES, warnings))
        report.push(
          `${path}: page ${Buffer.byteLength(html).toLocaleString('en-US')} B · ${weighAtlasProps(html)
            .map((a) => `#${a.id} ${a.bytes.toLocaleString('en-US')} B`)
            .join(', ')}`,
        )
      } catch (error) {
        failures.push(`${path}: fetch failed against ${base} (${error instanceof Error ? error.message : String(error)})`)
      }
    }
  }
  for (const line of report) console.log(`  ${line}`)
  for (const line of warnings) console.warn(`  WARN ${line}`)
  if (failures.length > 0) {
    console.error('ci:atlas-props-budget FAILED\n')
    for (const f of failures) console.error(`  • ${f}`)
    process.exit(1)
  }
  console.log(
    `ci:atlas-props-budget OK — ${ATLAS_ROUTES.length} routes defer the Atlas's dots and basemap` +
      (base || htmlArgs.length ? `; served Atlas props under ${ATLAS_PROPS_BUDGET_BYTES.toLocaleString('en-US')} B` : ' (static layer; set ATLAS_PROPS_BASE_URL for the served-bytes layer)'),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
