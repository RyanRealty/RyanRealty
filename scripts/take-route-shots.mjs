#!/usr/bin/env node
/**
 * take-route-shots.mjs — the ONE screenshot tool for `ui_kits/<route>/shots/`.
 *
 * WHAT IT REPLACED, AND WHY
 *
 * Every lane used to write its own capture script. By 2026-09-08 there were
 * ~60 of them under `scripts/_*shot*.mjs`, each with its own viewport, its own
 * device scale factor, its own idea of when a page is "loaded", and its own
 * output path. One of them (abfbb5fb) rode into an unrelated commit from a
 * lane's worktree root and had to be deleted in a follow-up.
 *
 * The cost was not the scripts. It was what they committed. Forensic audit of
 * the site queue's first day (Matt 2026-09-08): in one 6h37m window, 76 PNG
 * file-changes wrote 105.78 MB of new blob content into permanent git history
 * and grew the working tree +51.23 MB net. `ui_kits/neighborhood/shots/desktop.png`
 * went 1,147,456 -> 4,298,049 -> 10,619,761 bytes across two commits; the city
 * shot hit 11,346,285 in one. Every byte is paid again on every clone and every
 * Vercel build context.
 *
 * The mechanism was always the same shape: `fullPage: true` at
 * `deviceScaleFactor: 2`. A place page is ~16,300 CSS px tall, so that is a
 * 2880 x 32,600 PNG — 94 megapixels, written raw. Resolution was never the
 * problem: 1440 is kept here in full. The problem was capturing an entire
 * scroll-height at 2x and never quantizing the result.
 *
 * So this tool: one viewport standard (1440x900 and 375x812), device scale
 * factor 1, palette-quantized output, and the page-load traps the one-offs
 * each learned separately, carried in one place.
 *
 * USAGE
 *
 *   node scripts/take-route-shots.mjs <route-key> <baseUrl> [options]
 *
 *   node scripts/take-route-shots.mjs sell http://localhost:3199
 *   node scripts/take-route-shots.mjs city http://localhost:3199/cities/bend
 *   node scripts/take-route-shots.mjs sell http://localhost:3199 \
 *       --states proof=#track-record,answer-open=#faq!click
 *
 *   <route-key>  the `design_system/ryan-realty/ui_kits/<route-key>/` directory.
 *   <baseUrl>    an origin, or a full URL. Given a bare origin the path is read
 *                off that route's parity.json `route` field; a route with a
 *                dynamic segment (`app/cities/[slug]/page.tsx`) has no single
 *                URL, so pass the full one.
 *
 *   --states a,b=SEL,c=SEL!click   extra shots beyond the top-of-page pair.
 *                `a`          scroll to `#a` when it exists, else shoot the top
 *                `b=SEL`      scroll SEL into view, then shoot the viewport
 *                `c=SEL!click` scroll to SEL, click it, then shoot the viewport
 *   --out <dir>  write somewhere other than the route's shots/ directory
 *   --full       whole-page capture instead of the first viewport. Height-capped
 *                (see MAX_FULL_PAGE_HEIGHT) — a 16,000px stitch is the thing
 *                this tool exists to stop, so past the cap it refuses and tells
 *                you to use --states.
 *   --keep-raw   also write the un-quantized PNG under `out/take-route-shots/`
 *                (gitignored) so the encoder can be measured. Never in shots/ —
 *                a stray raw beside a shot is another 1.5 MB blob waiting to be
 *                staged by accident.
 *
 * NAMING IS READ OFF THE DIRECTORY, NOT INVENTED. Most routes use
 * `desktop.png` / `mobile375.png` with `<state>-desktop.png` /
 * `<state>-mobile375.png`; `sell/` uses `<state>-1440.png` / `<state>-375.png`
 * with `sell-1440.png` as its base pair. The tool detects which of the two a
 * directory already speaks and keeps speaking it, because `parity.json`
 * `tasteReview.shots` binds those exact paths and `ci:taste-canon` reads them.
 *
 * TRAPS PORTED FROM THE ONE-OFFS (each cost someone a debugging session)
 *
 *  1. Lenis smooth scroll. `window.scrollTo` does not move a Lenis page — the
 *     wrapper animates its own transform and a stitched `fullPage` capture
 *     comes back with blank bands where nothing ever painted. Scrolling here is
 *     real `mouse.wheel` in chunks with `window.scrollY` read back between them
 *     (_sell-shot2.mjs), and the default capture is viewport-sized at a real
 *     scroll position rather than a stitch.
 *  2. Scroll-reveal priming. GSAP ScrollTrigger reveals are `once: true`, so a
 *     section never scrolled past stays at opacity 0 forever. Walk the whole
 *     page with the wheel, then come back to the top (_sell-shot.mjs).
 *  3. The two overlays. The sign-in prompt and the cookie banner mount late and
 *     land in the middle of the shot. Suppressed in `addInitScript` BEFORE any
 *     page JS runs (localStorage key + consent cookie), with a click fallback
 *     for the case where one mounts anyway (_ds-shot.mjs).
 *  4. Undecoded images. `next/image` swaps in the real file after hydration; a
 *     shot taken too early is a wall of grey boxes. Wait until >=90% of
 *     `document.images` report `naturalWidth > 0` (_ds-shot.mjs).
 *  5. Webfonts. Amboqia and Geist land after first paint and reflow every
 *     heading. Await `document.fonts.ready` (_live-shot.mjs).
 *  6. `networkidle` is not a load signal here. Analytics beacons and the map
 *     SDK keep sockets warm, so `waitUntil: 'networkidle'` either hangs to the
 *     timeout or resolves at an arbitrary moment. Load on `domcontentloaded`
 *     and settle explicitly.
 *  7. Headless WebGL. Map canvases render black without a software GL fallback,
 *     so chromium launches with swiftshader (_shot-fixes.mjs).
 *  8. The bot screen. `middleware.ts` 403s automation User-Agents and empty
 *     ones — that is what makes a production capture come back as an error
 *     page. Send a real Chrome UA (the same reason `scripts/lib/ci-probe-ua.mjs`
 *     exists for fetch-based probes).
 *  9. Animation mid-frame. Capture with `animations: 'disabled'` so a shot is
 *     not taken halfway through a fade. `reducedMotion` stays
 *     'no-preference' on purpose — under 'reduce' some reveals never run and
 *     the page shoots empty.
 *
 * RUNNING A SERVER FOR IT. In a git worktree use `npx next dev --webpack`:
 * Turbopack refuses the symlinked `node_modules` a worktree gets. Any port is
 * fine; pass it in the base URL.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { chromium } from 'playwright'
import { SHOT_BYTE_CAP } from './check-shot-weight.mjs'

const UI_KITS = 'design_system/ryan-realty/ui_kits'

/** Real Chrome. The bot screen 403s automation UAs and empty ones (trap 8). */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Software GL so map canvases paint in headless (trap 7). */
const LAUNCH_ARGS = ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist']

export const VIEWPORTS = [
  { key: 'desktop', width: 1440, height: 900 },
  { key: 'mobile375', width: 375, height: 812 },
]

/**
 * Palette quantization. A review shot is flat UI over photography; 256 indexed
 * colours at libimagequant quality 90 is visually clean and lands a photo-heavy
 * 1440x900 hero at ~545 KB instead of ~1.58 MB. Dithering is off: it buys
 * nothing a reviewer can see and its noise defeats PNG's row filters.
 */
export const PNG_ENCODE = Object.freeze({
  palette: true,
  quality: 90,
  dither: 0,
  effort: 10,
  compressionLevel: 9,
})

/**
 * A whole-page capture past this height is the failure this tool exists to
 * stop — 16,300 CSS px of place page is a 94-megapixel PNG at 2x, and even at
 * 1x and quantized it cannot fit under the ci:shot-weight cap. Past it, states
 * are the answer.
 */
export const MAX_FULL_PAGE_HEIGHT = 6000

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

export function parseStates(raw) {
  const states = []
  for (const chunk of String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const eq = chunk.indexOf('=')
    if (eq === -1) {
      states.push({ name: chunk, selector: `#${chunk}`, click: false, selectorImplied: true })
      continue
    }
    const name = chunk.slice(0, eq).trim()
    let selector = chunk.slice(eq + 1).trim()
    let click = false
    if (selector.endsWith('!click')) {
      click = true
      selector = selector.slice(0, -'!click'.length).trim()
    }
    states.push({ name, selector, click, selectorImplied: false })
  }
  return states
}

function parseArgv(argv) {
  const positional = []
  const opts = { states: [], out: null, full: false, keepRaw: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--states') opts.states = parseStates(argv[++i])
    else if (a.startsWith('--states=')) opts.states = parseStates(a.slice('--states='.length))
    else if (a === '--out') opts.out = argv[++i]
    else if (a.startsWith('--out=')) opts.out = a.slice('--out='.length)
    else if (a === '--full') opts.full = true
    else if (a === '--keep-raw') opts.keepRaw = true
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`)
    else positional.push(a)
  }
  opts.routeKey = positional[0]
  opts.baseUrl = positional[1]
  return opts
}

// ---------------------------------------------------------------------------
// naming — read the directory, never invent
// ---------------------------------------------------------------------------

/**
 * Which suffix pair a shots/ directory already speaks.
 * `desktop`  -> desktop.png / mobile375.png / <state>-desktop.png
 * `1440`     -> <route>-1440.png / <route>-375.png / <state>-1440.png
 */
export function detectNaming(existingFiles, routeKey) {
  const has1440 = existingFiles.some((f) => /-1440\.png$/.test(f))
  const hasDesktop = existingFiles.some((f) => /(^|-)desktop\.png$/.test(f))
  const style = has1440 && !hasDesktop ? '1440' : 'desktop'
  const wide = style === '1440' ? '1440' : 'desktop'
  const narrow = style === '1440' ? '375' : 'mobile375'
  return {
    style,
    /** @param {string|null} state @param {'desktop'|'mobile375'} viewportKey */
    fileFor(state, viewportKey) {
      const suffix = viewportKey === 'desktop' ? wide : narrow
      if (state) return `${state}-${suffix}.png`
      // A `1440`-style directory has no bare `desktop.png`; its base pair is
      // named after the route (sell-1440.png / sell-375.png).
      return style === '1440' ? `${routeKey}-${suffix}.png` : `${suffix}.png`
    },
  }
}

/** URL path from a parity.json `route` (`app/sell/page.tsx` -> `/sell`). */
export function routePathFromParity(routeField) {
  if (typeof routeField !== 'string') return null
  const trimmed = routeField.replace(/^app\//, '').replace(/\/page\.tsx?$/, '')
  if (/\[/.test(trimmed)) return null // dynamic segment — no single URL
  return `/${trimmed}`.replace(/\/+$/, '') || '/'
}

export function resolveUrl(baseUrl, routeKey, readParity) {
  let u
  try {
    u = new URL(baseUrl)
  } catch {
    throw new Error(`<baseUrl> is not a URL: ${baseUrl}`)
  }
  if (u.pathname && u.pathname !== '/') return u.toString()

  const parity = readParity(routeKey)
  const path = routePathFromParity(parity?.route)
  if (!path) {
    throw new Error(
      `cannot derive a URL for "${routeKey}" from ${UI_KITS}/${routeKey}/parity.json ` +
        `(route: ${parity?.route ?? 'missing'}). It has a dynamic segment or no parity file — ` +
        `pass the full URL, e.g. ${u.origin}/cities/bend`,
    )
  }
  return new URL(path, u.origin).toString()
}

// ---------------------------------------------------------------------------
// page handling
// ---------------------------------------------------------------------------

/** Trap 3 — kill the two overlays before any page JS runs. */
const SUPPRESS_OVERLAYS = () => {
  try {
    localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    document.cookie =
      'ryan_realty_cookie_consent=' +
      encodeURIComponent(JSON.stringify({ analytics: true, marketing: true })) +
      '; path=/'
  } catch {}
}

async function dismissOverlays(page) {
  for (const name of ['Maybe later', 'Accept All', 'Accept all', 'Essential only', 'Got it']) {
    try {
      const btn = page.getByRole('button', { name }).first()
      if (await btn.isVisible({ timeout: 250 })) await btn.click({ timeout: 600 })
    } catch {}
  }
}

/** Trap 5 — webfonts reflow every heading after first paint. */
async function waitFonts(page) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
}

/** Trap 4 — next/image swaps the real file in after hydration. */
async function waitImages(page, timeout = 15000) {
  try {
    await page.waitForFunction(
      () => {
        const imgs = Array.from(document.images)
        if (imgs.length === 0) return true
        return imgs.filter((i) => i.complete && i.naturalWidth > 0).length / imgs.length >= 0.9
      },
      { timeout },
    )
  } catch {
    /* best effort — a broken image must not block the shot */
  }
}

/** Current scroll offset, Lenis wrapper or window. */
const readScrollY = (page) => page.evaluate(() => window.scrollY || document.documentElement.scrollTop || 0)

/**
 * Trap 1 — real wheel input, because Lenis ignores programmatic scrollTo.
 * Walks toward `targetY` in capped steps and gives up rather than spinning if
 * the page will not move (a scroll-locked modal, a shorter page than expected).
 */
async function wheelTo(page, targetY) {
  let current = await readScrollY(page)
  let stalled = 0
  for (let guard = 0; guard < 160 && Math.abs(current - targetY) > 48; guard += 1) {
    const delta = Math.max(-900, Math.min(900, targetY - current))
    await page.mouse.wheel(0, delta)
    await page.waitForTimeout(80)
    const next = await readScrollY(page)
    if (Math.abs(next - current) < 2) {
      stalled += 1
      if (stalled >= 4) break
    } else {
      stalled = 0
    }
    current = next
  }
  await page.waitForTimeout(500)
  return current
}

/** Trap 2 — walk the page so every `once: true` reveal fires, then come back. */
async function primeReveals(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < height; y += 700) {
    await page.mouse.wheel(0, 700)
    await page.waitForTimeout(90)
  }
  await page.waitForTimeout(900)
  await page.mouse.wheel(0, -(height * 2))
  await page.waitForTimeout(1100)
  return height
}

async function loadPage(page, url) {
  // Trap 6 — domcontentloaded plus an explicit settle, never networkidle.
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await waitFonts(page)
  await page.waitForTimeout(1200)
  await dismissOverlays(page)
  const height = await primeReveals(page)
  await waitImages(page)
  await page.waitForTimeout(600)
  return { status: response?.status() ?? 0, height }
}

// ---------------------------------------------------------------------------
// encode + write
// ---------------------------------------------------------------------------

const RAW_DIR = 'out/take-route-shots'

async function writeShot(page, destPath, { full, keepRaw, routeKey }) {
  const raw = await page.screenshot({ fullPage: Boolean(full), animations: 'disabled' })
  const encoded = await sharp(raw).png(PNG_ENCODE).toBuffer()
  mkdirSync(resolve(destPath, '..'), { recursive: true })
  writeFileSync(destPath, encoded)
  if (keepRaw) {
    const rawDir = join(RAW_DIR, routeKey)
    mkdirSync(rawDir, { recursive: true })
    writeFileSync(join(rawDir, destPath.split('/').pop()), raw)
  }
  return { bytes: encoded.length, rawBytes: raw.length }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function readParityFile(routeKey) {
  const p = join(UI_KITS, routeKey, 'parity.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  let opts
  try {
    opts = parseArgv(process.argv.slice(2))
  } catch (err) {
    console.error(`take-route-shots: ${err.message}`)
    process.exit(2)
  }

  if (!opts.routeKey || !opts.baseUrl) {
    console.error('Usage: node scripts/take-route-shots.mjs <route-key> <baseUrl> [--states a,b=SEL,c=SEL!click] [--out <dir>] [--full] [--keep-raw]')
    process.exit(2)
  }

  const outDir = opts.out ?? join(UI_KITS, opts.routeKey, 'shots')
  mkdirSync(outDir, { recursive: true })
  const existing = readdirSync(outDir).filter((f) => f.endsWith('.png'))
  const naming = detectNaming(existing, opts.routeKey)

  let url
  try {
    url = resolveUrl(opts.baseUrl, opts.routeKey, readParityFile)
  } catch (err) {
    console.error(`take-route-shots: ${err.message}`)
    process.exit(2)
  }

  console.log(`take-route-shots — ${opts.routeKey}`)
  console.log(`  url        ${url}`)
  console.log(`  out        ${outDir}`)
  console.log(`  naming     ${naming.style === '1440' ? '<state>-1440 / <state>-375' : '<state>-desktop / <state>-mobile375'} (from ${existing.length} existing shot${existing.length === 1 ? '' : 's'})`)
  console.log(`  capture    ${opts.full ? `full page (height-capped at ${MAX_FULL_PAGE_HEIGHT}px)` : 'first viewport'} · scale 1 · palette-quantized`)
  console.log('')

  const browser = await chromium.launch({ args: LAUNCH_ARGS })
  const written = []
  let failed = false

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent: BROWSER_USER_AGENT,
        deviceScaleFactor: 1, // the 9x blowup lived here
        reducedMotion: 'no-preference', // trap 9 — 'reduce' leaves reveals unfired
      })
      await context.addInitScript(SUPPRESS_OVERLAYS)
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160))
      })

      const { status, height } = await loadPage(page, url)
      if (status >= 400 || status === 0) {
        console.error(`  ${viewport.key}: HTTP ${status} — refusing to write a shot of an error page`)
        failed = true
        await context.close()
        continue
      }

      if (opts.full && height > MAX_FULL_PAGE_HEIGHT) {
        console.error(
          `  ${viewport.key}: page is ${height}px tall, over the ${MAX_FULL_PAGE_HEIGHT}px --full cap.\n` +
            '    A stitch this tall is the 10 MB PNG this tool exists to stop. Capture the\n' +
            '    sections instead:  --states hero,proof=#track-record,answer=#faq',
        )
        failed = true
        await context.close()
        continue
      }

      // Base pair, at the top of the page.
      const baseFile = naming.fileFor(null, viewport.key)
      const baseResult = await writeShot(page, join(outDir, baseFile), opts)
      written.push({ file: baseFile, ...baseResult })

      for (const state of opts.states) {
        const target = await page
          .evaluate((sel) => {
            const el = document.querySelector(sel)
            if (!el) return null
            return el.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop || 0)
          }, state.selector)
          .catch(() => null)

        if (target == null) {
          if (!state.selectorImplied) {
            console.error(`  ${viewport.key}: state "${state.name}" — selector ${state.selector} not found`)
            failed = true
            continue
          }
          // A bare state name with no matching anchor shoots the top of the page.
        } else {
          await wheelTo(page, Math.max(0, target - 24))
          if (state.click) {
            await page.click(state.selector, { timeout: 5000 }).catch((err) => {
              console.error(`  ${viewport.key}: state "${state.name}" — click failed: ${err.message.split('\n')[0]}`)
              failed = true
            })
            await page.waitForTimeout(700)
          }
        }

        const file = naming.fileFor(state.name, viewport.key)
        const result = await writeShot(page, join(outDir, file), opts)
        written.push({ file, ...result })
        await wheelTo(page, 0)
      }

      if (consoleErrors.length) {
        console.log(`  ${viewport.key}: ${consoleErrors.length} console error(s) — ${consoleErrors[0]}`)
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }

  console.log('')
  console.log('  bytes      raw ->  written   file')
  let over = 0
  for (const w of written) {
    const flag = w.bytes > SHOT_BYTE_CAP ? '  OVER CAP' : ''
    if (w.bytes > SHOT_BYTE_CAP) over += 1
    console.log(
      `  ${String(w.rawBytes).padStart(9)} -> ${String(w.bytes).padStart(9)}   ${w.file}${flag}`,
    )
  }
  const total = written.reduce((s, w) => s + w.bytes, 0)
  console.log(`  ${written.length} shot(s), ${total} bytes written (cap ${SHOT_BYTE_CAP} per file)`)

  if (over > 0) {
    console.error(`\n  ${over} shot(s) are over the ci:shot-weight cap. Narrow the capture (--states) rather than committing them.`)
    failed = true
  }
  if (failed) process.exit(1)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && statSync(process.argv[1]).isFile() && process.argv[1].endsWith('take-route-shots.mjs')
  } catch {
    return false
  }
})()
if (invokedDirectly) await main()
