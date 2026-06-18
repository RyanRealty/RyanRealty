import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(2000)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
await p.waitForTimeout(400)

// rail count for Tetherow
const railTeth = await p.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('#communities .comm-card'))
  const t = cards.find(c => /tetherow/i.test(c.textContent||''))
  return t ? (t.querySelector('.ct')?.textContent?.trim() ?? '?') : 'NOT FOUND'
})
// golf ledger count for Tetherow
const golfTeth = await p.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('#communities-ledger .town-row'))
  const t = rows.find(r => /tetherow/i.test(r.textContent||''))
  return t ? (t.querySelector('.town-count')?.textContent?.replace(/active/i,'').trim() ?? '?') : 'NOT FOUND'
})
console.log(`Tetherow — rail: ${railTeth} | golf ledger: ${golfTeth}`)

// FAQ section observable?
const faq = await p.evaluate(() => {
  const s = document.querySelector('section#faq')
  return s ? { tag: s.tagName, id: s.id, hasContent: (s.textContent||'').length > 40 } : null
})
console.log('FAQ section[id=faq]:', JSON.stringify(faq))

// menu sell links
await p.getByRole('button', { name: /open menu|menu \+/i }).first().click().catch(()=>{})
await p.waitForTimeout(900)
const sell = await p.$$eval('.menu-group a', els => els.map(a=>`${a.textContent?.trim()} -> ${a.getAttribute('href')}`).filter(s=>/sell|valuation|deadline|worth/i.test(s)))
console.log('sell links:', JSON.stringify(sell))
await b.close()
