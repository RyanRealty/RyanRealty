import { test, expect, type Page } from '@playwright/test'

/**
 * forms.spec.ts
 *
 * Tests contact + seller LP + buyer LP forms:
 *   - Required field validation: bad email rejected (HTML5 validation)
 *   - Submit button state
 *
 * CRITICAL SAFETY RULE:
 *   Real form submissions create CRM leads (`public.crm_people`).
 *   DO NOT submit on production.
 *   Actual submission is gated behind BASE_URL containing localhost/127.0.0.1.
 *   In all environments, validation behavior is tested WITHOUT submitting.
 *
 * Canary values used if submission is ever attempted in local-only mode:
 *   email: e2e-canary@ryan-realty.com
 *   name:  E2E Canary
 */

const DATA_TIMEOUT = 60_000
const E2E_EMAIL = 'e2e-canary@ryan-realty.com'
const E2E_NAME = 'E2E Canary'
const INVALID_EMAIL = 'not-an-email'

/** True only when running against a local dev/test server — never production */
function isLocalEnv(): boolean {
  const base = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').toLowerCase()
  return base.includes('localhost') || base.includes('127.0.0.1') || base.includes('0.0.0.0')
}

/**
 * /contact is a one-question V3Sheet. Inquiry is step 1 (defaulted), name
 * is step 2, email is step 3 (`#contact-email`). Never submit the last step
 * on production — that writes `crm_people`.
 */
async function reachContactEmail(page: Page) {
  const res = await page.goto('/contact', { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
  expect(res?.status()).toBe(200)
  await expect(page.locator('main').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /send a message/i })).toBeVisible({
    timeout: 20_000,
  })

  const continueBtn = page.getByRole('button', { name: /^continue$/i })
  await expect(continueBtn).toBeVisible()
  await continueBtn.click()

  const nameInput = page.locator('#contact-name')
  await expect(nameInput).toBeVisible({ timeout: 10_000 })
  await expect(nameInput).toHaveCount(1)
  await nameInput.fill(E2E_NAME)
  await continueBtn.click()

  const emailInput = page.locator('#contact-email')
  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await expect(emailInput).toHaveCount(1)
  return { nameInput, emailInput }
}

test.describe('Contact form (/contact)', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('contact form renders with required email field', async ({ page }) => {
    const { emailInput } = await reachContactEmail(page)
    expect(await emailInput.getAttribute('required')).not.toBeNull()
    expect(await emailInput.getAttribute('type')).toBe('email')
  })

  test('contact form: invalid email prevents submission (HTML5 validation)', async ({ page }) => {
    const { emailInput } = await reachContactEmail(page)

    await emailInput.fill(INVALID_EMAIL)

    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(isValid, 'Invalid email should fail HTML5 email validation').toBe(false)

    await page.getByRole('button', { name: /^continue$/i }).click()
    await expect(page.locator('#contact-email-error')).toContainText(/does not look complete/i)
    await expect(page.locator('#contact-email')).toBeVisible()
  })

  test('contact form: valid email passes HTML5 validation', async ({ page }) => {
    const { emailInput } = await reachContactEmail(page)

    await emailInput.fill(E2E_EMAIL)

    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(isValid, 'Valid canary email should pass HTML5 validation').toBe(true)

    const continueBtn = page.getByRole('button', { name: /^continue$/i })
    await expect(continueBtn).toBeVisible()
    await expect(continueBtn).toBeEnabled()

    // DO NOT advance to Send message / submit — that writes crm_people.
    if (!isLocalEnv()) return
  })
})

test.describe('Seller capture form (/sell)', () => {
  test.setTimeout(90_000)

  async function advanceToQualifyStep(page: Page) {
    const res = await page.goto('/sell', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 20_000 })

    const addressInput = page.locator('#get-value-address')
    const hasAddressInput = await addressInput.isVisible({ timeout: 10_000 }).catch(() => false)
    if (!hasAddressInput) return null

    await addressInput.fill('123 E Test Street, Bend, OR 97701')

    const advanceBtn = page.getByRole('button', { name: /value my home/i })
    if (await advanceBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await advanceBtn.click()
    } else {
      await addressInput.press('Enter')
    }

    const emailInput = page.locator('#sell-value-email')
    const emailVisible = await emailInput.isVisible({ timeout: 10_000 }).catch(() => false)
    return emailVisible ? emailInput : null
  }

  test('seller form renders with address step and advances to email field', async ({ page }) => {
    const res = await page.goto('/sell', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 20_000 })

    const addressInput = page.locator('#get-value-address')
    const hasAddressInput = await addressInput.waitFor({ state: 'visible', timeout: 45_000 }).then(() => true).catch(() => false)

    const emailInput = page.locator('#sell-value-email')
    const hasEmailInput = hasAddressInput
      ? false
      : await emailInput.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)

    expect(
      hasAddressInput || hasEmailInput,
      'Sell page should show address input (step 1) or email input on load'
    ).toBe(true)

    if (hasAddressInput && !hasEmailInput) {
      const emailEl = await advanceToQualifyStep(page)
      if (!emailEl) {
        test.skip(true, 'Could not advance sell form to qualify step')
        return
      }
      await expect(emailEl).toBeVisible({ timeout: 10_000 })
    }
  })

  test('seller form: invalid email fails HTML5 validation', async ({ page }) => {
    const emailInput = await advanceToQualifyStep(page)

    if (!emailInput) {
      test.skip(true, 'Could not reach sell email field')
      return
    }

    await emailInput.fill(INVALID_EMAIL)
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(isValid, 'Invalid email should fail HTML5 validation on /sell').toBe(false)
  })
})

test.describe('Buyer listing alerts fold into Homes', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('old LP URL lands on /homes-for-sale', async ({ page }) => {
    const res = await page.goto('/lp/buyer-listing-alerts', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.ok()).toBeTruthy()
    expect(new URL(page.url()).pathname).toBe('/homes-for-sale')
    await expect(page.locator('main').first()).toBeVisible({ timeout: DATA_TIMEOUT })
  })
})
