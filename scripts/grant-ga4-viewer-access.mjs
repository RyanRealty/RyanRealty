#!/usr/bin/env node
// Grant GA4 Property Viewer access to a service account via the Google
// Analytics Admin UI. Designed to be run by a browser-capable agent (or
// Matt directly) when programmatic API access is not available.
//
// Why this script exists:
//   - The marketing optimization cron at /api/cron/marketing-optimization-report
//     calls the GA4 Data API with a service account.
//   - The Vercel production env now has GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
//     GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SERVICE_ACCOUNT_SUBJECT, and
//     GOOGLE_GA4_PROPERTY_ID=527333348 (verified 2026-05-10).
//   - The cron currently returns "7 PERMISSION_DENIED: User does not have
//     sufficient permissions for this property."
//   - That means the service account (viewer@ryanrealty.iam.gserviceaccount.com)
//     is not yet on the GA4 property's access list.
//   - Matt cannot find an "Add user" control in either Property or Account
//     Access Management, suggesting his Google account either lacks the GA4
//     Administrator role or the property/account has a different layout than
//     expected.
//
// What this script does:
//   1. Launches Chromium with a persistent profile so sign-in state survives
//      between runs.
//   2. Navigates straight to the Property Access Management page for property
//      527333348 in account-aware mode.
//   3. Pauses if not signed in so the human (or browser agent) can complete
//      Google sign-in once. Subsequent runs reuse the cookies.
//   4. Captures full-page screenshots at every key waypoint so anyone
//      reviewing the output (Matt, another agent, a CI pipeline) can see
//      exactly what state the page is in.
//   5. Looks for the "+" / "Create" / "Add users" affordance and attempts
//      the add flow with the configured service account email and Viewer role.
//   6. If the affordance is not present, falls back to Account Access
//      Management and tries again.
//   7. Prints a structured JSON summary at the end so the calling agent can
//      decide next steps.
//
// Run from the repo root:
//   node scripts/grant-ga4-viewer-access.mjs
//   node scripts/grant-ga4-viewer-access.mjs --headed false   # CI mode
//   node scripts/grant-ga4-viewer-access.mjs --dry-run        # screenshots only
//   node scripts/grant-ga4-viewer-access.mjs --service-account some@other.iam.gserviceaccount.com
//
// What success looks like:
//   - The script reports `{ status: "added", level: "property" | "account" }`.
//   - GA4 Property Access Management for property 527333348 shows the service
//     account as a Viewer.
//   - Re-running /api/cron/marketing-optimization-report returns ga4.ok=true
//     in the new agent_insights packet.
//
// What failure usually means:
//   - status="missing_admin_role": the signed-in Google account does not have
//     Administrator on the property or account. Matt needs to grant himself
//     Administrator first (impossible if no one in the org currently holds
//     that role) or have the original GA4 owner do the add.
//   - status="auth_required": the script timed out waiting for Google sign-in.
//     Re-run with --headed and complete the flow manually.
//   - status="email_rejected": GA4 rejected the service account email. Verify
//     the full email including the @ryanrealty.iam.gserviceaccount.com suffix
//     is correct and the service account exists in the GCP project.

import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

// ─── Config ────────────────────────────────────────────────────────────────

const DEFAULT_PROPERTY_ID = '527333348'
const DEFAULT_SERVICE_ACCOUNT = 'viewer@ryanrealty.iam.gserviceaccount.com'

const args = parseArgs(process.argv.slice(2))
const PROPERTY_ID = args['property-id'] ?? DEFAULT_PROPERTY_ID
const SERVICE_ACCOUNT_EMAIL = args['service-account'] ?? DEFAULT_SERVICE_ACCOUNT
const HEADED = args.headed !== 'false'
const DRY_RUN = Boolean(args['dry-run'])
const PROFILE_DIR = args['profile-dir'] ?? join(homedir(), '.cache', 'ryan-realty-ga4-grant-context')
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
const OUT_DIR = resolve(args['out-dir'] ?? join(process.cwd(), 'out', 'ga4-grant', RUN_ID))
const SIGN_IN_TIMEOUT_MS = Number(args['signin-timeout-ms'] ?? 5 * 60 * 1000) // 5 min

mkdirSync(PROFILE_DIR, { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

const log = (msg, extra) => {
  const stamp = new Date().toISOString()
  if (extra) console.log(`[${stamp}] ${msg}`, extra)
  else console.log(`[${stamp}] ${msg}`)
}

const stepResults = []
const recordStep = (step, result) => {
  stepResults.push({ step, timestamp: new Date().toISOString(), ...result })
}

// ─── Main ──────────────────────────────────────────────────────────────────

;(async () => {
  log('Launching Chromium with persistent profile')
  log('  profile_dir=' + PROFILE_DIR)
  log('  out_dir=' + OUT_DIR)
  log('  property_id=' + PROPERTY_ID)
  log('  service_account=' + SERVICE_ACCOUNT_EMAIL)
  log('  headed=' + HEADED)
  log('  dry_run=' + DRY_RUN)

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  })

  const page = context.pages()[0] ?? (await context.newPage())

  try {
    // 1. Property Access Management — direct deep link.
    const propertyAccessUrl = `https://analytics.google.com/analytics/web/#/p${PROPERTY_ID}/admin/suiteuserpermissions/property`
    log('Navigating to Property Access Management')
    await page.goto(propertyAccessUrl, { waitUntil: 'domcontentloaded' })

    // 2. Detect sign-in state. If the URL bounces to accounts.google.com,
    //    pause and let the human / agent complete Google sign-in.
    const signedIn = await waitForSignInOrAccessUI(page, SIGN_IN_TIMEOUT_MS)
    await screenshot(page, '01_after_signin_check.png')
    if (!signedIn) {
      recordStep('signin', { status: 'auth_required' })
      throw new Error('Sign-in did not complete within timeout window. Re-run with --headed and complete Google sign-in.')
    }
    recordStep('signin', { status: 'signed_in' })

    // 3. Wait for the access table to settle.
    await page.waitForTimeout(2500)
    await screenshot(page, '02_property_access_loaded.png')

    // 4. Try Property-level add first.
    const propertyResult = await tryAddViewer({
      page,
      level: 'property',
      label: 'property',
      screenshotPrefix: '03_property',
    })
    recordStep('property_attempt', propertyResult)

    if (propertyResult.status === 'added') {
      log('Service account added at property level. Done.')
      writeSummary({ status: 'added', level: 'property', steps: stepResults })
      return
    }

    // 5. Fall back to Account-level add.
    log('Property-level add failed, trying account level')
    const accountAccessUrl = `https://analytics.google.com/analytics/web/#/p${PROPERTY_ID}/admin/suiteuserpermissions/account`
    await page.goto(accountAccessUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await screenshot(page, '04_account_access_loaded.png')

    const accountResult = await tryAddViewer({
      page,
      level: 'account',
      label: 'account',
      screenshotPrefix: '05_account',
    })
    recordStep('account_attempt', accountResult)

    if (accountResult.status === 'added') {
      log('Service account added at account level. Done.')
      writeSummary({ status: 'added', level: 'account', steps: stepResults })
      return
    }

    // 6. Both failed. Diagnose the most likely cause.
    const diagnosis = diagnoseFailure(propertyResult, accountResult)
    log('Both add attempts failed. Diagnosis: ' + diagnosis)
    writeSummary({
      status: diagnosis,
      level: null,
      property_attempt: propertyResult,
      account_attempt: accountResult,
      steps: stepResults,
    })
    process.exitCode = 2
  } catch (err) {
    log('Fatal error: ' + err.message)
    await screenshot(page, '99_fatal_error.png').catch(() => {})
    writeSummary({
      status: 'error',
      error: err.message,
      stack: err.stack,
      steps: stepResults,
    })
    process.exitCode = 1
  } finally {
    await context.close()
  }
})()

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = 'true'
    }
  }
  return out
}

async function screenshot(page, name) {
  const path = join(OUT_DIR, name)
  await page.screenshot({ path, fullPage: true })
  log('  screenshot: ' + path)
  return path
}

async function waitForSignInOrAccessUI(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const url = page.url()
    if (url.includes('analytics.google.com/analytics/web')) {
      // Look for the access management heading or table — confirms we are on
      // the right page, not a generic error.
      const onAccessUI = await page.locator('text=/Access Management|Add users|Email|Roles?/i').first().count()
      if (onAccessUI > 0) return true
    }
    if (url.includes('accounts.google.com')) {
      log('  waiting for Google sign-in...')
    }
    await page.waitForTimeout(2500)
  }
  return false
}

async function tryAddViewer({ page, level, label, screenshotPrefix }) {
  log(`Attempting add at ${label} level`)

  // Find an add affordance. GA4 uses a floating action button "Create" at the
  // top right of the access table. Try several common labels.
  const addButton = await findAddAffordance(page)
  await screenshot(page, `${screenshotPrefix}_a_search_for_add.png`)
  if (!addButton) {
    log('  no add affordance visible — likely missing Administrator role at this level')
    return { status: 'no_add_affordance', level }
  }

  if (DRY_RUN) {
    log('  dry-run: skipping click')
    return { status: 'dry_run_no_click', level }
  }

  log('  clicking add affordance')
  await addButton.click()
  await page.waitForTimeout(1500)
  await screenshot(page, `${screenshotPrefix}_b_after_add_click.png`)

  // Some GA4 layouts pop a menu first ("Add users" vs "Add user groups").
  const userMenuItem = page.getByRole('menuitem', { name: /add users?$/i }).first()
  if (await userMenuItem.count()) {
    log('  selecting "Add users" from menu')
    await userMenuItem.click()
    await page.waitForTimeout(1500)
    await screenshot(page, `${screenshotPrefix}_c_after_menu_select.png`)
  }

  // Fill the email field. GA4 uses a chip-input — type then press Enter.
  const emailInput = await findEmailInput(page)
  if (!emailInput) {
    log('  email input not found after add click')
    return { status: 'email_input_missing', level }
  }
  await emailInput.click()
  await emailInput.fill(SERVICE_ACCOUNT_EMAIL)
  await page.waitForTimeout(500)
  await emailInput.press('Enter')
  await page.waitForTimeout(800)
  await screenshot(page, `${screenshotPrefix}_d_email_entered.png`)

  // Set role to Viewer.
  const roleSelected = await ensureRoleViewer(page)
  await screenshot(page, `${screenshotPrefix}_e_role_set.png`)
  if (!roleSelected) {
    log('  could not confirm Viewer role selection')
    return { status: 'role_not_set', level }
  }

  // Some flows show a "Notify by email" checkbox — leave default. Click "Add".
  const submit = page.getByRole('button', { name: /^add$/i }).first()
  if (await submit.count()) {
    log('  clicking final Add button')
    await submit.click()
    await page.waitForTimeout(2500)
    await screenshot(page, `${screenshotPrefix}_f_after_submit.png`)
  }

  // Verify the email shows up in the user list.
  const emailVisible = await page
    .locator(`text=${SERVICE_ACCOUNT_EMAIL}`)
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false)

  if (emailVisible) {
    return { status: 'added', level }
  }

  // Look for an inline error toast.
  const errorText = await page
    .locator('text=/error|invalid|cannot|denied/i')
    .first()
    .innerText({ timeout: 1500 })
    .catch(() => null)

  return {
    status: errorText ? 'email_rejected' : 'unknown_failure',
    level,
    error_text: errorText,
  }
}

async function findAddAffordance(page) {
  const candidates = [
    page.getByRole('button', { name: /^add users?$/i }),
    page.getByRole('button', { name: /^create$/i }),
    page.getByRole('button', { name: /^add$/i }),
    page.locator('button[aria-label*="Add"]'),
    page.locator('button[aria-label*="Create"]'),
    page.locator('mat-fab, [class*="fab"]'),
  ]
  for (const candidate of candidates) {
    const handle = candidate.first()
    if ((await handle.count()) && (await handle.isVisible().catch(() => false))) {
      return handle
    }
  }
  return null
}

async function findEmailInput(page) {
  const candidates = [
    page.getByPlaceholder(/email/i),
    page.locator('input[type="email"]'),
    page.locator('input[aria-label*="Email"]'),
    page.locator('input[aria-label*="email"]'),
  ]
  for (const candidate of candidates) {
    const handle = candidate.first()
    if ((await handle.count()) && (await handle.isVisible().catch(() => false))) {
      return handle
    }
  }
  return null
}

async function ensureRoleViewer(page) {
  // Try clicking "Viewer" in the role list. GA4 sometimes uses a radio group,
  // sometimes a dropdown, sometimes pre-selects Viewer by default.
  const viewerRadio = page.getByRole('radio', { name: /^viewer$/i }).first()
  if (await viewerRadio.count()) {
    if (!(await viewerRadio.isChecked().catch(() => false))) {
      await viewerRadio.click().catch(() => {})
    }
    return true
  }
  const viewerOption = page.getByRole('option', { name: /^viewer$/i }).first()
  if (await viewerOption.count()) {
    await viewerOption.click().catch(() => {})
    return true
  }
  // Heuristic: just type "Viewer" if there is a role search field.
  const roleField = page
    .locator('input[placeholder*="role" i], input[aria-label*="role" i]')
    .first()
  if (await roleField.count()) {
    await roleField.fill('Viewer').catch(() => {})
    await page.keyboard.press('Enter').catch(() => {})
    return true
  }
  return false
}

function diagnoseFailure(propertyResult, accountResult) {
  if (propertyResult.status === 'no_add_affordance' && accountResult.status === 'no_add_affordance') {
    return 'missing_admin_role'
  }
  if (propertyResult.status === 'email_rejected' || accountResult.status === 'email_rejected') {
    return 'email_rejected'
  }
  if (propertyResult.status === 'role_not_set' || accountResult.status === 'role_not_set') {
    return 'role_not_set'
  }
  return 'unknown_failure'
}

function writeSummary(summary) {
  const path = join(OUT_DIR, 'summary.json')
  const payload = {
    ...summary,
    property_id: PROPERTY_ID,
    service_account_email: SERVICE_ACCOUNT_EMAIL,
    out_dir: OUT_DIR,
    profile_dir: PROFILE_DIR,
    finished_at: new Date().toISOString(),
  }
  writeFileSync(path, JSON.stringify(payload, null, 2))
  log('Summary written to ' + path)
  console.log('\n=== RESULT ===')
  console.log(JSON.stringify(payload, null, 2))
}
