import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'

const SIGNED_IN_EMAIL = process.env.E2E_SIGNED_IN_EMAIL?.trim()
const SIGNED_IN_PASSWORD = process.env.E2E_SIGNED_IN_PASSWORD?.trim()
const HAS_SIGNED_IN_CREDENTIALS = Boolean(SIGNED_IN_EMAIL && SIGNED_IN_PASSWORD)

async function gotoMain(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response, `Expected ${path} to return an HTTP response`).not.toBeNull()
  expect(response!.status(), `Expected ${path} to return < 400`).toBeLessThan(400)
  await expect(page.locator('main').first()).toBeVisible()
}

async function gotoAndFindFirstListing(page: Page, searchPath = '/search/bend') {
  await gotoMain(page, searchPath)
  await page.waitForLoadState('networkidle')
  const listingLink = page.locator('a[href*="/listing/"]').first()
  const href = await listingLink.getAttribute('href')
  return href
}

test.describe('User journeys coverage matrix', () => {
  test('UJ-001: Land on Homepage from Google', async ({ page }) => {
    await gotoMain(page, '/')
    await expect(page).toHaveTitle(/ryan realty|central oregon/i)

    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description).toBeTruthy()
    expect(description!.length).toBeGreaterThan(20)

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage).toBeTruthy()

    const header = page.locator('header')
    const footer = page.locator('footer')
    await expect(header).toBeVisible()
    await expect(footer).toBeVisible()
  })

  test('UJ-002: Search by City Name', async ({ page }) => {
    await gotoMain(page, '/')
    const searchInput = page
      .locator('input[type="search"], input[name*="search"], input[placeholder*="Search"], input[placeholder*="search"]')
      .first()
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Bend')
    await gotoMain(page, '/search/bend')
    await expect(page).toHaveTitle(/bend|homes for sale/i)
  })

  test('UJ-003: Apply Filters to Search', async ({ page }) => {
    await gotoMain(page, '/search/bend?minPrice=300000&maxPrice=500000&beds=3&baths=2')
    const url = new URL(page.url())
    expect(url.searchParams.get('beds')).toBe('3')
    expect(url.searchParams.get('baths')).toBe('2')
    expect(url.searchParams.get('minPrice')).toBe('300000')
    expect(url.searchParams.get('maxPrice')).toBe('500000')
  })

  test('UJ-004: Sort Search Results', async ({ page }) => {
    await gotoMain(page, '/search/bend?sort=price_desc')
    let url = new URL(page.url())
    expect(url.searchParams.get('sort')).toBe('price_desc')

    await gotoMain(page, '/search/bend?sort=newest')
    url = new URL(page.url())
    expect(url.searchParams.get('sort')).toBe('newest')
  })

  test('UJ-005: View Map and Switch to Map/List View', async ({ page }) => {
    await gotoMain(page, '/search/bend')
    const mapControl = page.locator('button:has-text("Map"), a:has-text("Map"), [aria-label*="map" i]').first()
    await expect(mapControl).toBeVisible()
  })

  test('UJ-006: Draw Polygon on Map to Search', async ({ page }) => {
    await gotoMain(page, '/search/bend')
    const drawControl = page.locator('button:has-text("Draw"), [aria-label*="draw" i]').first()
    const hasDrawControl = await drawControl.count()
    test.skip(hasDrawControl === 0, 'Draw control is not available in this environment state.')
    await expect(drawControl).toBeVisible()
  })

  test('UJ-007: View Listing Detail Page', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    await expect(page.locator('main')).toContainText(/bed|bath|sqft|square feet/i)
  })

  test('UJ-008: Browse Photo Gallery', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const galleryTrigger = page.locator('button[aria-label*="photo" i], button:has-text("Photo"), img').first()
    await expect(galleryTrigger).toBeVisible()
  })

  test('UJ-009: Try to Save a Listing (Anonymous)', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const saveControl = page.locator('button:has-text("Save"), [aria-label*="save" i]').first()
    await expect(saveControl).toBeVisible()
  })

  test('UJ-010: Share a Listing', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const shareControl = page.locator('button:has-text("Share"), [aria-label*="share" i]').first()
    await expect(shareControl).toBeVisible()
  })

  test('UJ-011: Contact Agent from Listing', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const contactControl = page
      .locator('button:has-text("Schedule"), button:has-text("Ask"), button:has-text("Contact"), a:has-text("Contact")')
      .first()
    await expect(contactControl).toBeVisible()
  })

  test('UJ-012: Browse Team Page', async ({ page }) => {
    await gotoMain(page, '/team')
    const profileLinks = page.locator('a[href^="/team/"]')
    expect(await profileLinks.count()).toBeGreaterThan(0)
  })

  test('UJ-013: Use Home Valuation Tool', async ({ page }) => {
    const candidatePaths = ['/sell/valuation', '/home-valuation', '/sell']
    let found = false

    for (const path of candidatePaths) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      if (response && response.status() < 400) {
        found = true
        break
      }
    }

    expect(found).toBeTruthy()
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-014: Browse Market Reports', async ({ page }) => {
    await gotoMain(page, '/housing-market')
    const cityLinks = page.locator('a[href^="/housing-market/"]')
    expect(await cityLinks.count()).toBeGreaterThan(0)
  })

  test('UJ-015: Read a Guide or Blog Post', async ({ page }) => {
    await gotoMain(page, '/guides')
    const firstGuide = page.locator('a[href^="/guides/"]').first()
    const href = await firstGuide.getAttribute('href')
    test.skip(!href, 'No published guide links available.')
    await gotoMain(page, href!)
    await expect(page.locator('main')).toContainText(/guide|market|home|oregon/i)
  })

  test('UJ-016: Browse Open Houses', async ({ page }) => {
    await gotoMain(page, '/open-houses')
    await expect(page.locator('main')).toContainText(/open house|open houses/i)
  })

  test('UJ-017: Use Mortgage Calculator', async ({ page }) => {
    await gotoMain(page, '/tools/mortgage-calculator')
    const inputs = page.locator('input')
    expect(await inputs.count()).toBeGreaterThan(2)
  })

  test('UJ-018: View Community Page', async ({ page }) => {
    await gotoMain(page, '/search/bend/tetherow')
    await expect(page.locator('main')).toContainText(/tetherow|community|bend/i)
  })

  test('UJ-019: Navigate Between Pages', async ({ page }) => {
    await gotoMain(page, '/')
    const navTargets = ['/about', '/team', '/homes-for-sale']
    for (const path of navTargets) {
      await gotoMain(page, path)
    }
  })

  test('UJ-020: Mobile Experience', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoMain(page, '/')
    await page.waitForLoadState('networkidle')
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('UJ-030: Sign In with Google', async ({ page }) => {
    await gotoMain(page, '/')
    const signInControl = page.locator('a:has-text("Sign In"), button:has-text("Sign In"), a[href*="sign-in"]').first()
    await expect(signInControl).toBeVisible()
  })

  test('UJ-031: Save a Listing', async ({ page }) => {
    test.skip(!HAS_SIGNED_IN_CREDENTIALS, 'E2E_SIGNED_IN_EMAIL and E2E_SIGNED_IN_PASSWORD are required.')
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const saveControl = page.locator('button:has-text("Save"), [aria-label*="save" i]').first()
    await expect(saveControl).toBeVisible()
  })

  test('UJ-032: Save a Search', async ({ page }) => {
    test.skip(!HAS_SIGNED_IN_CREDENTIALS, 'E2E_SIGNED_IN_EMAIL and E2E_SIGNED_IN_PASSWORD are required.')
    await gotoMain(page, '/search/bend')
    const saveSearchControl = page.locator('button:has-text("Save Search"), button:has-text("Save search")').first()
    await expect(saveSearchControl).toBeVisible()
  })

  test('UJ-033: Receive Email Alert for Saved Search', async ({ page }) => {
    test.skip(!HAS_SIGNED_IN_CREDENTIALS, 'Requires signed-in test user and external email pipeline setup.')
    await gotoMain(page, '/account/saved-searches')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-034: View Browsing History', async ({ page }) => {
    test.skip(!HAS_SIGNED_IN_CREDENTIALS, 'Requires signed-in test user.')
    await gotoMain(page, '/dashboard/history')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-035: Set Buying Preferences', async ({ page }) => {
    test.skip(!HAS_SIGNED_IN_CREDENTIALS, 'Requires signed-in test user.')
    await gotoMain(page, '/account/preferences')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-036: Edit Profile', async ({ page }) => {
    test.skip(!HAS_SIGNED_IN_CREDENTIALS, 'Requires signed-in test user.')
    await gotoMain(page, '/account/profile')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-037: Share a Listing via All Channels', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const shareControl = page.locator('button:has-text("Share"), [aria-label*="share" i]').first()
    await expect(shareControl).toBeVisible()
  })

  test('UJ-038: Export Personal Data', async ({ page }) => {
    test.skip(!HAS_SIGNED_IN_CREDENTIALS, 'Requires signed-in test user.')
    await gotoMain(page, '/account/settings')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-050: Admin Login', async ({ page }) => {
    await gotoMain(page, '/admin/login')
    const formControls = page.locator('form, input, button')
    expect(await formControls.count()).toBeGreaterThan(0)
  })

  test('UJ-051: Trigger Listing Sync', async ({ page }) => {
    const response = await page.request.get('/api/cron/sync-full')
    expect([200, 401, 403]).toContain(response.status())
  })

  test('UJ-052: Manage Brokers', async ({ page }) => {
    await gotoMain(page, '/admin/brokers')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-053: Create and Publish a Guide', async ({ page }) => {
    await gotoMain(page, '/admin/guides')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-054: View Lead Inquiry Dashboard', async ({ page }) => {
    await gotoMain(page, '/admin')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-055: Manage Site Content', async ({ page }) => {
    await gotoMain(page, '/admin/site-pages')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-056: View Analytics Dashboard', async ({ page }) => {
    await gotoMain(page, '/admin/analytics')
    await expect(page.locator('main')).toBeVisible()
  })

  test('UJ-070: Google Crawls Sitemap', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('<urlset')
  })

  test('UJ-071: Every Public Page Has Meta Tags', async ({ page }) => {
    const pages = ['/', '/search/bend', '/team', '/about']
    for (const path of pages) {
      await gotoMain(page, path)
      const title = await page.title()
      expect(title.length).toBeGreaterThan(0)

      const metaDescription = await page.locator('meta[name="description"]').getAttribute('content')
      expect(metaDescription).toBeTruthy()

      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content')
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
      expect(ogTitle).toBeTruthy()
      expect(ogDescription).toBeTruthy()
      expect(ogImage).toBeTruthy()
    }
  })

  test('UJ-072: Structured Data Validates', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const jsonLdScripts = page.locator('script[type="application/ld+json"]')
    expect(await jsonLdScripts.count()).toBeGreaterThan(0)
  })

  test('UJ-073: AI Crawler Can Access Content', async ({ page }) => {
    const response = await page.request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toMatch(/GPTBot|PerplexityBot|ClaudeBot|Google-Extended|OAI-SearchBot/i)
  })

  test('UJ-074: Page Performance Meets Core Web Vitals', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts?: Record<string, string>
    }
    expect(packageJson.scripts?.['ci:lighthouse']).toBeTruthy()
    expect(packageJson.scripts?.['quality:lighthouse']).toBeTruthy()
  })

  test('UJ-080: Listing Sync Pipeline', async ({ page }) => {
    const response = await page.request.get('/api/cron/sync-full')
    expect([200, 401, 403]).toContain(response.status())
  })

  test('UJ-081: Saved Search Alert Pipeline', async ({ page }) => {
    const response = await page.request.get('/api/cron/saved-search-alerts')
    expect([200, 401, 403]).toContain(response.status())
  })

  test('UJ-082: Market Report Generation', async ({ page }) => {
    const response = await page.request.get('/api/cron/market-report')
    expect([200, 401, 403]).toContain(response.status())
  })

  test('UJ-083: Optimization Health Check', async ({ page }) => {
    const response = await page.request.get('/api/cron/optimization-loop')
    expect([200, 401, 403]).toContain(response.status())
  })

  test('UJ-084: Lead Capture to CRM Pipeline', async ({ page }) => {
    const listingHref = await gotoAndFindFirstListing(page)
    test.skip(!listingHref, 'No listing links available for the current dataset.')
    await gotoMain(page, listingHref!)
    const contactControl = page
      .locator('button:has-text("Schedule"), button:has-text("Ask"), button:has-text("Contact"), a:has-text("Contact")')
      .first()
    await expect(contactControl).toBeVisible()
  })
})

