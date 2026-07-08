// Phase 2 consolidation verification (admin consolidation 2026-07-07):
//   - /admin/people + /admin/people/[fubId] redirect to the CRM / person page
//   - /admin/reports redirects to the Performance hub; hub carries the merged
//     report catalog + weekly report tool + city builder
//   - /admin/query-builder redirects to /admin/listings; the listings browser
//     carries the advanced query + CSV export panel and it actually runs
//   - Home dashboard shows the Email delivery section (+ Hot leads for Matt)
//   - The nav shows Alerts & reports + Performance, and no dead entries
// Screenshots land in out/phase2-verify/.
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

mkdirSync('out/phase2-verify', { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()

const results = []
const pass = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }
async function clearDevOverlay(p) {
  await p.evaluate(() => document.querySelector('nextjs-portal')?.remove()).catch(() => {})
}
async function goto(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await clearDevOverlay(page)
}

// ── Redirects ────────────────────────────────────────────────────────────────
console.log('\n-- Redirects --')
await goto('/admin/people')
pass('people index redirects to contacts', page.url().includes('/admin/crm'), page.url())

await goto('/admin/people/21966')
pass('people/[fubId] redirects to person page', page.url().includes('/admin/console/leads/13168'), page.url())

await goto('/admin/reports')
pass('reports redirects to Performance hub', page.url().includes('/admin/analytics'), page.url())

await goto('/admin/query-builder')
pass('query-builder redirects to listings', page.url().includes('/admin/listings'), page.url())

// ── Performance hub ──────────────────────────────────────────────────────────
console.log('\n-- Performance hub --')
await goto('/admin/analytics')
const hubText = await page.evaluate(() => document.body.innerText)
pass('hub titled Performance', /^|\n?Performance\n/.test(hubText) && hubText.includes('Performance'))
pass('hub has GA4 tabs', hubText.includes('Acquisition') && hubText.includes('Conversions'))
pass('hub has report catalog', hubText.includes('All reports') && hubText.includes('Market report by area') && hubText.includes('Broker performance'))
pass('hub has weekly report tool', hubText.includes('Weekly market report'))
await page.screenshot({ path: 'out/phase2-verify/hub-top.png' })
await page.screenshot({ path: 'out/phase2-verify/hub-full.png', fullPage: true })

// ── Listings CSV export panel ────────────────────────────────────────────────
console.log('\n-- Listings CSV export --')
await goto('/admin/listings')
const csvHeader = page.getByText('Advanced query and CSV export', { exact: true })
pass('listings shows export panel header', await csvHeader.isVisible().catch(() => false))
await csvHeader.click().catch(() => {})
await page.waitForTimeout(600)
await page.locator('#qb-city').fill('Bend').catch((e) => pass('fill city', false, e.message))
await page.getByRole('button', { name: 'Run query' }).click().catch((e) => pass('run query', false, e.message))
await page.waitForTimeout(6000)
const listText = await page.evaluate(() => document.body.innerText)
const matched = /([\d,]+)\s+of\s+([\d,]+)\s+matching listings/.exec(listText)
pass('query returns results', Boolean(matched), matched ? matched[0] : 'no result line')
pass('CSV download button present', await page.getByRole('button', { name: 'Download CSV' }).isVisible().catch(() => false))
await page.screenshot({ path: 'out/phase2-verify/listings-csv-export.png', fullPage: true })

// ── Home dashboard: delivery + hot leads ─────────────────────────────────────
console.log('\n-- Home dashboard --')
await goto('/admin/broker-dashboard')
const dashText = await page.evaluate(() => document.body.innerText)
pass('dashboard has Email delivery section', /email delivery/i.test(dashText))
pass('dashboard has Hot leads card (superuser)', /hot leads/i.test(dashText))
const deliverySection = page.locator('[data-tour="dash-delivery"]')
pass('delivery section anchored for the tour', await deliverySection.isVisible().catch(() => false))
await deliverySection.scrollIntoViewIfNeeded().catch(() => {})
await page.screenshot({ path: 'out/phase2-verify/dashboard-delivery.png' })

// ── Nav state ────────────────────────────────────────────────────────────────
console.log('\n-- Nav --')
// The Reports nav group is collapsed by default and only mounts its items when
// expanded — open every collapsed section header before reading the links.
for (const label of ['Reports', 'Admin']) {
  await page.getByRole('button', { name: label, exact: true }).first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)
}
const navLinks = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a[href^="/admin"]')).map((a) => ({
    href: a.getAttribute('href'),
    text: (a.textContent ?? '').trim(),
  })),
)
const linkText = (href) => navLinks.filter((l) => l.href === href).map((l) => l.text).join(' | ')
pass('nav: subscriptions entry says Alerts & reports', /alerts & reports/i.test(linkText('/admin/crm/subscriptions')), linkText('/admin/crm/subscriptions'))
pass('nav: analytics entry says Performance', /performance/i.test(linkText('/admin/analytics')), linkText('/admin/analytics'))
pass('nav: no Query builder link', !navLinks.some((l) => l.href === '/admin/query-builder'), '')
pass('nav: no standalone Reports launchpad link', !navLinks.some((l) => l.href === '/admin/reports'), '')

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) console.log('FAILED: ' + failed.map((f) => f.name).join(', '))
process.exit(failed.length > 0 ? 1 : 0)
