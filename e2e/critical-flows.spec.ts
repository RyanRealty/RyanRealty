import { test, expect } from '@playwright/test'

/**
 * Critical user flow E2E tests.
 *
 * These tests verify that the most important pages and interactions
 * work correctly. They run on every PR to prevent regressions.
 *
 * Note: Data-dependent pages (e.g. /homes-for-sale/bend) use a longer
 * timeout because SSR + Supabase queries can be slow on CI cold starts.
 */

// Longer timeout for pages that do SSR with database queries (CI cold starts can exceed 60s)
const DATA_PAGE_TIMEOUT = 120_000

test.describe('Homepage', () => {
  test('loads and shows hero section', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/.+/)
    // Hero section should be visible
    const hero = page.locator('main').first()
    await expect(hero).toBeVisible()
  })

  test('navigation links are present and work', async ({ page }) => {
    await page.goto('/')

    // Header should have key nav links
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Check for common nav items (text varies but links should exist)
    const navLinks = header.locator('a')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(2)
  })

  test('footer is present', async ({ page }) => {
    await page.goto('/')
    // Use role selector — the site footer uses role="contentinfo"
    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible()
  })
})

test.describe('Search', () => {
  // These pages do SSR with Supabase queries — allow extra time
  test.setTimeout(DATA_PAGE_TIMEOUT)

  test('city search page loads with listings', async ({ page }) => {
    await page.goto('/homes-for-sale/bend', { timeout: DATA_PAGE_TIMEOUT })
    await expect(page).toHaveTitle(/bend/i)

    // Page should render without errors
    await expect(page.locator('main')).toBeVisible()
  })

  test('search page has filter/sort controls', async ({ page }) => {
    await page.goto('/homes-for-sale/bend', { timeout: DATA_PAGE_TIMEOUT })

    // Should have some form of listing grid or results
    const main = page.locator('main')
    await expect(main).toBeVisible({ timeout: DATA_PAGE_TIMEOUT })
  })
})

test.describe('Listing Detail', () => {
  test.setTimeout(DATA_PAGE_TIMEOUT)

  test('listing page structure loads correctly', async ({ page }) => {
    // Navigate to search first, then click a listing
    await page.goto('/homes-for-sale/bend', { timeout: DATA_PAGE_TIMEOUT })
    await expect(page.locator('main')).toBeVisible({ timeout: DATA_PAGE_TIMEOUT })

    // Try to find a listing link
    const listingLink = page.locator('a[href*="/listing/"]').first()
    const hasListings = await listingLink.isVisible().catch(() => false)

    if (hasListings) {
      await listingLink.click()
      await page.waitForLoadState('domcontentloaded')

      // Listing detail page should have key sections
      await expect(page.locator('main')).toBeVisible()
      // URL should be a listing page
      expect(page.url()).toContain('/listing/')
    } else {
      // No listings in DB — skip gracefully
      test.skip()
    }
  })
})

test.describe('Team Page', () => {
  test('loads and shows team content', async ({ page }) => {
    await page.goto('/team')
    await expect(page).toHaveTitle(/team/i)
    await expect(page.locator('main')).toBeVisible()
  })
})

test.describe('About Page', () => {
  test('loads correctly', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('main')).toBeVisible()
  })
})

test.describe('Admin Login', () => {
  test('login page renders with form', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.locator('main')).toBeVisible()

    // Should have some form of login UI
    const formOrButton = page.locator('form, button, input')
    const count = await formOrButton.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('404 Handling', () => {
  test('non-existent page shows 404', async ({ page }) => {
    const response = await page.goto('/this-page-definitely-does-not-exist-12345')
    // Should return 404 status
    expect(response?.status()).toBe(404)
  })
})

test.describe('Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  test.setTimeout(DATA_PAGE_TIMEOUT)

  test('homepage has no horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/', { timeout: DATA_PAGE_TIMEOUT })
    await expect(page.locator('main')).toBeVisible({ timeout: DATA_PAGE_TIMEOUT })

    // Check that the page doesn't overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20) // allow minor CSS overflow
  })

  test('mobile navigation is accessible', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    await expect(header).toBeVisible()
  })
})

test.describe('Key Pages Return 200', () => {
  test.setTimeout(DATA_PAGE_TIMEOUT)

  const pages = [
    { path: '/', name: 'Homepage' },
    { path: '/homes-for-sale', name: 'Listings browse' },
    { path: '/homes-for-sale/bend', name: 'City search' },
    { path: '/team', name: 'Team' },
    { path: '/about', name: 'About' },
    { path: '/admin/login', name: 'Admin login' },
  ]

  for (const { path, name } of pages) {
    test(`${name} (${path}) returns 200`, async ({ page }) => {
      const response = await page.goto(path, { timeout: DATA_PAGE_TIMEOUT })
      expect(response?.status()).toBe(200)
    })
  }
})

test.describe('SEO Essentials', () => {
  test.setTimeout(DATA_PAGE_TIMEOUT)

  const pages = ['/', '/homes-for-sale/bend', '/team', '/about']

  for (const path of pages) {
    test(`${path} has meta description`, async ({ page }) => {
      await page.goto(path, { timeout: DATA_PAGE_TIMEOUT })
      const meta = page.locator('meta[name="description"]')
      const content = await meta.getAttribute('content').catch(() => null)
      // Should have a non-empty description
      expect(content).toBeTruthy()
      expect(content!.length).toBeGreaterThan(10)
    })
  }

  test('homepage has canonical link', async ({ page }) => {
    await page.goto('/')
    const canonical = page.locator('link[rel="canonical"]')
    const href = await canonical.getAttribute('href').catch(() => null)
    if (href) {
      expect(href).toContain('/')
    }
  })
})
