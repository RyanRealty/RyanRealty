/**
 * probe-page-types.mjs — headless client-error sweep across every page TYPE.
 *
 * Server-200 does NOT mean a page works: the systemic bugs this repo has hit
 * (React #418 hydration mismatch, `google.maps` read before the API loads →
 * "Cannot read properties of undefined (reading 'RIGHT_TOP')") all render valid
 * server HTML and then DIE on the client. This probe opens each representative
 * page type in headless Chromium and fails if ANY of these surface:
 *   - an uncaught exception (`pageerror`)
 *   - a console error matching a known-crash signature (RIGHT_TOP, hydration,
 *     Minified React error #418/#423, "Cannot read properties", "google is not defined")
 *   - the error-boundary text ("Something went wrong" / "Application error")
 *   - a non-200 navigation status (404 tolerated only for pages marked optional)
 *
 * Service workers are BLOCKED so the probe tests the page code, not a stale SW
 * cached from the old AgentFire site (that is a browser-cache issue, not a code bug).
 *
 * Usage:
 *   npm run build && npm run start:ci &        # serve a prod build on :3000
 *   NODE_PATH=$PWD/node_modules \
 *     SMOKE_BASE_URL=http://127.0.0.1:3000 \
 *     [SMOKE_LISTING_KEY=/listing/...] \
 *     node scripts/probe-page-types.mjs
 *
 * Exit 0 = every page type clean. Exit 1 = at least one broken page (details printed).
 */
import { chromium } from 'playwright'

const BASE = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const NAV_TIMEOUT = 45_000
const HYDRATE_WAIT = 2_500 // let the client tree hydrate so #418 / map crashes surface

/** Console-error substrings that mean a real client crash (not a benign warning). */
const CRASH_SIGNATURES = [
  'RIGHT_TOP',
  'Cannot read properties of undefined',
  'Cannot read properties of null',
  'google is not defined',
  'Minified React error #418',
  'Minified React error #423',
  'Minified React error #425',
  'Hydration failed',
  'There was an error while hydrating',
  'Text content does not match',
]

/** Representative page types. optional=true tolerates a 404 (page may not exist on this build). */
const PAGE_TYPES = [
  { name: 'home', url: '/' },
  { name: 'housing-market hub', url: '/housing-market' },
  { name: 'reports', url: '/reports' },
  { name: 'search city', url: '/homes-for-sale/bend' },
  { name: 'search city/preset', url: '/homes-for-sale/bend/under-750k' },
  { name: 'search city/subdivision', url: '/homes-for-sale/bend/tetherow' },
  { name: 'search subdivision/preset', url: '/homes-for-sale/bend/tetherow/luxury' },
  { name: 'search region root', url: '/homes-for-sale' },
  { name: 'cities/[slug] (map)', url: '/cities/bend' },
  { name: 'communities/[slug] (map)', url: '/communities/tetherow' },
  { name: 'subdivisions/[slug] (map)', url: '/subdivisions/tetherow' },
  { name: 'zip/[zip]', url: '/zip/97703' },
  { name: 'motivated-sellers', url: '/motivated-sellers' },
  { name: 'area-guides', url: '/area-guides' },
  { name: 'team', url: '/team' },
  { name: 'open-houses', url: '/open-houses' },
  { name: 'buy', url: '/buy', optional: true },
  { name: 'sell', url: '/sell', optional: true },
]

async function discoverFirstLink(page, fromPath, matchSource) {
  // matchSource is the BODY of a predicate (h) => ... evaluated in the browser.
  try {
    await page.goto(`${BASE}${fromPath}`, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    return await page.evaluate((src) => {
      // eslint-disable-next-line no-new-func
      const isMatch = new Function('h', src)
      const links = Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') || '')
      return links.find((h) => h && !/^https?:\/\//.test(h) && isMatch(h)) || null
    }, matchSource)
  } catch {
    return null
  }
}

async function discoverListingUrl(page) {
  if (process.env.SMOKE_LISTING_KEY) return process.env.SMOKE_LISTING_KEY
  // A real listing-detail link ends in a long MLS-style numeric suffix or /listing/<key>.
  return discoverFirstLink(page, '/homes-for-sale/bend', 'return /\\/listing\\//.test(h) || /-\\d{6,}(?:[/?#]|$)/.test(h)')
}

async function discoverNeighborhoodUrl(page) {
  // A neighborhood link is /cities/<city>/<neighborhood> (exactly two path segments under /cities).
  return discoverFirstLink(page, '/cities/bend', 'return /^\\/cities\\/[^/]+\\/[^/?#]+(?:[/?#]|$)/.test(h)')
}

async function probe(context, name, url, optional) {
  const page = await context.newPage()
  const pageErrors = []
  const crashConsole = []
  page.on('pageerror', (err) => pageErrors.push((err?.message || String(err)).slice(0, 240)))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (CRASH_SIGNATURES.some((sig) => text.includes(sig))) crashConsole.push(text.slice(0, 240))
  })

  const problems = []
  let status = 0
  try {
    const resp = await page.goto(`${BASE}${url}`, { timeout: NAV_TIMEOUT, waitUntil: 'networkidle' })
    status = resp?.status() ?? 0
    await page.waitForTimeout(HYDRATE_WAIT)

    if (status !== 200 && !(optional && status === 404)) {
      problems.push(`HTTP ${status}`)
    }
    const boundary = await page.locator('text="Something went wrong"').first().isVisible().catch(() => false)
    if (boundary) problems.push('error boundary: "Something went wrong"')
    const appError = await page.locator('text="Application error"').first().isVisible().catch(() => false)
    if (appError) problems.push('Next.js "Application error"')
  } catch (err) {
    problems.push(`navigation failed: ${(err?.message || String(err)).slice(0, 120)}`)
  }

  if (pageErrors.length) problems.push(`pageerror: ${[...new Set(pageErrors)].join(' | ')}`)
  if (crashConsole.length) problems.push(`crash console: ${[...new Set(crashConsole)].join(' | ')}`)

  await page.close()
  return { name, url, status, ok: problems.length === 0, problems }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    serviceWorkers: 'block',
  })

  const discoveryPage = await context.newPage()
  const listingUrl = await discoverListingUrl(discoveryPage)
  const neighborhoodUrl = await discoverNeighborhoodUrl(discoveryPage)
  await discoveryPage.close()

  const targets = [...PAGE_TYPES]
  // Insert the map-heavy neighborhood page (real, discovered slug) right after cities/[slug].
  const citiesIdx = targets.findIndex((t) => t.name === 'cities/[slug] (map)')
  if (neighborhoodUrl) {
    targets.splice(citiesIdx + 1, 0, { name: 'cities/[slug]/[neighborhood] (map)', url: neighborhoodUrl })
  } else {
    console.log('⚠️  Could not discover a neighborhood URL from /cities/bend — skipping that map page type.')
  }
  if (listingUrl) {
    targets.splice(targets.findIndex((t) => t.name === 'communities/[slug] (map)'), 0, { name: 'listing detail', url: listingUrl })
  } else {
    console.log('⚠️  Could not discover a listing-detail URL — skipping that page type. Set SMOKE_LISTING_KEY to force it.')
  }

  console.log(`\nProbing ${targets.length} page types at ${BASE}\n`)
  const results = []
  for (const t of targets) {
    const r = await probe(context, t.name, t.url, t.optional)
    results.push(r)
    const icon = r.ok ? '✅' : '🔴'
    console.log(`${icon} ${String(r.status).padStart(3)}  ${t.name.padEnd(34)} ${t.url}`)
    if (!r.ok) r.problems.forEach((p) => console.log(`        └─ ${p}`))
  }

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} page types clean.`)
  if (failed.length) {
    console.log(`\n🔴 ${failed.length} BROKEN page type(s):`)
    failed.forEach((r) => console.log(`   ${r.name} (${r.url}) — ${r.problems.join('; ')}`))
    process.exit(1)
  }
  console.log('All page types render without client errors.')
}

main().catch((err) => {
  console.error('Probe harness failed:', err)
  process.exit(1)
})
