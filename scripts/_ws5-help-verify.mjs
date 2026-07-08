// WS5 verification: guided tours + Help button + /admin/help knowledge base.
// For each of the 5 tours: open the page as Matt, click the floating Help
// button, start the tour from the sheet, step through every driver.js popover
// to Done, and record the step titles seen. Then verify /admin/help renders,
// search filters articles, and an article page shows its body. Finally check
// the Help button is present at phone size (390x844).
// Screenshots land in out/ws5-help-verify/.
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

mkdirSync('out/ws5-help-verify', { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()

const results = []
const pass = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }

// The Next DEV overlay badge (<nextjs-portal>) sits bottom-left, exactly where
// the Help button lives, and intercepts pointer events. Log what it says once
// (a real build/runtime error must surface, not be swallowed), then remove it.
let portalLogged = false
async function clearDevOverlay(p) {
  const text = await p.evaluate(() => {
    const el = document.querySelector('nextjs-portal')
    if (!el) return null
    const t = (el.shadowRoot?.textContent ?? el.textContent ?? '').trim().slice(0, 300)
    el.remove()
    return t
  }).catch(() => null)
  if (text && !portalLogged) { portalLogged = true; console.log(`   [dev-overlay said: ${text || '(empty badge)'}]`) }
}

const TOURS = [
  { slug: 'dashboard', route: '/admin/broker-dashboard', label: 'Your morning view' },
  { slug: 'crm', route: '/admin/crm', label: 'Find anyone in your contacts' },
  { slug: 'subscriptions', route: '/admin/crm/subscriptions', label: 'Alerts and reports: who gets what' },
  { slug: 'person', route: '/admin/console/leads/13168', label: 'Everything about one person' },
  { slug: 'inbox', route: '/admin/crm/inbox', label: 'Work your inbox' },
]

for (const tour of TOURS) {
  console.log(`\n-- Tour: ${tour.label} (${tour.route}) --`)
  await page.goto(`${BASE}${tour.route}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(2500)
  await clearDevOverlay(page)

  const helpBtn = page.locator('button[aria-label="Help"]')
  const btnVisible = await helpBtn.isVisible().catch(() => false)
  pass(`${tour.slug}: Help button visible`, btnVisible)
  if (!btnVisible) { await page.screenshot({ path: `out/ws5-help-verify/${tour.slug}-no-button.png` }); continue }

  await helpBtn.click()
  await page.waitForTimeout(600)
  const sheetCard = page.getByText(tour.label, { exact: true }).first()
  const labelShown = await sheetCard.isVisible().catch(() => false)
  pass(`${tour.slug}: tour listed in Help sheet`, labelShown)
  await page.screenshot({ path: `out/ws5-help-verify/${tour.slug}-1-sheet.png` })
  if (!labelShown) { await page.keyboard.press('Escape'); continue }

  await page.getByRole('button', { name: 'Start tour' }).first().click()
  await page.waitForTimeout(1200)

  // Step through every driver.js popover to Done.
  const seenTitles = []
  for (let step = 0; step < 15; step++) {
    const popover = page.locator('.driver-popover')
    const open = await popover.isVisible().catch(() => false)
    if (!open) break
    const title = await popover.locator('.driver-popover-title').innerText().catch(() => '')
    seenTitles.push(title)
    if (step === 0) await page.screenshot({ path: `out/ws5-help-verify/${tour.slug}-2-step1.png` })
    const nextBtn = popover.locator('.driver-popover-next-btn')
    const hasNext = await nextBtn.isVisible().catch(() => false)
    if (!hasNext) break
    const nextText = (await nextBtn.innerText().catch(() => '')).trim()
    await nextBtn.click()
    await page.waitForTimeout(500)
    if (nextText === 'Done') break
  }
  // The tour ends when the popover is gone after Done.
  await page.waitForTimeout(500)
  const stillOpen = await page.locator('.driver-popover').isVisible().catch(() => false)
  pass(`${tour.slug}: tour ran end to end`, seenTitles.length > 0 && !stillOpen, `${seenTitles.length} steps: ${seenTitles.join(' | ')}`)
  await page.screenshot({ path: `out/ws5-help-verify/${tour.slug}-3-done.png` })
}

// ── /admin/help knowledge base ───────────────────────────────────────────────
console.log('\n-- /admin/help knowledge base --')
await page.goto(`${BASE}/admin/help`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
await page.waitForTimeout(2000)
await clearDevOverlay(page)
await page.screenshot({ path: 'out/ws5-help-verify/help-1-index.png', fullPage: true })
const articleLinks = page.locator('a[href^="/admin/help/"]')
const totalArticles = await articleLinks.count()
pass('help: index lists articles', totalArticles >= 10, `${totalArticles} article links`)

// Search narrows the list
const searchInput = page.locator('input[type="search"], input[placeholder*="earch"]').first()
const hasSearch = await searchInput.isVisible().catch(() => false)
pass('help: search input present', hasSearch)
if (hasSearch) {
  await searchInput.fill('listing alert')
  await page.waitForTimeout(800)
  const filtered = await page.locator('a[href^="/admin/help/"]').count()
  pass('help: search filters results', filtered > 0 && filtered < totalArticles, `${filtered} of ${totalArticles} after "listing alert"`)
  await page.screenshot({ path: 'out/ws5-help-verify/help-2-search.png', fullPage: true })
  // No-match state stays honest
  await searchInput.fill('zzzz no such thing')
  await page.waitForTimeout(800)
  const none = await page.locator('a[href^="/admin/help/"]').count()
  pass('help: no-match search shows zero articles', none === 0, `${none} links`)
  await searchInput.fill('')
  await page.waitForTimeout(500)
}

// Open one article
await page.goto(`${BASE}/admin/help/set-up-a-listing-alert`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
await page.waitForTimeout(1500)
const articleBody = await page.evaluate(() => document.body.innerText)
pass('help: article renders body', /listing alert/i.test(articleBody) && articleBody.length > 500, `${articleBody.length} chars`)
pass('help: article uses renamed hub', /Alerts & reports/i.test(articleBody), 'mentions Alerts & reports')
await page.screenshot({ path: 'out/ws5-help-verify/help-3-article.png', fullPage: true })

// ── Mobile: Help button at 390x844 ───────────────────────────────────────────
console.log('\n-- Mobile Help button (390x844) --')
const mobile = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } })
await mobile.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const mp = await mobile.newPage()
await mp.goto(`${BASE}/admin/broker-dashboard`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
await mp.waitForTimeout(2500)
await clearDevOverlay(mp)
const mBtn = mp.locator('button[aria-label="Help"]')
pass('mobile: Help button visible', await mBtn.isVisible().catch(() => false))
await mBtn.click().catch(() => {})
await mp.waitForTimeout(600)
const mSheet = await mp.getByText('Guided walkthroughs and how-to articles', { exact: false }).isVisible().catch(() => false)
pass('mobile: Help sheet opens', mSheet)
await mp.screenshot({ path: 'out/ws5-help-verify/mobile-help-sheet.png' })
await mobile.close()

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(', '))
process.exit(failed.length > 0 ? 1 : 0)
