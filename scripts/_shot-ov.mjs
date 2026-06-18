import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/communities/tetherow', { waitUntil: 'load', timeout: 60000 }).catch(()=>{})
await p.waitForTimeout(2500)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(()=>{})
for (const [sel,name] of [['#overview','overview'],['#amenities','amenities'],['#golf','golf']]) {
  const el = await p.$(sel)
  if (el) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1400); await el.screenshot({ path: `/tmp/ov-${name}.png` }); console.log('OK /tmp/ov-'+name+'.png') }
  else console.log('MISS '+sel)
}
// content sanity: amenity cards + drive times + golf KPIs counts
const d = await p.evaluate(() => ({
  amenityCards: document.querySelectorAll('#amenities .amen-card').length,
  driveTimes: document.querySelectorAll('#overview .ov-drive').length,
  facts: document.querySelectorAll('#overview .ov-fact').length,
  golfKpis: document.querySelectorAll('#golf .ov-kpi').length,
  builders: document.querySelectorAll('#builders .ov-builder').length,
}))
console.log('tetherow content:', JSON.stringify(d))
await b.close()
