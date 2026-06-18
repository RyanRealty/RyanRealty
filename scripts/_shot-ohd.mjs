import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, userAgent: UA })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(2000)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
const oh = await p.$('#open-houses'); await oh.scrollIntoViewIfNeeded(); await p.waitForTimeout(2000)
const cards = await p.$$eval('#open-houses .oh-rail button.oh-rail-card', (els) =>
  els.slice(0,6).map((el) => {
    const r = el.getBoundingClientRect()
    const img = el.querySelector('.oh-rail-img')
    const media = el.querySelector('.oh-rail-media')
    const mr = media?.getBoundingClientRect()
    return {
      cardH: Math.round(r.height), cardW: Math.round(r.width),
      display: getComputedStyle(el).display,
      gridCols: getComputedStyle(el).gridTemplateColumns,
      mediaH: mr ? Math.round(mr.height) : null,
      imgComplete: img ? img.complete : 'noimg',
      imgNatW: img ? img.naturalWidth : 0,
      imgSrc: img ? (img.getAttribute('src')||'').slice(0,50) : null,
    }
  })
).catch((e)=>('ERR '+e.message))
console.log(JSON.stringify(cards, null, 1))
await b.close()
