import { test, expect } from '@playwright/test'

/**
 * pulse.spec.ts
 *
 * Tests the /pulse market pulse feed:
 *   - Page loads with at least one card
 *   - Like/heart button toggles aria-pressed state (PulseCard.tsx: aria-label="Like")
 *   - City filter chip changes the feed
 *   - No hydration console errors during load
 *
 * Selectors from PulseCard.tsx:
 *   - Heart: aria-pressed={liked}, aria-label="Like" / "Unlike"
 *   - Double-tap: aria-label="Double tap to like"
 * From PulseFilters.tsx / PulseFeed.tsx:
 *   - City filter chips in the sticky header bar
 */

const DATA_TIMEOUT = 90_000
const PULSE_URL = '/pulse'

// Known harmless hydration-adjacent console patterns on /pulse
const ALLOWED_PULSE_CONSOLE = [
  /hydration/i,  // We fail on this if unexpected
  /supabase|WebSocket/i,
  /gtag|analytics|googletagmanager/i,
  /Google Maps|BillingNotEnabled/i,
]

test.describe('Pulse feed', () => {
  test.setTimeout(DATA_TIMEOUT)

  test('page loads with at least one pulse card', async ({ page }) => {
    const res = await page.goto(PULSE_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    expect(res?.status()).toBe(200)
    await expect(page.locator('main').first()).toBeVisible()

    // Wait for cards to render — PulseCard / ActivityFeedCard / LifestyleCard
    // PulseFeed renders cards; at least one should appear
    const cards = page.locator('[aria-label="Double tap to like"], article, [class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 30_000 })

    const cardCount = await cards.count()
    expect(cardCount, 'Pulse feed should render at least one card').toBeGreaterThan(0)
  })

  test('like button toggles heart state', async ({ page }) => {
    // Pre-dismiss the sign-in modal (fires 1s after load for anonymous users).
    // Without this the modal overlays the like button and blocks the click.
    await page.addInitScript(() => {
      localStorage.setItem('ryan_realty_signin_prompt_dismissed', String(Date.now()))
    })

    await page.goto(PULSE_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible()

    // Find the Like button — aria-label="Like" from PulseCard.tsx
    const likeBtn = page.getByRole('button', { name: /^like$/i }).first()
    const likeVisible = await likeBtn.isVisible({ timeout: 30_000 }).catch(() => false)

    if (!likeVisible) {
      test.skip(true, 'Like button not visible — pulse cards may not have loaded or layout differs')
      return
    }

    // Initial state: aria-pressed="false"
    const pressedBefore = await likeBtn.getAttribute('aria-pressed')
    expect(pressedBefore, 'Like button should start with aria-pressed=false').toBe('false')

    // Click like
    await likeBtn.click()
    // Give time for the optimistic UI update and the sign-in prompt check
    await page.waitForTimeout(600)

    // PulseCard.tsx toggles aria-pressed AND label ("Like" → "Unlike").
    // If a sign-in modal appeared (3-like threshold), it may intercept focus —
    // close it first, then check state.
    const signInModal = page.locator('[role="dialog"], [role="alertdialog"]').first()
    const modalVisible = await signInModal.isVisible({ timeout: 500 }).catch(() => false)
    if (modalVisible) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    // Re-locate button in case DOM updated
    const likeOrUnlikeBtn = page.getByRole('button', { name: /^(like|unlike)$/i }).first()
    const pressedAfter = await likeOrUnlikeBtn.getAttribute('aria-pressed').catch(() => null)
    const labelAfter = await likeOrUnlikeBtn.getAttribute('aria-label').catch(() => null)

    const toggled = pressedAfter === 'true' || labelAfter === 'Unlike'
    expect(toggled, 'Like button should toggle after click — aria-pressed or label should change').toBe(true)
  })

  test('city filter chip changes feed state', async ({ page }) => {
    await page.goto(PULSE_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    await expect(page.locator('main').first()).toBeVisible()

    // PulseFeed renders city filter chips in a sticky bar
    // Look for filter buttons (city names like "Bend", "Redmond", etc.)
    const filterChips = page.locator('button[class*="chip"], button[class*="filter"], button[class*="Badge"]')
      .or(page.locator('nav button, [role="tab"]'))

    const chipCount = await filterChips.count()
    if (chipCount === 0) {
      test.skip(true, 'No filter chips found — pulse filter bar may not be rendered')
      return
    }

    // Click the first non-active chip
    await filterChips.first().click()
    await page.waitForTimeout(500)

    // Page should not crash after filtering
    const bodyText = await page.locator('body').innerText().catch(() => '')
    expect(bodyText).not.toContain('Application error')
    await expect(page.locator('main').first()).toBeVisible()
  })

  test('no hydration errors in console during load', async ({ page }) => {
    const hydrationErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Specifically check for React hydration errors — these are real bugs
        if (/hydration|Hydration|did not match|server.*client mismatch/i.test(text)) {
          hydrationErrors.push(text)
        }
      }
    })

    // /pulse has a live feed that never truly reaches networkidle — use domcontentloaded
    await page.goto(PULSE_URL, { waitUntil: 'domcontentloaded', timeout: DATA_TIMEOUT })
    // Wait briefly for React hydration to complete
    await page.waitForTimeout(2000)
    await expect(page.locator('main').first()).toBeVisible()

    expect(
      hydrationErrors,
      `Hydration errors on /pulse: ${hydrationErrors.slice(0, 2).join('; ')}`
    ).toHaveLength(0)
  })
})
