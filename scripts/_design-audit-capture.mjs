// Design-audit capture harness — screenshots the real running site (:3000) for the
// full-site UI/UX audit. Writes readable viewport PANELS + one bounded full-page image
// per (page, viewport) into docs/design-audit/assets/.
//
// Lenis note: SmoothScrollProvider does NOT mount Lenis under prefers-reduced-motion,
// so reducedMotion:'reduce' gives clean native-scroll captures (no blank bands).
// Panels are readable when an agent reads them; a lone tall fullPage downscales to mush.
//
// Usage: node scripts/_design-audit-capture.mjs [only=home,search]
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = 'docs/design-audit/assets'
mkdirSync(OUT, { recursive: true })

const onlyArg = (process.argv.find(a => a.startsWith('only=')) || '').slice(5)
const only = onlyArg ? new Set(onlyArg.split(',')) : null

// name, path, tier(1=desktop+mobile, 2=desktop only), role
const PAGES = [
  ['home',                 '/',                                          1, 'first-impression / homepage'],
  ['search',               '/homes-for-sale',                            1, 'core discovery / search results'],
  ['listing-detail',       '/listing/20260328234720220317000000',        1, 'core action / listing detail (mid $550k)'],
  ['listing-luxury',       '/listing/20250715233741474954000000',        2, 'listing detail (luxury $11.9M)'],
  ['sell',                 '/sell',                                      1, 'seller funnel entry'],
  ['sell-valuation',       '/sell/valuation',                            1, 'seller conversion / valuation'],
  ['lp-seller-home-value', '/lp/seller-home-value',                      1, 'paid LP / seller value'],
  ['about',                '/about',                                     1, 'trust / about'],
  ['team',                 '/team',                                      1, 'trust / team'],
  ['team-member',          '/team/matthew-ryan',                         2, 'trust / broker profile'],
  ['contact',              '/contact',                                   1, 'conversion / contact'],
  ['cities',               '/cities',                                    1, 'discovery / cities hub'],
  ['city-bend',            '/cities/bend',                               1, 'discovery / city detail (Bend)'],
  ['communities',          '/communities',                              1, 'discovery / communities hub'],
  ['community-tetherow',   '/communities/tetherow',                      1, 'discovery / community detail'],
  ['housing-market',       '/housing-market',                            1, 'authority / market hub'],
  ['market-report',        '/housing-market/central-oregon',             2, 'authority / market report'],
  ['reviews',              '/reviews',                                   1, 'trust / reviews'],
  ['blog',                 '/blog',                                      1, 'content / blog index'],
  ['blog-post',            '/blog/understanding-home-appraisals',        2, 'content / article'],
  ['buy',                  '/buy',                                       2, 'buyer funnel entry'],
  ['luxury-homes-bend',    '/luxury-homes-bend',                         2, 'SEO landing / luxury'],
  ['faq',                  '/faq',                                       2, 'support / faq'],
  ['resources',            '/resources',                                 2, 'support / resources'],
  ['open-houses',          '/open-houses',                               2, 'discovery / open houses'],
  ['tools-mortgage',       '/tools/mortgage-calculator',                 2, 'tool / mortgage calc'],
  ['login',                '/login',                                     2, 'account / login'],
  ['signup',               '/signup',                                    2, 'account / signup'],
]

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, dsf: 1.5, maxPanels: 14 },
  mobile:  { width: 390,  height: 844, dsf: 2,   maxPanels: 18 },
}

const results = []

async function dismissOverlays(page) {
  for (const label of ['Maybe later', 'Essential only', 'Decline', 'Reject all', 'Accept All', 'Accept all', 'Got it', 'Close']) {
    try {
      const btn = page.getByRole('button', { name: label }).first()
      if (await btn.isVisible({ timeout: 200 })) await btn.click({ timeout: 500 })
    } catch {}
  }
}

async function capture(browser, name, path, vpName) {
  const { width, height, dsf, maxPanels } = VIEWPORTS[vpName]
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    reducedMotion: 'reduce',
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
      localStorage.setItem('rr_consent', 'essential')
      localStorage.setItem('cookie-consent', 'declined')
    } catch {}
  })
  const page = await ctx.newPage()
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 90000 })
    const status = resp ? resp.status() : 0
    await dismissOverlays(page)
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
    await page.waitForTimeout(1600)

    // Prime GSAP reveals: native step-scroll to bottom then back to top.
    const docH = await page.evaluate(async (vh) => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms))
      let h = document.body.scrollHeight
      for (let y = 0; y < h; y += Math.round(vh * 0.85)) { window.scrollTo(0, y); await sleep(110); h = document.body.scrollHeight }
      window.scrollTo(0, h); await sleep(200); window.scrollTo(0, 0); await sleep(350)
      return document.body.scrollHeight
    }, height)
    await dismissOverlays(page)
    await page.waitForTimeout(300)

    // Panels: viewport-tall readable slices, scrolled with native scroll.
    const step = Math.round(height * 0.9)
    const panelCount = Math.min(maxPanels, Math.max(1, Math.ceil(docH / step)))
    const panels = []
    for (let i = 0; i < panelCount; i++) {
      const y = i * step
      await page.evaluate((yy) => window.scrollTo(0, yy), y)
      await page.waitForTimeout(350)
      const pf = `${name}-${vpName}-${String(i + 1).padStart(2, '0')}.png`
      await page.screenshot({ path: `${OUT}/${pf}`, fullPage: false })
      panels.push(pf)
    }
    // Bounded full-page (dsf 1) for report embed / gestalt.
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250)
    results.push({ name, path, vp: vpName, status, docHeight: docH, panels, ok: true })
    console.log(`OK   ${name}-${vpName} [${status}] h=${docH} panels=${panelCount}`)
  } catch (e) {
    results.push({ name, path, vp: vpName, ok: false, error: e.message })
    console.log(`FAIL ${name}-${vpName}: ${e.message}`)
  }
  await ctx.close()
}

const browser = await chromium.launch()
for (const [name, path, tier] of PAGES) {
  if (only && !only.has(name)) continue
  await capture(browser, name, path, 'desktop')
  if (tier === 1) await capture(browser, name, path, 'mobile')
}
await browser.close()
writeFileSync(`${OUT}/_capture-manifest.json`, JSON.stringify(results, null, 2))
console.log(`\n${results.filter(r => r.ok).length}/${results.length} captured. Manifest: ${OUT}/_capture-manifest.json`)
