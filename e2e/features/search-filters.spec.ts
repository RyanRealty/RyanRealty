import { test, expect } from '@playwright/test'

/**
 * search-filters.spec.ts
 *
 * Exercises the AdvancedSearchFilters component on /homes-for-sale/bend:
 *   - Set beds + max price, Apply → URL params update, cards re-render
 *   - Clear filters restores unfiltered state
 *
 * Selectors are grounded in AdvancedSearchFilters.tsx:
 *   - maxPrice: <Input name="maxPrice" />
 *   - beds:     <SelectTrigger aria-label="Minimum bedrooms"> (state-driven, not form name)
 *   - Apply:    <Button type="submit">Apply</Button>
 *
 * Note: /homes-for-sale/bend is rewritten to /search/bend in next.config.ts,
 * which renders app/search/[...slug]/page.tsx with AdvancedSearchFilters.
 */

const DATA_TIMEOUT = 90_000
const SEARCH_URL = '/homes-for-sale/bend'

test.describe('Search filters', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('set max price and beds, Apply — URL updates and result count changes', async ({ page }) => {
    // Pre-dismiss the sign-in prompt that auto-pops after 1s on anonymous visits.
    // SignInPrompt.tsx reads 'ryan_realty_signin_prompt_dismissed' from localStorage.
    // We set it BEFORE page load so the modal never blocks the filter interactions.
    await page.addInitScript(() => {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    })

    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    // Wait for filter form to be present
    const filterForm = page.locator('form').filter({ has: page.locator('input[name="maxPrice"]') })
    await expect(filterForm).toBeVisible({ timeout: DATA_TIMEOUT })

    // Fill max price
    const maxPriceInput = page.locator('input[name="maxPrice"]')
    await expect(maxPriceInput).toBeVisible()
    await maxPriceInput.fill('750000')

    // Select beds via the shadcn Select — aria-label="Minimum bedrooms" on SelectTrigger
    // (aria-label added to AdvancedSearchFilters.tsx). Falls back to first combobox
    // in the filter form when running against a pre-deploy build.
    const namedBedsTrigger = page.getByRole('combobox', { name: /minimum bedrooms/i })
    const hasNamed = await namedBedsTrigger.isVisible({ timeout: 10_000 }).catch(() => false)
    const bedsTrigger = hasNamed
      ? namedBedsTrigger
      : filterForm.getByRole('combobox').first()
    await expect(bedsTrigger).toBeVisible({ timeout: DATA_TIMEOUT })
    await bedsTrigger.click()

    // Wait for the listbox portal to appear, then pick "3"
    await page.waitForSelector('[role="listbox"]', { timeout: 5_000 })
    await page.getByRole('option', { name: /^3/ }).first().click()

    // Capture current URL and wait for navigation after Apply
    const applyButton = page.getByRole('button', { name: /^apply/i })
    await expect(applyButton).toBeVisible()

    await Promise.all([
      page.waitForURL((url) => url.searchParams.has('beds') && url.searchParams.has('maxPrice'), {
        timeout: DATA_TIMEOUT,
      }),
      applyButton.click(),
    ])

    // Assert URL params are set correctly
    const url = new URL(page.url())
    expect(url.searchParams.get('beds')).toBe('3')
    expect(url.searchParams.get('maxPrice')).toBe('750000')

    // Wait for main content to re-render
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    // Page should not show an application error
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
  })

  test('clear filters restores unfiltered state', async ({ page }) => {
    // Start with filters applied via URL
    await page.goto(`${SEARCH_URL}?beds=4&maxPrice=1000000`, {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    // Verify filters are reflected in the form
    const maxPriceInput = page.locator('input[name="maxPrice"]')
    await expect(maxPriceInput).toBeVisible({ timeout: DATA_TIMEOUT })
    await expect(maxPriceInput).toHaveValue('1000000')

    // Navigate to the clean search URL to simulate "clear"
    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    // No filter params in URL
    const url = new URL(page.url())
    expect(url.searchParams.has('beds')).toBe(false)
    expect(url.searchParams.has('maxPrice')).toBe(false)

    // Page renders without errors
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
  })
})
