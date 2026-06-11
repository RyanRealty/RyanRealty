#!/usr/bin/env node
/**
 * Render the 228 SE Soft Tail CMA HTML to PDF using local Chrome on macOS.
 * Inlines local assets + map image as data URIs (same logic as lib/cma-pdf.ts).
 */
import puppeteer from 'puppeteer-core'
import { promises as fs, statSync } from 'node:fs'
import { resolve, dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
loadEnv({ path: join(REPO_ROOT, '.env.local') })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SLUG = 'cma-228-soft-tail'
const CMA_DIR = resolve(REPO_ROOT, 'public/drafts', SLUG)
const HTML_PATH = resolve(CMA_DIR, 'cma.html')
const OUT_PDF = resolve(REPO_ROOT, 'out/cma-228-soft-tail/cma-228-soft-tail.pdf')

const ASSET_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function inlineLocalAssets(html, cmaDir) {
  const pattern = /\.\/assets\/([A-Za-z0-9_./-]+)/g
  const cache = new Map()
  for (const m of html.matchAll(pattern)) {
    const relPath = m[1]
    if (cache.has(relPath)) continue
    const ext = extname(relPath).toLowerCase()
    const mime = ASSET_MIME[ext] ?? 'application/octet-stream'
    try {
      const buf = await fs.readFile(join(cmaDir, 'assets', relPath))
      cache.set(relPath, `data:${mime};base64,${buf.toString('base64')}`)
    } catch {}
  }
  let out = html
  for (const [k, dataUri] of cache.entries()) {
    out = out.split(`./assets/${k}`).join(dataUri)
  }
  return out
}

// Build the map image directly via Google Static Maps
async function fetchMapDataUri() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) throw new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing')

  const points = [
    { label: 'S', color: 'red', lat: 44.050383, lng: -121.272492 },
    { label: '1', color: '0x102742', lat: 44.05107, lng: -121.272413 },
    { label: '2', color: '0x102742', lat: 44.048317, lng: -121.272417 },
    { label: '3', color: '0x102742', lat: 44.048029, lng: -121.272309 },
    { label: '4', color: '0x102742', lat: 44.046422, lng: -121.272609 },
    { label: '5', color: '0x102742', lat: 44.046114, lng: -121.271823 },
    { label: '6', color: '0x102742', lat: 44.046152, lng: -121.272798 },
    { label: '7', color: '0x102742', lat: 44.04583, lng: -121.27345 },
    { label: '8', color: '0x102742', lat: 44.048577, lng: -121.273339 },
    { label: '9', color: '0x102742', lat: 44.047426, lng: -121.270856 },
  ]
  const STYLE_PARAMS = [
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
    'feature:landscape.natural|element:geometry|color:0xeae3d6',
    'feature:landscape.man_made|element:geometry|color:0xf2ebdd',
    'feature:water|element:geometry|color:0xd6dde1',
    'feature:road|element:geometry.stroke|color:0xc9c2b3',
    'feature:road|element:labels.text.fill|color:0x5b5b5b',
    'feature:administrative|element:labels.text.fill|color:0x102742',
    'feature:administrative.land_parcel|visibility:off',
  ]
  const params = new URLSearchParams()
  params.set('size', '640x360')
  params.set('scale', '2')
  params.set('maptype', 'roadmap')
  for (const p of points) params.append('markers', `color:${p.color}|label:${p.label}|size:mid|${p.lat},${p.lng}`)
  for (const s of STYLE_PARAMS) params.append('style', s)
  params.set('key', apiKey)
  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Map fetch failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return `data:image/png;base64,${buf.toString('base64')}`
}

// Main
let html = await fs.readFile(HTML_PATH, 'utf8')
console.log(`HTML: ${html.length} bytes`)

html = await inlineLocalAssets(html, CMA_DIR)
console.log(`After local-asset inline: ${html.length} bytes`)

const mapDataUri = await fetchMapDataUri()
html = html.split('/api/maps/cma-228-soft-tail').join(mapDataUri)
console.log(`After map inline: ${html.length} bytes`)

await fs.mkdir(dirname(OUT_PDF), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.evaluate(async () => {
    const imgs = Array.from(document.images)
    await Promise.all(
      imgs.map(img =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise(resolve => {
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
  await fs.writeFile(OUT_PDF, pdf)
  const sz = statSync(OUT_PDF).size
  console.log(`\n✓ PDF written: ${OUT_PDF}`)
  console.log(`  ${sz} bytes (${(sz / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`  under 25 MB cap: ${sz <= 25 * 1024 * 1024 ? 'YES' : 'NO — drop image tier'}`)
} finally {
  await browser.close()
}
