/**
 * CMA look-pass: render the CURRENT renderer output for one or more
 * `cmas.slug` values — the exact functions the live app calls
 * (`renderCmaHtml` via `resolveCmaPrintHtml`, `renderImmersiveCmaHtml` via
 * `immersiveFromRow`, both fed from the row's `render_args`) — and
 * screenshot every chapter, so a reviewer can look at a document before it
 * goes anywhere near Matt. See docs/plans/CMA_FUNNEL_MISSION_2026-09-07.md
 * Stream A.
 *
 * READ-ONLY. Only ever SELECTs (`cmas`, `brokers`, the boundary/comp reads
 * `buildCmaMapDataUri` already does on every live render). Never writes.
 *
 * Usage:
 *   npx tsx scripts/cma-lookpass.ts <slug> [<slug> ...]
 *   npx tsx scripts/cma-lookpass.ts --check <slug> [<slug> ...]
 *   npx tsx scripts/cma-lookpass.ts --interact <slug> [<slug> ...]
 *
 * `--interact` drives every interaction the blueprint's Delta 2 asks for on
 * the immersive document — the timeline draw and a tap on a cut, the curve
 * scrub, a bar, a sale row and its pin, the adjusted-prices toggle, the sort,
 * the competition filter, a price-history expand, a month on the market line —
 * and screenshots the RESULT of each one at 1280 and 375, into
 * out/cma-look/<slug>/interact-<width>/NN-<name>.png. A control that is not
 * there, or a tap that changes nothing on the page, fails the run: an
 * interaction nobody drove is an interaction nobody knows works.
 *
 * `--check` adds three MECHANICAL failures on top of the shots, so the three
 * defects Matt found on 2026-09-07 cannot come back without the tool saying so
 * (docs/plans/CMA_REIMAGINED_2026-09-07.md, Done means):
 *
 *   1. a banned word in the seller text of either document
 *   2. a property address that is not inside a tracked ryan-realty.com link
 *   3. a chart label outside its own viewBox at 375, measured in the browser
 *      with getBBox() rather than estimated from a character count
 *
 * It exits non-zero on any of them.
 *
 * Per slug, writes to out/cma-look/<slug>/ (out/ is gitignored):
 *   letter.html, immersive.html          — the rendered HTML, as-is
 *   letter-816/NN-<chapter>.png          — one PNG per `.page`, screen width 816
 *   letter-375/NN-<chapter>.png          — same chapters, screen width 375
 *   immersive-1280/NN-<section>.png      — one PNG per `.sc[id]`, width 1280
 *   immersive-375/NN-<section>.png       — same sections, width 375
 *   contact-sheet.html                   — every shot above, tiled, one file to open
 *
 * Also prints one line per chapter per (document, width) to stdout: chapter
 * id, heading text, rendered height in px, and how many <svg>/<img>/<table>
 * sit inside it — the same thing a reviewer would eyeball, in a form that's
 * greppable across a batch of slugs.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import path from 'node:path'
import { promises as fs } from 'node:fs'
// Type-only: erased at compile time, so this does not trigger the
// `import 'server-only'` side effect in lib/data/cma/documents.ts at runtime.
import type { CmaRenderSource } from '@/lib/data/cma/documents'

// `server-only` throws by design outside a Next server component, and
// lib/data (which the render glue below pulls in) imports it; several of
// its files also import `next/cache` (unstable_cache), which needs Next's
// incremental cache. vitest solves both with aliases; a bare `npx tsx`
// process has no bundler to alias with, so module resolution is patched at
// require-time instead — the same technique scripts/_rerender-cma.ts,
// scripts/_rebuild-cma.ts, and scripts/_rebuild-failing-cmas.ts already use,
// factored into one place. Must run before any import of `@/lib/**` below.
const { installServerOnlyShim } = require('./lib/server-only-shim.cjs') as {
  installServerOnlyShim: () => void
}
installServerOnlyShim()

const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_ROOT = path.join(REPO_ROOT, 'out', 'cma-look')
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')

type DocKind = 'letter' | 'immersive'

interface Shot {
  doc: DocKind
  width: number
  index: number
  id: string
  heading: string
  heightPx: number
  svgCount: number
  imgCount: number
  tableCount: number
  file: string // relative to the slug's out dir, e.g. "letter-816/01-cover.png"
}

const SECTION_SELECTOR: Record<DocKind, string> = {
  letter: 'body > section.page',
  immersive: 'body > section.sc',
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Waits for every <img> to settle (loaded or errored) — same pattern as
 * lib/cma-pdf.ts.
 *
 * Every image is forced to `loading="eager"` first. A look-pass never scrolls,
 * so a lazy image below the 1400px viewport never starts loading and
 * screenshots as a blank photo box — which is exactly what made comps 4 and 5
 * look broken on 2026-09-07 when the real page was fine (F2). The renderer no
 * longer marks comp thumbnails lazy either, but the tool must not be able to
 * invent that defect for anything else on the page.
 */
async function waitForImages(page: import('puppeteer-core').Page): Promise<void> {
  await page.evaluate(async () => {
    const imgs = Array.from(document.images)
    for (const img of imgs) {
      if (img.loading === 'lazy') {
        img.loading = 'eager'
        // Chrome only re-evaluates the load on a src assignment.
        const src = img.src
        img.src = ''
        img.src = src
      }
    }
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true })
              img.addEventListener('error', () => resolve(), { once: true })
              setTimeout(() => resolve(), 8_000)
            }),
      ),
    )
  })
  await page.evaluateHandle('document.fonts ? document.fonts.ready : Promise.resolve()').catch(() => {})
}

/**
 * Renders one document (letter or immersive HTML) at one viewport width and
 * screenshots every top-level chapter section. Returns the shots plus the
 * chapter metadata (via the pure extractor, run against the settled DOM so
 * counts reflect what actually rendered, not the pre-hydration HTML).
 */
async function screenshotDocument(opts: {
  browser: import('puppeteer-core').Browser
  html: string
  doc: DocKind
  width: number
  outDir: string
  extractChapters: (html: string) => Array<{ id: string; heading: string; svgCount: number; imgCount: number; tableCount: number }>
  /** --check: collect chart labels that fall outside their own frame. */
  svgFailures?: CheckFailure[]
}): Promise<Shot[]> {
  const { browser, html, doc, width, outDir, extractChapters } = opts
  await fs.mkdir(outDir, { recursive: true })
  const page = await browser.newPage()
  try {
    // Reduced motion is the settled state of this document by design: the
    // immersive's own script returns before it installs any observer when the
    // viewer asks for it, so emulating it here screenshots the page as it
    // finally rests rather than mid-transition. A CSS override alone was not
    // enough — the count-up that shipped 184 / 5.1% / 0.7% into a screenshot
    // of 3,394 / 94.2% / 12.3% was requestAnimationFrame, which no stylesheet
    // can stop (F4).
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.setViewport({ width, height: 1400, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await waitForImages(page)

    if (doc === 'immersive') {
      // With reduced motion the reveal observer never runs, so the scenes keep
      // their pre-reveal class. Force the revealed state: that is what a
      // reader who scrolls actually sees.
      await page.evaluate(() => {
        document.querySelectorAll('.sc').forEach((el) => el.classList.add('on'))
        const style = document.createElement('style')
        style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }'
        document.head.appendChild(style)
      })
    }
    // Fonts settle after the reveal class lands, so a heading measured for the
    // screenshot is measured in Amboqia, not in the fallback serif.
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()))

    if (opts.svgFailures && width <= 400) {
      opts.svgFailures.push(...(await checkSvgTextInsideViewBox(page, doc)))
    }

    const settledHtml = await page.content()
    const chapters = extractChapters(settledHtml)
    const handles = await page.$$(SECTION_SELECTOR[doc])

    if (handles.length !== chapters.length) {
      console.error(
        `  ⚠ ${doc} @ ${width}px: extractChapters found ${chapters.length} chapter(s) but the DOM has ${handles.length} "${SECTION_SELECTOR[doc]}" element(s) — screenshot/label pairing may be off`,
      )
    }

    const shots: Shot[] = []
    for (let i = 0; i < handles.length; i++) {
      const chapter = chapters[i] ?? { id: `chapter-${i + 1}`, heading: '', svgCount: 0, imgCount: 0, tableCount: 0 }
      const fileName = `${pad(i + 1)}-${chapter.id}.png`
      const box = await handles[i].boundingBox()
      const heightPx = box ? Math.round(box.height) : 0
      await handles[i].screenshot({ path: path.join(outDir, fileName) as `${string}.png` })
      shots.push({
        doc,
        width,
        index: i + 1,
        id: chapter.id,
        heading: chapter.heading,
        heightPx,
        svgCount: chapter.svgCount,
        imgCount: chapter.imgCount,
        tableCount: chapter.tableCount,
        file: `${path.basename(outDir)}/${fileName}`,
      })
    }
    return shots
  } finally {
    await page.close().catch(() => {})
  }
}

/**
 * ── --check ────────────────────────────────────────────────────────────────
 * Three mechanical failures. Each one is a defect Matt found by opening the
 * document, so each one now fails the tool instead of waiting for him.
 */

type CheckFailure = { doc: DocKind; rule: string; detail: string }

/** 1. A banned word anywhere a seller reads (lib/cma/seller-text.ts). */
function checkBannedWords(
  doc: DocKind,
  html: string,
  findSellerBannedWords: (html: string) => Array<{ label: string; excerpt: string }>,
): CheckFailure[] {
  return findSellerBannedWords(html).map((hit) => ({
    doc,
    rule: `banned word "${hit.label}"`,
    detail: `...${hit.excerpt}...`,
  }))
}

/**
 * 2. Every OTHER property's address is inside a tracked link.
 *
 * The addresses come from `render_args` rather than from a pattern over the
 * prose: a regex for "a number then a street name" also matches a price, a
 * date and a square-foot figure, and a check that cries wolf gets muted. The
 * subject's own address is exempt — it is the title of the document, not a
 * link out of it.
 */
function collectDocumentAddresses(renderArgs: Record<string, unknown> | null): {
  subject: string | null
  addresses: string[]
} {
  const a = (renderArgs ?? {}) as Record<string, any>
  const out = new Set<string>()
  const push = (v: unknown) => {
    const t = String(v ?? '').trim()
    if (t) out.add(t)
  }
  for (const c of a.comps ?? []) push(c?.address)
  for (const r of a.extras?.band?.rivals ?? []) push(r?.address)
  for (const p of a.extras?.marketArea?.expiredPeers ?? []) push(p?.address)
  for (const n of a.subdivisionStory?.notableSales ?? []) push(n?.address)
  const subject = String(a.subject?.streetAddress ?? '').trim() || null
  if (subject) out.delete(subject)
  return { subject, addresses: [...out] }
}

const TRACKED_HOST = 'https://ryan-realty.com/'

function checkTrackedAddresses(doc: DocKind, html: string, addresses: readonly string[]): CheckFailure[] {
  const fails: CheckFailure[] = []
  // Every anchor whose href is a tracked ryan-realty.com link, with its text.
  const tracked: string[] = []
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]!.replace(/&amp;/g, '&')
    if (!href.startsWith(TRACKED_HOST)) continue
    tracked.push(m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  }
  const visible = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  for (const address of addresses) {
    if (!visible.includes(address)) continue
    if (tracked.some((t) => t.includes(address))) continue
    fails.push({
      doc,
      rule: 'address is not a tracked link',
      detail: `"${address}" appears in the document but is not inside an <a href="${TRACKED_HOST}...">`,
    })
  }
  return fails
}

/**
 * 3. No chart label outside its own frame at 375.
 *
 * Measured in the browser with getBBox(), which uses the real font metrics —
 * every earlier version of this check estimated a text width from a character
 * count and let a clipped label through.
 */
async function checkSvgTextInsideViewBox(
  page: import('puppeteer-core').Page,
  doc: DocKind,
): Promise<CheckFailure[]> {
  const bad = await page.evaluate(() => {
    const out: string[] = []
    for (const svg of Array.from(document.querySelectorAll('svg[viewBox]'))) {
      const el = svg as SVGSVGElement
      // Only what a reader can actually see: a hidden wide layout is allowed
      // to be wider than the phone.
      if (el.getClientRects().length === 0) continue
      const vb = el.viewBox.baseVal
      if (!vb || vb.width <= 0) continue
      for (const node of Array.from(el.querySelectorAll('text'))) {
        let b: DOMRect | null = null
        try {
          b = (node as SVGGraphicsElement).getBBox() as unknown as DOMRect
        } catch {
          continue
        }
        if (!b || (b.width === 0 && b.height === 0)) continue
        const label = (node.textContent ?? '').trim()
        const slack = 0.6
        if (
          b.x < vb.x - slack ||
          b.y < vb.y - slack ||
          b.x + b.width > vb.x + vb.width + slack ||
          b.y + b.height > vb.y + vb.height + slack
        ) {
          out.push(
            `"${label}" at ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}x${b.height.toFixed(1)} outside viewBox ${vb.width}x${vb.height} (${el.getAttribute('aria-label') ?? 'chart'})`,
          )
        }
      }
    }
    return out
  })
  return bad.map((detail) => ({ doc, rule: 'chart label outside its viewBox at 375', detail }))
}


/**
 * ── --interact ─────────────────────────────────────────────────────────────
 * Drive every interaction Delta 2 names on the web document, and shoot the
 * result of each one.
 *
 * Each step names a selector to act on and, where it can, a witness: something
 * about the page that MUST be different afterwards. A step whose control is
 * missing, or whose witness did not move, is a failure — the same standard as
 * the three mechanical checks above. A screenshot of a button nobody could
 * press is how an interaction layer rots.
 */
type InteractStep = {
  name: string
  /** Skip silently when this chapter is not in this document. */
  optional?: boolean
  /** Run in the page; return a witness string, or null when the step cannot run. */
  run: string
  /** Element to frame the shot on. Falls back to the whole viewport. */
  shot?: string
}

/** The first live line in a chapter that has something in it. */
const READ_IN = (sel: string) => `(() => {
  const reads = Array.from(document.querySelectorAll('${sel} .rr-read'))
  const said = reads.map((r) => (r.textContent || '').trim()).filter(Boolean)
  return said[0] || ''
})()`

const INTERACT_STEPS: InteractStep[] = [
  {
    name: 'timeline-cut',
    shot: '#what-happened',
    run: `(() => {
      const mark = document.querySelectorAll('#what-happened .tl-mark')
      const target = mark[mark.length - 1]
      if (!target) return null
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return ${READ_IN('#what-happened')}
    })()`,
  },
  {
    name: 'did-not-sell-history',
    shot: '#did-not-sell',
    run: `(() => {
      const t = document.querySelector('#did-not-sell .pp-toggle')
      if (!t) return null
      t.click()
      const list = document.querySelector('#did-not-sell .pp-list')
      return list && !list.hidden ? 'expanded ' + list.children.length + ' dated rows' : ''
    })()`,
  },
  {
    name: 'curve-scrub',
    shot: '#priced-right',
    run: `(() => {
      const hit = document.querySelector('#priced-right svg.curve-scrub .scrub-hit')
      if (!hit) return null
      for (let i = 0; i < 20; i++) {
        hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, shiftKey: true }))
      }
      return ${READ_IN('#priced-right')}
    })()`,
  },
  {
    name: 'ask-outcome-bar',
    shot: '#priced-right',
    run: `(() => {
      const bars = document.querySelectorAll('#priced-right .bar-row')
      const target = bars[bars.length - 1]
      if (!target) return null
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      const reads = Array.from(document.querySelectorAll('#priced-right .rr-read'))
      const said = reads.map((r) => (r.textContent || '').trim()).filter(Boolean)
      return said[said.length - 1] || ''
    })()`,
  },
  {
    name: 'sale-and-pin',
    shot: '#what-its-worth',
    run: `(() => {
      const pin = document.querySelector('#what-its-worth .pin-map [data-pin], #what-its-worth .pin-map-wrap [data-pin]')
      const row = document.querySelector('#what-its-worth th.v[data-comp="2"], #what-its-worth .comp-stack-card[data-comp="2"]')
      const target = pin || row
      if (!target) return null
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      const lit = document.querySelectorAll('#what-its-worth .is-on')
      return lit.length ? 'lit ' + lit.length + ' element(s)' : ''
    })()`,
  },
  {
    name: 'adjustments-off',
    shot: '#what-its-worth',
    run: `(() => {
      const btns = Array.from(document.querySelectorAll('#what-its-worth .rr-btn'))
      const b = btns.find((x) => /sale prices only/i.test(x.textContent || ''))
      if (!b) return null
      const before = document.querySelectorAll('#what-its-worth tr[data-adj]').length
      b.click()
      const hidden = Array.from(document.querySelectorAll('#what-its-worth tr[data-adj]'))
        .filter((tr) => getComputedStyle(tr).display === 'none').length
      return before > 0 && hidden === before ? 'hid ' + hidden + ' adjustment rows' : ''
    })()`,
  },
  {
    name: 'sort-by-price',
    shot: '#what-its-worth',
    run: `(() => {
      const btns = Array.from(document.querySelectorAll('#what-its-worth .rr-btn'))
      const plain = btns.find((x) => /with the adjustments/i.test(x.textContent || ''))
      if (plain) plain.click()
      const b = btns.find((x) => /price today/i.test(x.textContent || ''))
      if (!b) return null
      b.click()
      const keys = Array.from(document.querySelectorAll('#what-its-worth thead th.v'))
        .map((th) => th.getAttribute('data-sort-price'))
        .filter((v) => v != null)
        .map(Number)
      if (keys.length < 2) return ''
      const sorted = keys.every((v, i) => i === 0 || keys[i - 1] >= v)
      // The cards and the price paths move with the columns, or the chapter
      // now disagrees with itself about which sale is which.
      const cards = Array.from(document.querySelectorAll('#what-its-worth .comp-stack-card'))
        .map((c) => Number(c.getAttribute('data-sort-price')))
      const cardsMatch = cards.length === 0 || cards.join(',') === keys.join(',')
      return sorted && cardsMatch ? 'highest first: ' + keys.join(' > ') : ''
    })()`,
  },
  {
    name: 'competition-pending',
    shot: '#competition',
    run: `(() => {
      const btns = Array.from(document.querySelectorAll('#competition .rr-btn'))
      const b = btns.find((x) => /under contract/i.test(x.textContent || ''))
      if (!b) return null
      b.click()
      const shown = Array.from(document.querySelectorAll('#competition .rival-grid')).filter((g) => !g.hidden)
      const hidden = Array.from(document.querySelectorAll('#competition .rival-grid')).filter((g) => g.hidden)
      return hidden.length > 0 && shown.length > 0 ? 'showing ' + shown.length + ' of ' + (shown.length + hidden.length) + ' groups' : ''
    })()`,
  },
  {
    name: 'month-line',
    optional: true,
    shot: '#this-market',
    run: `(() => {
      const marks = document.querySelectorAll('#this-market .month-mark')
      const target = marks[Math.floor(marks.length / 2)]
      if (!target) return null
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return ${READ_IN('#this-market')}
    })()`,
  },
]

/**
 * One pass over the immersive document at one width: reload, run every step in
 * order, shoot each result. Motion is NOT reduced here — this is the pass that
 * proves the interactions work for a reader who gets them.
 */
async function driveInteractions(opts: {
  browser: import('puppeteer-core').Browser
  html: string
  width: number
  outDir: string
}): Promise<{ shots: Shot[]; failures: CheckFailure[] }> {
  const { browser, html, width, outDir } = opts
  await fs.mkdir(outDir, { recursive: true })
  const page = await browser.newPage()
  const shots: Shot[] = []
  const failures: CheckFailure[] = []
  try {
    await page.setViewport({ width, height: 1400, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await waitForImages(page)
    // Every scene revealed and SETTLED, so a step never taps a control inside
    // a hidden section and no shot catches a chapter mid-fade. The reveal is
    // chapter entrance; it is not what this pass is driving. Killing the
    // transitions also lands the timeline's draw on its finished state, which
    // is what a reader sees a moment after it runs.
    await page.evaluate(() => {
      document.querySelectorAll('.sc').forEach((el) => el.classList.add('on'))
      const style = document.createElement('style')
      style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }'
      document.head.appendChild(style)
    })
    await page.evaluate(() => new Promise((r) => setTimeout(r, 200)))
    for (let i = 0; i < INTERACT_STEPS.length; i++) {
      const step = INTERACT_STEPS[i]!
      let witness: string | null = null
      try {
        witness = (await page.evaluate(step.run)) as string | null
      } catch (err) {
        witness = ''
        failures.push({
          doc: 'immersive',
          rule: `interaction "${step.name}" threw`,
          detail: err instanceof Error ? err.message : String(err),
        })
      }
      if (witness == null) {
        if (!step.optional) {
          failures.push({
            doc: 'immersive',
            rule: `interaction "${step.name}" has no control`,
            detail: `nothing matched at ${width}px — the chapter is present but the control was never built`,
          })
        }
        console.log(`  [interact ${width}] ${pad(i + 1)} ${step.name.padEnd(24)} — absent${step.optional ? ' (optional)' : ''}`)
        continue
      }
      if (!witness) {
        failures.push({
          doc: 'immersive',
          rule: `interaction "${step.name}" changed nothing`,
          detail: `the control is there at ${width}px and driving it moved no witness on the page`,
        })
      }
      const fileName = `${pad(i + 1)}-${step.name}.png`
      const handle = step.shot ? await page.$(step.shot) : null
      if (handle) await handle.screenshot({ path: path.join(outDir, fileName) as `${string}.png` })
      else await page.screenshot({ path: path.join(outDir, fileName) as `${string}.png` })
      shots.push({
        doc: 'immersive',
        width,
        index: i + 1,
        id: step.name,
        heading: witness,
        heightPx: 0,
        svgCount: 0,
        imgCount: 0,
        tableCount: 0,
        file: `${path.basename(outDir)}/${fileName}`,
      })
      console.log(`  [interact ${width}] ${pad(i + 1)} ${step.name.padEnd(24)} ${witness || '✗ no change'}`)
    }
    return { shots, failures }
  } finally {
    await page.close().catch(() => {})
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function writeContactSheet(outDir: string, slug: string, meta: Record<string, unknown>, shots: Shot[]): Promise<void> {
  const groups: Array<{ label: string; items: Shot[] }> = [
    { label: 'Letter · 816px (desktop screen width)', items: shots.filter((s) => s.doc === 'letter' && s.width === 816) },
    { label: 'Letter · 375px (mobile)', items: shots.filter((s) => s.doc === 'letter' && s.width === 375) },
    { label: 'Immersive · 1280px (desktop)', items: shots.filter((s) => s.doc === 'immersive' && s.width === 1280) },
    { label: 'Immersive · 375px (mobile)', items: shots.filter((s) => s.doc === 'immersive' && s.width === 375) },
    { label: 'Interactions · 1280px — the RESULT of each one', items: shots.filter((s) => s.width === 1281) },
    { label: 'Interactions · 375px — the RESULT of each one', items: shots.filter((s) => s.width === 376) },
  ]
  const body = groups
    .filter((g) => g.items.length > 0)
    .map(
      (g) => `
  <h2>${escapeHtml(g.label)}</h2>
  <div class="row">
    ${g.items
      .map(
        (s) => `
    <figure>
      <img src="${escapeHtml(s.file)}" alt="${escapeHtml(s.id)}" />
      <figcaption>
        <strong>${pad(s.index)} · ${escapeHtml(s.id)}</strong>
        <span>${escapeHtml(s.heading || '(no heading)')}</span>
        <span class="dim">${s.width}px wide × ${s.heightPx}px tall · svg ${s.svgCount} · img ${s.imgCount} · table ${s.tableCount}</span>
      </figcaption>
    </figure>`,
      )
      .join('')}
  </div>`,
    )
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>CMA look-pass · ${escapeHtml(slug)}</title>
<style>
  body { margin: 0; padding: 24px; background: #e8e3d8; color: #102742; font-family: system-ui, -apple-system, sans-serif; }
  h1 { margin: 0 0 4px; }
  .meta { color: #445; font-size: 13px; margin-bottom: 24px; }
  h2 { margin: 32px 0 12px; font-size: 16px; border-bottom: 1px solid rgba(16,39,66,0.2); padding-bottom: 6px; }
  .row { display: flex; flex-wrap: wrap; gap: 16px; }
  figure { margin: 0; width: 320px; background: #fff; border: 1px solid rgba(16,39,66,0.15); border-radius: 8px; overflow: hidden; }
  figure img { width: 100%; display: block; border-bottom: 1px solid rgba(16,39,66,0.1); background: #f4f1ea; }
  figcaption { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
  figcaption span.dim { color: #667; }
</style>
</head>
<body>
  <h1>${escapeHtml(slug)}</h1>
  <div class="meta">${escapeHtml(JSON.stringify(meta))}</div>
  ${body}
</body>
</html>`
  await fs.writeFile(path.join(outDir, 'contact-sheet.html'), html, 'utf-8')
}

async function processSlug(
  slug: string,
  browser: import('puppeteer-core').Browser,
  check: boolean,
  interact: boolean,
  deps: {
    getCmaAdminRowBySlug: (slug: string) => Promise<Record<string, unknown> | null>
    getCmaRenderSourceBySlug: (slug: string) => Promise<CmaRenderSource | null>
    getCmaStoredHtmlBySlug: (slug: string) => Promise<string | null>
    resolveCmaPrintHtml: (slug: string) => Promise<{ html: string; status: string } | null>
    immersiveFromRow: (row: CmaRenderSource, origin: string, hydrateArea: boolean) => Promise<string | null>
    extractChapters: (html: string) => Array<{ id: string; heading: string; svgCount: number; imgCount: number; tableCount: number }>
    findSellerBannedWords: (html: string) => Array<{ label: string; excerpt: string }>
  },
): Promise<{ slug: string; ok: boolean; contactSheet?: string; failures: CheckFailure[] }> {
  console.log(`\n=== ${slug} ===`)
  const adminRow = await deps.getCmaAdminRowBySlug(slug)
  if (!adminRow) {
    console.error(`  no cmas row for slug "${slug}"`)
    return { slug, ok: false, failures: [] }
  }
  const meta = {
    slug,
    doc_type: adminRow.doc_type,
    request_source: adminRow.request_source ?? null,
    status: adminRow.status,
    subject_address: adminRow.subject_address,
    client_name: adminRow.client_name,
    has_render_args: adminRow.render_args != null,
    has_html_content: typeof adminRow.html_content === 'string' && (adminRow.html_content as string).length > 0,
  }
  console.log(`  doc_type=${meta.doc_type} request_source=${meta.request_source} status=${meta.status} subject="${meta.subject_address}"`)
  console.log(`  render_args present=${meta.has_render_args} html_content present=${meta.has_html_content}`)

  const outDir = path.join(OUT_ROOT, slug)
  await fs.mkdir(outDir, { recursive: true })

  const allShots: Shot[] = []
  const failures: CheckFailure[] = []
  const { subject: subjectAddress, addresses } = collectDocumentAddresses(
    (adminRow.render_args as Record<string, unknown> | null) ?? null,
  )

  // Letter: resolveCmaPrintHtml is the exact function lib/cma-pdf.ts calls
  // for the PDF and the ?print=1 route falls back to — reusing it means a
  // renderer fix (or a renderer bug) shows up here identically.
  const letter = await deps.resolveCmaPrintHtml(slug)
  if (letter?.html) {
    await fs.writeFile(path.join(outDir, 'letter.html'), letter.html, 'utf-8')
    for (const width of [816, 375] as const) {
      const shots = await screenshotDocument({
        browser,
        html: letter.html,
        doc: 'letter',
        width,
        outDir: path.join(outDir, `letter-${width}`),
        extractChapters: deps.extractChapters,
        svgFailures: check ? failures : undefined,
      })
      allShots.push(...shots)
      for (const s of shots) {
        console.log(
          `  [letter ${width}] ${pad(s.index)} ${s.id.padEnd(28)} "${s.heading}" h=${s.heightPx}px svg=${s.svgCount} img=${s.imgCount} table=${s.tableCount}`,
        )
      }
    }
  } else {
    console.error(`  resolveCmaPrintHtml returned nothing for "${slug}" — no letter shots`)
  }

  // Immersive: mirror serveCmaDocument's own order exactly (live render_args
  // first, D27-frozen hydrateArea=false since this is reviewing what a
  // recipient already has or is about to get; frozen html_content fallback
  // when render_args is absent) so the shots match what production serves.
  let immersiveHtml: string | null = null
  const renderSource = await deps.getCmaRenderSourceBySlug(slug)
  if (renderSource) {
    immersiveHtml = await deps.immersiveFromRow(renderSource, SITE_URL, false)
  }
  if (!immersiveHtml) {
    immersiveHtml = await deps.getCmaStoredHtmlBySlug(slug)
    if (immersiveHtml) console.log('  immersive: render_args miss — fell back to frozen html_content (matches serveCmaDocument)')
  }
  if (immersiveHtml) {
    await fs.writeFile(path.join(outDir, 'immersive.html'), immersiveHtml, 'utf-8')
    for (const width of [1280, 375] as const) {
      const shots = await screenshotDocument({
        browser,
        html: immersiveHtml,
        doc: 'immersive',
        width,
        outDir: path.join(outDir, `immersive-${width}`),
        extractChapters: deps.extractChapters,
        svgFailures: check ? failures : undefined,
      })
      allShots.push(...shots)
      for (const s of shots) {
        console.log(
          `  [immersive ${width}] ${pad(s.index)} ${s.id.padEnd(28)} "${s.heading}" h=${s.heightPx}px svg=${s.svgCount} img=${s.imgCount} table=${s.tableCount}`,
        )
      }
    }
  } else {
    console.error(`  no immersive HTML for "${slug}" (render_args miss AND no stored html_content) — no immersive shots`)
  }

  if (interact && immersiveHtml) {
    for (const width of [1280, 375] as const) {
      const run = await driveInteractions({
        browser,
        html: immersiveHtml,
        width,
        outDir: path.join(outDir, `interact-${width}`),
      })
      // The contact sheet groups by width, and 1280/375 are already taken by
      // the chapter shots — stamp these one apart so they land in their own
      // rows rather than mixing into the chapter grid.
      allShots.push(...run.shots.map((s) => ({ ...s, width: width + 1 })))
      failures.push(...run.failures)
    }
  }

  if (check) {
    for (const [doc, html] of [
      ['letter', letter?.html ?? null],
      ['immersive', immersiveHtml],
    ] as const) {
      if (!html) continue
      failures.push(...checkBannedWords(doc, html, deps.findSellerBannedWords))
      failures.push(...checkTrackedAddresses(doc, html, addresses))
    }
    if (failures.length === 0) {
      console.log(
        `  ✓ check: no banned word, ${addresses.length} address(es) tracked, every chart label inside its frame at 375`,
      )
    } else {
      console.error(`  ✗ check: ${failures.length} failure(s)${subjectAddress ? ` on ${subjectAddress}` : ''}`)
      for (const f of failures) console.error(`      [${f.doc}] ${f.rule}: ${f.detail}`)
    }
  }

  await writeContactSheet(outDir, slug, meta, allShots)
  const contactSheet = path.join(outDir, 'contact-sheet.html')
  console.log(`  contact sheet: ${contactSheet}`)
  return { slug, ok: allShots.length > 0 && failures.length === 0, contactSheet, failures }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const check = argv.includes('--check')
  const interact = argv.includes('--interact')
  const slugs = argv
    .filter((a) => !a.startsWith('--'))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (slugs.length === 0) {
    console.error('usage: npx tsx scripts/cma-lookpass.ts [--check] [--interact] <slug> [<slug> ...]')
    process.exit(1)
  }

  const { getCmaAdminRowBySlug, getCmaRenderSourceBySlug, getCmaStoredHtmlBySlug } = await import('@/lib/data')
  const { resolveCmaPrintHtml } = await import('@/lib/cma/print-html')
  const { immersiveFromRow } = await import('@/lib/cma/serve-document')
  const { extractChapters } = await import('@/lib/cma/lookpass-chapters')
  const { findSellerBannedWords } = await import('@/lib/cma/seller-text')
  const puppeteerModule = await import('puppeteer-core')
  const puppeteer = puppeteerModule.default

  const fsExists = await fs
    .access(CHROME)
    .then(() => true)
    .catch(() => false)
  if (!fsExists) {
    console.error(`Chrome not found at ${CHROME}. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH.`)
    process.exit(1)
  }

  await fs.mkdir(OUT_ROOT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const results: Array<{ slug: string; ok: boolean; contactSheet?: string; failures: CheckFailure[] }> = []
  try {
    for (const slug of slugs) {
      const result = await processSlug(slug, browser, check, interact, {
        getCmaAdminRowBySlug,
        getCmaRenderSourceBySlug,
        getCmaStoredHtmlBySlug,
        resolveCmaPrintHtml,
        immersiveFromRow,
        extractChapters,
        findSellerBannedWords,
      })
      results.push(result)
    }
  } finally {
    await browser.close().catch(() => {})
  }

  console.log('\n=== summary ===')
  for (const r of results) {
    const failed = r.failures.length
    console.log(
      `  ${r.ok ? 'OK  ' : 'FAIL'} ${r.slug}${failed ? ` — ${failed} check failure(s)` : ''}${r.contactSheet ? ` — ${r.contactSheet}` : ''}`,
    )
  }
  if (results.some((r) => !r.ok)) process.exit(1)
}

main().catch((e) => {
  console.error('cma-lookpass threw:', e)
  process.exit(1)
})
