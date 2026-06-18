import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/communities/widgi-creek', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(2500)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
const data = await p.evaluate(() => ({
  heroCount: document.querySelector('.kb-root .hero-sub, .kb-root #top')?.textContent?.match(/(\d+)\s+homes/)?.[1],
  featuredCards: document.querySelectorAll('#listings .lst-card, #listings a[class*="lst"]').length,
  mapTotal: document.querySelector('#map')?.textContent?.match(/(\d+)/)?.[1],
  marketActive: document.querySelector('#market-report')?.textContent?.match(/(\d+)\s*\n?\s*active/i)?.[1],
}))
console.log('WIDGI:', JSON.stringify(data))
const feat = await p.$('#listings'); if (feat) { await feat.scrollIntoViewIfNeeded(); await p.waitForTimeout(2000); await feat.screenshot({ path: '/tmp/w-listings.png' }); console.log('OK /tmp/w-listings.png') }
const map = await p.$('#map'); if (map) { await map.scrollIntoViewIfNeeded(); await p.waitForTimeout(2500); await map.screenshot({ path: '/tmp/w-map.png' }); console.log('OK /tmp/w-map.png') }
await b.close()
