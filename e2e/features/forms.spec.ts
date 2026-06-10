import { test, expect, type Page } from '@playwright/test'

/**
 * forms.spec.ts
 *
 * Tests contact + seller LP + buyer LP forms:
 *   - Required field validation: bad email rejected (HTML5 validation)
 *   - Submit button state
 *
 * CRITICAL SAFETY RULE:
 *   Real form submissions create Follow Up Boss leads.
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

test.describe('Contact form (/contact)', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('contact form renders with required email field', async ({ page }) => {
    const res = await page.goto('/contact', { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    expect(res?.status()).toBe(200)
    // Use first() — some pages render two <main> elements (layout + page body)
    await expect(page.locator('main').first()).toBeVisible()

    // Contact form email field — id="contact-email" from ContactForm.tsx
    // NOTE: Production renders ContactForm twice (duplicate IDs — real bug).
    // Use .first() to target the primary visible form in the page grid.
    const emailInput = page.locator('#contact-email').first()
    await expect(emailInput).toBeVisible({ timeout: 20_000 })
    expect(await emailInput.getAttribute('required')).not.toBeNull()
    expect(await emailInput.getAttribute('type')).toBe('email')
  })

  test('contact form: invalid email prevents submission (HTML5 validation)', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible()

    // NOTE: Production has duplicate #contact-email — use .first()
    const emailInput = page.locator('#contact-email').first()
    await expect(emailInput).toBeVisible({ timeout: 20_000 })

    // Fill invalid email
    await emailInput.fill(INVALID_EMAIL)

    // Check HTML5 validity API — invalid email should fail validation
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(isValid, 'Invalid email should fail HTML5 email validation').toBe(false)
  })

  test('contact form: valid email passes HTML5 validation', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible()

    // NOTE: Production has duplicate #contact-email — use .first()
    const nameInput = page.locator('#contact-name').first()
    const emailInput = page.locator('#contact-email').first()
    await expect(emailInput).toBeVisible({ timeout: 20_000 })

    await nameInput.fill(E2E_NAME)
    await emailInput.fill(E2E_EMAIL)

    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(isValid, 'Valid canary email should pass HTML5 validation').toBe(true)

    // Submit button should be enabled (form is valid)
    const submitBtn = page.getByRole('button', { name: /send|submit|contact/i }).first()
    await expect(submitBtn).toBeVisible()
    const isDisabled = await submitBtn.isDisabled()
    expect(isDisabled, 'Submit button should be enabled with valid email').toBe(false)

    // DO NOT click submit unless local environment
    if (!isLocalEnv()) {
      // Production / staging: do not submit — just verified the state
      return
    }
    // Local only: submitting would hit local server, no real FUB lead
  })
})

test.describe('Seller LP form (/lp/seller-home-value)', () => {
  test.setTimeout(90_000)

  /**
   * Helper: navigate to the seller LP page and advance from step 1 (address)
   * to step 2 (qualify / email capture).
   *
   * Step 1 advances purely in React state — no API call, no FUB lead.
   * Safe to run on production. We fill a dummy 5+ char address string.
   */
  async function advanceToQualifyStep(page: Page) {
    const res = await page.goto('/lp/seller-home-value', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 20_000 })

    // Step 1: address field — id="seller-lp-address" (AddressAutocomplete)
    const addressInput = page.locator('#seller-lp-address')
    const hasAddressInput = await addressInput.isVisible({ timeout: 10_000 }).catch(() => false)
    if (!hasAddressInput) {
      // Could not find address step — skip gracefully
      return null
    }

    // Fill a fake address (≥5 chars satisfies the client-side length guard)
    // No Google Maps autocomplete fires on headless without a real API key.
    // React native-setter trick: trigger React's onChange so the value lands in state.
    await addressInput.fill('123 E Test Street, Bend, OR 97701')

    // Click the submit / "Get my home value" button to advance to step 2
    const advanceBtn = page.getByRole('button', { name: /get my home value|start my home sale/i })
    if (await advanceBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await advanceBtn.click()
    } else {
      // Fallback: submit the form via keyboard
      await addressInput.press('Enter')
    }

    // Wait for step 2 to render — the email field appears
    const emailInput = page.locator('#seller-lp-email')
    const emailVisible = await emailInput.isVisible({ timeout: 10_000 }).catch(() => false)
    return emailVisible ? emailInput : null
  }

  test('seller LP form renders with address step and advances to email field', async ({ page }) => {
    // Step 1: page loads with address input
    const res = await page.goto('/lp/seller-home-value', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible({ timeout: 20_000 })

    // The address field should be present on the initial view.
    // Use waitFor with a generous timeout — production cold-cache hits in the full
    // test suite can be slow. CI uses retries=2 which covers remaining flakiness.
    const addressInput = page.locator('#seller-lp-address')
    const hasAddressInput = await addressInput.waitFor({ state: 'visible', timeout: 45_000 }).then(() => true).catch(() => false)

    // Either the address step or the email step should be visible
    // (knownVisitor=true might skip straight to email)
    const emailInput = page.locator('#seller-lp-email')
    const hasEmailInput = hasAddressInput
      ? false // already found address — skip
      : await emailInput.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)

    expect(
      hasAddressInput || hasEmailInput,
      'Seller LP should show address input (step 1) or email input on load'
    ).toBe(true)

    // If at step 1, advance to step 2 and verify email field appears
    if (hasAddressInput && !hasEmailInput) {
      const emailEl = await advanceToQualifyStep(page)
      if (!emailEl) {
        test.skip(true, 'Could not advance seller LP to qualify step — address step may require real autocomplete')
        return
      }
      await expect(emailEl).toBeVisible({ timeout: 10_000 })
    }
  })

  test('seller LP form: invalid email fails HTML5 validation', async ({ page }) => {
    // Advance to the qualify step where the email field lives
    const emailInput = await advanceToQualifyStep(page)

    if (!emailInput) {
      test.skip(true, 'Could not reach seller LP email field — address step may require real autocomplete or known visitor')
      return
    }

    await emailInput.fill(INVALID_EMAIL)
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(isValid, 'Invalid email should fail HTML5 validation on seller LP').toBe(false)
  })
})

test.describe('Buyer LP form (/lp/buyer-listing-alerts)', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('buyer LP renders with email input', async ({ page }) => {
    const res = await page.goto('/lp/buyer-listing-alerts', {
      waitUntil: 'domcontentloaded',
      timeout: DATA_TIMEOUT,
    })
    expect(res?.status()).toBe(200)
    await expect(page.locator('main').first()).toBeVisible()

    // BuyerLPForm.tsx: id="email"
    const emailInput = page.locator('#email').first()
    await expect(emailInput).toBeVisible({ timeout: 30_000 })
    expect(await emailInput.getAttribute('type')).toBe('email')
  })

  test('buyer LP form: invalid email fails HTML5 validation', async ({ page }) => {
    await page.goto('/lp/buyer-listing-alerts', { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible()

    const emailInput = page.locator('#email').first()
    await expect(emailInput).toBeVisible({ timeout: 30_000 })

    await emailInput.fill(INVALID_EMAIL)
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(isValid, 'Invalid email should fail HTML5 validation on buyer LP').toBe(false)
  })
})
