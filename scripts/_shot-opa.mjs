import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(1500)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
const oh = await p.$('#open-houses'); await oh.scrollIntoViewIfNeeded(); await p.waitForTimeout(2500)
const op = await p.$$eval('#open-houses .oh-rail button.oh-rail-card', els =>
  els.map(e => ({ inline: e.style.opacity, computed: getComputedStyle(e).opacity, vis: getComputedStyle(e).visibility })))
console.log('rail card opacity:', JSON.stringify(op))
const leadOp = await p.$eval('#open-houses .oh-lead', e => getComputedStyle(e).opacity).catch(()=>'?')
console.log('lead opacity:', leadOp)
await b.close()
