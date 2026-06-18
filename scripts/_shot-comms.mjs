import { chromium } from 'playwright'

const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
const url = process.env.CITY_URL || 'http://localhost:3010/cities/bend'
await p.goto(url, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('warn', e.message))
await p.waitForTimeout(2500)
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(() => {})
await p.waitForTimeout(400)

// communities rail — count cards + how many carry a hover image
const commCount = await p.$$eval('#communities .comm-card', (els) => els.length).catch(() => -1)
const commWithImg = await p
  .$$eval('#communities .comm-card .comm-img', (els) => els.filter((i) => i.getAttribute('src')).length)
  .catch(() => -1)
console.log(`communities rail: ${commCount} cards, ${commWithImg} with image`)

const comm = await p.$('#communities')
if (comm) {
  await comm.scrollIntoViewIfNeeded()
  await p.waitForTimeout(1600)
  await comm.screenshot({ path: '/tmp/c-communities.png' })
  console.log('OK /tmp/c-communities.png')
}

// neighborhoods — count how many town cards have a hover fill image
const nb = await p.$('#neighborhoods')
if (nb) {
  await nb.scrollIntoViewIfNeeded()
  await p.waitForTimeout(1400)
  const fills = await p.$$eval('#neighborhoods .town-fill', (els) => els.length).catch(() => 0)
  const rows = await p.$$eval('#neighborhoods .town-row, #neighborhoods a', (els) => els.length).catch(() => 0)
  console.log(`neighborhoods: ${fills} hover-image fills across ~${rows} rows`)
  // hover the first row to reveal the bg image
  const firstRow = await p.$('#neighborhoods .town-row, #neighborhoods a')
  if (firstRow) {
    await firstRow.hover().catch(() => {})
    await p.waitForTimeout(900)
  }
  await nb.screenshot({ path: '/tmp/c-neighborhoods.png' })
  console.log('OK /tmp/c-neighborhoods.png')
}

// golf / master-planned ledger
const golf = await p.$('#communities-ledger')
if (golf) {
  await golf.scrollIntoViewIfNeeded()
  await p.waitForTimeout(1200)
  await golf.screenshot({ path: '/tmp/c-golf.png' })
  console.log('OK /tmp/c-golf.png')
}
await b.close()
