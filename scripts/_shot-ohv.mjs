import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(2000)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
const oh = await p.$('#open-houses'); await oh.scrollIntoViewIfNeeded(); await p.waitForTimeout(800)
await p.evaluate(() => window.scrollBy(0, -80))
await p.waitForTimeout(2500)
await p.screenshot({ path: '/tmp/f-ohv.png' })  // viewport, not element
console.log('OK /tmp/f-ohv.png')
await b.close()
