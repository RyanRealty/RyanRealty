import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('console', msg => {
  const t = msg.type()
  if (t === 'error') errors.push(`[ERROR] ${msg.text()}`)
  if (t === 'warning' && !msg.text().includes('preloaded') && !msg.text().includes('aspect ratio')) errors.push(`[WARN] ${msg.text()}`)
})
const r = await page.goto('http://localhost:3000/listing/20250801191429117679000000', { waitUntil: 'networkidle', timeout: 90000 })
console.error('HTTP', r.status())
// give images + Google Maps a long time to load
await page.waitForTimeout(10000)
// scroll the page so lazy-loaded images below the fold are forced to load
await page.evaluate(async () => {
  const total = document.documentElement.scrollHeight
  for (let y = 0; y < total; y += 600) {
    window.scrollTo(0, y)
    await new Promise(r => setTimeout(r, 200))
  }
  window.scrollTo(0, 0)
  await new Promise(r => setTimeout(r, 500))
})
await page.waitForTimeout(3000)
const dims = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
console.error('PAGE', dims)
const probes = await page.evaluate(() => {
  const sec = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Where this home sits'))
  const stack = sec?.parentElement?.parentElement
  const mapDiv = stack?.querySelector('[style*="aspect-ratio"]')
  const mapRect = mapDiv?.getBoundingClientRect()
  const sims = Array.from(document.querySelectorAll('a[href^="/listing/"]')).filter(a => a.querySelector('img'))
  const photoStats = sims.map(a => { const img = a.querySelector('img'); return { complete: img.complete, w: img.naturalWidth, h: img.naturalHeight } })
  return {
    mapW: Math.round(mapRect?.width ?? 0),
    mapH: Math.round(mapRect?.height ?? 0),
    gmReady: typeof window?.google?.maps?.Map === 'function',
    simCount: sims.length,
    simComplete: photoStats.filter(p => p.complete && p.w > 0).length,
    simSample: photoStats.slice(0, 4),
  }
})
console.error('PROBES', JSON.stringify(probes, null, 2))
console.error('ERRORS', JSON.stringify(errors, null, 2))
await page.screenshot({ path: 'out/listing-detail-full-v3.png', fullPage: true })
await browser.close()
