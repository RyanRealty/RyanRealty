/**
 * Shared CMA PDF renderer used by both:
 *   - GET /api/cma/[slug]/pdf    — serves the PDF directly
 *   - POST /api/cma/[slug]/email — attaches the PDF to an outbound email
 *
 * Reads the HTML for a CMA slug from disk (bundled via outputFileTracingIncludes
 * in next.config.ts), inlines local + map assets, then renders to PDF via
 * puppeteer-core + @sparticuz/chromium-min.
 */

import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fetchCmaMapPngBuffer } from '@/lib/cma-map'
import { getCmaHtmlBySlug } from '@/lib/data'
import { assertPdfPageSafety } from '@/lib/pdf/assert-page-safety'
import { pdfRenderOptions, CMA_MARGIN_IN } from '@/lib/pdf/page-contract'
import { CONTACT } from '@/lib/brand/contact'

const CHROMIUM_REMOTE =
  'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.x64.tar'

const ASSET_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function getBrowser(): Promise<Browser> {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  if (isVercel) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1024, height: 1320, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(CHROMIUM_REMOTE),
      headless: true,
    })
  }
  const localChrome =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome')
  return puppeteer.launch({
    executablePath: localChrome,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

async function resolveCmaDir(slug: string): Promise<{ dir: string; html: string } | null> {
  const candidates = [
    path.join(process.cwd(), 'public', 'cmas', slug),
    path.join(process.cwd(), 'public', 'drafts', slug),
  ]
  for (const dir of candidates) {
    const htmlPath = path.join(dir, 'cma.html')
    try {
      const html = await fs.readFile(htmlPath, 'utf-8')
      return { dir, html }
    } catch {
      // try next candidate
    }
  }
  return null
}

async function inlineLocalAssets(html: string, cmaDir: string): Promise<string> {
  const pattern = /\.\/assets\/([A-Za-z0-9_./-]+)/g
  const cache = new Map<string, string>()
  const replacements: Array<{ match: string; dataUri: string }> = []

  for (const m of html.matchAll(pattern)) {
    const relPath = m[1]
    if (cache.has(relPath)) {
      replacements.push({ match: m[0], dataUri: cache.get(relPath)! })
      continue
    }
    const ext = path.extname(relPath).toLowerCase()
    const mime = ASSET_MIME[ext] ?? 'application/octet-stream'
    try {
      const buf = await fs.readFile(path.join(cmaDir, 'assets', relPath))
      const dataUri = `data:${mime};base64,${buf.toString('base64')}`
      cache.set(relPath, dataUri)
      replacements.push({ match: m[0], dataUri })
    } catch {
      // skip missing asset
    }
  }

  let out = html
  const seen = new Set<string>()
  for (const { match, dataUri } of replacements) {
    if (seen.has(match)) continue
    seen.add(match)
    out = out.split(match).join(dataUri)
  }
  return out
}

async function inlineMapReferences(html: string): Promise<string> {
  const pattern = /\/api\/maps\/([a-z0-9-]+)/g
  const cache = new Map<string, string>()
  const matches = Array.from(new Set(Array.from(html.matchAll(pattern), (m) => m[1])))

  for (const mapSlug of matches) {
    if (cache.has(mapSlug)) continue
    const buf = await fetchCmaMapPngBuffer(mapSlug)
    if (buf) cache.set(mapSlug, `data:image/png;base64,${buf.toString('base64')}`)
  }

  let out = html
  for (const [mapSlug, dataUri] of cache.entries()) {
    out = out.split(`/api/maps/${mapSlug}`).join(dataUri)
  }
  return out
}

export class CmaNotFoundError extends Error {
  readonly looked_at: string[]
  constructor(slug: string) {
    super('CMA HTML not found on disk')
    this.looked_at = [`public/cmas/${slug}/cma.html`, `public/drafts/${slug}/cma.html`]
  }
}

export interface RenderCmaPdfResult {
  buffer: Buffer
  /** True if HTML resolved from `public/cmas/` (finalized), false if from `public/drafts/`. */
  finalized: boolean
}

export async function renderCmaPdfBuffer(slug: string): Promise<RenderCmaPdfResult> {
  const resolved = await resolveCmaDir(slug)

  let html: string
  let finalizedSource: boolean
  if (resolved) {
    html = await inlineLocalAssets(resolved.html, resolved.dir)
    html = await inlineMapReferences(html)
    finalizedSource = resolved.dir.includes(path.sep + 'cmas' + path.sep)
  } else {
    // DB-stored CMA (deterministic builder, 2026-07-07): the HTML is fully
    // self-contained (inline CSS, absolute asset URLs, data-URI map), so no
    // asset or map inlining is needed before the render.
    const row = await getCmaHtmlBySlug(slug)
    if (!row?.html_content) throw new CmaNotFoundError(slug)
    html = row.html_content
    finalizedSource = row.status === 'finalized' || row.status === 'delivered'
  }

  let browser: Browser | null = null
  try {
    browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.evaluate(async () => {
      const imgs = Array.from(document.images)
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true })
                img.addEventListener('error', () => resolve(), { once: true })
                setTimeout(() => resolve(), 8_000)
              })
        )
      )
    })
    // Web fonts (Geist / Caveat / Amboqia) load over the network in the
    // DB-stored variant — wait for them so the PDF matches the browser view.
    await page
      .evaluateHandle('document.fonts ? document.fonts.ready : Promise.resolve()')
      .catch(() => {})
    await page.emulateMediaType('print')
    // The footer is a running mark in the reserved bottom margin, so it repeats
    // on every sheet — including a continuation sheet when a section runs long,
    // which the old in-body absolute footer could not do. `pageNumber` /
    // `totalPages` are Chrome-substituted, so the count is the real sheet count
    // rather than a section count guessed before pagination.
    const pdf = await page.pdf(
      pdfRenderOptions(
        { footerLeft: `Ryan Realty · ${CONTACT.phoneDirect}` },
        CMA_MARGIN_IN,
      ),
    )
    const buffer = Buffer.from(pdf)
    // THE PAGE CONTRACT, checked on the bytes. No fit check here: the CMA now
    // FLOWS, so a section taller than one sheet is correct behaviour, not a
    // defect — it becomes a properly margined continuation sheet. The byte
    // check is the one that still means something. See docs/PAGE_CONTRACT.md.
    // STRADDLE applies now: the footer lives in the margin strip, so the bands
    // are Chrome's and classifiable. Margins must match what the stylesheet
    // declared, or this polices a box the document never used.
    await assertPdfPageSafety(buffer, `CMA ${slug}`, { margins: CMA_MARGIN_IN })
    return {
      buffer,
      finalized: finalizedSource,
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
