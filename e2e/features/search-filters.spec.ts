import { test, expect } from '@playwright/test'

/**
 * search-filters.spec.ts
 *
 * Exercises the shared SearchFilterBar (registry-driven chip bar + All-filters
 * sheet) on /homes-for-sale/bend:
 *   - Price dropdown: set max price, Apply → URL param updates
 *   - Beds & Baths dropdown: set beds, Apply → both params in URL
 *   - URL-seeded filters are reflected back in the dropdown inputs
 *
 * Selectors are grounded in components/SearchFilterBar.tsx:
 *   - Price:   <Button>Price</Button> → dropdown form with <Input name="maxPrice" />
 *   - Beds:    <Button>Beds & Baths</Button> → #filter-beds-N chip radios
 *   - Apply:   each dropdown form's <Button type="submit">Apply</Button>
 *
 * Note: /homes-for-sale/bend is rewritten to /search/bend in next.config.ts,
 * which renders app/search/[...slug]/page.tsx with SearchFilterBar (the same
 * AllFiltersSheet registry surface as /homes-for-sale).
 */

const DATA_TIMEOUT = 90_000
const SEARCH_URL = '/homes-for-sale/bend'

test.describe('Search filters', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('set max price and beds via the chip bar — URL updates', async ({ page }) => {
    // Pre-dismiss the sign-in prompt that auto-pops after 1s on anonymous visits.
    // SignInPrompt.tsx reads 'ryan_realty_signin_prompt_dismissed' from localStorage.
    await page.addInitScript(() => {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    })

    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    // Open the Price dropdown and set a max price.
    const priceButton = page.getByRole('button', { name: /^price$/i })
    await expect(priceButton).toBeVisible({ timeout: DATA_TIMEOUT })
    await priceButton.click()

    const maxPriceInput = page.locator('input[name="maxPrice"]')
    await expect(maxPriceInput).toBeVisible({ timeout: 10_000 })
    await maxPriceInput.fill('750000')

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get('maxPrice') === '750000', {
        timeout: DATA_TIMEOUT,
      }),
      page.getByRole('button', { name: /^apply/i }).first().click(),
    ])

    // Open Beds & Baths and pick 3+ via the labeled chip (sr-only radio).
    const bedsButton = page.getByRole('button', { name: /beds & baths/i })
    await expect(bedsButton).toBeVisible({ timeout: DATA_TIMEOUT })
    await bedsButton.click()

    const bedsRadio = page.locator('#filter-beds-3')
    await bedsRadio.waitFor({ state: 'attached', timeout: 10_000 })
    await page.locator('label[for="filter-beds-3"]').click()
    await expect(bedsRadio).toBeChecked()

    const bedsForm = page.locator('form').filter({ has: bedsRadio })
    await Promise.all([
      page.waitForURL((url) => url.searchParams.has('beds') && url.searchParams.has('maxPrice'), {
        timeout: DATA_TIMEOUT,
      }),
      bedsForm.getByRole('button', { name: /^apply/i }).click(),
    ])

    // Assert URL params are set correctly (buildParams carries maxPrice forward).
    const url = new URL(page.url())
    expect(url.searchParams.get('beds')).toBe('3')
    expect(url.searchParams.get('maxPrice')).toBe('750000')

    // Page should re-render without an application error.
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
  })

  test('URL-seeded filters reflect in the bar; clean URL clears them', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    })

    // Start with filters applied via URL.
    await page.goto(`${SEARCH_URL}?beds=4&maxPrice=1000000`, {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    // The Price dropdown reflects the URL-seeded max price.
    const priceButton = page.getByRole('button', { name: /^price$/i })
    await expect(priceButton).toBeVisible({ timeout: DATA_TIMEOUT })
    await priceButton.click()
    const maxPriceInput = page.locator('input[name="maxPrice"]')
    await expect(maxPriceInput).toBeVisible({ timeout: 10_000 })
    await expect(maxPriceInput).toHaveValue('1000000')

    // Navigate to the clean search URL to simulate "clear".
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    // No filter params in URL.
    const url = new URL(page.url())
    expect(url.searchParams.has('beds')).toBe(false)
    expect(url.searchParams.has('maxPrice')).toBe(false)

    // Page renders without errors.
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
  })
})
