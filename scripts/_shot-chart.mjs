import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(2000)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
const mkt = await p.$('#market-report'); await mkt.scrollIntoViewIfNeeded(); await p.waitForTimeout(2200)
// chart diagnostics
const d = await p.evaluate(() => {
  const chips = Array.from(document.querySelectorAll('.kbmc-chip')).map(c=>({y:c.textContent.trim(),pressed:c.getAttribute('aria-pressed')}))
  const lines = document.querySelectorAll('.kbmc-svg .kbmc-line').length
  const xaxis = Array.from(document.querySelectorAll('.kbmc-xaxis span')).map(s=>s.textContent).join('')
  const endlabel = document.querySelector('.kbmc-endlabel')?.textContent
  const eyebrow = document.querySelector('#market-report .sec-index')?.textContent
  return { chips, lines, xaxis, endlabel, eyebrow }
})
console.log('CHART:', JSON.stringify(d))
await mkt.screenshot({ path: '/tmp/c-chart.png' })
console.log('OK /tmp/c-chart.png')
// toggle a year off, re-check line count
const chips = await p.$$('.kbmc-chip')
if (chips.length >= 2) { await chips[0].click(); await p.waitForTimeout(600) }
const after = await p.$$eval('.kbmc-svg .kbmc-line', e=>e.length).catch(()=>-1)
console.log('after toggling first chip off, visible lines:', after)
// hover the plot to trigger tooltip
const plot = await p.$('.kbmc-plot'); const box = await plot.boundingBox()
await p.mouse.move(box.x + box.width*0.6, box.y + box.height*0.5); await p.waitForTimeout(500)
const tip = await p.$eval('.kbmc-tip', e=>e.textContent.replace(/\s+/g,' ').trim()).catch(()=>'(no tip)')
console.log('tooltip:', tip)
await mkt.screenshot({ path: '/tmp/c-chart-hover.png' })
console.log('OK /tmp/c-chart-hover.png')
// featured grid: count cards + check no tiny orphan (widths)
const feat = await p.$('#listings'); await feat.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200)
const cards = await p.$$eval('#listings .lst-card', els => els.map(e=>Math.round(e.getBoundingClientRect().width)))
console.log('featured card widths:', JSON.stringify(cards))
await feat.screenshot({ path: '/tmp/c-featured.png' }); console.log('OK /tmp/c-featured.png')
await b.close()
