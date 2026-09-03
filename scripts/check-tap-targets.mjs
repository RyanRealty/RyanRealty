#!/usr/bin/env node
/**
 * check-tap-targets.mjs — G: no control on a public page is smaller than 44x44 CSS px.
 *
 * WCAG 2.5.5 (AAA) / Apple HIG / Material all land on the same number, and this
 * repo keeps re-shipping controls under it: a 32px-wide nav caret, an 18px-tall
 * footer disclosure, 32px chart tabs. Prose did not stop it, so this is a gate
 * (CLAUDE.md §6).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MECHANISM: RUNTIME. Playwright drives a RUNNING server and reads
 * getBoundingClientRect on every control on a route list, at two viewports.
 *
 * WHY NOT STATIC (parsing CSS/TSX for a declared box under 44px):
 *
 * 1. The exception is a runtime fact. WCAG 2.5.8 "Equivalent" says a small
 *    control is conforming when ANOTHER control ON THE SAME PAGE does the same
 *    job at full size. The atlas is exactly that: 27 SVG `.v3-atlas__place`
 *    polygons, none of them 44px, each paired 1:1 by name with a
 *    `.v3-atlas__chip` button measured here at >=96x44. No parse of a CSS file
 *    or a TSX file can know that the pairing is 1:1 and complete — it is a
 *    property of the rendered page. A gate that cannot see it fails the atlas
 *    on every run and gets deleted within a week.
 * 2. The failures have no declared box. `.v3-chrome__caret` is 32px wide
 *    because of its flex parent; `.v3-footer__column-title` is 17.8px tall
 *    because of line-height. Neither declares a width or a height. A static
 *    gate would have found neither of the two regressions this gate exists for.
 *
 * WHAT THIS GATE CANNOT SEE (say it out loud rather than imply coverage):
 *   · Routes not in ROUTES below. It samples the public surface, it does not
 *     crawl all 118 pages, and it renders one instance of each templated route.
 *   · Anything inside an <iframe> — main frame only.
 *   · Controls that only exist after an interaction: contents of a closed
 *     disclosure or menu, dialogs, sheets, map info windows, hover-revealed UI.
 *     (Open-by-default <details> and rendered-but-offscreen nav ARE measured.)
 *   · Non-default states: :hover, :active, invalid/error, signed-in variants.
 *   · Viewports other than 390 and 1440, and zoom levels other than 100%.
 *   · Effective hit area after z-order. It measures the element's own border
 *     box; a 48px button covered by an overlay still reads as 48px.
 *   · forced-colors / prefers-reduced-motion / RTL renderings.
 *   · Third-party embed chrome, which is deliberately excluded (see
 *     THIRD_PARTY_ROOTS) — we do not author Google's zoom buttons.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RATCHET, NOT A CLIFF. The tree fails in 25 places today. Those are
 * recorded in scripts/tap-targets-baseline.json as SIGNATURES (tag + class
 * shape), not counts — counts move with the data, signatures do not. The
 * signature set may only SHRINK: a signature not in the baseline is RED. A
 * baselined control that gets SMALLER than its recorded size (beyond
 * SHRINK_TOLERANCE_PX) is also RED. Every baselined violation prints on every
 * run so the debt stays visible instead of going quiet.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WIRING. Needs a server, so it cannot sit in the secret-less static `ci:gates`
 * chain (CLAUDE.md §6: live-dependency gates run where the dependency exists).
 * It runs in .github/workflows/ci.yml in the same PR step that already starts a
 * production server for ci:route-smoke and ci:page-payload — the comment there
 * says it directly: "Runs here rather than in the static ci:gates chain because
 * it measures a real built server, and the server started above is already up."
 *
 * A missing server is a hard FAILURE here, never a silent skip. A gate that
 * exits 0 when it measured nothing is green for the wrong reason.
 *
 * Usage:
 *   npm run ci:tap-targets                    # needs a server (see BASE)
 *   npm run ci:tap-targets:start              # builds nothing; starts `next start` first
 *   npm run ci:tap-targets:baseline           # re-record (prunes fixed entries too)
 *   TAP_TARGETS_BASE_URL=http://localhost:3322 npm run ci:tap-targets   # dev server
 *   TAP_TARGETS_LISTING_KEY=<ListingKey>      # also measure a listing detail page
 *
 * Baselines are recorded from whatever server you point at. Dev and production
 * builds render the same components, but if CI reports a signature you do not
 * see locally, re-record against a production build rather than deleting rows.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const MIN_PX = 44
const SHRINK_TOLERANCE_PX = 2 // sub-pixel + font-rendering drift between hosts
const BASELINE_PATH = 'scripts/tap-targets-baseline.json'
const WRITE = process.argv.includes('--write-baseline')

const BASE = (
  process.env.TAP_TARGETS_BASE_URL ??
  process.env.SMOKE_BASE_URL ??
  'http://127.0.0.1:3000'
).replace(/\/+$/, '')

const NAV_TIMEOUT_MS = Number(process.env.TAP_TARGETS_TIMEOUT_MS ?? 60_000)
const NAV_ATTEMPTS = 2
const RETRY_BACKOFF_MS = 3_000
/**
 * A page that renders almost nothing must not pass by having nothing to fail.
 * Every public route carries the v3 chrome and footer, which alone is dozens of
 * controls; the thinnest real reading here is 17 (/homes-for-sale at 390). A
 * count under this floor means the render did not finish, so it is a failed
 * measurement, not a clean page.
 */
const MIN_CONTROLS_PER_PAGE = 10
/** Client components mount, maps draw, charts lay out. Measure after that. */
const SETTLE_MS = Number(process.env.TAP_TARGETS_SETTLE_MS ?? 2_500)

/**
 * The public surface, one route per pattern that renders a distinct control set.
 * Add a route when it introduces controls no route here already renders.
 */
const ROUTES = [
  '/', // atlas (the Equivalent case), hero, chrome
  '/housing-market', // chart switches
  '/cities/bend', // place page: map, chart switches, breadcrumb
  '/communities', // index/grid page
  '/homes-for-sale', // search: filters, view toggles, sort
  '/sell', // seller LP + form
  '/contact', // form-heavy
  '/team', // people grid
]
if (process.env.TAP_TARGETS_LISTING_KEY) {
  ROUTES.push(`/listing/${process.env.TAP_TARGETS_LISTING_KEY}`)
}

/** Phone and desktop. The failures differ: the chrome and footer only fail wide. */
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
]

/**
 * Everything a pointer can hit that we would call a control. `[tabindex]` is
 * included because the atlas polygons are role=button paths on a roving
 * tabindex, and roving means 26 of the 27 carry tabindex="-1" at any moment.
 */
const CONTROL_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[tabindex]',
].join(',')

/**
 * Subtrees we do not author. Google Maps renders its own zoom buttons, its
 * "Open this area in Google Maps" link and its map-type control into our DOM;
 * their size is Google's to set. `nextjs-portal` is the dev overlay.
 * Keep this list TINY — every entry is a hole in the gate.
 */
const THIRD_PARTY_ROOTS = ['.gm-style', '.gmnoprint', '.gm-svpc', 'nextjs-portal']

// ── measurement (runs in the page) ───────────────────────────────────────────

/**
 * Returns one record per control. All classification that needs the DOM
 * (visibility, aria-hidden ancestry, accessible name, inline-in-a-sentence)
 * happens here; the equivalence pairing happens in node, over the whole page.
 */
function collectControls(selector, thirdPartyRoots) {
  const norm = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[\d]+/g, ' ')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const classesOf = (el) => {
    const raw = typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '')
    return String(raw).trim().split(/\s+/).filter(Boolean)
  }

  /**
   * Only the design-system class names, with state and modifier stripped.
   *
   * A signature has one job: survive an edit that does not change the control.
   * A raw class dump fails that twice over — a Tailwind utility added to a
   * button rewrites its identity and turns the gate red for nothing, and
   * `--on` / `is-active` split one control into two rows depending on which
   * tab happened to be selected. `v3-` is the public design system (CLAUDE.md
   * §3), so those names are the stable half of any class list.
   */
  const semanticClasses = (el) =>
    [
      ...new Set(
        classesOf(el)
          .filter((c) => c.startsWith('v3-') && !c.startsWith('is-'))
          .map((c) => c.replace(/--.+$/, '')),
      ),
    ].sort()

  /**
   * Stable identity for one CONTROL CLASS, not one instance.
   *
   * Order matters. Self class first. Then the nearest design-system ancestor
   * within three levels, which is what collapses `ul.v3-footer__column-list >
   * li > a` — thirty-odd footer links that are one control repeated — into a
   * single row. Without it the baseline carries a row per href, and adding a
   * footer link turns the gate red for a reason that has nothing to do with
   * tap targets. Accessible name is the fallback for controls outside the
   * design system (the shadcn search UI), because a name survives a restyle.
   */
  const signature = (el) => {
    const tag = el.tagName.toLowerCase()
    const own = semanticClasses(el)
    if (own.length) return `${tag}.${own.join('.')}`

    let anc = el.parentElement
    for (let depth = 1; anc && depth <= 3; depth += 1, anc = anc.parentElement) {
      const up = semanticClasses(anc)
      if (up.length) return `${anc.tagName.toLowerCase()}.${up.join('.')} ${tag}`
    }

    const name = norm(el.getAttribute('aria-label') || el.textContent || el.getAttribute('title'))
    if (name.length >= 2) return `${tag}[name="${name}"]`
    const href = el.getAttribute('href')
    if (href) return `${tag}[href="${href.split('?')[0]}"]`
    const role = el.getAttribute('role')
    if (role) return `${tag}[role="${role}"]`
    return tag
  }

  /**
   * The hit area, not the border box. `after:absolute after:-inset-x-3` is the
   * standard way to widen a small control without moving layout, and
   * getBoundingClientRect cannot see it — measuring the box alone would report
   * a deliberately-enlarged 20px checkbox as a violation. A pseudo-element
   * counts only when it is absolutely positioned and still takes pointer
   * events; `pointer-events: none` is the marker for a decorative one.
   *
   * Blind spot it keeps: a pseudo positioned AWAY from its element (not
   * centred on it) is counted as if it overlapped. Rare, and it errs toward
   * silence rather than a false red.
   */
  const hitBox = (el, r) => {
    let w = r.width
    let h = r.height
    for (const pseudo of ['::after', '::before']) {
      const ps = getComputedStyle(el, pseudo)
      if (!ps || ps.content === 'none' || ps.content === '') continue
      if (ps.position !== 'absolute' && ps.position !== 'fixed') continue
      if (ps.pointerEvents === 'none' || ps.display === 'none' || ps.visibility === 'hidden') continue
      const pw = parseFloat(ps.width)
      const ph = parseFloat(ps.height)
      if (Number.isFinite(pw)) w = Math.max(w, pw)
      if (Number.isFinite(ph)) h = Math.max(h, ph)
    }
    return { w, h }
  }

  const accName = (el) => {
    const label = el.getAttribute('aria-label')
    if (label && label.trim()) return label.trim()
    const by = el.getAttribute('aria-labelledby')
    if (by) {
      const t = by
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim()
      if (t) return t
    }
    const text = (el.textContent ?? '').trim()
    if (text) return text
    return (el.getAttribute('title') ?? el.getAttribute('alt') ?? '').trim()
  }

  /**
   * Visually hidden until focused (the skip link). `sr-only` is 1x1 with a
   * clip; it is not "presented" at that size, so it is out of scope rather
   * than a 1x1 violation.
   */
  const isClipHidden = (el, cs, r) => {
    const clipped =
      (cs.clipPath && cs.clipPath.includes('inset(50%')) ||
      (cs.clip && cs.clip !== 'auto') ||
      cs.position === 'absolute'
    return clipped && r.width <= 2 && r.height <= 2
  }

  const out = []
  for (const el of document.querySelectorAll(selector)) {
    // Roving-tabindex controls are real (the atlas). A -1 that is not part of a
    // roving group is caught by role/tag instead, so only skip a bare
    // tabindex="-1" with no control role and no control tag.
    const tag = el.tagName.toLowerCase()
    const role = el.getAttribute('role') ?? ''
    const isControlTag = ['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag)
    const isControlRole = /^(button|link|tab|checkbox|radio|switch|menuitem|option)$/.test(role)
    if (!isControlTag && !isControlRole && el.getAttribute('tabindex') === '-1') continue
    if (tag === 'a' && !el.hasAttribute('href') && !isControlRole) continue

    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)

    if (thirdPartyRoots.some((sel) => el.closest(sel))) {
      out.push({ sig: signature(el), skip: 'third-party' })
      continue
    }
    if (el.closest('[aria-hidden="true"]')) continue // not exposed, not a control
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue
    if (cs.pointerEvents === 'none') continue
    if (r.width === 0 || r.height === 0) continue
    if (isClipHidden(el, cs, r)) {
      out.push({ sig: signature(el), skip: 'visually-hidden-until-focus' })
      continue
    }

    const name = accName(el)
    const hrefAttr = el.getAttribute('href') ?? ''
    // Resolved path, so /sell and https://host/sell pair up.
    let href = ''
    if (hrefAttr) {
      try {
        const u = new URL(hrefAttr, location.href)
        href = u.origin === location.origin ? u.pathname + u.search : u.href
      } catch {
        href = hrefAttr
      }
    }

    /**
     * WCAG 2.5.8 "Inline": a target inside a sentence, whose size is set by the
     * line-height of the text around it. HTML only — an SVG <path> reports
     * display:inline too, and the atlas polygons are not prose.
     */
    const parent = el.parentElement
    const inline =
      el.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
      cs.display.startsWith('inline') &&
      !!parent &&
      (parent.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 1

    const hit = hitBox(el, r)
    out.push({
      sig: signature(el),
      tag,
      w: Math.round(hit.w * 10) / 10,
      h: Math.round(hit.h * 10) / 10,
      name,
      key: norm(name),
      href,
      inline,
    })
  }
  return out
}

// ── equivalence (runs in node, over one page's controls) ─────────────────────

/**
 * WCAG 2.5.8 Equivalent: a small control passes when a DIFFERENT control on the
 * same page achieves the same function at >= 44x44.
 *
 * "Same function" is href for links (a /sell link is a /sell link), and the
 * normalized accessible name otherwise. Normalization drops digits, which is
 * what makes the atlas pairing work: the chip reads "Sunriver146" (name + count
 * badge) and the polygon reads "Sunriver". Names shorter than 3 characters
 * after normalization are not accepted as proof — "1Y" and "Y" would pair
 * things that share nothing.
 */
function equivalentPartner(control, all) {
  const big = all.filter((c) => c !== control && c.w >= MIN_PX && c.h >= MIN_PX)
  if (control.href) {
    const byHref = big.find((c) => c.href === control.href)
    if (byHref) return `href ${control.href} also on ${byHref.sig} (${byHref.w}x${byHref.h})`
    return null
  }
  if (control.key.length < 3) return null
  const byName = big.find((c) => !c.href && c.key === control.key)
  if (byName) return `name "${control.name}" also on ${byName.sig} (${byName.w}x${byName.h})`
  return null
}

// ── driver ───────────────────────────────────────────────────────────────────

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return { violations: [] }
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch (err) {
    console.error(`${BASELINE_PATH} is not valid JSON: ${err.message}`)
    process.exit(2)
  }
}

async function reachable(url) {
  try {
    // middleware.ts 403s automation User-Agents; ci-probe-ua.mjs owns the one UA
    // every health probe here sends, and `ci:probe-ua` asserts this import.
    const res = await fetch(url, {
      headers: { ...CI_PROBE_HEADERS },
      signal: AbortSignal.timeout(10_000),
    })
    return res.status < 500
  } catch {
    return false
  }
}

async function main() {
  console.log('Tap-target gate (44x44 CSS px, WCAG 2.5.5 / 2.5.8)')
  console.log('==================================================\n')
  console.log(`base       ${BASE}`)
  console.log(`routes     ${ROUTES.length}  ·  viewports ${VIEWPORTS.map((v) => v.name).join(', ')}\n`)

  if (!(await reachable(BASE + '/'))) {
    console.error(`No server answering at ${BASE}.`)
    console.error('This gate measures a real rendered page; it does not guess and it does not skip.')
    console.error('  npm run ci:tap-targets:start                                  # production server')
    console.error('  TAP_TARGETS_BASE_URL=http://localhost:3322 npm run ci:tap-targets   # a dev server')
    process.exit(1)
  }

  const browser = await chromium.launch()
  /** sig -> { sig, minW, minH, seen:Set, n } */
  const failures = new Map()
  const exempt = { equivalent: 0, inline: 0 }
  const skipped = { 'third-party': 0, 'visually-hidden-until-focus': 0 }
  let measured = 0
  let navFailed = 0

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      })
      const page = await ctx.newPage()
      let controls = null
      let lastErr = null
      // One retry. A dev server rebuilding, or a production server still
      // warming its first compile, refuses a single connection and would
      // otherwise turn a whole PR red for nothing. Two failures in a row is a
      // real problem and is reported as one.
      for (let attempt = 1; attempt <= NAV_ATTEMPTS && controls === null; attempt += 1) {
        try {
          const res = await page.goto(BASE + route, {
            waitUntil: 'domcontentloaded',
            timeout: NAV_TIMEOUT_MS,
          })
          if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`)
          await page.waitForTimeout(SETTLE_MS)
          // `collectControls` lives in this file so it reads next to the rules
          // it encodes; it is serialised into the page, not duplicated there.
          const found = await page.evaluate(
            `(${collectControls.toString()})(${JSON.stringify(CONTROL_SELECTOR)}, ${JSON.stringify(THIRD_PARTY_ROOTS)})`,
          )
          const usable = found.filter((c) => !c.skip).length
          if (usable < MIN_CONTROLS_PER_PAGE) {
            throw new Error(`only ${usable} controls rendered (floor ${MIN_CONTROLS_PER_PAGE}) — page did not finish`)
          }
          controls = found
        } catch (err) {
          lastErr = err
          if (attempt < NAV_ATTEMPTS) await page.waitForTimeout(RETRY_BACKOFF_MS)
        }
      }
      if (controls === null) {
        navFailed += 1
        console.error(
          `  FAIL  ${route} @${vp.name} — ${String(lastErr?.message ?? 'unknown').split('\n')[0]}`,
        )
        await ctx.close()
        continue
      }

      for (const c of controls) if (c.skip) skipped[c.skip] = (skipped[c.skip] ?? 0) + 1
      const live = controls.filter((c) => !c.skip)
      measured += live.length

      const small = live.filter((c) => c.w < MIN_PX || c.h < MIN_PX)
      let bad = 0
      for (const c of small) {
        if (c.inline) {
          exempt.inline += 1
          continue
        }
        if (equivalentPartner(c, live)) {
          exempt.equivalent += 1
          continue
        }
        bad += 1
        const at = `${route} @${vp.name}`
        const prev = failures.get(c.sig)
        if (prev) {
          prev.minW = Math.min(prev.minW, c.w)
          prev.minH = Math.min(prev.minH, c.h)
          prev.seen.add(at)
          prev.n += 1
          if (!prev.example.name && c.name) prev.example = c
        } else {
          failures.set(c.sig, {
            sig: c.sig,
            minW: c.w,
            minH: c.h,
            seen: new Set([at]),
            n: 1,
            example: c,
          })
        }
      }
      console.log(
        `  ok    ${route} @${vp.name} · ${live.length} controls · ${small.length} under ${MIN_PX} · ${bad} unexcused`,
      )
      await ctx.close()
    }
  }
  await browser.close()

  if (navFailed) {
    console.error(`\n${navFailed} route/viewport pair(s) did not render. Measurement is incomplete.`)
    process.exit(1)
  }

  const found = [...failures.values()].sort((a, b) => a.sig.localeCompare(b.sig))
  const records = found.map((f) => ({
    signature: f.sig,
    min: `${f.minW}x${f.minH}`,
    minW: f.minW,
    minH: f.minH,
    instances: f.n,
    example: f.example.name ? f.example.name.slice(0, 60) : f.example.href || '(no name)',
    seen: [...f.seen].sort(),
  }))

  console.log(
    `\nmeasured ${measured} controls · ${exempt.equivalent} excused by WCAG 2.5.8 Equivalent · ` +
      `${exempt.inline} by Inline · ${skipped['third-party'] ?? 0} third-party · ` +
      `${skipped['visually-hidden-until-focus'] ?? 0} hidden-until-focus`,
  )

  if (WRITE) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          note:
            `Controls on public pages under ${MIN_PX}x${MIN_PX} CSS px with no WCAG 2.5.8 excuse — ` +
            'KNOWN DEBT. Keyed by signature (tag + class shape), not by count: counts move with the ' +
            'data, signatures do not. The signature list may only SHRINK, and a listed control may ' +
            'not get smaller than its recorded `min`. Regenerate with `npm run ci:tap-targets:baseline`.',
          generated_by: 'check-tap-targets.mjs --write-baseline',
          min_px: MIN_PX,
          measured: {
            base: BASE,
            routes: ROUTES,
            viewports: VIEWPORTS.map((v) => `${v.width}x${v.height}`),
            controls: measured,
          },
          violations: records,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`\nWrote ${records.length} violation signature(s) to ${BASELINE_PATH}`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  const known = new Map((baseline.violations ?? []).map((v) => [v.signature, v]))

  const added = records.filter((r) => !known.has(r.signature))
  const shrunk = records.filter((r) => {
    const b = known.get(r.signature)
    if (!b) return false
    return r.minW < b.minW - SHRINK_TOLERANCE_PX || r.minH < b.minH - SHRINK_TOLERANCE_PX
  })
  const fixed = [...known.keys()].filter((s) => !records.some((r) => r.signature === s))

  // Always print the debt, so a baselined failure never goes quiet.
  console.log(`\nBASELINED violations (${records.length - added.length} of ${known.size} recorded):`)
  for (const r of records) {
    if (added.includes(r)) continue
    console.log(`  · ${r.min.padEnd(12)} ${r.signature}`)
    console.log(`      ${r.instances}x · "${r.example}" · ${r.seen.join(', ')}`)
  }
  if (!records.length) console.log('  (none)')

  if (fixed.length) {
    console.log(`\nFIXED or no longer rendered (${fixed.length}) — prune with \`npm run ci:tap-targets:baseline\`:`)
    for (const s of fixed) console.log(`  · ${s}`)
  }

  let failedRun = false
  if (added.length) {
    failedRun = true
    console.error(`\nNEW under-${MIN_PX}px control(s) — the baseline may only shrink:`)
    for (const r of added) {
      console.error(`  x ${r.min.padEnd(12)} ${r.signature}`)
      console.error(`      ${r.instances}x · "${r.example}" · ${r.seen.join(', ')}`)
    }
    console.error(
      `\n  Give it a ${MIN_PX}x${MIN_PX} hit area (padding or min-block-size/min-inline-size counts —\n` +
        '  the box is what is measured), or give the same job a full-size control on the same page\n' +
        '  (WCAG 2.5.8 Equivalent, how the atlas polygons pass). Recording it in the baseline is\n' +
        '  for pre-existing debt only.',
    )
  }
  if (shrunk.length) {
    failedRun = true
    console.error(`\nBASELINED control(s) got SMALLER (tolerance ${SHRINK_TOLERANCE_PX}px):`)
    for (const r of shrunk) {
      const b = known.get(r.signature)
      console.error(`  x ${r.signature}: ${b.min} -> ${r.min}`)
    }
  }

  if (failedRun) {
    console.error('\nTap-target gate FAILED.')
    process.exit(1)
  }
  console.log(`\nEvery public control is ${MIN_PX}x${MIN_PX} or excused. Debt: ${records.length}.`)
  process.exit(0)
}

await main()
