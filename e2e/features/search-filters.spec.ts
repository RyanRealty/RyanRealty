import { test, expect, type Locator, type Page } from '@playwright/test'

/**
 * search-filters.spec.ts
 *
 * Exercises SearchFilters (the regional Field chrome) on /homes-for-sale/bend.
 * City browse defaults to the same MapSearchView split as /homes-for-sale.
 *   - Price dropdown: set max price, Enter → URL param updates
 *   - Beds dropdown: pick 3+ → beds param in URL
 *   - URL-seeded filters are reflected back in the dropdown inputs
 *
 * Selectors are grounded in components/search/SearchFilters.tsx:
 *   - Price:   <Button>Price</Button> → input[name="maxPrice"]
 *   - Beds:    <Button>Beds</Button> → 3+ chip
 *
 * Note: /homes-for-sale/bend is rewritten to /search/bend in next.config.ts,
 * which renders app/search/[...slug]/page.tsx. Grid/list still uses
 * SearchFilterBar; the default city split uses SearchFilters.
 */

const DATA_TIMEOUT = 90_000
const SEARCH_URL = '/homes-for-sale/bend'

/** Open the All filters sheet (components/search/AllFiltersSheet.tsx) and return it. */
async function openAllFilters(page: Page): Promise<Locator> {
  const open = page.getByRole('button', { name: /^all filters/i })
  await expect(open).toBeVisible({ timeout: DATA_TIMEOUT })
  await open.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible({ timeout: 10_000 })
  return sheet
}

/** The sheet's apply button ("Show N homes" or "Apply filters"), beside Reset in its footer. */
function applyButton(sheet: Locator): Locator {
  return sheet.locator('[data-slot="sheet-footer"]').getByRole('button').filter({ hasNotText: /^reset$/i })
}

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

    // Price is typed in All filters: the bar's Price pill is sheet-only since
    // SITE-110 (.srch-chip--sheet), and the dock carries the price slider.
    const sheet = await openAllFilters(page)
    const maxPriceInput = sheet.getByLabel('Price maximum')
    await expect(maxPriceInput).toBeVisible({ timeout: 10_000 })
    await maxPriceInput.fill('750000')

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get('maxPrice') === '750000', {
        timeout: DATA_TIMEOUT,
      }),
      applyButton(sheet).click(),
    ])

    const bedsButton = page.getByRole('button', { name: /^beds/i })
    await expect(bedsButton).toBeVisible({ timeout: DATA_TIMEOUT })
    await bedsButton.click()

    await Promise.all([
      page.waitForURL((url) => url.searchParams.has('beds') && url.searchParams.has('maxPrice'), {
        timeout: DATA_TIMEOUT,
      }),
      page.getByRole('button', { name: '3+' }).click(),
    ])

    const url = new URL(page.url())
    expect(url.searchParams.get('beds')).toBe('3')
    expect(url.searchParams.get('maxPrice')).toBe('750000')

    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
  })

  test('URL-seeded filters reflect in the bar; clean URL clears them', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    })

    await page.goto(`${SEARCH_URL}?beds=4&maxPrice=1000000`, {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    const sheet = await openAllFilters(page)
    const maxPriceInput = sheet.getByLabel('Price maximum')
    await expect(maxPriceInput).toBeVisible({ timeout: 10_000 })
    await expect(maxPriceInput).toHaveValue('1000000')
    await page.keyboard.press('Escape')

    await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })

    const url = new URL(page.url())
    expect(url.searchParams.has('beds')).toBe(false)
    expect(url.searchParams.has('maxPrice')).toBe(false)

    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
  })
})
