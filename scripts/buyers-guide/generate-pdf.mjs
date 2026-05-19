#!/usr/bin/env node
/**
 * Generate the buyer's-guide PDF for a single community by driving Puppeteer
 * against the canonical web page at /lp/<community>/buyers-guide?print=true.
 *
 * Usage:
 *   node scripts/buyers-guide/generate-pdf.mjs --community tetherow \
 *     --out public/guides/tetherow/tetherow-buyers-guide.pdf
 *
 * Optional:
 *   --base-url http://localhost:3000   (defaults to BUYERS_GUIDE_BASE_URL env or http://localhost:3000)
 *   --wait     networkidle0|networkidle2|domcontentloaded|load   (default networkidle0)
 *
 * The script assumes a running Next.js dev or production server. It does NOT
 * spin one up — kick `npm run dev` (or hit the prod URL via --base-url) before
 * running.
 *
 * Spec: marketing_brain_skills/producers/buyers-guide/SKILL.md §4.3 Step 2.
 */
import { mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const community = arg('community')
if (!community) {
  console.error('Missing --community')
  process.exit(2)
}

const baseUrl = (arg('base-url') ?? process.env.BUYERS_GUIDE_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const waitUntil = arg('wait', 'networkidle0')
const outArg = arg('out', `public/guides/${community}/${community}-buyers-guide.pdf`)
const outPath = path.isAbsolute(outArg) ? outArg : path.join(process.cwd(), outArg)

const targetUrl = `${baseUrl}/lp/${community}/buyers-guide?print=true`

console.log(`[buyers-guide] generating ${community} PDF`)
console.log(`[buyers-guide] source ${targetUrl}`)
console.log(`[buyers-guide] target ${outPath}`)

const startedAt = Date.now()

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  page.on('pageerror', (err) => console.warn('[buyers-guide] pageerror:', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.warn('[buyers-guide] console.error:', msg.text())
  })

  await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 })
  await page.goto(targetUrl, { waitUntil, timeout: 60_000 })

  // Force print media so @media print rules apply.
  await page.emulateMediaType('print')

  // Ensure web fonts settle before paint.
  await page.evaluate(() =>
    typeof document.fonts !== 'undefined' ? document.fonts.ready : Promise.resolve(),
  )

  // Brief settle to let any async data hydrate.
  await new Promise((r) => setTimeout(r, 750))

  await mkdir(path.dirname(outPath), { recursive: true })

  await page.pdf({
    path: outPath,
    format: 'letter',
    printBackground: true,
    margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
    preferCSSPageSize: false,
    displayHeaderFooter: false,
  })

  const info = await stat(outPath)
  const elapsedMs = Date.now() - startedAt

  // Sidecar manifest — request handler reads `generatedAt` to decide freshness.
  const manifest = {
    slug: community,
    pdfPath: path.relative(path.join(process.cwd(), 'public'), outPath),
    generatedAt: new Date().toISOString(),
    sizeBytes: info.size,
    generationMs: elapsedMs,
  }
  const manifestPath = path.join(path.dirname(outPath), 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  console.log(`[buyers-guide] wrote ${outPath} (${(info.size / 1024).toFixed(0)} KB, ${elapsedMs} ms)`)
  console.log(`[buyers-guide] manifest ${manifestPath}`)
} finally {
  await browser.close()
}
