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

// 1) Hero — logo + breadcrumb (top of page, viewport shot)
await p.screenshot({ path: '/tmp/r-hero.png' })
console.log('OK /tmp/r-hero.png')

// breadcrumb audit — is there a white/legacy breadcrumb anywhere above the hero?
const bcInfo = await p.evaluate(() => {
  const navs = Array.from(document.querySelectorAll('nav, .breadcrumb, [aria-label*="readcrumb"], .kb-bc'))
  return navs.slice(0, 6).map((n) => ({
    cls: n.className?.toString().slice(0, 60),
    label: n.getAttribute('aria-label') || '',
    bg: getComputedStyle(n).backgroundColor,
    top: Math.round(n.getBoundingClientRect().top),
  }))
})
console.log('breadcrumb/nav elements:', JSON.stringify(bcInfo))

// logo audit — is the logo image fully visible (not clipped/overflowing)?
const logo = await p.evaluate(() => {
  const img = document.querySelector('.topbar .logo-img') || document.querySelector('header img')
  if (!img) return null
  const r = img.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), natW: img.naturalWidth, natH: img.naturalHeight }
})
console.log('logo:', JSON.stringify(logo))

// 2) Market chart (multi-year overlay)
const mkt = await p.$('#market, .mkt, [id*="market"]')
if (mkt) {
  await mkt.scrollIntoViewIfNeeded()
  await p.waitForTimeout(2200)
  await mkt.screenshot({ path: '/tmp/r-market.png' })
  console.log('OK /tmp/r-market.png')
  const yearlines = await p.$$eval('.mkt-yearline', (e) => e.length).catch(() => 0)
  const legend = await p.$$eval('.mkt-yl', (e) => e.map((x) => x.textContent?.trim()).filter(Boolean)).catch(() => [])
  console.log(`market: ${yearlines} year-lines, legend=${JSON.stringify(legend)}`)
}

// 3) Open houses
const oh = await p.$('#open-houses')
if (oh) {
  await oh.scrollIntoViewIfNeeded()
  await p.waitForTimeout(1600)
  await oh.screenshot({ path: '/tmp/r-openhouses.png' })
  console.log('OK /tmp/r-openhouses.png')
}

// 4) Testimonials
const ts = await p.$('#reviews')
if (ts) {
  await ts.scrollIntoViewIfNeeded()
  await p.waitForTimeout(2000)
  await ts.screenshot({ path: '/tmp/r-testimonials.png' })
  console.log('OK /tmp/r-testimonials.png')
}

// 5) Menu (comprehensive)
await p.evaluate(() => window.scrollTo(0, 0))
await p.waitForTimeout(600)
await p.getByRole('button', { name: /open menu|menu \+/i }).first().click().catch(() => {})
await p.waitForTimeout(1100)
await p.screenshot({ path: '/tmp/r-menu.png' })
console.log('OK /tmp/r-menu.png')
const menuLinks = await p.$$eval('.menu-grid a, .menu-group a', (els) =>
  els.map((a) => `${a.textContent?.trim()} -> ${a.getAttribute('href')}`),
).catch(() => [])
console.log('menu links (' + menuLinks.length + '):', JSON.stringify(menuLinks, null, 0))

await b.close()
