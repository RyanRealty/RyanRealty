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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function writeContactSheet(outDir: string, slug: string, meta: Record<string, unknown>, shots: Shot[]): Promise<void> {
  const groups: Array<{ label: string; items: Shot[] }> = [
    { label: 'Letter · 816px (desktop screen width)', items: shots.filter((s) => s.doc === 'letter' && s.width === 816) },
    { label: 'Letter · 375px (mobile)', items: shots.filter((s) => s.doc === 'letter' && s.width === 375) },
    { label: 'Immersive · 1280px (desktop)', items: shots.filter((s) => s.doc === 'immersive' && s.width === 1280) },
    { label: 'Immersive · 375px (mobile)', items: shots.filter((s) => s.doc === 'immersive' && s.width === 375) },
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
  deps: {
    getCmaAdminRowBySlug: (slug: string) => Promise<Record<string, unknown> | null>
    getCmaRenderSourceBySlug: (slug: string) => Promise<CmaRenderSource | null>
    getCmaStoredHtmlBySlug: (slug: string) => Promise<string | null>
    resolveCmaPrintHtml: (slug: string) => Promise<{ html: string; status: string } | null>
    immersiveFromRow: (row: CmaRenderSource, origin: string, hydrateArea: boolean) => Promise<string | null>
    extractChapters: (html: string) => Array<{ id: string; heading: string; svgCount: number; imgCount: number; tableCount: number }>
  },
): Promise<{ slug: string; ok: boolean; contactSheet?: string }> {
  console.log(`\n=== ${slug} ===`)
  const adminRow = await deps.getCmaAdminRowBySlug(slug)
  if (!adminRow) {
    console.error(`  no cmas row for slug "${slug}"`)
    return { slug, ok: false }
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

  await writeContactSheet(outDir, slug, meta, allShots)
  const contactSheet = path.join(outDir, 'contact-sheet.html')
  console.log(`  contact sheet: ${contactSheet}`)
  return { slug, ok: allShots.length > 0, contactSheet }
}

async function main(): Promise<void> {
  const slugs = process.argv.slice(2).map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (slugs.length === 0) {
    console.error('usage: npx tsx scripts/cma-lookpass.ts <slug> [<slug> ...]')
    process.exit(1)
  }

  const { getCmaAdminRowBySlug, getCmaRenderSourceBySlug, getCmaStoredHtmlBySlug } = await import('@/lib/data')
  const { resolveCmaPrintHtml } = await import('@/lib/cma/print-html')
  const { immersiveFromRow } = await import('@/lib/cma/serve-document')
  const { extractChapters } = await import('@/lib/cma/lookpass-chapters')
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

  const results: Array<{ slug: string; ok: boolean; contactSheet?: string }> = []
  try {
    for (const slug of slugs) {
      const result = await processSlug(slug, browser, {
        getCmaAdminRowBySlug,
        getCmaRenderSourceBySlug,
        getCmaStoredHtmlBySlug,
        resolveCmaPrintHtml,
        immersiveFromRow,
        extractChapters,
      })
      results.push(result)
    }
  } finally {
    await browser.close().catch(() => {})
  }

  console.log('\n=== summary ===')
  for (const r of results) {
    console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.slug}${r.contactSheet ? ` — ${r.contactSheet}` : ''}`)
  }
  if (results.some((r) => !r.ok)) process.exit(1)
}

main().catch((e) => {
  console.error('cma-lookpass threw:', e)
  process.exit(1)
})
