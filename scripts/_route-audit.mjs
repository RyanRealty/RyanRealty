// Route render-audit: visits a representative URL for every route pattern on the
// dev server, reports HTTP status + whether the page rendered or threw an error
// boundary. Auto-discovers a few real detail slugs (listing, blog, report, guide,
// school) from index pages so dynamic routes are checked with real data.
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3000'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await ctx.addInitScript(() => { try { localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now())) } catch {} })
const page = await ctx.newPage()

async function firstHref(path, re) {
  try {
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(1500)
    const hrefs = await page.$$eval('a[href]', (els) => els.map((e) => e.getAttribute('href')))
    return hrefs.find((h) => h && re.test(h)) || null
  } catch { return null }
}

// Discover real detail slugs
const listingHref = await firstHref('/homes-for-sale/bend', /^\/listing\//)
const blogHref = await firstHref('/blog', /^\/blog\/[^/]+$/)
const guideHref = await firstHref('/guides', /^\/guides\/[^/]+$/)
const reportHref = await firstHref('/housing-market/reports', /^\/housing-market\/reports\/[^/]+$/)
const schoolHref = await firstHref('/schools', /^\/schools\/[^/]+$/)
const neighborhoodHref = await firstHref('/cities/bend', /^\/cities\/bend\/[^/]+$/)

const routes = [
  // static public
  '/', '/about', '/sell', '/contact', '/faq', '/compare', '/search', '/open-houses',
  '/buy', '/join', '/accessibility', '/cookies', '/fair-housing', '/dmca', '/terms',
  '/privacy', '/area-guides', '/activity', '/feed', '/cities', '/communities',
  '/housing-market', '/housing-market/explore', '/housing-market/reports', '/housing-market/central-oregon',
  '/schools', '/parks', '/guides', '/blog', '/team', '/reviews',
  // auth-ish (redirect to login is OK, not a failure)
  '/login', '/forgot-password', '/dashboard', '/dashboard/saved', '/dashboard/searches',
  '/dashboard/likes', '/account', '/account/saved-searches', '/account/saved-homes',
  // LPs
  '/lp/bend', '/lp/seller-home-value', '/lp/sell-your-home', '/lp/buyer-listing-alerts',
  '/lp/central-oregon-golf', '/lp/expired-listing',
  // dynamic with known slugs
  '/cities/bend', '/communities/tetherow', '/parks/smith-rock', '/zip/97701',
  '/housing-market/bend', '/homes-for-sale/bend', '/homes-for-sale/bend/under-750k',
  '/homes-for-sale/bend/on-golf-course', '/homes-for-sale/bend/luxury', '/homes-for-sale/bend/acreage',
  // dynamic discovered
  listingHref, blogHref, guideHref, reportHref, schoolHref, neighborhoodHref,
  // more cities / communities / presets / zips
  '/cities/redmond', '/cities/sisters', '/cities/sunriver', '/communities/eagle-crest',
  '/communities/brasada-ranch', '/communities/sunriver', '/zip/97703', '/zip/97702',
  '/homes-for-sale/redmond', '/homes-for-sale/sunriver/on-golf-course',
  '/homes-for-sale/bend/new-construction', '/homes-for-sale/bend/condos',
  '/homes-for-sale/bend/with-shop', '/homes-for-sale/la-pine/acreage',
  '/housing-market/redmond', '/housing-market/sisters',
  '/buy/first-time', '/buy/luxury', '/buy/investment', '/parks/drake-park', '/schools',
  // account/dashboard variants (auth redirects expected)
  '/dashboard/settings', '/dashboard/collections', '/dashboard/notifications',
  '/account/profile', '/account/saved-cities', '/account/saved-communities',
  // admin (real URLs — (protected) is a route GROUP, not a path segment)
  '/admin/login', '/admin/setup', '/admin/photos', '/admin/approval-queue',
  '/admin/analytics', '/admin/listings', '/admin/people', '/admin/blog', '/admin/cmas',
].filter(Boolean)

const results = []
for (const r of routes) {
  try {
    const resp = await page.goto(BASE + r, { waitUntil: 'load', timeout: 90000 })
    const status = resp ? resp.status() : 0
    await page.waitForTimeout(800)
    const finalUrl = page.url().replace(BASE, '')
    const bodyText = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 600) : '').catch(() => '')
    // Real crash markers only (NOT bare "500" — that matches prices like $500,000).
    const errored = /Application error|client-side exception|Unhandled Runtime Error|Internal Server Error|TypeError:|ReferenceError:|is not a function|Cannot read propert|Maximum call stack|Hydration failed/i.test(bodyText)
    const emptyShell = bodyText.replace(/\s+/g, '').length < 40
    const tag = status >= 500 || errored || emptyShell ? 'BROKEN' : (status === 404 ? '404' : (finalUrl !== r && /login|auth-error|auth/i.test(finalUrl) ? 'AUTH-REDIR' : 'OK'))
    results.push(`${tag.padEnd(10)} ${String(status).padEnd(4)} ${r}${finalUrl !== r ? '  -> ' + finalUrl : ''}`)
  } catch (e) {
    results.push(`BROKEN     ERR  ${r}  (${e.message.slice(0, 80)})`)
  }
}
await browser.close()
console.log(results.join('\n'))
const broken = results.filter((r) => r.startsWith('BROKEN'))
console.log(`\n=== ${broken.length} BROKEN of ${results.length} checked ===`)
broken.forEach((b) => console.log(b))
