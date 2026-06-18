import { chromium } from 'playwright'

const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('warn', e.message))
await p.waitForTimeout(2500)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(() => {})
await p.waitForTimeout(400)

// 1) GOLF LEDGER counts (§0 alias-aware) — Tetherow 55, Widgi 48, NWX 28, Broken Top 21, Pronghorn 14, Awbrey 10
const golf = await p.$$eval('#communities-ledger .town-row', (rows) =>
  rows.map((r) => {
    const name = r.querySelector('.town-name')?.textContent?.trim()
    const count = r.querySelector('.town-count')?.textContent?.replace(/active/i, '').trim() || '(none)'
    const hasFill = !!r.querySelector('.town-fill')
    return { name, count, hasFill }
  }),
).catch(() => [])
console.log('GOLF LEDGER:')
for (const g of golf) console.log(`  ${g.name}: count=${g.count} hoverImg=${g.hasFill}`)

// 2) RAIL resort counts (should match golf ledger)
const railResorts = await p.$$eval('#communities .comm-card', (cards) =>
  cards
    .map((c) => ({ name: c.querySelector('.comm-name')?.textContent?.trim(), count: c.querySelector('.ct')?.textContent?.trim() }))
    .filter((x) => /tetherow|widgi|broken top|northwest|pronghorn|awbrey/i.test(x.name || '')),
).catch(() => [])
console.log('RAIL resort cards:', JSON.stringify(railResorts))

// 3) ACTIVITY heading + thumbnails
const actHeading = await p.$eval('#activity .sec-title', (e) => e.textContent?.trim()).catch(() => '(none)')
const actThumbs = await p.$$eval('#activity .act-thumb-img', (e) => e.length).catch(() => 0)
const actRows = await p.$$eval('#activity .act-row', (e) => e.length).catch(() => 0)
console.log(`ACTIVITY: heading="${actHeading}" thumbnails=${actThumbs}/${actRows} rows`)

// 4) ARTICLES thumbnails
const artImgs = await p.$$eval('#articles .art-img', (e) => e.length).catch(() => 0)
const artHeading = await p.$eval('#articles .sec-title', (e) => e.textContent?.trim()).catch(() => '(none)')
console.log(`ARTICLES: heading="${artHeading}" thumbnails=${artImgs}`)

// 5) OPEN HOUSES interactivity — rail cards are buttons; click swaps the lead image
const oh = await p.$('#open-houses')
if (oh) {
  await oh.scrollIntoViewIfNeeded()
  await p.waitForTimeout(1800)
  const railButtons = await p.$$eval('#open-houses .oh-rail button.oh-rail-card', (e) => e.length).catch(() => 0)
  const leadBefore = await p.$eval('#open-houses .oh-lead-img', (e) => e.getAttribute('src')).catch(() => null)
  // click the 3rd rail card
  const cards = await p.$$('#open-houses .oh-rail button.oh-rail-card')
  if (cards.length >= 3) {
    await cards[2].click()
    await p.waitForTimeout(700)
  }
  const leadAfter = await p.$eval('#open-houses .oh-lead-img', (e) => e.getAttribute('src')).catch(() => null)
  // is the rail a capped scroll container on desktop?
  const railScroll = await p.$eval('#open-houses .oh-rail', (e) => ({
    overflowY: getComputedStyle(e).overflowY,
    maxH: getComputedStyle(e).maxHeight,
    scrollH: e.scrollHeight,
    clientH: e.clientHeight,
  })).catch(() => null)
  console.log(`OPEN HOUSES: railButtons=${railButtons} leadChanged=${leadBefore !== leadAfter} scroll=${JSON.stringify(railScroll)}`)
  await oh.screenshot({ path: '/tmp/f-openhouses.png' })
  console.log('OK /tmp/f-openhouses.png')
  const act = await p.$('#activity'); if (act) { await act.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500); await act.screenshot({ path: '/tmp/f-activity.png' }); console.log('OK /tmp/f-activity.png') }
  const golfEl = await p.$('#communities-ledger'); if (golfEl) { await golfEl.scrollIntoViewIfNeeded(); await golfEl.hover().catch(()=>{}); await p.waitForTimeout(900); await golfEl.screenshot({ path: '/tmp/f-golf.png' }); console.log('OK /tmp/f-golf.png') }
}
await b.close()
