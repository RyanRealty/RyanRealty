// Phase 0 admin consolidation audit — visit every top-level admin route as an
// authenticated superuser, screenshot it, and record console errors + basic
// render evidence. Output: out/admin-audit/<route>.png + out/admin-audit/report.json
import { chromium, devices } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

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

const ROUTES = [
  '/admin', '/admin/analytics', '/admin/approval-queue', '/admin/audit-log', '/admin/banners',
  '/admin/blog', '/admin/broker-dashboard', '/admin/broker-links', '/admin/brokers', '/admin/cmas',
  '/admin/commissions', '/admin/crm', '/admin/crm/subscriptions', '/admin/deals', '/admin/email',
  '/admin/expired-listings', '/admin/financials', '/admin/forms', '/admin/fub-attribution',
  '/admin/geo', '/admin/guides', '/admin/listings', '/admin/media', '/admin/newsletters',
  '/admin/operations', '/admin/optimization', '/admin/people', '/admin/photos', '/admin/producers',
  '/admin/query-builder', '/admin/reports', '/admin/resort-communities', '/admin/search',
  '/admin/settings', '/admin/sign-off', '/admin/signing', '/admin/site-pages', '/admin/spark-status',
  '/admin/stock-photos', '/admin/sync', '/admin/users', '/admin/visitors',
]

mkdirSync('out/admin-audit', { recursive: true })
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } })
await ctx.addCookies(Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })))
const page = await ctx.newPage()

const report = []
const consoleErrors = []
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)) })
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + String(err).slice(0, 300)))

for (const route of ROUTES) {
  consoleErrors.length = 0
  const slug = route.replace(/^\/admin\/?/, '') || 'home'
  const file = `out/admin-audit/${slug.replace(/\//g, '-')}.png`
  let status = null, finalUrl = null, h1 = '', bodyLen = 0, err = null
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    status = resp?.status() ?? null
    await page.waitForTimeout(3500)
    finalUrl = page.url()
    h1 = (await page.locator('h1, h2').first().textContent({ timeout: 3000 }).catch(() => '')) ?? ''
    bodyLen = (await page.locator('body').textContent().catch(() => ''))?.length ?? 0
    await page.screenshot({ path: file, fullPage: false })
  } catch (e) {
    err = String(e).slice(0, 200)
  }
  const entry = { route, status, finalUrl: finalUrl?.replace(BASE, ''), h1: h1.trim().slice(0, 80), bodyLen, consoleErrors: [...new Set(consoleErrors)].slice(0, 5), error: err }
  report.push(entry)
  console.log(`${route}  →  ${status}  ${entry.finalUrl ?? ''}  h1="${entry.h1}"  errors=${entry.consoleErrors.length}${err ? '  ERR=' + err : ''}`)
}

writeFileSync('out/admin-audit/report.json', JSON.stringify(report, null, 2))
await browser.close()
console.log('\nDone. Report: out/admin-audit/report.json')
