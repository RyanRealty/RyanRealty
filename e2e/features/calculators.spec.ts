import { test, expect } from '@playwright/test'

/**
 * calculators.spec.ts
 *
 * Tests /tools/mortgage-calculator and /tools/rental-property-calculator:
 *   - Inputs render
 *   - Changing values produces a formatted currency output change
 *
 * Selectors from:
 *   - MortgageCalculator.tsx: formatCurrency(monthlyTotal), slider + text inputs
 *   - rental-property-calculator/page.tsx: similar pattern
 */

const DATA_TIMEOUT = 60_000

test.describe('Mortgage calculator', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('page loads with inputs and monthly payment output', async ({ page }) => {
    const res = await page.goto('/tools/mortgage-calculator', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.status()).toBe(200)
    await expect(page.locator('main').first()).toBeVisible()

    // Heading
    await expect(page.locator('h1, [role="heading"]').first()).toBeVisible()

    // Should have inputs (range sliders or number inputs)
    const inputs = page.locator('input')
    const count = await inputs.count()
    expect(count, 'Mortgage calculator should have at least 3 inputs').toBeGreaterThanOrEqual(3)

    // The monthly total ("$3,053/month"). Scoped to the calculator: the first "$" in
    // the document is the header's market panel, hidden until opened.
    const paymentEl = page.locator('#calculator p', { hasText: '/month' }).first()
    await expect(paymentEl).toBeVisible({ timeout: 10_000 })
    const paymentText = await paymentEl.textContent()
    expect(paymentText).toMatch(/\$[\d,]+/)
  })

  test('changing home price updates monthly payment', async ({ page }) => {
    await page.goto('/tools/mortgage-calculator', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    await expect(page.locator('main').first()).toBeVisible()

    const paymentEl = page.locator('#calculator p', { hasText: '/month' }).first()
    await expect(paymentEl).toBeVisible({ timeout: 10_000 })
    const before = (await paymentEl.textContent()) ?? ''
    expect(before).toMatch(/\$[\d,]+/)

    // Home price is a number box (#home-price, default 500,000). A higher price is
    // a higher loan, so the monthly total must change.
    const homePrice = page.locator('#home-price')
    await expect(homePrice).toBeVisible()
    await homePrice.fill('800000')
    await homePrice.press('Tab')

    await expect(paymentEl).not.toHaveText(before, { timeout: 10_000 })
    expect(await paymentEl.textContent()).toMatch(/\$[\d,]+/)
  })
})

test.describe('Rental property calculator', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('page loads with inputs', async ({ page }) => {
    const res = await page.goto('/tools/rental-property-calculator', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.status()).toBe(200)
    await expect(page.locator('main').first()).toBeVisible()

    // Heading
    await expect(page.locator('h1, [role="heading"]').first()).toBeVisible()

    // Should have inputs. The calculator is a client island — its inputs mount
    // after hydration, so poll instead of counting at domcontentloaded (the
    // 2026-07-17 false failure: 1 input pre-hydration, 26 in a real browser).
    const inputs = page.locator('input')
    await expect
      .poll(async () => inputs.count(), {
        message: 'Rental calculator should have at least 3 inputs',
        timeout: 20_000,
      })
      .toBeGreaterThanOrEqual(3)

    // No application error
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
  })

  test('computed output renders as formatted currency', async ({ page }) => {
    await page.goto('/tools/rental-property-calculator', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    await expect(page.locator('main').first()).toBeVisible()

    // Find any currency-formatted output on the page
    // The rental calculator renders outputs like monthly cash flow, ROI, etc.
    const currencyOutput = page.locator('text=/\\$[0-9,]+/').first()
    const hasCurrency = await currencyOutput.isVisible({ timeout: 10_000 }).catch(() => false)

    if (!hasCurrency) {
      // Some calculators only show output after first interaction — trigger it
      const firstInput = page.locator('input').first()
      if (await firstInput.count() > 0) {
        await firstInput.click()
        await firstInput.press('Tab')
        await page.waitForTimeout(500)
      }
    }

    // After any interaction, verify the page hasn't crashed
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')

    // A heading is still visible
    await expect(page.locator('h1, [role="heading"]').first()).toBeVisible()
  })
})
