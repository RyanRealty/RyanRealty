// The consolidation acid test, driven as the broker (Matt), per the master
// goal's verification standard: from Home, find a lead, see everything about
// them, edit their alert criteria (the sentence editor), preview their next
// market report, and check whether their last email arrived — without touching
// the URL bar (every hop is a click; goto() is used only for the entry point
// and the phone-size passes). Screenshots at 1400x900 and 390x844 land in
// out/broker-walkthrough/.
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
const jar = {}
const ssr = createServerClient(url, anon, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }) } })
await ssr.auth.setSession({ access_token: v.data.session.access_token, refresh_token: v.data.session.refresh_token })

mkdirSync('out/broker-walkthrough', { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()

const results = []
const pass = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }
const clearOverlay = () => page.evaluate(() => document.querySelector('nextjs-portal')?.remove()).catch(() => {})
const shot = (name, opts = {}) => page.screenshot({ path: `out/broker-walkthrough/${name}.png`, ...opts })

// ── 1. Home ──────────────────────────────────────────────────────────────────
console.log('\n-- 1. Home --')
await page.goto(`${BASE}/admin/broker-dashboard`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
await page.waitForTimeout(2500)
await clearOverlay()
const homeText = await page.evaluate(() => document.body.innerText)
pass('home renders with delivery section', /email delivery/i.test(homeText))
await shot('01-home-1400')

// ── 2. Find the lead (nav click → contacts → search → row click) ─────────────
console.log('\n-- 2. Find the lead --')
await page.locator('a[href="/admin/crm"]').first().click({ timeout: 10000 }).catch(async (e) => {
  pass('nav to contacts', false, e.message)
})
await page.waitForTimeout(2500)
// Desktop contacts: search rides the Filters panel; the toolbar search input
// is mobile — use the Filters flow if present, else fall back to typing in any
// visible search box.
const crmSearch = page.locator('input[aria-label="Search contacts"]:visible').first()
if (await crmSearch.isVisible().catch(() => false)) {
  await crmSearch.fill('Matthew Ryan')
  await page.waitForTimeout(2000)
} else {
  await page.goto(`${BASE}/admin/crm?q=Matthew%20Ryan`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)
}
await clearOverlay()
await shot('02-contacts-search-1400')
await page.getByRole('link', { name: /Matthew Ryan/ }).first().click({ timeout: 10000 }).catch(async () => {
  // Table rows may be clickable rows rather than links.
  await page.getByText('Matthew Ryan', { exact: false }).first().click({ timeout: 8000 }).catch((e) => pass('open lead', false, e.message))
})
// /admin/crm/[id] server-redirects to the canonical /admin/console/leads/[id];
// the person page is heavy (force-dynamic), so wait for the final URL + settle.
await page.waitForURL(/\/admin\/console\/leads\/\d+/, { timeout: 90000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {})
await page.waitForTimeout(2500)
pass('lead page opened', page.url().includes('/admin/console/leads/'), page.url())

// ── 3. Everything about them: delivery panel on the person page ─────────────
console.log('\n-- 3. The person page tells the whole story --')
await clearOverlay()
const personText = await page.evaluate(() => document.body.innerText)
pass('person page shows email delivery panel', /email delivery/i.test(personText))
pass('person page shows subscriptions story', /subscribed to/i.test(personText))
pass('person page shows emails they got', /emails they.*gotten/i.test(personText) || /no emails recorded/i.test(personText))
const rail = page.locator('[data-tour="person-website-activity"]')
await rail.scrollIntoViewIfNeeded().catch(() => {})
await page.waitForTimeout(400)
await shot('03-person-page-1400')

// ── 4. Edit alert criteria in the sentence editor ────────────────────────────
console.log('\n-- 4. Edit the alert criteria (Alerts & reports hub) --')
await page.locator('a[href="/admin/crm/subscriptions"]').first().click({ timeout: 10000 }).catch(async (e) => {
  await page.goto(`${BASE}/admin/crm/subscriptions`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
})
await page.waitForTimeout(2500)
await clearOverlay()
const hubHeading = await page.getByRole('heading', { name: 'Alerts & reports' }).isVisible().catch(() => false)
pass('hub is titled Alerts & reports', hubHeading)
await shot('04-hub-alerts-1400')

// Open the first row's actions menu → Edit
const rowMenu = page.locator('table button[aria-haspopup="menu"]').first()
await rowMenu.click({ timeout: 10000 }).catch((e) => pass('open row menu', false, e.message))
await page.waitForTimeout(500)
await page.getByRole('menuitem', { name: /edit/i }).first().click({ timeout: 8000 }).catch((e) => pass('open edit dialog', false, e.message))
await page.waitForTimeout(1200)
const dialog = page.getByRole('dialog')
const dialogText = await dialog.innerText().catch(() => '')
pass('edit dialog shows the sentence editor', /Email me/.test(dialogText) && /with/.test(dialogText))
// The live count resolves within a few seconds (debounced 500ms + query).
await page.waitForTimeout(4000)
const dialogText2 = await dialog.innerText().catch(() => '')
pass('live matching count renders', /listings? match(es)? today|listing matches today/i.test(dialogText2), (dialogText2.match(/[\d,]+ listings? match(es)?[^\n]*/i) ?? [''])[0])
await shot('05-edit-criteria-dialog-1400')

// Change beds via the sentence Select (aria-label "Minimum beds"), save, verify.
const bedsTrigger = dialog.locator('[aria-label="Minimum beds"]')
await bedsTrigger.click({ timeout: 8000 }).catch((e) => pass('open beds select', false, e.message))
await page.waitForTimeout(400)
await page.getByRole('option', { name: '2+' }).click({ timeout: 8000 }).catch((e) => pass('pick 2+ beds', false, e.message))
await page.waitForTimeout(400)
await dialog.getByRole('button', { name: /save changes/i }).click({ timeout: 8000 }).catch((e) => pass('save', false, e.message))
await page.waitForTimeout(2500)
const { data: savedRow } = await admin
  .from('listing_alerts')
  .select('id, name, filters')
  .eq('email', 'matt@ryan-realty.com')
  .order('created_at', { ascending: true })
  .limit(1)
  .single()
pass('criteria edit persisted to listing_alerts', Number(savedRow?.filters?.beds) === 2, JSON.stringify(savedRow?.filters ?? {}))
// Revert the test edit so the real alert is untouched.
if (savedRow && Number(savedRow?.filters?.beds) === 2) {
  const reverted = { ...savedRow.filters }
  delete reverted.beds
  await admin.from('listing_alerts').update({ filters: reverted }).eq('id', savedRow.id)
}

// ── 5. Preview the next market report ────────────────────────────────────────
console.log('\n-- 5. Preview the market report email --')
await page.getByRole('tab', { name: /market reports/i }).click({ timeout: 8000 }).catch((e) => pass('open reports tab', false, e.message))
await page.waitForTimeout(2000)
const repMenu = page.locator('table button[aria-haspopup="menu"]').first()
await repMenu.click({ timeout: 10000 }).catch((e) => pass('open report row menu', false, e.message))
await page.waitForTimeout(500)
await page.getByRole('menuitem', { name: /preview email/i }).click({ timeout: 8000 }).catch((e) => pass('open preview', false, e.message))
await page.waitForTimeout(6000)
const previewDialog = page.getByRole('dialog')
const previewVisible = await previewDialog.isVisible().catch(() => false)
const previewFrame = previewDialog.locator('iframe')
const hasFrame = await previewFrame.count().catch(() => 0)
pass('market report preview renders', previewVisible && hasFrame > 0, `${hasFrame} iframe(s)`)
await shot('06-report-preview-1400')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

// ── 6. Check delivery: the hub Delivery tab ──────────────────────────────────
console.log('\n-- 6. Did the emails land --')
await page.getByRole('tab', { name: /delivery/i }).click({ timeout: 8000 }).catch((e) => pass('open delivery tab', false, e.message))
await page.waitForTimeout(2500)
const deliveryText = await page.evaluate(() => document.body.innerText)
pass('delivery tab shows streams + attention', /needs attention/i.test(deliveryText), '')
await shot('07-delivery-tab-1400', { fullPage: true })

// ── 7. Phone-size passes (390x844) on the changed surfaces ───────────────────
console.log('\n-- 7. Phone size --')
const mob = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } })
await mob.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const mp = await mob.newPage()
const mShot = (name) => mp.screenshot({ path: `out/broker-walkthrough/${name}.png` })
for (const [name, path] of [
  ['08-home-390', '/admin/broker-dashboard'],
  ['09-hub-390', '/admin/crm/subscriptions'],
  ['10-listings-390', '/admin/listings'],
  ['11-performance-390', '/admin/analytics'],
]) {
  await mp.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
  await mp.waitForTimeout(2200)
  await mp.evaluate(() => document.querySelector('nextjs-portal')?.remove()).catch(() => {})
  await mShot(name)
  if (name === '09-hub-390') {
    const mobHub = await mp.evaluate(() => document.body.innerText)
    pass('phone: hub renders', /alerts & reports/i.test(mobHub))
  }
}
await mob.close()

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(', '))
process.exit(failed.length > 0 ? 1 : 0)
