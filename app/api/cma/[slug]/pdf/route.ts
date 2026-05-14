import { NextResponse } from 'next/server'
import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // seconds

/**
 * GET /api/cma/[slug]/pdf
 *
 * Renders the corresponding CMA HTML to a print-ready PDF via headless
 * Chrome (puppeteer-core + @sparticuz/chromium-min). The PDF preserves
 * the HTML formatting exactly — same Chrome engine the user sees in the
 * browser, no print-CSS surprises.
 *
 * Looks for the HTML at:
 *   1. /cmas/<slug>/cma.html   (finalized)
 *   2. /drafts/<slug>/cma.html (in-progress draft)
 *
 * Returns: application/pdf, Content-Disposition: inline for in-browser
 * preview; flip to attachment via `?download=1` for forced download.
 */

// Public mirror of the Chromium binary that ships with @sparticuz/chromium-min.
// The "min" package omits the Chromium binary to keep the deploy bundle small;
// we point it at the matching Vercel-blob mirror at runtime. Version pinned to
// match the chromium-min package version.
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
  // Local dev fallback: use whatever Chrome is on PATH.
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

function resolveHostFromRequest(request: Request): string {
  const url = new URL(request.url)
  if (url.protocol === 'https:' || url.protocol === 'http:') {
    return `${url.protocol}//${url.host}`
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

async function findHtmlPath(host: string, slug: string): Promise<string | null> {
  const candidates = [
    `${host}/cmas/${slug}/cma.html`,
    `${host}/drafts/${slug}/cma.html`,
  ]
  for (const u of candidates) {
    const head = await fetch(u, { method: 'HEAD' }).catch(() => null)
    if (head && head.ok) return u
  }
  return null
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

  const host = resolveHostFromRequest(request)
  const htmlUrl = await findHtmlPath(host, safeSlug)
  if (!htmlUrl) {
    return NextResponse.json(
      {
        error: 'CMA HTML not found',
        looked_at: [`${host}/cmas/${safeSlug}/cma.html`, `${host}/drafts/${safeSlug}/cma.html`],
      },
      { status: 404 }
    )
  }

  const { searchParams } = new URL(request.url)
  const download = searchParams.get('download') === '1'

  let browser: Browser | null = null
  try {
    browser = await getBrowser()
    const page = await browser.newPage()
    await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 2 })
    await page.goto(htmlUrl, { waitUntil: 'networkidle0', timeout: 45_000 })
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
