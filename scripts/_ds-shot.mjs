// Design-system rollout screenshot harness.
// Captures the genuinely-LOADED state of /search, /cities/bend, and a live
// listing-detail page (not the skeleton / lazy-load placeholder state).
//
// Usage: LABEL=before node scripts/_ds-shot.mjs [only]
//   LABEL  -> out subdir (before|after), default "before"
//   only   -> optional: search | city | listing  (capture just one)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const LABEL = process.env.LABEL || 'before'
const ONLY = process.argv[2] || ''
const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = `out/ds-rollout/${LABEL}`
mkdirSync(OUT, { recursive: true })

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, deviceScaleFactor: 2 })
// Suppress the two known overlays (sign-in prompt + cookie banner) BEFORE any
// page JS runs, so we screenshot the genuine loaded UI, not lazy-popped chrome.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    document.cookie =
      'ryan_realty_cookie_consent=' +
      encodeURIComponent(JSON.stringify({ analytics: true, marketing: true })) +
      '; path=/'
  } catch {}
})
const page = await ctx.newPage()

// Belt-and-suspenders: if either overlay still mounts, click it away.
async function dismissOverlays() {
  for (const label of ['Maybe later', 'Accept All', 'Essential only']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 400 })) await btn.click({ timeout: 800 })
    } catch {}
  }
}
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[ERR] ${m.text()}`.slice(0, 200))
})

// Force every lazy / below-the-fold section to mount, then settle.
async function settle(ms = 1500) {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight
    for (let y = 0; y < h; y += 500) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 300))
  })
  await page.waitForTimeout(ms)
}

// Wait until every <img> in view is actually decoded (naturalWidth>0), so we
// don't screenshot grey image placeholders.
async function waitImages(timeout = 15000) {
  try {
    await page.waitForFunction(
      () => {
        const imgs = Array.from(document.images)
        if (imgs.length === 0) return true
        const done = imgs.filter((i) => i.complete && i.naturalWidth > 0).length
        return done / imgs.length >= 0.9
      },
      { timeout },
    )
  } catch { /* best effort */ }
}

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${OUT}/${name}-fold.png`, fullPage: false })
}

async function capSearch() {
  const r = await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 90000 })
  // loaded-state signal: at least one price-bearing result card present
  await page.waitForTimeout(2500)
  await dismissOverlays()
  await settle(2000)
  await waitImages()
  const probe = await page.evaluate(() => {
    const cards = document.querySelectorAll('a[href^="/listing/"], article')
    const prices = Array.from(document.querySelectorAll('*')).filter((e) => /^\$[\d,]+$/.test(e.textContent?.trim() || '')).length
    const hasMap = !!document.querySelector('.gm-style, canvas, [class*="map" i]')
    return { status: 'ok', cards: cards.length, prices, hasMap }
  })
  console.error('SEARCH', r.status(), JSON.stringify(probe))
  await shot('search')
}

async function capCity() {
  const r = await page.goto(`${BASE}/cities/bend`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(2500)
  await dismissOverlays()
  await settle(2000)
  await waitImages()
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  console.error('CITY', r.status(), 'height', h)
  await shot('city')
}

async function capListing() {
  // discover a live listing from the search page. Cards link to SEO paths like
  // /homes-for-sale/bend/60454-kangaroo-220222542 where the trailing digits are
  // the MLS ListNumber; the /listing/[listingKey] parity route resolves by it.
  const fixed = process.env.LISTING_KEY
  let target
  if (fixed) {
    target = `/listing/${fixed}`
  } else {
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(2500)
    await settle(1000)
    const mls = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a[href]'))
        .map((x) => x.getAttribute('href') || '')
        .find((h) => /\/homes-for-sale\/[^/]+\/[^/]+-\d{6,}$/.test(h))
      return a ? a.match(/-(\d{6,})$/)?.[1] : null
    })
    if (!mls) { console.error('LISTING: no live listing href found on /search'); return }
    target = `/listing/${mls}`
  }
  console.error('LISTING target', target)
  const r = await page.goto(`${BASE}${target}`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(4000)
  await dismissOverlays()
  await settle(3000)
  await waitImages(20000)
  const probe = await page.evaluate(() => ({
    gmReady: typeof window?.google?.maps?.Map === 'function',
    imgs: document.images.length,
    imgsDone: Array.from(document.images).filter((i) => i.complete && i.naturalWidth > 0).length,
    h: document.documentElement.scrollHeight,
  }))
  console.error('LISTING', r.status(), JSON.stringify(probe))
  await shot('listing')
}

if (!ONLY || ONLY === 'search') await capSearch()
if (!ONLY || ONLY === 'city') await capCity()
if (!ONLY || ONLY === 'listing') await capListing()

if (errors.length) console.error('CONSOLE ERRORS', errors.slice(0, 8).join('\n'))
await browser.close()
