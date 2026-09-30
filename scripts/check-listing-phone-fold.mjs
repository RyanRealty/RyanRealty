#!/usr/bin/env node
/**
 * check-listing-phone-fold.mjs: the listing page's first screen on a phone
 * may not go back to wasting space.
 *
 * WHY. Matt 2026-09-25, a phone screenshot of 61390 Merriewood Court: "I hate
 * all the wasted space." At 375x812 the hero was a fixed 448px navy box with a
 * 3:2 still contained in it, 99px of empty navy above the photo and 99px
 * below. PR #386 (880d8453f) made the phone frame the photograph's own shape
 * with cover fit and drew the address at display-2. ci:listing-fold-density
 * pins the CSS text of that fix; nothing measured the page it renders, so a
 * wrapper, a token or a component could bring the bands back with every
 * static check green. CLAUDE.md §6: a rule held only in prose rots.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MECHANISM: RUNTIME. Playwright renders real listing detail pages from a
 * RUNNING production build at 375x812 and 390x844 (isMobile, touch) and reads
 * getBoundingClientRect after the lead photo, fonts and Jax's entrance have
 * settled. The pure rules live in scripts/lib/listing-phone-fold.mjs and are
 * unit-tested in scripts/lib/listing-phone-fold.test.mjs. It asserts, per
 * listing per viewport:
 *
 *   1. The address (h1.listing-ask), the price (.listing-ask__price) and the
 *      facts line (.listing-face__facts: beds / baths / sq ft) sit whole
 *      inside the first screen. The hero cannot push them below the fold.
 *   2. The hero frame (.listing-frame__media) is no taller than 4:3 of its
 *      width for a photograph (listingFrameAspect's floor) and 16:9 when a reel
 *      leads, and the lead photograph covers it (at most 2px of frame left
 *      empty). The 448px letterbox fails both.
 *   3. No band with nothing drawn in it (no text, painted photograph, icon
 *      or control) is taller than FOLD_LIMITS.maxHeroBandPx between the top of
 *      the screen and the facts line, or than FOLD_LIMITS.maxDeadBandPx
 *      anywhere in the first screen. Navy frame around a contained photo is a
 *      background, so it is dead space; so is a spacer.
 *   4. Jax (.v3-dog-floater, a fixed disc at the right edge half the viewport
 *      down) overlaps neither the price text nor the address text.
 *
 * WHICH LISTINGS. Never a hard-coded id: listings go off market. The cases
 * are discovered from the server under test, the way ci:route-smoke finds a
 * resolving listing: its own /sitemaps/listings.xml. Candidate pages are
 * classified from their server HTML (lib: classifyListingHtml) and four are
 * measured, each a different home (a facts line with beds and sq ft, and a
 * photograph): one whose frame leads with a reel (data-lead="video"), one
 * photo-led with no price cut, the longest street address among the
 * sitemap's longest slugs, and one carrying the price-cut line (the tallest
 * price block). Probes are spread across the whole sitemap, which runs in
 * blocks (forty lots of one plat in a row). A case that cannot be found is a
 * FAILURE, never a skip.
 *
 * WHAT THIS GATE CANNOT SEE (said out loud rather than implied):
 *   · Listings it did not pick. Four listings sample the shapes that move the
 *     fold (reel, photo, long address, price cut), not every listing.
 *   · Viewports other than 375x812 and 390x844, landscape, zoom, and a
 *     browser's own toolbars (the viewport here is the layout viewport).
 *   · Inside a reel's iframe: a reel frame is judged by its 16:9 box.
 *   · A map, 3D or floor-plan lead: the gate measures the photo tab.
 *   · Anything a later interaction changes (a tab, a swipe, an open sheet).
 *
 * WIRING. Needs a server, so it is not in the secret-less ci:gates chain
 * (CLAUDE.md §6). It runs in scripts/run-runtime-gates.sh
 * (npm run ci:runtime-gates) with the other runtime gates, and in
 * .github/workflows/ci.yml in the production-server step. A missing server,
 * a sitemap that never answers, or a page that does not render is a hard
 * failure: a gate that exits 0 having measured nothing is green for the
 * wrong reason.
 *
 * Usage:
 *   npm run build && npm run ci:runtime-gates         # every runtime gate
 *   npm run ci:listing-phone-fold                     # needs a server (BASE)
 *   PHONE_FOLD_BASE_URL=http://127.0.0.1:3401 npm run ci:listing-phone-fold
 *   node scripts/check-listing-phone-fold.mjs --json  # machine-readable result
 *   node scripts/check-listing-phone-fold.mjs --survey 16
 *       # report only: the four cases plus 16 more homes, and where the largest
 *       # empty bands fall. How the band limits were set; rerun it before
 *       # moving one.
 *
 * Knobs: PHONE_FOLD_PROBE_BUDGET (80 server-HTML probes spread across the
 * sitemap for the reel, photo and price-cut cases), PHONE_FOLD_LONG_CANDIDATES
 * (the 24 longest street slugs tried for the long address),
 * PHONE_FOLD_TIMEOUT_MS (60s per page load).
 */

import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'
import { openGateContext } from './lib/gate-browser.mjs'
import {
  FOLD_LIMITS,
  LISTING_PHONE_FOLD_GATE,
  PHONE_VIEWPORTS,
  byLongestStreet,
  chooseCases,
  classifyListingHtml,
  foldProblems,
  listingPathsFromSitemap,
  spreadOrder,
  summarizeFold,
  tableHeader,
  tableRow,
} from './lib/listing-phone-fold.mjs'

const BASE = (
  process.env.PHONE_FOLD_BASE_URL ??
  process.env.SMOKE_BASE_URL ??
  'http://127.0.0.1:3000'
).replace(/\/+$/, '')
const JSON_OUT = process.argv.includes('--json')
/**
 * --survey <n>: also measure n more home listings spread across the sitemap
 * and print where the largest empty bands fall, without failing on a limit.
 * It is how the band limits in scripts/lib/listing-phone-fold.mjs were set,
 * and how they are re-checked before anyone moves one.
 */
const surveyIdx = process.argv.indexOf('--survey')
const SURVEY_N = surveyIdx >= 0 ? Math.max(1, Number(process.argv[surveyIdx + 1]) || 12) : 0

const NAV_TIMEOUT_MS = Number(process.env.PHONE_FOLD_TIMEOUT_MS ?? 60_000)
const SITEMAP_TIMEOUT_MS = Number(process.env.PHONE_FOLD_SITEMAP_TIMEOUT_MS ?? 45_000)
const PROBE_TIMEOUT_MS = Number(process.env.PHONE_FOLD_PROBE_TIMEOUT_MS ?? 30_000)
/** Upper bound on server-HTML probes spent finding the cases. */
const PROBE_BUDGET = Number(process.env.PHONE_FOLD_PROBE_BUDGET ?? 80)
const PROBE_CONCURRENCY = 4
/** The longest street slugs tried for the long-address case (the longest few are often lots). */
const LONG_CANDIDATES = Number(process.env.PHONE_FOLD_LONG_CANDIDATES ?? 24)
const NAV_ATTEMPTS = 2
const MEDIA_SETTLE_MS = 20_000
const STABLE_PASSES = 6
const STABLE_INTERVAL_MS = 400

const log = (...a) => {
  if (!JSON_OUT) console.log(...a)
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

async function fetchText(url, timeoutMs) {
  // middleware.ts 403s automation User-Agents; ci-probe-ua.mjs owns the one UA
  // every health probe here sends, and ci:probe-ua asserts this import.
  const res = await fetch(url, {
    headers: { ...CI_PROBE_HEADERS },
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { status: res.status, body: await res.text() }
}

async function reachable(url) {
  try {
    const { status } = await fetchText(url, 10_000)
    return status < 500
  } catch {
    return false
  }
}

/**
 * The listings sitemap is the heaviest read a gate makes (every listing the
 * site publishes; 3,213 URLs on 2026-09-30); a cold server or a database blip
 * can cancel it once. Three attempts with
 * backoff, as ci:route-smoke does; a status that holds is the failure.
 */
async function loadSitemapPaths() {
  const waits = [1_000, 3_000]
  let why = ''
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { status, body } = await fetchText(`${BASE}/sitemaps/listings.xml`, SITEMAP_TIMEOUT_MS)
      if (status === 200) {
        const paths = listingPathsFromSitemap(body)
        if (paths.length) return { paths, why: null }
        why = 'HTTP 200 with no canonical listing URL in it'
      } else {
        why = `HTTP ${status}`
      }
    } catch (err) {
      why = err?.name === 'TimeoutError' || err?.name === 'AbortError' ? `no response in ${SITEMAP_TIMEOUT_MS}ms` : `fetch failed: ${err?.message ?? err}`
    }
    if (attempt < 3) {
      log(`  sitemaps/listings.xml answered ${why} (attempt ${attempt}/3); retrying`)
      await new Promise((r) => setTimeout(r, waits[attempt - 1]))
    }
  }
  return { paths: [], why }
}

async function probe(path) {
  try {
    const { status, body } = await fetchText(BASE + path, PROBE_TIMEOUT_MS)
    if (status !== 200) return { path, info: { resolves: false, status } }
    return { path, info: { ...classifyListingHtml(body), status } }
  } catch (err) {
    return { path, info: { resolves: false, status: 0, error: String(err?.message ?? err) } }
  }
}

/** Probe `paths` in order, PROBE_CONCURRENCY at a time, until `enough(results)`. */
async function probeUntil(paths, budget, enough) {
  const results = []
  for (let i = 0; i < paths.length && i < budget; i += PROBE_CONCURRENCY) {
    const batch = paths.slice(i, Math.min(i + PROBE_CONCURRENCY, budget))
    results.push(...(await Promise.all(batch.map(probe))))
    if (enough(results)) break
  }
  return results
}

async function discoverCases() {
  const { paths, why } = await loadSitemapPaths()
  if (!paths.length) return { cases: [], error: `could not read listing URLs from ${BASE}/sitemaps/listings.xml: ${why}` }

  const long = await probeUntil(byLongestStreet(paths), LONG_CANDIDATES, (rs) =>
    rs.some((r) => r.info.resolves && r.info.home && r.info.photos),
  )
  const longPaths = new Set(long.map((r) => r.path))
  const rest = spreadOrder(
    paths.filter((p) => !longPaths.has(p)),
    PROBE_BUDGET,
  )
  const candidates = await probeUntil(rest, PROBE_BUDGET, (rs) => {
    const cases = chooseCases({ candidates: rs, long })
    return cases.every((c) => !c.missing)
  })
  const cases = chooseCases({ candidates, long })
  let probed = long.length + candidates.length
  const missing = cases.filter((c) => c.missing).map((c) => c.kind)

  const survey = []
  if (SURVEY_N > 0) {
    const used = new Set([...cases.map((c) => c.path), ...candidates.map((c) => c.path), ...longPaths])
    const pool = spreadOrder(
      paths.filter((p) => !used.has(p)),
      SURVEY_N * 4,
    )
    const extra = await probeUntil(pool, pool.length, (rs) => rs.filter((r) => r.info.resolves && r.info.home && r.info.photos).length >= SURVEY_N)
    probed += extra.length
    for (const r of [...candidates, ...extra]) {
      if (survey.length >= SURVEY_N) break
      if (!r.info.resolves || !r.info.home || !r.info.photos || cases.some((c) => c.path === r.path)) continue
      survey.push({ kind: 'survey', path: r.path, address: r.info.address, info: r.info })
    }
  }
  return {
    cases,
    survey,
    probed,
    sitemapCount: paths.length,
    error: missing.length
      ? `no ${missing.join(', ')} case among ${probed} listing page(s) probed. ` +
        missing
          .map((kind) =>
            kind === 'long-address'
              ? `long-address is drawn from the ${LONG_CANDIDATES} longest street slugs (PHONE_FOLD_LONG_CANDIDATES) and none was a home with a photo`
              : `${kind} is drawn from ${PROBE_BUDGET} probes spread across the sitemap (PHONE_FOLD_PROBE_BUDGET)`,
          )
          .join('; ') +
        '. Raise the knob only if the market really lacks one; a server that renders no reel or no price-cut line is a finding.'
      : null,
  }
}

// ── measurement (runs in the page) ───────────────────────────────────────────

/**
 * One reading of the first screen. Serialised into the page, so it must be
 * self-contained. Returns raw boxes; every judgement is made in Node by the
 * pure functions in scripts/lib/listing-phone-fold.mjs.
 */
function readFold() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const box = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })
  const inFold = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
  const SKIP = '[data-v3-dog-floater], [data-cookie-notice], nextjs-portal, script, style, noscript, template'
  const CONTROL = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="link"]'
  /** A control's own box is drawn content only at tap scale: a photo slide is a 250px button whose padding is not text. */
  const CONTROL_MAX_H = 88

  const styleCache = new Map()
  const cs = (el) => {
    let s = styleCache.get(el)
    if (!s) {
      s = getComputedStyle(el)
      styleCache.set(el, s)
    }
    return s
  }
  const visibleCache = new Map()
  const visible = (el) => {
    if (visibleCache.has(el)) return visibleCache.get(el)
    let ok = cs(el).visibility === 'visible'
    let opacity = 1
    for (let n = el; ok && n && n.nodeType === 1; n = n.parentElement) {
      const s = cs(n)
      if (s.display === 'none') ok = false
      opacity *= Number(s.opacity)
      if (opacity < 0.1) ok = false
    }
    visibleCache.set(el, ok)
    return ok
  }
  /** The rect an element is clipped to by its scrolling / overflow-hidden ancestors. */
  const clipCache = new Map()
  const clipOf = (el) => {
    if (clipCache.has(el)) return clipCache.get(el)
    let clip = { x: 0, y: 0, w: vw, h: vh }
    const parent = el.parentElement
    if (parent && parent !== document.documentElement && parent !== document.body) {
      const up = clipOf(parent)
      clip = up
      // Per axis, from computed style: hidden / auto / scroll on one axis
      // compute the other to auto, but `overflow-x: clip` (.listing-detail)
      // leaves y visible, and content painting past the box vertically is
      // still on the screen.
      const s = cs(parent)
      const clipX = s.overflowX !== 'visible'
      const clipY = s.overflowY !== 'visible'
      if (clipX || clipY) {
        const r = parent.getBoundingClientRect()
        const x0 = clipX ? Math.max(clip.x, r.left) : clip.x
        const y0 = clipY ? Math.max(clip.y, r.top) : clip.y
        const x1 = clipX ? Math.min(clip.x + clip.w, r.right) : clip.x + clip.w
        const y1 = clipY ? Math.min(clip.y + clip.h, r.bottom) : clip.y + clip.h
        clip = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
      }
    }
    // A fixed element escapes its ancestors' clips.
    if (cs(el).position === 'fixed') clip = { x: 0, y: 0, w: vw, h: vh }
    clipCache.set(el, clip)
    return clip
  }
  const clipped = (r, clip) => {
    const x0 = Math.max(r.x, clip.x)
    const y0 = Math.max(r.y, clip.y)
    const x1 = Math.min(r.x + r.w, clip.x + clip.w)
    const y1 = Math.min(r.y + r.h, clip.y + clip.h)
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null
  }
  const textRects = (el) => {
    const out = []
    if (!el) return out
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.data.trim() || !t.parentElement || !visible(t.parentElement)) continue
      range.selectNodeContents(t)
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push(box(r))
    }
    return out
  }
  /** The first match that is actually shown: a copy hidden at this width is not the one a visitor sees. */
  const named = (sel) => {
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (!(r.width > 0 && r.height > 0)) continue
      return { box: box(r), text: textRects(el), value: (el.textContent ?? '').replace(/\s+/g, ' ').trim() }
    }
    return null
  }

  const content = []
  const images = []
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest(SKIP)) continue
    const r = el.getBoundingClientRect()
    if (!inFold(r) || !visible(el)) continue
    const tag = el.tagName.toLowerCase()
    const clip = clipOf(el)
    if (tag === 'img') {
      // Painted area is computed in Node from the intrinsic size and
      // object-fit; an image that has not decoded paints nothing.
      if (el.complete && el.naturalWidth > 0) {
        images.push({
          box: box(r),
          natural: { w: el.naturalWidth, h: el.naturalHeight },
          fit: cs(el).objectFit,
          position: cs(el).objectPosition,
          clip,
        })
      }
      continue
    }
    const pushBox = (kind) => {
      const c = clipped(box(r), clip)
      if (c) content.push({ ...c, kind })
    }
    if (tag === 'svg' || tag === 'video' || tag === 'iframe' || tag === 'canvas' || tag === 'picture' || tag === 'object' || tag === 'embed') {
      pushBox(tag)
    } else if (el.matches(CONTROL) && r.height <= CONTROL_MAX_H) {
      pushBox('control')
    } else if (/url\(/.test(cs(el).backgroundImage)) {
      pushBox('bg-image')
    }
    // Text drawn directly by this element (its own text nodes, not its children's).
    const range = document.createRange()
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.data.trim()) continue
      range.selectNodeContents(node)
      for (const tr of range.getClientRects()) {
        const c = clipped(box(tr), clip)
        if (c) content.push({ ...c, kind: 'text' })
      }
    }
  }

  const frameEl = document.querySelector('.listing-frame__media')
  let frame = null
  if (frameEl && visible(frameEl)) {
    const fr = frameEl.getBoundingClientRect()
    const leadKind = frameEl.getAttribute('data-lead') === 'video' ? 'video' : 'image'
    let lead = null
    if (leadKind === 'image') {
      // The still in view: the slide image that overlaps the frame, not a
      // neighbour parked off to the right.
      for (const img of frameEl.querySelectorAll('img')) {
        const ir = img.getBoundingClientRect()
        const overlap = Math.min(ir.right, fr.right) - Math.max(ir.left, fr.left)
        if (overlap >= fr.width / 2 && visible(img)) {
          lead = {
            kind: 'image',
            box: box(ir),
            natural: { w: img.naturalWidth, h: img.naturalHeight },
            fit: cs(img).objectFit,
            position: cs(img).objectPosition,
            complete: img.complete && img.naturalWidth > 0,
            src: img.currentSrc || img.src,
          }
          break
        }
      }
    }
    frame = { box: box(fr), leadKind: lead ? 'image' : leadKind === 'video' ? 'video' : 'none', lead }
  }

  const jaxEl = document.querySelector('.v3-dog-floater')
  const jax = jaxEl && visible(jaxEl) ? { box: box(jaxEl.getBoundingClientRect()) } : null

  return {
    vw,
    vh,
    scrollY: window.scrollY,
    address: named('h1.listing-ask'),
    price: named('.listing-ask__price'),
    facts: named('.listing-face__facts'),
    frame,
    jax,
    content,
    images,
    openDialogs: [...document.querySelectorAll('[role="dialog"][data-state="open"], dialog[open]')].length,
  }
}

/** The boxes whose settling decides when a reading is final. */
const settleKey = (m) =>
  JSON.stringify([m.address?.box, m.price?.box, m.facts?.box, m.frame?.box, m.jax?.box].map((b) => (b ? [Math.round(b.y), Math.round(b.h), Math.round(b.x)] : null)))

async function measure(browser, path, vp) {
  const { context } = await openGateContext(browser, {
    baseUrl: BASE,
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  let lastErr = null
  try {
    for (let attempt = 1; attempt <= NAV_ATTEMPTS; attempt += 1) {
      try {
        const res = await page.goto(BASE + path, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS })
        if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`)
        await page.evaluate(() => document.fonts.ready.then(() => true))
        // The phone frame takes the lead still's shape once it decodes
        // (ListingHero onLeadShape), which moves everything under it. Measure
        // after that, bounded so a hung CDN cannot hang the gate.
        await page
          .waitForFunction(
            () => {
              const frame = document.querySelector('.listing-frame__media')
              if (!frame) return false
              if (frame.getAttribute('data-lead') === 'video') return true
              const imgs = [...frame.querySelectorAll('img')]
              return imgs.length > 0 && imgs.some((img) => img.complete && img.naturalWidth > 0)
            },
            undefined,
            { timeout: MEDIA_SETTLE_MS },
          )
          .catch(() => {})
        // Jax arrives with a 1.35s flip; his box is read once it is done.
        await page
          .evaluate(async () => {
            const jax = document.querySelector('.v3-dog-floater')
            const anims = jax ? jax.getAnimations({ subtree: true }) : []
            await Promise.race([Promise.all(anims.map((a) => a.finished.catch(() => null))), new Promise((r) => setTimeout(r, 4000))])
          })
          .catch(() => {})
        await page.evaluate(() => window.scrollTo(0, 0))
        let reading = await page.evaluate(`(${readFold.toString()})()`)
        for (let pass = 0; pass < STABLE_PASSES; pass += 1) {
          await page.waitForTimeout(STABLE_INTERVAL_MS)
          const next = await page.evaluate(`(${readFold.toString()})()`)
          const settled = settleKey(next) === settleKey(reading)
          reading = next
          if (settled) break
        }
        if (reading.scrollY !== 0) throw new Error(`page did not stay at the top (scrollY ${reading.scrollY})`)
        if (!reading.address && !reading.price) throw new Error('no h1.listing-ask and no price: the listing did not render')
        if (reading.frame?.leadKind === 'image' && !reading.frame.lead?.complete) {
          throw new Error(`lead photo did not load (${reading.frame.lead?.src ?? 'no src'}); the frame cannot be judged`)
        }
        return reading
      } catch (err) {
        lastErr = err
        if (attempt < NAV_ATTEMPTS) await page.waitForTimeout(3_000)
      }
    }
    throw lastErr ?? new Error('unknown navigation failure')
  } finally {
    await context.close()
  }
}

// ── driver ───────────────────────────────────────────────────────────────────

async function main() {
  log(`Listing phone-fold gate (${LISTING_PHONE_FOLD_GATE})`)
  log('==============================================\n')
  log(`base       ${BASE}`)
  log(`viewports  ${PHONE_VIEWPORTS.map((v) => v.name).join(', ')}`)
  log(
    `limits     empty band <= ${FOLD_LIMITS.maxHeroBandPx}px above the facts line and <= ${FOLD_LIMITS.maxDeadBandPx}px anywhere in the fold · photo frame <= 4:3 tall, reel frame <= 16:9 · photo leaves <= ${FOLD_LIMITS.maxUncoveredFramePx}px of frame empty · Jax clear of the price and the address\n`,
  )

  if (!(await reachable(BASE + '/'))) {
    console.error(`No server answering at ${BASE}.`)
    console.error('This gate measures a real rendered page; it does not guess and it does not skip.')
    console.error('  npm run build && npm run ci:runtime-gates')
    console.error('  PHONE_FOLD_BASE_URL=http://127.0.0.1:3401 npm run ci:listing-phone-fold')
    process.exit(1)
  }

  const discovery = await discoverCases()
  const cases = [...discovery.cases.filter((c) => !c.missing), ...(discovery.survey ?? [])]
  log(`discovered from /sitemaps/listings.xml (${discovery.sitemapCount ?? 0} listing URLs, ${discovery.probed ?? 0} probed):`)
  for (const c of cases) log(`  ${c.kind.padEnd(12)} ${c.address} · ${c.info.facts}  ${c.path}`)
  log('')

  const failures = []
  if (discovery.error) failures.push(`discovery: ${discovery.error}`)

  const browser = await chromium.launch()
  const rows = []
  const readings = []
  for (const c of cases) {
    for (const vp of PHONE_VIEWPORTS) {
      let reading
      const started = Date.now()
      try {
        reading = await measure(browser, c.path, vp)
        log(`  measured ${c.kind} @${vp.name} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
      } catch (err) {
        failures.push(`${c.address} (${c.path}) @${vp.name}: did not render for measurement: ${String(err?.message ?? err).split('\n')[0]}`)
        rows.push(`${c.kind.padEnd(12)} ${vp.name.padEnd(9)} did not render`)
        continue
      }
      const m = { ...reading, viewport: vp, listing: { kind: c.kind, label: c.address, path: c.path } }
      readings.push(m)
      rows.push(tableRow(m))
      for (const p of foldProblems(m)) failures.push(p.message)
    }
  }
  await browser.close()

  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, limits: FOLD_LIMITS, cases, readings, failures }, null, 2))
    process.exit(failures.length ? 1 : 0)
  }

  log(tableHeader())
  for (const r of rows) log(r)
  log(
    '\n  y = top..bottom in CSS px at scrollY 0 · uncovered = frame px the lead photo leaves empty ·\n' +
      '  hero band / fold band = tallest band with nothing drawn, above the facts line / anywhere in the\n' +
      '  first screen · Jax/x = disc clearance from that text (negative overlaps)',
  )

  if (SURVEY_N > 0) {
    // Report only: where the largest bands fall on this build.
    const worst = (pick) =>
      readings
        .map((m) => ({ m, g: pick(summarizeFold(m)) }))
        .filter((x) => x.g)
        .sort((a, b) => b.g.px - a.g.px)[0]
    for (const [label, pick, limit] of [
      ['hero band', (s) => s.keyGap, FOLD_LIMITS.maxHeroBandPx],
      ['fold band', (s) => s.gap, FOLD_LIMITS.maxDeadBandPx],
    ]) {
      const w = worst(pick)
      if (w) log(`  survey: largest ${label} ${w.g.px}px (${w.m.listing.label} @${w.m.viewport.name}, y ${w.g.from}..${w.g.to}); limit ${limit}px`)
    }
    for (const f of failures) log(`  survey: over a limit: ${f}`)
    process.exit(readings.length ? 0 : 1)
  }

  if (failures.length) {
    console.error(`\n${LISTING_PHONE_FOLD_GATE} FAILED (${failures.length}):`)
    for (const f of failures) console.error(`  x ${f}`)
    console.error(
      '\n  The listing page\'s first screen on a phone must show the address, the price and the\n' +
        '  beds / baths / sq ft under a hero that is the photograph\'s own shape, with no empty\n' +
        '  band and Jax clear of the price (PR #386, Matt 2026-09-25). Fix the page, not the limit.',
    )
    process.exit(1)
  }
  log(`\n${LISTING_PHONE_FOLD_GATE} OK: ${readings.length} listing x viewport reading(s), every fold holds.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err))
  process.exit(1)
})
