#!/usr/bin/env node
/**
 * scripts/drive-meta-ga4-ui.mjs
 *
 * Drives the Meta Business Suite + GA4 Admin UI for the items not exposed
 * via either platform's REST API.
 *
 * Flow:
 *   1. Opens a single Chromium window with a persistent profile.
 *   2. Opens GOOGLE first — waits for you to sign in (matt@ryan-realty.com).
 *   3. Opens FACEBOOK next — waits for you to sign in.
 *   4. Walks through 5 admin pages, taking a full-page screenshot of each.
 *   5. Where safe (GA4 Reporting Identity → Blended), attempts auto-apply
 *      when --apply is set.
 *   6. Leaves the browser open so you can finish manual steps from each tab.
 *
 * Sign-in pages are detected by URL substring and the script polls every
 * 2s for up to --signin-timeout-ms (default 15 min).
 *
 * Usage:
 *   node scripts/drive-meta-ga4-ui.mjs                # take screenshots only
 *   node scripts/drive-meta-ga4-ui.mjs --apply        # plus attempt safe auto-actions
 */

import { chromium } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const APPLY = Boolean(args.apply)
const PROFILE_DIR = args['profile-dir'] ?? join(homedir(), '.cache', 'ryan-realty-marketing-ui-driver')
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
const OUT_DIR = resolve(args['out-dir'] ?? join(process.cwd(), 'out', 'marketing-ui-drive', RUN_ID))
const SIGN_IN_TIMEOUT_MS = Number(args['signin-timeout-ms'] ?? 15 * 60 * 1000)
const VIEWPORT = { width: 1500, height: 950 }

const GA4_PROPERTY_ID = '527333348'
const DEAD_PIXEL_ID = '590593947302147'
const CANONICAL_PIXEL_ID = '1546878946032105'
const BUSINESS_ID = '733664948512665'

const ADMIN_PAGES = [
  { id: 'ga4-reporting-identity', platform: 'google',
    label: 'GA4 → Reporting identity (set to Blended)',
    url: `https://analytics.google.com/analytics/web/#/p${GA4_PROPERTY_ID}/admin/reporting-identities`,
    autoAction: 'set-blended',
    hint: 'Select Blended radio + click Save. Unlocks User Explorer + cross-device reporting for the user_id values our AnalyticsIdentityBridge already writes.' },
  { id: 'meta-lead-forms', platform: 'meta',
    label: 'Meta → Lead Forms Manager',
    url: 'https://business.facebook.com/latest/leads_forms',
    autoAction: null,
    hint: 'Archive form id 2621615651544418 ("Home Valuation + Notes" — misconfigured). Add https://ryan-realty.com/privacy as privacy_policy on both v3 forms.' },
  { id: 'meta-dead-pixel', platform: 'meta',
    label: `Meta → Events Manager → Dead Pixel ${DEAD_PIXEL_ID} → Diagnostics`,
    url: `https://business.facebook.com/events_manager2/list/pixel/${DEAD_PIXEL_ID}/overview`,
    autoAction: 'click-diagnostics',
    hint: 'Click Diagnostics tab to identify the firing source (codebase + WP already verified clean — source is an external integration).' },
  { id: 'meta-owned-domains', platform: 'meta',
    label: 'Meta → Business Settings → Owned Domains',
    url: `https://business.facebook.com/settings/owned-domains?business_id=${BUSINESS_ID}`,
    autoAction: null,
    hint: 'Confirm ryan-realty.com is Verified. The meta tag is already in app/layout.tsx so verification should be one click if not done.' },
  { id: 'meta-canonical-pixel-aem', platform: 'meta',
    label: `Meta → Events Manager → Canonical Pixel ${CANONICAL_PIXEL_ID} → AEM`,
    url: `https://business.facebook.com/events_manager2/list/pixel/${CANONICAL_PIXEL_ID}/overview`,
    autoAction: null,
    hint: 'Aggregated Event Measurement tab → ryan-realty.com → Manage Events. Priority order: Lead → Purchase → CompleteRegistration → Subscribe → ViewContent → Contact → Search → PageView.' },
]

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k.startsWith('--')) {
      const key = k.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) { out[key] = 'true'; continue }
      out[key] = next; i++
    }
  }
  return out
}

function isOnSignIn(url, platform) {
  const u = url.toLowerCase()
  if (platform === 'google') {
    return u.includes('accounts.google.com') || u.includes('signin') || u.includes('challenge')
  }
  if (platform === 'meta') {
    return u.includes('login.php') || u.includes('/login/') || u.includes('loginpage') || u.includes('checkpoint')
  }
  return false
}

async function waitForSignedIn(page, platform, label) {
  const start = Date.now()
  console.log(`\n🛑 Sign in to ${platform.toUpperCase()} in the browser window — ${label}`)
  console.log(`   Will wait up to ${Math.round(SIGN_IN_TIMEOUT_MS / 1000 / 60)} min, polling every 2s for the URL to leave the sign-in form.`)
  while (Date.now() - start < SIGN_IN_TIMEOUT_MS) {
    if (!isOnSignIn(page.url(), platform)) {
      console.log(`   ✓ signed in (now at ${page.url().slice(0, 100)})`)
      return true
    }
    await page.waitForTimeout(2000)
  }
  console.log(`   ⚠️ sign-in timeout — continuing but later pages may be unauthenticated`)
  return false
}

async function attemptGa4Blended(page, screenshot) {
  console.log('   attempting auto-set Reporting Identity → Blended...')
  await page.waitForTimeout(3000)
  await screenshot('before')
  const candidates = [
    page.getByRole('radio', { name: /blended/i }),
    page.locator('mat-radio-button:has-text("Blended")'),
    page.locator('label:has-text("Blended")'),
    page.getByText(/^Blended$/i),
  ]
  let clicked = false
  for (const c of candidates) {
    try {
      if (await c.first().isVisible({ timeout: 1500 })) {
        await c.first().click({ timeout: 3000 })
        console.log('     ✓ clicked Blended')
        clicked = true; break
      }
    } catch { /* next */ }
  }
  await screenshot('after-radio')
  if (!clicked) { console.log('     · Blended radio not found'); return false }
  for (const s of [page.getByRole('button', { name: /^save$/i }), page.locator('button:has-text("Save")')]) {
    try {
      if (await s.first().isVisible({ timeout: 1500 })) {
        await s.first().click({ timeout: 3000 })
        console.log('     ✓ clicked Save')
        await page.waitForTimeout(2500)
        await screenshot('after-save')
        return true
      }
    } catch { /* next */ }
  }
  console.log('     · Save button not found'); return false
}

async function attemptDiagnostics(page, screenshot) {
  console.log('   attempting to click Diagnostics tab...')
  await page.waitForTimeout(3000)
  for (const c of [
    page.getByRole('tab', { name: /diagnostic/i }),
    page.locator('[role="tab"]').filter({ hasText: /diagnostic/i }),
    page.getByText(/^Diagnostics$/i).first(),
  ]) {
    try {
      if (await c.first().isVisible({ timeout: 1500 })) {
        await c.first().click({ timeout: 3000 })
        console.log('     ✓ clicked Diagnostics')
        await page.waitForTimeout(3000)
        await screenshot('after-diagnostics')
        return true
      }
    } catch { /* next */ }
  }
  console.log('     · Diagnostics tab not found via auto-selectors')
  await screenshot('diagnostics-not-found')
  return false
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Profile: ${PROFILE_DIR}`)
  console.log(`Output:  ${OUT_DIR}`)
  console.log(`Apply mode: ${APPLY ? 'YES (will attempt safe auto-actions)' : 'no (screenshots only)'}\n`)

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: VIEWPORT,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const summary = { runId: RUN_ID, applyMode: APPLY, results: [] }

  // ─── Phase 1: sign in to both platforms first ─────────────────────────
  console.log('═'.repeat(70))
  console.log('PHASE 1: sign in to GOOGLE then FACEBOOK in the browser window')
  console.log('═'.repeat(70))

  const googleSignIn = await context.newPage()
  await googleSignIn.goto('https://analytics.google.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await googleSignIn.bringToFront()
  await waitForSignedIn(googleSignIn, 'google', 'GA4 admin')

  const metaSignIn = await context.newPage()
  await metaSignIn.goto('https://business.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await metaSignIn.bringToFront()
  await waitForSignedIn(metaSignIn, 'meta', 'Meta Business Suite')

  // ─── Phase 2: walk the admin pages ────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}\nPHASE 2: walking admin pages, screenshot + auto-actions\n${'═'.repeat(70)}`)

  for (const spec of ADMIN_PAGES) {
    console.log(`\n[${spec.id}] ${spec.label}`)
    console.log(`   → ${spec.url}`)
    const page = await context.newPage()
    const screenshot = async (suffix) => {
      const p = join(OUT_DIR, `${spec.id}_${suffix}.png`)
      try {
        await page.screenshot({ path: p, fullPage: false })
        console.log(`   📸 ${p.split('/').slice(-2).join('/')}`)
      } catch (e) { console.log(`   · screenshot fail: ${e.message.slice(0, 80)}`) }
    }
    const result = { id: spec.id, label: spec.label, hint: spec.hint, autoAction: null, screenshots: [] }
    try {
      await page.goto(spec.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(2500)
      // If somehow still on sign-in (rare since Phase 1 covered it), wait a bit more
      if (isOnSignIn(page.url(), spec.platform)) {
        await waitForSignedIn(page, spec.platform, spec.label)
      }
      await page.waitForTimeout(3000)
      await screenshot('landed')
      result.screenshots.push(`${spec.id}_landed.png`)
      if (APPLY && spec.autoAction === 'set-blended') {
        result.autoAction = (await attemptGa4Blended(page, screenshot)) ? 'applied' : 'failed'
      } else if (APPLY && spec.autoAction === 'click-diagnostics') {
        result.autoAction = (await attemptDiagnostics(page, screenshot)) ? 'applied' : 'failed'
      }
    } catch (e) {
      console.log(`   ✗ error: ${e.message.slice(0, 200)}`)
      result.error = e.message
    }
    summary.results.push(result)
  }

  writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(`\n\n📋 Summary: ${join(OUT_DIR, 'summary.json')}`)
  console.log(`\n🌐 Browser left OPEN — finish manual steps from each tab.`)
  console.log(`   Close the browser window to exit the script.\n`)

  await new Promise((resolve) => context.on('close', resolve))
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
