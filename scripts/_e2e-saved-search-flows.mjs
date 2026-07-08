// Interactive E2E for the saved-search build (W5), against the local dev server.
// Flow A (admin): CRM people list -> select Matthew Ryan -> bulk "Assign a saved
//   search" with real filters -> drain crm-bulk-worker -> assert the
//   listing_alerts row (crm_person_id + origin broker + filters).
// Flow B (user): /search -> Save search dialog -> assert listing_alerts row
//   captures the full filter set.
// Flow C (user): /account/notifications -> market report self-subscribe ->
//   assert crm_report_subscriptions row.
import { chromium, devices } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync, mkdirSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const BASE = process.env.VERIFY_BASE || 'http://localhost:3021'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createSb(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'matt@ryan-realty.com' })
const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
let v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
if (v.error) v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
const session = v.data.session
const jar = {}
const ssr = createServerClient(url, anon, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }) } })
await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })

mkdirSync('out/saved-search-verify', { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()

const results = []
const pass = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }

// ── Flow A: admin bulk assign ────────────────────────────────────────────────
console.log('\n-- Flow A: admin bulk assign saved search --')
await page.goto(`${BASE}/admin/crm?q=Matthew%20Ryan`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(3000)
await page.screenshot({ path: 'out/saved-search-verify/e2e-a1-people-list.png' })

// Select the first row's checkbox
const rowCheckbox = page.locator('[role="checkbox"], input[type="checkbox"]').nth(1)
await rowCheckbox.click({ timeout: 10000 }).catch(async () => {
  await page.locator('[role="checkbox"], input[type="checkbox"]').first().click({ timeout: 5000 }).catch(() => {})
})
await page.waitForTimeout(1000)
await page.screenshot({ path: 'out/saved-search-verify/e2e-a2-selected.png' })

// Open the bulk-actions overflow menu (icon button, aria-label="Bulk actions")
await page.getByRole('button', { name: 'Bulk actions' }).first().click({ timeout: 10000 })
await page.waitForTimeout(600)
const menuItem = page.getByRole('menuitem', { name: 'Assign a saved search' })
await menuItem.click({ timeout: 8000 }).catch((e) => pass('A: open assign dialog', false, e.message))
await page.waitForTimeout(800)
await page.screenshot({ path: 'out/saved-search-verify/e2e-a3-dialog.png' })

// Fill the modal
await page.locator('#bulk-ss-name').fill('E2E Bend test alert', { timeout: 8000 })
await page.locator('#bulk-ss-city').fill('Bend')
await page.locator('#bulk-ss-min-price').fill('500000')
await page.locator('#bulk-ss-max-price').fill('900000')
await page.screenshot({ path: 'out/saved-search-verify/e2e-a4-filled.png' })

// Submit (the dialog's primary action button is labeled "Run")
const dialog = page.getByRole('dialog')
await dialog.getByRole('button', { name: 'Run', exact: true }).click({ timeout: 8000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: 'out/saved-search-verify/e2e-a5-submitted.png' })

// Drain the worker
const cron = await fetch(`${BASE}/api/cron/crm-bulk-worker`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })
const cronBody = await cron.text()
console.log('worker cron:', cron.status, cronBody.slice(0, 300))
await new Promise((r) => setTimeout(r, 1500))

// Assert the row
const { data: alertRows } = await admin.from('listing_alerts').select('*').eq('email', 'matt@ryan-realty.com')
const row = (alertRows ?? [])[0]
pass('A: listing_alerts row created', Boolean(row), row ? `id=${row.id}` : 'no row')
if (row) {
  pass('A: crm_person_id stamped', row.crm_person_id === 13168, String(row.crm_person_id))
  pass('A: origin broker', row.origin === 'broker', row.origin)
  pass('A: filters captured', row.filters?.city === 'Bend' && Number(row.filters?.minPrice) === 500000, JSON.stringify(row.filters))
  pass('A: assigned_by', row.assigned_by === 'matt@ryan-realty.com', String(row.assigned_by))
}

// ── Flow B1: guest saves a search from /search (full filter capture) ─────────
// The search page is ISR-cached so the button renders its guest branch; the
// guest path writes listing_alerts through submitSearchAlertSignup.
console.log('\n-- Flow B1: guest save search (full filters) --')
const guestEmail = 'matt@ryan-realty.com'
// A REAL guest: fresh context with no session cookies, so the page renders the
// email-capture branch of SaveSearchButton.
const guestCtx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } })
const gp = await guestCtx.newPage()
await gp.goto(`${BASE}/search/bend?minPrice=600000&maxPrice=1200000&beds=3&baths=2&propertyType=A&hasView=1`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await gp.waitForTimeout(3000)
await gp.getByRole('button', { name: 'Save this search' }).first().click({ timeout: 10000 })
await gp.waitForTimeout(800)
await gp.screenshot({ path: 'out/saved-search-verify/e2e-b1-save-dialog.png' })
await gp.locator('#save-search-email').fill(guestEmail, { timeout: 8000 })
await gp.getByRole('button', { name: 'Save search', exact: true }).click({ timeout: 8000 })
await gp.waitForTimeout(3500)
await gp.screenshot({ path: 'out/saved-search-verify/e2e-b2-saved.png' })
await guestCtx.close()

const { data: guestRows } = await admin
  .from('listing_alerts')
  .select('*')
  .eq('email', guestEmail)
  .order('created_at', { ascending: false })
const b1 = (guestRows ?? []).find((r) => r.filters?.hasView === true || String(r.filters?.hasView) === 'true')
pass('B1: guest alert row with full filters', Boolean(b1), b1 ? JSON.stringify(b1.filters) : `rows=${(guestRows ?? []).length}`)
if (b1) {
  pass('B1: numeric filters coerced', Number(b1.filters?.minPrice) === 600000 && Number(b1.filters?.beds) === 3, JSON.stringify({ minPrice: b1.filters?.minPrice, beds: b1.filters?.beds }))
  pass('B1: crm_person_id resolved', b1.crm_person_id === 13168, String(b1.crm_person_id))
}

// ── Flow B2: signed-in edit dialog on /account/saved-searches ────────────────
console.log('\n-- Flow B2: edit saved search on account page --')
const authUserId = session.user.id
// Seed a listing_alerts row for the signed-in user
const { data: seeded, error: seedErr } = await admin
  .from('listing_alerts')
  .insert({
    user_id: authUserId,
    email: 'matt@ryan-realty.com',
    name: 'E2E seed search',
    filters: { city: 'Bend', minPrice: 700000, beds: 3 },
    filters_hash: 's_e2e_seed_' + Date.now(),
    notification_frequency: 'daily',
  })
  .select('id')
  .single()
if (seedErr) pass('B2: seed row', false, seedErr.message)
await page.goto(`${BASE}/account/saved-searches`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(3000)
await page.screenshot({ path: 'out/saved-search-verify/e2e-b3-account-list.png', fullPage: true })
const bodyText = await page.evaluate(() => document.body.innerText)
pass('B2: seeded search renders', bodyText.includes('E2E seed search'))
// Open the edit dialog, rename, save
await page.getByRole('button', { name: /^edit$/i }).first().click({ timeout: 10000 }).catch((e) => pass('B2: open edit dialog', false, e.message))
await page.waitForTimeout(800)
await page.screenshot({ path: 'out/saved-search-verify/e2e-b4-edit-dialog.png' })
const editDialog = page.getByRole('dialog')
const editName = editDialog.locator('input').first()
await editName.fill('E2E renamed search', { timeout: 8000 }).catch((e) => pass('B2: fill name', false, e.message))
await editDialog.getByRole('button', { name: /save/i }).first().click({ timeout: 8000 }).catch((e) => pass('B2: save edit', false, e.message))
await page.waitForTimeout(2500)
await page.screenshot({ path: 'out/saved-search-verify/e2e-b5-after-edit.png', fullPage: true })
if (seeded) {
  const { data: after } = await admin.from('listing_alerts').select('name, filters').eq('id', seeded.id).single()
  pass('B2: rename persisted', after?.name === 'E2E renamed search', after?.name ?? 'missing')
  pass('B2: filters survived edit', after?.filters?.city === 'Bend' && Number(after?.filters?.minPrice) === 700000, JSON.stringify(after?.filters))
}

// ── Flow C: market report self-subscribe ─────────────────────────────────────
console.log('\n-- Flow C: market report self-subscribe --')
await page.goto(`${BASE}/account/notifications`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(3500)
await page.screenshot({ path: 'out/saved-search-verify/e2e-c1-prefs.png', fullPage: true })
// Toggle an area button (Bend) then save
const bendToggle = page.getByRole('button', { name: /^bend$/i }).first()
await bendToggle.click({ timeout: 8000 }).catch((e) => pass('C: toggle area', false, e.message))
await page.waitForTimeout(500)
const savePrefs = page.getByRole('button', { name: /save market report/i }).first()
await savePrefs.click({ timeout: 8000 }).catch((e) => pass('C: click save', false, e.message))
await page.waitForTimeout(2500)
await page.screenshot({ path: 'out/saved-search-verify/e2e-c2-saved.png', fullPage: true })

const { data: repRows } = await admin.from('crm_report_subscriptions').select('*').eq('person_id', 13168)
const rep = (repRows ?? [])[0]
pass('C: crm_report_subscriptions row', Boolean(rep), rep ? `areas=${JSON.stringify(rep.areas)} active=${rep.is_active}` : 'no row')

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
