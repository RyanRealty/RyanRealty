import { NextResponse } from 'next/server'
import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // seconds

/**
 * GET /api/cma/[slug]/pdf
 *
 * Renders a CMA HTML to PDF using the same Chrome engine that displays it
 * in the browser (puppeteer-core + @sparticuz/chromium-min). The PDF
 * preserves the HTML formatting exactly — no print-CSS surprises.
 *
 * Approach:
 *   1. Read the HTML from disk (public/cmas/<slug>/cma.html if finalized,
 *      public/drafts/<slug>/cma.html if draft). Files are bundled with the
 *      serverless function via outputFileTracingIncludes in next.config.ts.
 *   2. Inline the few local assets (logo, headshot, font) as data URIs so
 *      Chromium doesn't need to resolve relative paths or hit the Vercel
 *      SSO wall on the deployment URL.
 *   3. Spark CDN photo URLs (absolute, public) stay as-is.
 *   4. page.setContent → page.pdf({ format: 'Letter', printBackground: true }).
 *
 * Append `?download=1` to force-download instead of inline preview.
 */

const CHROMIUM_REMOTE =
  'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.x64.tar'

async function getBrowser(): Promise<Browser> {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  if (isVercel) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1024, height: 1320, deviceScaleFactor: 2 },
      executablePath: await chromium.executablePath(CHROMIUM_REMOTE),
      headless: true,
    })
  }
  const localChrome =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    '/usr/bin/google-chrome'
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

async function inlineLocalAssets(html: string, cmaDir: string): Promise<string> {
  // Match any src="./assets/X" or url('./assets/X') reference and replace
  // with a data: URI. Spark CDN photos use absolute URLs and are skipped.
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
      // skip — asset will simply not load (broken-image icon in PDF)
    }
  }

  let out = html
  // Apply replacements once each (dedupe by match)
  const seen = new Set<string>()
  for (const { match, dataUri } of replacements) {
    if (seen.has(match)) continue
    seen.add(match)
    out = out.split(match).join(dataUri)
  }
  return out
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const resolved = await resolveCmaDir(safeSlug)
  if (!resolved) {
    return NextResponse.json(
      {
        error: 'CMA HTML not found on disk',
        looked_at: [`public/cmas/${safeSlug}/cma.html`, `public/drafts/${safeSlug}/cma.html`],
      },
      { status: 404 }
    )
  }

  const { searchParams } = new URL(request.url)
  const download = searchParams.get('download') === '1'

  const html = await inlineLocalAssets(resolved.html, resolved.dir)

  let browser: Browser | null = null
  try {
    browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    // Give external Spark CDN photos a chance to load before printing.
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
    await page.emulateMediaType('print')
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeSlug}.pdf"`,
        'Cache-Control': 'public, max-age=600, s-maxage=600',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'PDF render failed', detail: msg.slice(0, 500) }, { status: 500 })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
