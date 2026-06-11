#!/usr/bin/env node
/**
 * Opens a headed Chromium window pointed at app.skyslope.com so Matt can
 * log in once, then saves the post-login cookies + localStorage to
 * tmp/skyslope-session.json for reuse by _skyslope-template-add-archive.mjs.
 *
 * Usage:
 *   node scripts/_skyslope-login-capture.mjs
 *
 * Behaviour:
 *   - Opens chromium, navigates to https://app.skyslope.com/LoginIntegrated.aspx
 *   - Waits up to 5 minutes for the user to log in (detects redirect away
 *     from LoginIntegrated.aspx).
 *   - Saves storage state and closes the browser.
 *
 * Re-run any time the saved cookies expire (SkySlope idle timeout is short).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = path.join(process.cwd(), 'tmp/skyslope-session.json')
const LOGIN_URL = 'https://app.skyslope.com/LoginIntegrated.aspx'
const POST_LOGIN_URL = 'https://app.skyslope.com/ManageTransactions.aspx'
const MAX_WAIT_MS = 20 * 60 * 1000

// Load .env.local for autofilled UI credentials (gitignored).
async function loadEnvLocal() {
  const raw = await fs.readFile('.env.local', 'utf8').catch(() => '')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}
await loadEnvLocal()

const AUTO_EMAIL = process.env.SKYSLOPE_LOGIN_EMAIL
const AUTO_PASSWORD = process.env.SKYSLOPE_LOGIN_PASSWORD
const HEADLESS = process.argv.includes('--headless')
const KEEP_OPEN = process.argv.includes('--keep-open')

const browser = await chromium.launch({ headless: HEADLESS })
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

console.log(`Opening ${LOGIN_URL} — ${AUTO_EMAIL ? 'attempting auto-login' : 'please complete the SkySlope login manually'}.`)
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

// Bring the Playwright window to the front on macOS so Matt can approve MFA if needed.
if (!HEADLESS && process.platform === 'darwin') {
  const { execSync } = await import('node:child_process')
  try {
    execSync(
      'osascript -e \'tell application "Google Chrome for Testing" to activate\'',
      { stdio: 'ignore' },
    )
  } catch {
    /* non-fatal */
  }
}

/** Return a locator scope that contains the Okta login form (main doc or iframe). */
async function loginScope(p) {
  const emailSel =
    'input[type="email"], input[name="username"], input[name*="username" i], input[name*="email" i], input[id*="username" i], input[id="okta-signin-username"], input[autocomplete="username"]'
  // Main document first
  const mainEmail = p.locator(emailSel).first()
  if (await mainEmail.count()) {
    try {
      await mainEmail.waitFor({ state: 'visible', timeout: 5000 })
      return p
    } catch {
      /* try frames */
    }
  }
  for (const frame of p.frames()) {
    const fEmail = frame.locator(emailSel).first()
    if (await fEmail.count()) {
      try {
        await fEmail.waitFor({ state: 'visible', timeout: 5000 })
        return frame
      } catch {
        /* next frame */
      }
    }
  }
  return p
}

async function clickFirst(scope, selectors) {
  for (const sel of selectors) {
    const loc = scope.locator(sel).first()
    if (await loc.count()) {
      await loc.click({ timeout: 5000 }).catch(() => {})
      return true
    }
  }
  return false
}

// If creds available, try auto-fill via Okta. SkySlope login forwards to
// id.skyslope.com (Okta) which has the email + password fields.
if (AUTO_EMAIL && AUTO_PASSWORD) {
  try {
    console.log('Auto-login: waiting for Okta redirect / login form (up to 90s)...')
    await page
      .waitForURL(/id\.skyslope\.com|LoginIntegrated|oauth2|okta/i, { timeout: 90000 })
      .catch(() => {})
    await page.waitForTimeout(1500)

    const scope = await loginScope(page)
    const emailInput = scope
      .locator(
        'input[type="email"], input[name="username"], input[name*="username" i], input[name*="email" i], input[id*="username" i], input[id="okta-signin-username"], input[autocomplete="username"]',
      )
      .first()
    await emailInput.waitFor({ state: 'visible', timeout: 60000 })
    console.log('Auto-login: email field visible, filling.')
    await emailInput.fill(AUTO_EMAIL)
    await page.waitForTimeout(400)

    await clickFirst(scope, [
      'input[type="submit"][value="Next"]',
      'button:has-text("Next")',
      'button:has-text("Continue")',
      'input[type="submit"]',
      'button[type="submit"]',
    ])
    console.log('Auto-login: advanced past email step (if two-step flow).')

    const pwInput = scope.locator('input[type="password"], input[name="password"], input[id="okta-signin-password"]').first()
    await pwInput.waitFor({ state: 'visible', timeout: 30000 })
    console.log('Auto-login: password field visible, filling.')
    await pwInput.fill(AUTO_PASSWORD)
    await page.waitForTimeout(400)

    await clickFirst(scope, [
      'input[type="submit"][value="Verify"]',
      'button:has-text("Verify")',
      'button:has-text("Sign In")',
      'input[type="submit"]',
      'button[type="submit"]',
    ])
    console.log('Auto-login: submitted credentials. If Okta MFA is enabled, approve on your phone — script waits up to 20 min.')
  } catch (e) {
    console.log(`Auto-login attempt errored (${e.message.slice(0, 200)}); falling through to manual wait.`)
  }
}

const start = Date.now()
let savedOnce = false
while (Date.now() - start < MAX_WAIT_MS) {
  await page.waitForTimeout(2000)
  const url = page.url()
  // Detect logged-in: on app.skyslope.com path AND NOT on the OAuth flow
  // (id.skyslope.com /oauth2/.../authorize). Otherwise we'd save state
  // mid-flow and the cookies won't be valid.
  const onAppPath = /app\.skyslope\.com/i.test(url)
  const onLogin = /LoginIntegrated\.aspx/i.test(url)
  const onOAuth = /id\.skyslope\.com.*oauth2/i.test(url)
  if (onAppPath && !onLogin && !onOAuth) {
    if (!savedOnce) {
      console.log(`Detected post-login URL: ${url}`)
      console.log('Waiting 3s for any post-login redirects to settle...')
      await page.waitForTimeout(3000)
      // Touch a known authenticated page to make sure cookies persist
      await page.goto(POST_LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForTimeout(2000)
      // Verify we're not bounced back to login (cookie smoke test)
      if (/LoginIntegrated\.aspx/i.test(page.url())) {
        console.log('Bounced back to login after touching ManageTransactions — session not valid. Continuing to wait.')
        continue
      }
      await fs.mkdir(path.dirname(STATE_PATH), { recursive: true })
      await context.storageState({ path: STATE_PATH })
      console.log(`Saved storage state → ${STATE_PATH}`)
      savedOnce = true
      break
    }
  }
}

if (!savedOnce) {
  console.error('Timeout waiting for login.')
  await browser.close()
  process.exit(1)
}

if (KEEP_OPEN) {
  console.log('Session saved. Browser stays open (--keep-open). Close the window when you are done.')
  await new Promise(() => {})
} else {
  console.log('Session saved. Closing browser in 8 seconds (this is normal — cookies are in tmp/skyslope-session.json).')
  console.log('Use --keep-open if you want the window to stay up after capture.')
  await page.waitForTimeout(8000)
  await browser.close()
  console.log('Done. You may now run scripts/_skyslope-template-add-archive.mjs')
}
