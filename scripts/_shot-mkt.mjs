import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA })
for (const url of ['http://localhost:3010/cities/bend','http://localhost:3010/','http://localhost:3010/communities/widgi-creek']) {
  const p = await ctx.newPage()
  await p.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
  await p.waitForTimeout(2000)
  const d = await p.evaluate(() => {
    const head = document.querySelector('.kb-root .mkt-headline')?.textContent?.replace(/\s+/g,' ').trim()
    const phead = document.querySelector('.kb-root .mkt-phead .mono-lab')?.textContent?.replace(/\s+/g,' ').trim()
    const headHasSale = /median sale/i.test(document.querySelector('.kb-root .mkt-headline')?.textContent || '')
    return { head, phead, headHasSale }
  })
  console.log(url.replace('http://localhost:3010',''), '\n  headline:', d.head, '\n  chart cap:', d.phead, '\n  headline-has-sale-delta:', d.headHasSale)
  await p.close()
}
await b.close()
