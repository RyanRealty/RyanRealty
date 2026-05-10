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
    // 1. Land on the GA4 Home page in the right account/property scope.
    //    GA4 deep links to /admin/suiteuserpermissions/* are flaky in the
    //    current UI — they often dump the user back at Home. Instead we land
    //    on Home and click the "Property access management" tile that appears
    //    in either Recently accessed or under the Admin (gear) menu.
    const homeUrl = 'https://analytics.google.com/analytics/web/'
    log('Navigating to GA4 Home')
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' })

    // 2. Detect sign-in state. If the URL bounces to accounts.google.com,
    //    pause and let the human / agent complete Google sign-in.
    const signedIn = await waitForSignInOrAccessUI(page, SIGN_IN_TIMEOUT_MS)
    await screenshot(page, '01_after_signin_check.png')
    if (!signedIn) {
      recordStep('signin', { status: 'auth_required' })
      throw new Error('Sign-in did not complete within timeout window. Re-run with --headed and complete Google sign-in.')
    }
    recordStep('signin', { status: 'signed_in' })

    // 3. Navigate to Property Access Management via the in-app UI.
    const propertyNavOk = await navigateToAccessManagement(page, 'property')
    await screenshot(page, '02_property_access_loaded.png')
    if (!propertyNavOk) {
      log('Could not reach Property Access Management UI')
      recordStep('property_nav', { status: 'navigation_failed' })
    }

    // 4. Try Property-level add first.
    const propertyResult = propertyNavOk
      ? await tryAddViewer({
          page,
          level: 'property',
          label: 'property',
          screenshotPrefix: '03_property',
        })
      : { status: 'navigation_failed', level: 'property' }
    recordStep('property_attempt', propertyResult)

    if (propertyResult.status === 'added') {
      log('Service account added at property level. Done.')
      writeSummary({ status: 'added', level: 'property', steps: stepResults })
      return
    }

    // 5. Fall back to Account-level add.
    log('Property-level add did not succeed, trying account level')
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const accountNavOk = await navigateToAccessManagement(page, 'account')
    await screenshot(page, '04_account_access_loaded.png')
    if (!accountNavOk) {
      log('Could not reach Account Access Management UI')
      recordStep('account_nav', { status: 'navigation_failed' })
    }

    const accountResult = accountNavOk
      ? await tryAddViewer({
          page,
          level: 'account',
          label: 'account',
          screenshotPrefix: '05_account',
        })
      : { status: 'navigation_failed', level: 'account' }
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

  // IMPORTANT: do NOT press Escape here. GA4 renders access management as a
  // modal dialog overlay, not a separate page. Escape would close it.

  // Debug dump: list every visible button on the right half of the screen
  // with its aria-label and bounding box. Helps a future agent tighten the
  // selector without re-running the whole flow.
  await dumpRightSideButtons(page, screenshotPrefix)

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

async function navigateToAccessManagement(page, scope /* 'property' | 'account' */) {
  const tileName = scope === 'property' ? /^Property access management$/i : /^Account access management$/i

  // Strategy 1: click the Recently accessed tile then, if we land on the
  // Admin overview, click the actual subpage link to drill in.
  const tile = page.getByRole('link', { name: tileName }).first()
  if (await tile.count()) {
    log(`  clicking "${scope === 'property' ? 'Property' : 'Account'} access management" tile`)
    await tile.click().catch(() => {})
    await page.waitForTimeout(3000)
    if (await isOnAccessManagementPage(page, scope)) return true
    // Drill in from Admin overview: click the link in the side nav or right
    // panel that points specifically at access management for our scope.
    if (await drillIntoAccessSubpage(page, scope)) {
      await page.waitForTimeout(3000)
      if (await isOnAccessManagementPage(page, scope)) return true
    }
  }

  // Strategy 2: open Admin from the sidebar/gear and drill in.
  const admin = page.getByRole('link', { name: /^Admin$/i }).first()
  if (await admin.count()) {
    log('  opening Admin via gear/sidebar')
    await admin.click().catch(() => {})
    await page.waitForTimeout(2500)
    if (await drillIntoAccessSubpage(page, scope)) {
      await page.waitForTimeout(3000)
      if (await isOnAccessManagementPage(page, scope)) return true
    }
  }

  return false
}

async function drillIntoAccessSubpage(page, scope) {
  const phrase = scope === 'property' ? 'Property access management' : 'Account access management'

  // Try the right-panel card icon link first (under "Property settings" or
  // "Account settings"). This is the most reliable path when on the Admin
  // overview. The card link sits inside a section that contains the literal
  // text "Property settings" or "Account settings".
  const sectionAnchor = scope === 'property' ? 'Property settings' : 'Account settings'
  const cardLink = page
    .locator(`section:has-text("${sectionAnchor}")`)
    .locator(`a:has-text("${phrase}"), button:has-text("${phrase}")`)
    .first()
  if (await cardLink.count()) {
    log(`  drilling via ${sectionAnchor} card link`)
    await cardLink.scrollIntoViewIfNeeded().catch(() => {})
    await cardLink.click({ force: true }).catch(() => {})
    await page.waitForTimeout(2500)
    if (await isOnAccessManagementPage(page, scope)) return true
  }

  // Try clicking the side nav entry. The side nav has truncated labels like
  // "Property access managem..." so we use a starts-with text match.
  const sideNav = page
    .locator('nav, [role="navigation"]')
    .locator(`a:has-text("${phrase.slice(0, 18)}"), button:has-text("${phrase.slice(0, 18)}")`)
  const sideNavAll = await sideNav.all()
  for (const handle of sideNavAll) {
    if (!(await handle.isVisible().catch(() => false))) continue
    log('  drilling via side nav entry')
    await handle.click({ force: true }).catch(() => {})
    await page.waitForTimeout(2500)
    if (await isOnAccessManagementPage(page, scope)) return true
  }

  // Last resort: try every link/button matching the phrase, click each in
  // turn, check after each click. Forces past any swallowed click handlers.
  const broad = page.locator(
    `a:has-text("${phrase}"), button:has-text("${phrase}"), [role="link"]:has-text("${phrase}"), [role="button"]:has-text("${phrase}")`
  )
  const broadAll = await broad.all()
  for (const handle of broadAll) {
    if (!(await handle.isVisible().catch(() => false))) continue
    log('  drilling via broad text match')
    await handle.click({ force: true }).catch(() => {})
    await page.waitForTimeout(2500)
    if (await isOnAccessManagementPage(page, scope)) return true
  }

  return false
}

async function isOnAccessManagementPage(page, scope) {
  // IMPORTANT: do NOT press Escape here. GA4 renders the access management
  // table as a modal dialog over the Admin page; Escape would close it.

  // The Admin overview page also contains the literal text "Property access
  // management" (as a link card), so loose text matching gives false
  // positives. The reliable signals are:
  //   1. The "Roles and data restrictions" column header — only renders on
  //      the access management subpage.
  //   2. The "<scope> access management <N> rows?" title format with a row
  //      count suffix — only renders when the access table is loaded.
  //   3. URL contains the suiteuserpermissions / accessmanagement segment.
  // We reject if the visible page heading is exactly "Admin" (overview).

  const adminHeadingVisible = await page
    .locator('h1:has-text("Admin"), [role="heading"]:has-text("Admin")')
    .first()
    .isVisible({ timeout: 800 })
    .catch(() => false)
  if (adminHeadingVisible) return false

  const colHeader = await page
    .locator('text=/Roles and data restrictions/i')
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false)
  if (colHeader) return true

  const url = page.url()
  if (/suiteuserpermissions|accessmanagement/i.test(url)) return true

  // Title with row count — "Property access management 1 row" or "10 rows".
  const titlePattern = scope === 'property'
    ? /Property access management\s+\d+\s+rows?/i
    : /Account access management\s+\d+\s+rows?/i
  const rowsTitle = await page
    .locator(`text=${titlePattern.toString().slice(1, -2)}`)
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false)
  if (rowsTitle) return true

  return false
}

async function dumpRightSideButtons(page, prefix) {
  const viewport = page.viewportSize() ?? { width: 1024, height: 768 }
  const rows = await page.evaluate((vw) => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
    return buttons
      .map((b) => {
        const r = b.getBoundingClientRect()
        return {
          aria_label: b.getAttribute('aria-label') ?? '',
          aria_haspopup: b.getAttribute('aria-haspopup') ?? '',
          text: (b.textContent ?? '').trim().slice(0, 40),
          class_name: b.className?.toString().slice(0, 80) ?? '',
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
          disabled: b.hasAttribute('disabled'),
          visible: r.width > 0 && r.height > 0,
        }
      })
      .filter((b) => b.visible && !b.disabled && b.x > vw * 0.45 && b.y < 120)
  }, viewport.width)
  const path = join(OUT_DIR, `${prefix}_z_button_dump.json`)
  writeFileSync(path, JSON.stringify(rows, null, 2))
  log(`  dumped ${rows.length} top-right candidate buttons → ${path}`)
}

async function findAddAffordance(page) {
  // The actual add control is a blue circular FAB in the top-right of the
  // access management table header. Filtering rules:
  //   - Reject disabled / hidden buttons.
  //   - Reject carousel scroll arrows (aria-label contains "scroll",
  //     "backwards", etc.).
  //   - Reject the TOP-LEFT "+ Create" entity creator (lives in the side
  //     nav, x position is in the LEFT HALF of the viewport, opens an
  //     Account / Property submenu).
  //   - Accept the right-side FAB even if it has aria-haspopup, because
  //     clicking the access-management add button opens an Add users /
  //     Add user groups submenu before showing the email form.
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 }
  const candidates = [
    page.getByRole('button', { name: /^add users?$/i }),
    page.getByRole('link', { name: /^add users?$/i }),
    page.locator('button[aria-label="Add users"]'),
    page.locator('button[aria-label="Add user"]'),
    page.locator('button[aria-label="Add users to account"]'),
    page.locator('button[aria-label="Add users to property"]'),
    page.locator('button[mat-fab]:not([disabled])'),
    page.locator('button.mdc-fab:not([disabled])'),
    page.locator('button.mat-mdc-fab:not([disabled])'),
    page.getByRole('button', { name: /^create$/i }),
  ]
  for (const candidate of candidates) {
    const all = await candidate.all()
    for (const handle of all) {
      const enabled = await handle.isEnabled().catch(() => false)
      const visible = await handle.isVisible().catch(() => false)
      if (!enabled || !visible) continue
      const aria = (await handle.getAttribute('aria-label').catch(() => '')) ?? ''
      if (/scroll|backwards?|forwards?|previous|next|move/i.test(aria)) continue
      // Require right-half placement: the access-management add button sits
      // at the top-right of the table; the entity creator "+ Create" sits
      // in the left side nav.
      const box = await handle.boundingBox().catch(() => null)
      if (box && box.x < viewport.width * 0.5) continue
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
