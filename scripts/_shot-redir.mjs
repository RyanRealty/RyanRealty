import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, userAgent: UA })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/communities/bend-tetherow', { waitUntil: 'load', timeout: 60000 }).catch(e=>console.log('warn',e.message))
await p.waitForTimeout(2000)
console.log('final URL:', p.url())
const count = await p.evaluate(() => document.querySelector('.kb-root #top')?.textContent?.match(/(\d+)\s+homes/)?.[1])
console.log('hero count:', count)
await b.close()
