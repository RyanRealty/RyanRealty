/**
 * Generic self-contained HTML → PDF renderer (Letter, full-bleed).
 *
 * For documents whose HTML is already self-contained (inline CSS, absolute
 * asset URLs, data-URI images) — the deterministic BPO and CMA builders both
 * produce that shape, so no asset inlining is needed. puppeteer-core +
 * @sparticuz/chromium-min on Vercel, local Chrome in dev (same resolution as
 * lib/cma-pdf.ts).
 */

import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

const CHROMIUM_REMOTE =
  'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.x64.tar'

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

/** Render a self-contained HTML string to a Letter-format PDF buffer. */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
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
              }),
        ),
      )
    })
    await page.evaluateHandle('document.fonts ? document.fonts.ready : Promise.resolve()').catch(() => {})
    await page.emulateMediaType('print')
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
