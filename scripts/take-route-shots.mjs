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
 *                `d=SEL!type:TEXT` scroll to SEL, fill it with TEXT, submit its
 *                             form, wait for the answer, then shoot. A states
 *                             argument containing `!type:` is separated by
 *                             SEMICOLONS, because an address carries commas.
 *                `e=SEL@ANCHOR!click` click SEL, but frame ANCHOR — for a
 *                             control that changes something above it (the
 *                             homepage Sell tab and the hero headline it swaps)
 *   --await SEL  after a `!type:` submit, wait for SEL to be visible before the
 *                shot. Network-idle only says the fetches stopped; it does not
 *                say the answer painted, and without this the capture caught a
 *                "reading sales, a few seconds" step (2026-09-08). Name the
 *                thing the state exists to show.
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
 * 11. The sticky chrome over a state shot. A `--states` capture used to park
 *     the target 24px from the top of the viewport, under a 66px header, so
 *     every state shot on this site showed a section with its first line
 *     sliced. That is not what a visitor following the anchor sees, and it
 *     cost the 2026-09-08 homepage pass a defect report against a page that
 *     was correct. The scroll now reserves the target's own
 *     `scroll-margin-top`, or the pinned chrome's height plus 24 when it
 *     declares none.
 *
 * RUNNING A SERVER FOR IT. In a git worktree use `npx next dev --webpack`:
 * Turbopack refuses the symlinked `node_modules` a worktree gets. Any port is
 * fine; pass it in the base URL.
 */
import { execFile } from 'node:child_process'
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

/**
 * A state's optional action, and why `!type:` exists.
 *
 * `!click` reaches anything behind a disclosure or a tab. It cannot reach a
 * state behind a FORM: the /sell answer and the place-page ask only exist after
 * a visitor has typed an address and submitted it, so the shot that records
 * them had no way to be taken with this tool — which is exactly how lanes end
 * up writing their own capture script again (SITE-02b, 2026-09-08).
 *
 * `!type:<text>` fills the selector, submits its form, and waits for the answer
 * to land before the shot. An address carries commas, so a states argument that
 * uses `!type:` is separated by SEMICOLONS instead; without one the comma split
 * stays exactly as it was.
 */
export function parseStates(raw) {
  const arg = String(raw ?? '')
  const states = []
  for (const chunk of arg
    .split(arg.includes('!type:') ? ';' : ',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const eq = chunk.indexOf('=')
    if (eq === -1) {
      states.push({ name: chunk, selector: `#${chunk}`, anchor: null, click: false, type: null, selectorImplied: true })
      continue
    }
    const name = chunk.slice(0, eq).trim()
    let selector = chunk.slice(eq + 1).trim()
    let click = false
    let type = null
    const bang = selector.indexOf('!type:')
    if (bang !== -1) {
      type = selector.slice(bang + '!type:'.length)
      selector = selector.slice(0, bang).trim()
    } else if (selector.endsWith('!click')) {
      click = true
      selector = selector.slice(0, -'!click'.length).trim()
    }
    // `SEL@ANCHOR` — click SEL, frame ANCHOR. A control and the thing it
    // changes are usually not the same element: the homepage Sell tab sits at
    // the foot of the hero, so framing the tab crops off the headline the tab
    // just switched. Split on the LAST `@` so a selector holding one in an
    // attribute value keeps it. This runs AFTER the `!` suffix is stripped, so
    // `SEL@ANCHOR!click` reaches here as `SEL@ANCHOR`.
    let anchor = null
    const at = selector.lastIndexOf('@')
    if (at > 0) {
      anchor = selector.slice(at + 1).trim() || null
      selector = selector.slice(0, at).trim()
    }
    states.push({ name, selector, anchor, click, type, selectorImplied: false })
  }
  return states
}

function parseArgv(argv) {
  const positional = []
  const opts = { states: [], out: null, full: false, keepRaw: false, awaitSelector: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--states') opts.states = parseStates(argv[++i])
    else if (a.startsWith('--states=')) opts.states = parseStates(a.slice('--states='.length))
    else if (a === '--await') opts.awaitSelector = argv[++i]
    else if (a.startsWith('--await=')) opts.awaitSelector = a.slice('--await='.length)
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
  // The leading slash is OPTIONAL in the page-file match: the homepage's route
  // is `app/page.tsx`, which trims to the bare `page.tsx`, and a `\/page\.tsx`
  // pattern left it there — `homepage-v6` resolved to `/page.tsx` and every
  // capture 404'd (SITE-12).
  const trimmed = routeField.replace(/^app\//, '').replace(/(^|\/)page\.tsx?$/, '')
  if (/\[/.test(trimmed)) return null // dynamic segment — no single URL
  return `/${trimmed}`.replace(/\/+$/, '') || '/'
}

/**
 * The Chromium to drive.
 *
 * Playwright resolves its own download by revision, so an image that ships ONE
 * pinned Chromium (which the agent sandboxes do, at /opt/pw-browsers) fails the
 * default launch with "Executable doesn't exist at chromium_headless_shell-<n>"
 * and tells the caller to run `npx playwright install` — which those images
 * deliberately forbid. Point at the pinned binary when there is one; fall back
 * to Playwright's own resolution when there is not, so a normal dev machine is
 * unaffected. PLAYWRIGHT_CHROMIUM_PATH overrides both.
 */
const CHROMIUM_EXECUTABLE = (() => {
  const named = (process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '').trim()
  if (named) return existsSync(named) ? named : undefined
  const pinned = '/opt/pw-browsers/chromium'
  return existsSync(pinned) ? pinned : undefined
})()

/**
 * TRAP 10 — remote media the BROWSER cannot reach.
 *
 * A public page's hero can be a CDN URL (the place heroes are Supabase storage
 * objects). In an egress-restricted sandbox the Node process reaches those
 * hosts through the configured proxy and headless Chromium does not, so the
 * capture comes back with a flat navy Stage and the evaluator grades a hole in
 * the page rather than the page. That is a capture artifact and it has already
 * cost one lane a receipt footnote.
 *
 * So: cross-origin image, media and font requests are fetched by NODE and
 * fulfilled into the browser — the same bytes a visitor gets, not a stand-in.
 * A fetch that fails hands the request straight back to the browser, so a
 * machine with ordinary network access behaves exactly as before. One response
 * cache per run, because six shots load the same hero six times.
 *
 * Set SHOT_NO_MEDIA_PROXY=1 to turn it off.
 */
const MEDIA_TYPES = new Set(['image', 'media', 'font'])
const mediaCache = new Map()

async function installRemoteMediaProxy(context, pageOrigin, stats) {
  if (process.env.SHOT_NO_MEDIA_PROXY === '1') return
  await context.route('**/*', async (route) => {
    const request = route.request()
    if (!MEDIA_TYPES.has(request.resourceType())) return route.continue()
    let origin
    try {
      origin = new URL(request.url()).origin
    } catch {
      return route.continue()
    }
    if (origin === pageOrigin) return route.continue()
    const key = request.url()
    try {
      if (!mediaCache.has(key)) {
        const response = await fetch(key, { signal: AbortSignal.timeout(20_000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        mediaCache.set(key, {
          body: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        })
      }
      const hit = mediaCache.get(key)
      stats.served += 1
      return route.fulfill({ status: 200, contentType: hit.contentType, body: hit.body })
    } catch {
      return route.continue()
    }
  })
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

/**
 * Trap 10 — the Next dev-tools badge. Every shot in this repo is taken against
 * `next dev`, and Next paints its own indicator in the bottom-left corner, on
 * top of the page. On the listing page it landed squarely over the label of the
 * first act in the close section, so a taste evaluator reading the shot saw a
 * control obscured by chrome that does not exist in production and would have
 * marked the page down for it. It is a capture artifact, so the capture tool
 * removes it: `nextjs-portal` is the custom element Next mounts the overlay in.
 */
const HIDE_DEV_CHROME = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher, [data-next-badge-root] {
    display: none !important;
  }
`

async function dismissOverlays(page) {
  // The dev-server build badge is a <nextjs-portal> shadow host pinned to the
  // bottom-left corner, so it lands in the corner of every record taken against
  // `next dev` — which is every record these lanes take. It is not the page.
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((n) => n.remove())).catch(() => {})
  for (const name of ['Maybe later', 'Accept All', 'Accept all', 'Essential only', 'Got it']) {
    try {
      const btn = page.getByRole('button', { name }).first()
      if (await btn.isVisible({ timeout: 250 })) await btn.click({ timeout: 600 })
    } catch {}
  }
}

/**
 * Trap 11 — the pinned browser is not the installed browser. A cloud sandbox
 * ships one chromium build under PLAYWRIGHT_BROWSERS_PATH; bump the playwright
 * package and its expected build moves ahead of it, so `chromium.launch()` dies
 * with "Executable doesn't exist" and tells you to run `npx playwright install`,
 * which these images forbid (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD). Both lanes
 * working on 2026-09-08 hit it and each hand-passed an executablePath.
 *
 * So: use playwright's own resolution when the file is really there, and
 * otherwise fall back to the newest chromium actually installed. Returns an
 * empty object on a normal machine, where nothing needs saying.
 */
function installedChromium() {
  const override = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  if (override && existsSync(override)) return { executablePath: override }
  try {
    if (existsSync(chromium.executablePath())) return {}
  } catch {
    /* playwright cannot even name it — fall through to the scan */
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  if (!existsSync(root)) return {}
  const builds = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const build of builds) {
    const bin = join(root, build, 'chrome-linux', 'chrome')
    if (existsSync(bin)) {
      console.log(`  browser    ${bin} (playwright's pinned build is not installed)`)
      return { executablePath: bin }
    }
  }
  return {}
}

/**
 * Trap 10 — a cloud agent's browser cannot reach the image hosts, so the record
 * shows a page nobody ships. In the sandboxes these lanes run in, the browser's
 * egress refuses the Supabase storage bucket, the Spark photo CDN and the
 * YouTube thumbnail host (ERR_CONNECTION_RESET) while curl reaches all three
 * through the agent proxy. Lanes each discovered this separately on 2026-09-08
 * and one shipped a whole set of records with a navy void where the hero is.
 *
 * So: try the browser's own stack first (on a normal machine that is the whole
 * story and costs one extra hop), and only when it throws, fetch the same URL
 * with curl and fulfil the real bytes. Never a substitute image — if curl fails
 * too, the request is aborted and waitImages simply records what loaded.
 */
const RELAY_WHEN_BLOCKED = [/\/storage\/v1\/object\/public\//, /cdn\.resize\.sparkplatform\.com/, /i\.ytimg\.com/]

const CONTENT_TYPE_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml' }

async function relayBlockedAssets(page) {
  await page.route(
    (u) => RELAY_WHEN_BLOCKED.some((re) => re.test(u.href)),
    async (route) => {
      try {
        const direct = await route.fetch()
        await route.fulfill({ response: direct })
        return
      } catch {
        /* browser egress refused it — fall through to curl */
      }
      const href = route.request().url()
      try {
        const body = await new Promise((ok, no) =>
          execFile('curl', ['-sSL', '--max-time', '30', href], { encoding: 'buffer', maxBuffer: 96 * 1024 * 1024 }, (err, out) =>
            err ? no(err) : ok(out),
          ),
        )
        if (!body || body.length === 0) throw new Error('empty body')
        const ext = (href.split('?')[0].split('.').pop() ?? '').toLowerCase()
        await route.fulfill({ status: 200, body, contentType: CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream' })
      } catch {
        await route.abort().catch(() => {})
      }
    },
  )
}

/** Trap 5 — webfonts reflow every heading after first paint. */
async function waitFonts(page) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
  await page.addStyleTag({ content: HIDE_DEV_CHROME }).catch(() => {})
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
 * Wait until a region's rendered text stops changing.
 *
 * `networkidle` says the fetches finished; it does not say the answer painted.
 * A form whose submit runs a server action goes idle while a "reading sales"
 * step is still on screen, and the shot catches the spinner. This samples the
 * region's text and returns once two consecutive samples match, capped so a
 * genuinely animating region cannot hang the capture.
 */
async function settleText(page, selector, { every = 500, cap = 45000 } = {}) {
  const read = () =>
    page
      .evaluate((sel) => document.querySelector(sel)?.innerText?.length ?? -1, selector)
      .catch(() => -1)
  const started = Date.now()
  let previous = await read()
  while (Date.now() - started < cap) {
    await page.waitForTimeout(every)
    const next = await read()
    if (next === previous && Date.now() - started > 1500) return true
    previous = next
  }
  return false
}

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

/**
 * Trap 12 — a record must not quietly show the page's degraded read. Every
 * place read here is wrapped in a 3.5-4s timeout fallback, and a dev server
 * compiling under load blows straight through it: the page then renders its
 * honest withheld state ("Live counts are unavailable right now", a callout
 * with no figure) and the capture writes THAT as the record. It happened on
 * 2026-09-08 to a whole mobile set, and the evaluator scored the withheld copy
 * as the shipped design and marked the feature missing.
 *
 * The withheld state is a real state and worth capturing deliberately, so this
 * does not ban it: it reloads, and only fails when the page will not come back.
 * A degraded record is worse than no record, because a number gets written
 * against it.
 */
const DEGRADED_SENTINELS = [
  'Live counts are unavailable right now',
  'counts are unavailable',
  'could not be read right now',
]

async function degradedRead(page) {
  const text = await page.evaluate(() => document.body.innerText || '').catch(() => '')
  return DEGRADED_SENTINELS.find((s) => text.includes(s)) ?? null
}

async function loadPage(page, url, { attempt = 1 } = {}) {
  // Trap 6 — domcontentloaded plus an explicit settle, never networkidle.
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await waitFonts(page)
  await page.waitForTimeout(1200)
  await dismissOverlays(page)
  const height = await primeReveals(page)
  await waitImages(page)
  await page.waitForTimeout(600)

  const degraded = await degradedRead(page)
  if (degraded) {
    if (attempt >= 3) {
      throw new Error(
        `the page is still serving its degraded read after ${attempt} loads ("${degraded}"). ` +
          `Warm the route first (curl it with a browser user agent until it is fast) and re-run — ` +
          `a record captured in this state understates the page and any score written against it is wrong.`,
      )
    }
    console.log(`  reload     degraded read ("${degraded}") — attempt ${attempt + 1} of 3`)
    await page.waitForTimeout(2500)
    return loadPage(page, url, { attempt: attempt + 1 })
  }

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

  // An explicit CHROMIUM_EXECUTABLE wins; otherwise fall back to the newest
  // installed chromium under /opt/pw-browsers, which is what this image ships.
  const browser = await chromium.launch({
    args: LAUNCH_ARGS,
    ...(CHROMIUM_EXECUTABLE ? { executablePath: CHROMIUM_EXECUTABLE } : installedChromium()),
  })
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
      const mediaStats = { served: 0 }
      await installRemoteMediaProxy(context, new URL(url).origin, mediaStats)
      const page = await context.newPage()
      await relayBlockedAssets(page)
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
        // TRAP 11 — the sticky chrome. Parking the target at y=24 puts its
        // first line UNDER a 66px header, so a state shot shows a section whose
        // heading is sliced and the evaluator reads a live defect the page does
        // not have (2026-09-08: #right-now's claim read "Wore than one in five"
        // in right-now-mobile375.png while an actual anchor scroll landed it
        // 14px clear). Reserve what a real anchor scroll reserves: the
        // element's own scroll-margin-top when it declares one — that IS the
        // page's answer — else the height of whatever is pinned at the top of
        // the viewport, plus the 24px this tool has always used. With no sticky
        // chrome and no declared margin the number is 24, exactly as before.
        const measure = (sel) =>
          page
            .evaluate((s) => {
              const el = document.querySelector(s)
              if (!el) return null
              const top =
                el.getBoundingClientRect().top +
                (window.scrollY || document.documentElement.scrollTop || 0)
              const declared = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0
              let chrome = 0
              for (const node of document.elementsFromPoint(Math.round(window.innerWidth / 2), 4)) {
                const cs = getComputedStyle(node)
                if (cs.position !== 'sticky' && cs.position !== 'fixed') continue
                const r = node.getBoundingClientRect()
                if (r.top <= 2 && r.height > 0) chrome = Math.max(chrome, r.height)
              }
              return { top, reserve: declared > 0 ? declared : chrome + 24 }
            }, sel)
            .catch(() => null)

        const frameSel = state.anchor ?? state.selector
        const target = await measure(frameSel)

        if (target == null) {
          if (!state.selectorImplied) {
            console.error(`  ${viewport.key}: state "${state.name}" — selector ${frameSel} not found`)
            failed = true
            continue
          }
          // A bare state name with no matching anchor shoots the top of the page.
        } else {
          await wheelTo(page, Math.max(0, target.top - target.reserve))
          if (state.click) {
            await page.click(state.selector, { timeout: 5000 }).catch((err) => {
              console.error(`  ${viewport.key}: state "${state.name}" — click failed: ${err.message.split('\n')[0]}`)
              failed = true
            })
            await page.waitForTimeout(700)
            // page.click scrolls its own target into view, and focusing a
            // visually-hidden control can move the page again, so an explicit
            // frame is re-applied after the click rather than before it.
            if (state.anchor) {
              const framed = await measure(state.anchor)
              if (framed) await wheelTo(page, Math.max(0, framed.top - framed.reserve))
            }
          }
          if (state.type != null) {
            // Fill, submit the owning form, and wait for the ANSWER — not for
            // the spinner. The first cut waited on networkidle and shot "Reading
            // Sunriver sales. A few seconds." (2026-09-08), which is a picture
            // of a loading step. So the settle also waits for the form's own
            // text to stop changing, and the shot re-finds the form afterwards
            // because an answer that replaces a step moves the page under it.
            const ok = await page
              .fill(state.selector, state.type, { timeout: 5000 })
              .then(() => true)
              .catch((err) => {
                console.error(
                  `  ${viewport.key}: state "${state.name}" — fill failed: ${err.message.split('\n')[0]}`,
                )
                failed = true
                return false
              })
            if (ok) {
              await page.evaluate((sel) => {
                const el = document.querySelector(sel)
                const form = el?.closest('form') ?? el?.parentElement
                if (form) form.setAttribute('data-shot-anchor', '1')
              }, state.selector)
              const submit = page
                .locator(state.selector)
                .locator('xpath=ancestor::form[1]')
                .locator('button[type=submit]')
                .first()
              if ((await submit.count().catch(() => 0)) > 0) {
                await submit.click({ timeout: 5000 }).catch(() => {})
              } else {
                await page.press(state.selector, 'Enter').catch(() => {})
              }
              // Park the pointer. The click leaves the cursor where the submit
              // button used to be, and an answer that renders under it comes up
              // already hovered — the shot then records one figure mid-reading
              // and the rest idle, which is not a state the page has.
              await page.mouse.move(0, 0)
              await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
              if (opts.awaitSelector) {
                await page
                  .waitForSelector(opts.awaitSelector, { state: 'visible', timeout: 90000 })
                  .catch(() => {
                    console.error(
                      `  ${viewport.key}: state "${state.name}" — --await ${opts.awaitSelector} never appeared`,
                    )
                    failed = true
                  })
              }
              await settleText(page, '[data-shot-anchor="1"]')
              const anchor = await page
                .evaluate(() => {
                  const el = document.querySelector('[data-shot-anchor="1"]')
                  if (!el) return null
                  return (
                    el.getBoundingClientRect().top +
                    (window.scrollY || document.documentElement.scrollTop || 0)
                  )
                })
                .catch(() => null)
              await wheelTo(page, Math.max(0, (anchor ?? target) - 24))
            }
          }
        }

        const file = naming.fileFor(state.name, viewport.key)
        const result = await writeShot(page, join(outDir, file), opts)
        written.push({ file, ...result })
        await wheelTo(page, 0)
      }

      if (mediaStats.served > 0) {
        console.log(`  ${viewport.key}: ${mediaStats.served} cross-origin asset(s) fetched by node (trap 10)`)
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
