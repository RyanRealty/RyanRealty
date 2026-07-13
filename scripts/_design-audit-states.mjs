// Design-audit STATES + NAV capture — the things static page shots miss:
// 404, listing-not-found, empty search results, mega-menu open, mobile nav drawer.
// Read-only: never submits a form (would create a real CRM lead). Writes to docs/design-audit/assets/.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = 'docs/design-audit/assets'
mkdirSync(OUT, { recursive: true })
const results = []

async function dismissOverlays(page) {
  for (const label of ['Maybe later', 'Essential only', 'Decline', 'Accept All', 'Got it', 'Close']) {
    try { const b = page.getByRole('button', { name: label }).first(); if (await b.isVisible({ timeout: 200 })) await b.click({ timeout: 500 }) } catch {}
  }
}
function ctxOpts(vp) {
  return { viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1.5, reducedMotion: 'reduce' }
}
const DESKTOP = { width: 1440, height: 900 }
const MOBILE = { width: 390, height: 844 }

const browser = await chromium.launch()

async function shotFull(name, path, vp = DESKTOP, prep) {
  const ctx = await browser.newContext(ctxOpts(vp))
  await ctx.addInitScript(() => { try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 60000 })
    await dismissOverlays(page)
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
    await page.waitForTimeout(1500)
    if (prep) await prep(page)
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
    results.push({ name, path, status: resp?.status(), ok: true })
    console.log(`OK   ${name} [${resp?.status()}]`)
  } catch (e) { results.push({ name, path, ok: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`) }
  await ctx.close()
}

// 404 not-found
await shotFull('state-404-desktop', '/this-page-does-not-exist-xyz-9k2', DESKTOP)
// Listing not found (bad key)
await shotFull('state-listing-notfound-desktop', '/listing/00000000000000000000000000', DESKTOP)
// Empty search — impossibly high min price via query param variants; capture whatever renders
await shotFull('state-search-empty-desktop', '/homes-for-sale?priceMin=90000000', DESKTOP)
await shotFull('state-search-empty2-desktop', '/homes-for-sale/bend/luxury?priceMin=99000000', DESKTOP)

// Mega-menu open (desktop) — hover the MENU+ / primary triggers on homepage KB nav
await shotFull('state-nav-megamenu-desktop', '/', DESKTOP, async (page) => {
  for (const label of [/menu/i, 'HOMES', 'Homes', 'COMMUNITIES', 'Communities']) {
    try {
      const t = page.getByRole('link', { name: label }).first()
      if (await t.isVisible({ timeout: 500 })) { await t.hover({ timeout: 1500 }); await page.waitForTimeout(700); break }
      const b = page.getByRole('button', { name: label }).first()
      if (await b.isVisible({ timeout: 400 })) { await b.hover({ timeout: 1000 }).catch(()=>{}); await b.click({ timeout: 800 }).catch(()=>{}); await page.waitForTimeout(700); break }
    } catch {}
  }
})

// Site-header mega-menu on a non-home page (search) — hover Homes/Market
await shotFull('state-nav-siteheader-desktop', '/homes-for-sale', DESKTOP, async (page) => {
  for (const label of ['Homes', 'Market', 'Sell']) {
    try { const t = page.getByRole('button', { name: label }).first(); if (await t.isVisible({ timeout: 500 })) { await t.hover({ timeout: 1200 }); await page.waitForTimeout(600); break } } catch {}
  }
})

// Mobile nav drawer (home + a site-header page)
for (const [name, path] of [['state-nav-drawer-home-mobile', '/'], ['state-nav-drawer-site-mobile', '/homes-for-sale']]) {
  await shotFull(name, path, MOBILE, async (page) => {
    let opened = false
    for (const nm of [/menu/i, /open/i, /navigation/i, 'MENU +', 'MENU+']) {
      try { const b = page.getByRole('button', { name: nm }).first(); if (await b.isVisible({ timeout: 400 })) { await b.click({ timeout: 800 }); opened = true; break } } catch {}
    }
    if (!opened) { try { const btns = page.locator('header button, nav button'); const n = await btns.count(); if (n) await btns.nth(n-1).click({ timeout: 800 }).catch(()=>{}) } catch {} }
    await page.waitForTimeout(800)
  })
}

await browser.close()
writeFileSync(`${OUT}/_states-manifest.json`, JSON.stringify(results, null, 2))
console.log(`\n${results.filter(r=>r.ok).length}/${results.length} states captured.`)
