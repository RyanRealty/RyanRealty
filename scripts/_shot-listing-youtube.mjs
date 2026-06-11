import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const r = await page.goto('http://localhost:3000/listing/20260408183243260637000000', { waitUntil: 'load', timeout: 90000 })
console.error('HTTP', r.status())
await page.waitForTimeout(6000)
const dims = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
console.error('PAGE', dims)
const probes = await page.evaluate(() => {
  const heroIframe = document.querySelector('section[aria-label="Listing hero"] iframe')
  const title = document.title
  return {
    title,
    heroHasIframe: !!heroIframe,
    heroIframeSrc: heroIframe?.getAttribute('src') ?? null,
  }
})
console.error('PROBE', JSON.stringify(probes, null, 2))
await page.screenshot({ path: 'out/listing-youtube-full.png', fullPage: true })
await browser.close()
