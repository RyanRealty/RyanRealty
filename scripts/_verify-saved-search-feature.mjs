// Browser verification for the saved-search + subscriptions build (W5).
// Mints a session for matt@ryan-realty.com against the local dev server,
// walks the new surfaces, and writes screenshots to out/saved-search-verify/.
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
const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'matt@ryan-realty.com' })
if (linkErr) { console.error('generateLink failed:', linkErr.message); process.exit(1) }
const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
let v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
if (v.error) v = await anonC.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
if (v.error) { console.error('verifyOtp failed:', v.error.message); process.exit(1) }
const session = v.data.session
const jar = {}
const ssr = createServerClient(url, anon, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }) } })
await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })

mkdirSync('out/saved-search-verify', { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)) })

async function check(route, mustHave, shot, opts = {}) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(opts.wait ?? 2500)
  const text = await page.evaluate(() => document.body.innerText)
  console.log(`\n== ${route} ==`)
  let ok = true
  for (const s of mustHave) {
    const has = text.includes(s)
    if (!has) ok = false
    console.log(`  HAS "${s}": ${has ? 'YES' : 'NO'}`)
  }
  await page.screenshot({ path: `out/saved-search-verify/${shot}`, fullPage: opts.fullPage ?? false })
  return ok
}

// 1. Admin subscriptions hub
await check('/admin/crm/subscriptions', ['Listing alerts', 'Saved searches', 'Market reports'], 'admin-subscriptions-hub.png', { fullPage: true })

// 2. Tab interactions: switch to Market reports tab
await page.getByRole('tab', { name: 'Market reports' }).click().catch((e) => console.log('  tab click failed:', e.message))
await page.waitForTimeout(1500)
await page.screenshot({ path: 'out/saved-search-verify/admin-subscriptions-reports-tab.png', fullPage: true })

// 3. Account saved searches
await check('/account/saved-searches', ['Saved searches'], 'account-saved-searches.png', { fullPage: true })

// 4. Notification prefs (market report self-subscribe)
await check('/account/notifications', ['Market report'], 'account-notifications.png', { fullPage: true })

// 5. Search page (SaveSearchButton)
await check('/search/bend?minPrice=500000&beds=3', ['Save'], 'search-bend.png')

// 6. Mobile: subscriptions hub
const mobile = await browser.newContext({ ...devices['iPhone 13'] })
await mobile.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const mp = await mobile.newPage()
await mp.goto(`${BASE}/admin/crm/subscriptions`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await mp.waitForTimeout(2500)
await mp.screenshot({ path: 'out/saved-search-verify/admin-subscriptions-mobile.png', fullPage: true })

console.log('\nConsole errors (first 10):')
for (const e of consoleErrors.slice(0, 10)) console.log('  -', e)
if (consoleErrors.length === 0) console.log('  none')

await browser.close()
console.log('\nDone. Screenshots in out/saved-search-verify/')
