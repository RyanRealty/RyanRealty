// Live screenshot harness for Matt's sign-off — captures the REAL running pages
// (golf landing + the bento mega-menu open) from the dev server on :3000.
// Usage: node scripts/_live-shot.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = '/Users/matthewryan/ryanrealty/out/design-mockups/_live'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const results = []

async function dismissOverlays(page) {
  for (const label of ['Maybe later', 'Accept All', 'Accept all', 'Essential only', 'Got it']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 300 })) await btn.click({ timeout: 600 })
    } catch {}
  }
}

// ---- GOLF LANDING (desktop + mobile, full page) ----
for (const v of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {}
  })
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/homes-for-sale/bend/on-golf-course`, { waitUntil: 'load', timeout: 120000 })
    await dismissOverlays(page)
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/golf-${v.name}.png`, fullPage: true })
    results.push(`OK golf-${v.name}`)
  } catch (e) {
    results.push(`FAIL golf-${v.name}: ${e.message}`)
  }
  await ctx.close()
}

// ---- MEGA-MENU open on hover (desktop) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => { try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 120000 })
    await dismissOverlays(page)
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
    await page.waitForTimeout(1500)
    for (const parent of ['Homes', 'Communities', 'Market']) {
      try {
        const trigger = page.getByRole('link', { name: parent, exact: false }).first()
        await trigger.hover({ timeout: 4000 })
        await page.waitForTimeout(700)
        await page.screenshot({ path: `${OUT}/nav-${parent.toLowerCase()}.png` })
        results.push(`OK nav-${parent.toLowerCase()}`)
      } catch (e) {
        results.push(`FAIL nav-${parent.toLowerCase()}: ${e.message}`)
      }
    }
  } catch (e) {
    results.push(`FAIL nav-desktop: ${e.message}`)
  }
  await ctx.close()
}

// ---- MOBILE drawer ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => { try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 120000 })
    await dismissOverlays(page)
    await page.waitForTimeout(1200)
    // open the hamburger (try a few likely accessible names, else last header button)
    let opened = false
    for (const name of [/menu/i, /open/i, /navigation/i]) {
      try {
        const b = page.getByRole('button', { name }).first()
        if (await b.isVisible({ timeout: 500 })) { await b.click({ timeout: 1000 }); opened = true; break }
      } catch {}
    }
    if (!opened) {
      const btns = page.locator('header button')
      const n = await btns.count()
      if (n > 0) { await btns.nth(n - 1).click({ timeout: 1000 }).catch(() => {}) }
    }
    await page.waitForTimeout(800)
    // expand a parent section
    try { await page.getByRole('button', { name: 'Communities', exact: false }).first().click({ timeout: 1500 }) } catch {}
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/nav-mobile.png`, fullPage: true })
    results.push('OK nav-mobile')
  } catch (e) {
    results.push(`FAIL nav-mobile: ${e.message}`)
  }
  await ctx.close()
}

await browser.close()
console.log(results.join('\n'))
