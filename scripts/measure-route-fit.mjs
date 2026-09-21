#!/usr/bin/env node
/**
 * measure-route-fit.mjs — does this ROUTE fit its VIEWPORT, across a matrix
 * of routes x widths. One command, whole class, printed verdict table.
 *
 * WHY THIS EXISTS (SITE-137 / SITE-138, 2026-09-20). Two p0 nodes each named
 * ONE example fixture: SITE-137 named one listing for its breadcrumb-clip
 * defect, SITE-138 named one place page for its map overflow. Checking those
 * exact fixtures on production read clean, which nearly got both nodes closed
 * as stale. They were not stale — a second, differently-shaped check (the
 * same measurement across six widths and several other listings / place
 * pages) showed the defect alive everywhere except the one fixture each node
 * happened to name. CLAUDE.md §0 calls that trap by name: "Reporting absence
 * from ONE query shape." §6 says a trap that keeps biting gets a mechanical
 * fix, never more prose. That counter-query had to be hand-rolled in
 * Playwright, in the orchestrator's context, once already — this file is so
 * the next lane runs one command instead of hand-rolling it again.
 *
 * NOT a gate. Deliberately not named `check-*.mjs` — `ci:gates-wired`
 * requires every `scripts/check-*.mjs` to run inside a gate chain, and this
 * is a measurement tool a lane runs by hand while triaging a node, not a
 * thing CI invokes on every commit. Exit code reflects whether the PROBE
 * worked, not whether a defect was found — pass `--fail-on-defect` to get a
 * gate-shaped exit code when you want one.
 *
 * WHAT IT MEASURES, per route x width:
 *   1. Horizontal page overflow — `document.documentElement.scrollWidth -
 *      window.innerWidth`. When positive, names the culprit elements,
 *      skipping anything inside an ancestor with `overflow-x: auto|scroll`
 *      (an intentional scroll rail — a horizontal carousel is not a bug, and
 *      reporting its dozen slides as "culprits" buries the real one).
 *   2. Breadcrumb last-rung readability — `.v3-breadcrumb`'s last
 *      `.v3-breadcrumb__item`: is its text cut by the viewport or by the
 *      nearest overflow:hidden/clip ancestor, while its own `text-overflow`
 *      is not `ellipsis`? That combination is the unreadable mid-word clip;
 *      cut-with-ellipsis is a deliberate, readable truncation and is clean.
 *   3. Contained-element clipping — any child (selector B) whose rect
 *      escapes its container's rect (selector A). Generic; the shipped
 *      defaults point at the place-page map's price chips, but any
 *      container/child pair works.
 *
 * TWO CLOUD TRAPS, ALREADY ROOT-CAUSED, BAKED IN RATHER THAN REDISCOVERED
 * (scripts/lib/gate-browser.mjs, verified 2026-09-15):
 *   - Headless Chromium does not trust this sandbox's agent-proxy CA, so
 *     `https://ryan-realty.com` dies `net::ERR_CERT_AUTHORITY_INVALID` unless
 *     the context sets `ignoreHTTPSErrors: true`. `openGateContext` does this
 *     automatically, and only when `HTTPS_PROXY`/`https_proxy` is set — an
 *     ordinary machine is untouched.
 *   - The site's WAF serves a bot screen to default automation User-Agents.
 *     A real desktop Chrome UA is sent on every context.
 *
 * USAGE
 *   node scripts/measure-route-fit.mjs --base <origin> --routes <a,b,c> [opts]
 *   node scripts/measure-route-fit.mjs --base https://ryan-realty.com --preset listing-crumb
 *   node scripts/measure-route-fit.mjs --base http://localhost:3313 \
 *       --routes /cities/bend,/listing/20260805071518931426000000 \
 *       --widths 360,375,390,1440 --json --out out/route-fit.json
 *
 * Run `node scripts/measure-route-fit.mjs --help` for the full flag list and
 * the built-in presets (`listing-crumb`, `place-overflow`).
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { openGateContext } from './lib/gate-browser.mjs'

// ============================================================================
// PURE PREDICATES — no DOM, no Playwright. Imported and unit-tested directly
// by scripts/__tests__/measure-route-fit.test.mjs with hand-built fixtures.
// Every function below takes plain data (numbers, strings, plain objects) —
// the browser-reading section further down is the ONLY place that touches a
// Page or `document`, and its job stops at handing back plain data.
// ============================================================================

/**
 * One overflow candidate is a culprit when its right edge clears the
 * viewport by more than `tolerance`, UNLESS it sits inside an ancestor with
 * `overflow-x: auto|scroll` — an intentional scroll rail, not a bug.
 * @param {{right:number, insideScrollRail:boolean}} candidate
 * @param {number} viewportWidth
 * @param {{tolerance?: number}} [options]
 */
export function isOverflowCulprit(candidate, viewportWidth, { tolerance = 1 } = {}) {
  if (!candidate || typeof candidate.right !== 'number') return false
  if (candidate.insideScrollRail) return false
  return candidate.right - viewportWidth > tolerance
}

/**
 * Filters + ranks overflow candidates into a short, de-duplicated list of
 * named culprits — the biggest offender first. Dedup key is
 * tag+className+rounded-right-edge so a chain of wrapper divs that all
 * report the same edge (common: div > div > div around one wide element)
 * does not eat the whole `limit`.
 * @param {Array<object>} candidates
 * @param {number} viewportWidth
 * @param {{tolerance?: number, limit?: number}} [options]
 */
export function rankOverflowCulprits(candidates, viewportWidth, { tolerance = 1, limit = 8 } = {}) {
  const seen = new Set()
  const out = []
  const ranked = (candidates || [])
    .filter((c) => isOverflowCulprit(c, viewportWidth, { tolerance }))
    .map((c) => ({ ...c, overflowPx: round1(c.right - viewportWidth) }))
    .sort((a, b) => b.overflowPx - a.overflowPx)
  for (const c of ranked) {
    const key = `${c.tag}|${c.className}|${Math.round(c.right)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}

/**
 * The breadcrumb last-rung readability predicate. `cut` means the rung's own
 * rendered right edge clears the clip boundary (the nearest overflow:hidden
 * ancestor's right edge, or the viewport if there is none) by more than
 * `tolerance`. A cut rung with `text-overflow: ellipsis` is a deliberate,
 * readable truncation — clean. A cut rung with anything else is the
 * unreadable mid-word clip SITE-137 found — a defect. Not cut is clean
 * regardless of the `text-overflow` value.
 * @param {{rungRight:number, clipBoundary:number, textOverflow:string, tolerance?:number}} input
 */
export function evaluateCrumbClip({ rungRight, clipBoundary, textOverflow, tolerance = 1 }) {
  const cut = (rungRight ?? 0) - (clipBoundary ?? 0) > tolerance
  const hasEllipsis = textOverflow === 'ellipsis'
  return { cut, hasEllipsis, defect: cut && !hasEllipsis }
}

/**
 * True when `childRect` sits fully inside `containerRect`, to within
 * `tolerance` px on every edge (subpixel layout rounds differently between
 * runs; a fraction of a pixel is not a defect).
 * @param {{left:number,right:number,top:number,bottom:number}} childRect
 * @param {{left:number,right:number,top:number,bottom:number}} containerRect
 * @param {number} [tolerance]
 */
export function isContained(childRect, containerRect, tolerance = 0.5) {
  if (!childRect || !containerRect) return false
  return (
    childRect.left >= containerRect.left - tolerance &&
    childRect.right <= containerRect.right + tolerance &&
    childRect.top >= containerRect.top - tolerance &&
    childRect.bottom <= containerRect.bottom + tolerance
  )
}

/** The containment predicate applied to a whole child list. */
export function findEscapingChildren(children, containerRect, tolerance = 0.5) {
  return (children || []).filter((child) => !isContained(child, containerRect, tolerance))
}

/** Mobile widths get a taller viewport (matches take-route-shots.mjs's pair). */
export function heightForWidth(width) {
  return width <= 500 ? 812 : 900
}

function round1(n) {
  return Math.round(n * 10) / 10
}

/**
 * Combines the three raw browser reads for one route x width into the final
 * result object, applying the pure predicates above. Pure — no DOM — kept
 * separate from `measureOne` (which does the navigating) so the combination
 * logic is exercised by the same "no browser" test discipline as the
 * predicates it calls, even though the brief only requires the three
 * predicates themselves to be exported.
 */
export function buildResult({ route, url, width, height, httpStatus, navError, overflowRaw, crumbRaw, containmentRaw, opts }) {
  const result = { route, url, width, height, httpStatus, error: navError }
  if (navError) {
    result.measured = false
    result.defect = false
    return result
  }
  result.measured = true

  if (overflowRaw) {
    if (overflowRaw.error) {
      result.overflow = { error: overflowRaw.error }
    } else {
      const pageOverflowPx = round1(overflowRaw.pageScrollWidth - overflowRaw.viewportWidth)
      const defect = pageOverflowPx > opts.tolerance
      // Culprits are only meaningful once the page itself actually overflows
      // ("When positive, name the culprit elements"). Without this gate, an
      // element that reports a huge off-canvas rect but is UA-clipped by its
      // own ancestor (classically: an <svg>'s internal <path>/<g> geometry —
      // SVG defaults to overflow:hidden and never touches
      // document.scrollWidth) shows up as noise on an otherwise-clean page.
      const culprits = defect
        ? rankOverflowCulprits(overflowRaw.candidates, overflowRaw.viewportWidth, {
            tolerance: opts.tolerance,
            limit: opts.overflowLimit,
          })
        : []
      result.overflow = { pageOverflowPx, culprits, defect }
    }
  }

  if (crumbRaw) {
    if (crumbRaw.error) {
      result.crumb = { error: crumbRaw.error }
    } else if (!crumbRaw.found) {
      result.crumb = { found: false }
    } else {
      const verdict = evaluateCrumbClip({
        rungRight: crumbRaw.rungRight,
        clipBoundary: crumbRaw.clipBoundary,
        textOverflow: crumbRaw.textOverflow,
        tolerance: opts.tolerance,
      })
      result.crumb = {
        found: true,
        text: crumbRaw.text,
        rungRight: crumbRaw.rungRight,
        clipBoundary: crumbRaw.clipBoundary,
        clippedByViewport: crumbRaw.clippedByViewport,
        boundaryEl: crumbRaw.boundaryEl,
        textOverflow: crumbRaw.textOverflow,
        ...verdict,
      }
    }
  }

  if (containmentRaw) {
    if (containmentRaw.error) {
      result.containment = { error: containmentRaw.error }
    } else if (!containmentRaw.found) {
      result.containment = { found: false }
    } else {
      const escaping = findEscapingChildren(containmentRaw.children, containmentRaw.container, opts.tolerance)
      result.containment = {
        found: true,
        childCount: containmentRaw.childCount,
        escaping,
        defect: escaping.length > 0,
      }
    }
  }

  result.defect = Boolean(result.overflow?.defect || result.crumb?.defect || result.containment?.defect)
  return result
}

// ============================================================================
// BROWSER-SIDE COLLECTORS — everything below runs INSIDE the page via
// `page.evaluate()`. Each one gathers plain, JSON-serializable facts and does
// NO defect judgment itself; the judgment lives in the pure predicates above,
// in Node, where it can be unit-tested without a browser. Standalone function
// declarations only (no closures over outer scope) — Playwright serializes
// the function body to run in the page.
// ============================================================================

function browserCollectOverflow() {
  const viewportWidth = window.innerWidth
  const pageScrollWidth = document.documentElement.scrollWidth
  const candidates = []
  const nodes = document.body ? document.body.querySelectorAll('*') : []
  for (const el of nodes) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    if (rect.right - viewportWidth <= 0.5) continue
    let insideScrollRail = false
    let ancestor = el.parentElement
    while (ancestor) {
      const ox = window.getComputedStyle(ancestor).overflowX
      if (ox === 'auto' || ox === 'scroll') {
        insideScrollRail = true
        break
      }
      ancestor = ancestor.parentElement
    }
    let className = ''
    if (typeof el.className === 'string') className = el.className
    else if (el.className && typeof el.className.baseVal === 'string') className = el.className.baseVal
    candidates.push({
      tag: el.tagName ? el.tagName.toLowerCase() : '',
      id: el.id || null,
      className: className.trim(),
      left: Math.round(rect.left * 100) / 100,
      right: Math.round(rect.right * 100) / 100,
      top: Math.round(rect.top * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      insideScrollRail,
    })
  }
  return { viewportWidth, pageScrollWidth, candidates }
}

function browserCollectCrumbClip({ crumbSelector, itemSelector }) {
  const root = document.querySelector(crumbSelector)
  if (!root) return { found: false }
  const items = root.querySelectorAll(itemSelector)
  if (!items.length) return { found: false }
  const lastItem = items[items.length - 1]
  const rungEl =
    lastItem.querySelector('.v3-breadcrumb__text, .v3-breadcrumb__link, a, span') || lastItem
  const rect = rungEl.getBoundingClientRect()
  const cs = window.getComputedStyle(rungEl)
  const viewportWidth = window.innerWidth

  // The nearest clip boundary is the smallest right edge among the viewport
  // itself and every ancestor whose overflow-x actually clips (hidden/clip —
  // NOT auto/scroll, which shows a scrollbar rather than chopping content).
  let boundary = viewportWidth
  let boundaryEl = null
  let ancestor = rungEl.parentElement
  while (ancestor) {
    const ox = window.getComputedStyle(ancestor).overflowX
    if (ox === 'hidden' || ox === 'clip') {
      const arect = ancestor.getBoundingClientRect()
      if (arect.right < boundary) {
        boundary = arect.right
        let acls = ''
        if (typeof ancestor.className === 'string') acls = ancestor.className
        boundaryEl = { tag: ancestor.tagName.toLowerCase(), className: acls.trim() }
      }
    }
    ancestor = ancestor.parentElement
  }

  return {
    found: true,
    text: (rungEl.textContent || '').trim(),
    rungLeft: Math.round(rect.left * 100) / 100,
    rungRight: Math.round(rect.right * 100) / 100,
    clipBoundary: Math.round(boundary * 100) / 100,
    clippedByViewport: boundaryEl === null,
    boundaryEl,
    textOverflow: cs.textOverflow,
    viewportWidth,
  }
}

function browserCollectContainment({ containerSelector, childSelector }) {
  const container = document.querySelector(containerSelector)
  if (!container) return { found: false }
  const containerRect = container.getBoundingClientRect()
  const kids = Array.from(container.querySelectorAll(childSelector))
  const children = kids.map((el) => {
    const r = el.getBoundingClientRect()
    let className = ''
    if (typeof el.className === 'string') className = el.className
    return {
      tag: el.tagName.toLowerCase(),
      className: className.trim(),
      text: (el.textContent || '').trim().slice(0, 40),
      left: Math.round(r.left * 100) / 100,
      right: Math.round(r.right * 100) / 100,
      top: Math.round(r.top * 100) / 100,
      bottom: Math.round(r.bottom * 100) / 100,
    }
  })
  return {
    found: true,
    childCount: children.length,
    container: {
      left: Math.round(containerRect.left * 100) / 100,
      right: Math.round(containerRect.right * 100) / 100,
      top: Math.round(containerRect.top * 100) / 100,
      bottom: Math.round(containerRect.bottom * 100) / 100,
    },
    children,
  }
}

// ============================================================================
// PRESETS — a fixture SET, not one fixture. A lane re-measuring a node runs
// one command and gets the whole class. Editable here without touching any
// probe logic above.
// ============================================================================

export const PRESETS = {
  'listing-crumb': {
    description:
      'SITE-137 class — listing overlay breadcrumb last rung, short vs. long addresses.',
    routes: [
      // 828 NW Florida Avenue — short address. Currently PASSES.
      '/listing/20260805071518931426000000',
      // Long address / place path — currently FAIL.
      '/listing/20260710161710639698000000',
      '/listing/20260617231001736150000000',
      '/listing/20260520170023794747000000',
    ],
  },
  'place-overflow': {
    description: 'SITE-138 class — place page horizontal overflow, city + neighbourhoods + communities.',
    routes: [
      '/cities/bend',
      '/cities/bend/old-bend',
      '/cities/bend/awbrey-butte',
      '/communities/tetherow',
      '/communities/northwest-crossing',
    ],
  },
}

// ============================================================================
// CLI + ORCHESTRATION
// ============================================================================

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const DEFAULT_WIDTHS = [360, 375, 390, 1440]
const DEFAULT_SETTLE_MS = 4000
const DEFAULT_TIMEOUT_MS = 45000
const DEFAULT_TOLERANCE = 1
const DEFAULT_OVERFLOW_LIMIT = 8
const ALL_CHECKS = ['overflow', 'crumb', 'containment']

function printHelp() {
  const lines = [
    'measure-route-fit.mjs — does this route fit its viewport, across routes x widths.',
    '',
    'USAGE',
    '  node scripts/measure-route-fit.mjs --base <origin> [--routes a,b,c | --preset <name>] [options]',
    '',
    'EXAMPLES',
    '  node scripts/measure-route-fit.mjs --base https://ryan-realty.com --preset listing-crumb',
    '  node scripts/measure-route-fit.mjs --base https://ryan-realty.com --preset place-overflow --widths 360,375',
    '  node scripts/measure-route-fit.mjs --base http://localhost:3313 \\',
    '      --routes /cities/bend,/listing/20260805071518931426000000 \\',
    '      --widths 360,375,390,1440 --json --out out/route-fit.json',
    '',
    'PRESETS (a fixture SET, not one fixture — edit the PRESETS const to add more)',
    ...Object.entries(PRESETS).map(
      ([name, p]) => `  ${name.padEnd(16)} ${p.description}\n${' '.repeat(19)}routes: ${p.routes.join(', ')}`,
    ),
    '',
    'FLAGS',
    '  --base <origin>            required. e.g. https://ryan-realty.com or http://localhost:3313',
    '  --routes <a,b,c>           comma-separated paths (or full URLs). Overrides --preset routes.',
    '  --preset <name>            one of: ' + Object.keys(PRESETS).join(', '),
    `  --widths <n,n,...>         comma-separated viewport widths (default ${DEFAULT_WIDTHS.join(',')})`,
    `  --checks <a,b,c>           which measurements to run: overflow,crumb,containment (default all)`,
    `  --tolerance <px>           slack before a measurement counts as a defect (default ${DEFAULT_TOLERANCE})`,
    `  --overflow-limit <n>       max overflow culprits reported per route/width (default ${DEFAULT_OVERFLOW_LIMIT})`,
    '  --crumb-selector <css>     default .v3-breadcrumb',
    '  --crumb-item-selector <css> default .v3-breadcrumb__item',
    '  --container-selector <css> default .v3-place-look__map',
    '  --child-selector <css>     default [data-price-pill="1"]',
    `  --settle-ms <ms>           extra wait after load, before measuring (default ${DEFAULT_SETTLE_MS}).`,
    '                             Google Maps and other late-painting widgets need several seconds',
    "                             after the `load` event before their content is stable — do not",
    '                             lower this for a route that mounts a map.',
    `  --timeout <ms>             navigation timeout (default ${DEFAULT_TIMEOUT_MS})`,
    '  --json                     print the JSON report to stdout instead of the table',
    '  --out <path>               also write the JSON report to this file',
    '  --fail-on-defect           exit 1 if any route/width combo has a defect',
    '  --help, -h                 this text',
    '',
    'EXIT CODES',
    '  0   the probe measured (regardless of what it found), unless --fail-on-defect',
    '  1   --fail-on-defect was set and at least one defect was found',
    '  2   the browser could not be launched',
    '  3   every route/width combo failed to navigate — nothing could be measured',
    '',
    'This is a MEASUREMENT TOOL, not a gate — do not name a copy of this `check-*.mjs`;',
    'ci:gates-wired requires every scripts/check-*.mjs to run inside a gate chain.',
  ]
  console.log(lines.join('\n'))
}

function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      base: { type: 'string' },
      routes: { type: 'string' },
      preset: { type: 'string' },
      widths: { type: 'string' },
      checks: { type: 'string' },
      tolerance: { type: 'string' },
      'overflow-limit': { type: 'string' },
      'crumb-selector': { type: 'string' },
      'crumb-item-selector': { type: 'string' },
      'container-selector': { type: 'string' },
      'child-selector': { type: 'string' },
      'settle-ms': { type: 'string' },
      timeout: { type: 'string' },
      json: { type: 'boolean', default: false },
      out: { type: 'string' },
      'fail-on-defect': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  })
  return values
}

function resolveRoutesAndBase(argv) {
  const base = (argv.base || process.env.BASE_URL || '').replace(/\/$/, '')
  let routes = null
  let presetName = null
  if (argv.preset) {
    presetName = argv.preset
    const preset = PRESETS[argv.preset]
    if (!preset) {
      throw new Error(`Unknown preset "${argv.preset}". Known presets: ${Object.keys(PRESETS).join(', ')}`)
    }
    routes = preset.routes
  }
  if (argv.routes) {
    routes = argv.routes.split(',').map((r) => r.trim()).filter(Boolean)
  }
  if (!routes || routes.length === 0) {
    throw new Error('Pass --routes <a,b,c> or --preset <name>.')
  }
  if (!base) {
    throw new Error('Pass --base <origin> (or set BASE_URL).')
  }
  return { base, routes, presetName }
}

function resolveUrl(base, route) {
  if (/^https?:\/\//.test(route)) return route
  return `${base}${route.startsWith('/') ? '' : '/'}${route}`
}

async function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
  })
}

/**
 * `browser.close()` on an already-dead browser (renderer crashed, process
 * gone) can hang instead of resolving — verified 2026-09-20, it ate the rest
 * of a 300s run after every other combo had already finished. Never let
 * shutdown block longer than this.
 */
async function closeBrowserBounded(browser, timeoutMs = 8000) {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

async function measureOne({ browser, route, url, width, opts }) {
  const height = heightForWidth(width)
  const { context } = await openGateContext(browser, {
    baseUrl: url,
    viewport: { width, height },
    userAgent: BROWSER_USER_AGENT,
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  let httpStatus = 0
  let navError = null
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs })
    httpStatus = response ? response.status() : 0
    // Never `networkidle` as the sole signal — analytics beacons and the map
    // SDK keep sockets warm, so it either hangs to the timeout or (on some
    // routes) resolves before the map has actually painted. `load`, bounded,
    // plus an explicit settle for late content, is the pattern this repo's
    // other Playwright probes converged on (see take-route-shots.mjs).
    await page.waitForLoadState('load', { timeout: Math.min(opts.timeoutMs, 30000) }).catch(() => {})
    await page.waitForTimeout(opts.settleMs)
  } catch (err) {
    navError = err instanceof Error ? err.message : String(err)
  }

  let overflowRaw = null
  let crumbRaw = null
  let containmentRaw = null
  if (!navError) {
    if (opts.checks.has('overflow')) {
      overflowRaw = await page.evaluate(browserCollectOverflow).catch((err) => ({ error: String(err) }))
    }
    if (opts.checks.has('crumb')) {
      crumbRaw = await page
        .evaluate(browserCollectCrumbClip, { crumbSelector: opts.crumbSelector, itemSelector: opts.crumbItemSelector })
        .catch((err) => ({ error: String(err) }))
    }
    if (opts.checks.has('containment')) {
      containmentRaw = await page
        .evaluate(browserCollectContainment, { containerSelector: opts.containerSelector, childSelector: opts.childSelector })
        .catch((err) => ({ error: String(err) }))
    }
  }

  await context.close()
  return buildResult({ route, url, width, height, httpStatus, navError, overflowRaw, crumbRaw, containmentRaw, opts })
}

function fmtCulprit(c) {
  const cls = c.className ? `.${c.className.split(/\s+/).slice(0, 2).join('.')}` : ''
  return `${c.tag}${cls} right=${c.right}px (+${c.overflowPx}px)`
}

function printTable(report) {
  const byRoute = new Map()
  for (const r of report.results) {
    if (!byRoute.has(r.route)) byRoute.set(r.route, [])
    byRoute.get(r.route).push(r)
  }

  console.log('')
  console.log(`measure-route-fit — base ${report.base}${report.preset ? ` — preset ${report.preset}` : ''}`)
  console.log(`checks: ${report.checks.join(', ')} · tolerance: ${report.tolerance}px · settle: ${report.settleMs}ms`)
  console.log('')

  for (const [route, rows] of byRoute) {
    console.log(`ROUTE ${route}`)
    for (const r of rows) {
      if (!r.measured) {
        console.log(`  ${String(r.width).padEnd(6)} NAV FAILED — ${r.error}`)
        continue
      }
      const parts = []
      if (r.overflow) {
        parts.push(
          r.overflow.error
            ? `overflow: error(${r.overflow.error})`
            : `overflow ${r.overflow.pageOverflowPx >= 0 ? '+' : ''}${r.overflow.pageOverflowPx}px ${r.overflow.defect ? 'DEFECT' : 'clean'}`,
        )
      }
      if (r.crumb) {
        if (r.crumb.error) parts.push(`crumb: error(${r.crumb.error})`)
        else if (!r.crumb.found) parts.push('crumb: n/a (not found)')
        else
          parts.push(
            `crumb ${r.crumb.defect ? 'DEFECT (cut, no ellipsis)' : r.crumb.cut ? 'clean (cut, ellipsis)' : 'clean'}`,
          )
      }
      if (r.containment) {
        if (r.containment.error) parts.push(`containment: error(${r.containment.error})`)
        else if (!r.containment.found) parts.push('containment: n/a (not found)')
        else
          parts.push(
            `containment ${r.containment.defect ? `DEFECT (${r.containment.escaping.length} escaping)` : `clean (${r.containment.childCount} checked)`}`,
          )
      }
      console.log(`  ${String(r.width).padEnd(6)} ${parts.join('  ·  ')}`)
      if (r.overflow?.culprits?.length) {
        for (const c of r.overflow.culprits) console.log(`         overflow culprit: ${fmtCulprit(c)}`)
      }
      if (r.crumb?.defect) {
        console.log(
          `         crumb text: "${r.crumb.text}" right=${r.crumb.rungRight} clipBoundary=${r.crumb.clipBoundary} (${r.crumb.clippedByViewport ? 'viewport' : `ancestor ${r.crumb.boundaryEl?.tag}.${r.crumb.boundaryEl?.className}`}) text-overflow=${r.crumb.textOverflow}`,
        )
      }
      if (r.containment?.defect) {
        for (const c of r.containment.escaping) {
          console.log(`         escaping child: ${c.tag}.${c.className} "${c.text}" right=${c.right}`)
        }
      }
    }
    console.log('')
  }

  console.log(
    `summary: ${report.summary.measured}/${report.summary.total} measured, ${report.summary.defects} defect(s), ${report.summary.navigationFailures} nav failure(s)`,
  )
}

async function main() {
  const argv = parseCliArgs(process.argv.slice(2))
  if (argv.help) {
    printHelp()
    process.exit(0)
  }

  let base, routes, presetName
  try {
    ;({ base, routes, presetName } = resolveRoutesAndBase(argv))
  } catch (err) {
    console.error(`measure-route-fit: ${err.message}`)
    console.error('Run with --help for usage.')
    process.exit(2)
  }

  const widths = (argv.widths ? argv.widths.split(',') : DEFAULT_WIDTHS.map(String))
    .map((w) => Number(String(w).trim()))
    .filter((w) => Number.isFinite(w) && w > 0)
  const checks = new Set(
    (argv.checks ? argv.checks.split(',').map((c) => c.trim()) : ALL_CHECKS).filter((c) => ALL_CHECKS.includes(c)),
  )
  const opts = {
    checks,
    tolerance: argv.tolerance ? Number(argv.tolerance) : DEFAULT_TOLERANCE,
    overflowLimit: argv['overflow-limit'] ? Number(argv['overflow-limit']) : DEFAULT_OVERFLOW_LIMIT,
    crumbSelector: argv['crumb-selector'] || '.v3-breadcrumb',
    crumbItemSelector: argv['crumb-item-selector'] || '.v3-breadcrumb__item',
    containerSelector: argv['container-selector'] || '.v3-place-look__map',
    childSelector: argv['child-selector'] || '[data-price-pill="1"]',
    settleMs: argv['settle-ms'] ? Number(argv['settle-ms']) : DEFAULT_SETTLE_MS,
    timeoutMs: argv.timeout ? Number(argv.timeout) : DEFAULT_TIMEOUT_MS,
  }

  let browser
  try {
    browser = await launchBrowser()
  } catch (err) {
    console.error(`measure-route-fit: could not launch chromium — ${err instanceof Error ? err.message : err}`)
    process.exit(2)
  }

  // Self-healing loop. Verified necessary 2026-09-20: a photo-heavy listing
  // page ran Chromium into a bad state mid-navigation (repeated TLS handshake
  // failures through the sandbox proxy, then the renderer died); every
  // remaining route/width combo in that run then failed immediately with
  // "Target page, context or browser has been closed" — one bad page lost the
  // whole rest of the preset. So: on a recognizably browser-dead error, close
  // (bounded — see closeBrowserBounded) and relaunch once, then retry that
  // one combo, instead of cascading failures through the rest of the matrix.
  const results = []
  for (const route of routes) {
    const url = resolveUrl(base, route)
    for (const width of widths) {
      let result = null
      for (let attempt = 1; attempt <= 2 && result === null; attempt++) {
        if (!browser.isConnected()) {
          console.error(`measure-route-fit: browser disconnected before ${route}@${width} — relaunching`)
          await closeBrowserBounded(browser)
          browser = await launchBrowser()
        }
        try {
          result = await measureOne({ browser, route, url, width, opts })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          const browserIsDead = /has been closed|target closed|disconnected/i.test(msg)
          if (browserIsDead && attempt === 1) {
            console.error(`measure-route-fit: ${route}@${width} hit "${msg}" — relaunching and retrying once`)
            await closeBrowserBounded(browser)
            browser = await launchBrowser()
            continue
          }
          result = { route, url, width, measured: false, defect: false, error: msg }
        }
      }
      results.push(result)
    }
  }
  await closeBrowserBounded(browser)

  const measured = results.filter((r) => r.measured).length
  const navigationFailures = results.length - measured
  const defects = results.filter((r) => r.defect).length

  const report = {
    generatedAt: new Date().toISOString(),
    base,
    preset: presetName,
    routes,
    widths,
    checks: [...checks],
    tolerance: opts.tolerance,
    settleMs: opts.settleMs,
    selectors: {
      crumbSelector: opts.crumbSelector,
      crumbItemSelector: opts.crumbItemSelector,
      containerSelector: opts.containerSelector,
      childSelector: opts.childSelector,
    },
    results,
    summary: { total: results.length, measured, navigationFailures, defects },
  }

  if (argv.out) {
    mkdirSync(dirname(resolve(argv.out)), { recursive: true })
    writeFileSync(resolve(argv.out), JSON.stringify(report, null, 2))
  }

  if (argv.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printTable(report)
    if (argv.out) console.log(`\nwrote ${argv.out}`)
  }

  if (measured === 0) {
    console.error('measure-route-fit: every route/width combo failed to navigate — nothing was measured.')
    process.exit(3)
  }
  if (argv['fail-on-defect'] && defects > 0) {
    process.exit(1)
  }
  process.exit(0)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((err) => {
    console.error(`measure-route-fit: fatal — ${err instanceof Error ? err.stack : err}`)
    process.exit(2)
  })
}
