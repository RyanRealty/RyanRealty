import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const r = await page.goto('http://localhost:3000/listing/20250715233741474954000000', { waitUntil: 'load', timeout: 90000 })
console.error('HTTP', r.status())
await page.waitForTimeout(8000)
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
  const heroIframe = document.querySelector('section[aria-label="Listing hero"] iframe')
  const heroImg = document.querySelectorAll('section[aria-label="Listing hero"] img')
  const title = document.title
  return {
    title,
    heroHasIframe: !!heroIframe,
    heroIframeSrc: heroIframe?.getAttribute('src') ?? null,
    heroPhotoCount: heroImg.length,
  }
})
console.error('PROBE', JSON.stringify(probes, null, 2))
await page.screenshot({ path: 'out/listing-luxury-full.png', fullPage: true })
await browser.close()
