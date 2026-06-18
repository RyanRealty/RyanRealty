import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(2000)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
await p.waitForTimeout(400)
// dismiss chat widget if present
await p.evaluate(() => { document.querySelectorAll('[class*="chat"],[id*="chat"],[class*="widget"]').forEach(e=>{ if(e.getBoundingClientRect().bottom>700) e.style.display='none' }) }).catch(()=>{})
const oh = await p.$('#open-houses')
await oh.scrollIntoViewIfNeeded()
await p.waitForTimeout(2500)
// rail diagnostics
const diag = await p.evaluate(() => {
  const board = document.querySelector('#open-houses .oh-board')
  const rail = document.querySelector('#open-houses .oh-rail')
  const cards = document.querySelectorAll('#open-houses .oh-rail button.oh-rail-card')
  const r = rail?.getBoundingClientRect()
  return {
    boardCols: board ? getComputedStyle(board).gridTemplateColumns : null,
    railVisible: r ? (r.width>0 && r.height>0) : false,
    railRect: r ? {w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x)} : null,
    cards: cards.length,
    railOverflowY: rail ? getComputedStyle(rail).overflowY : null,
  }
})
console.log('OH diag:', JSON.stringify(diag))
await oh.screenshot({ path: '/tmp/f-oh2.png' })
console.log('OK /tmp/f-oh2.png')
await b.close()
