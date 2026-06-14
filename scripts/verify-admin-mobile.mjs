#!/usr/bin/env node
/**
 * verify-admin-mobile.mjs — scan EVERY admin page on the live deploy in a real
 * signed-in session: does it work (no 500 / console error / error boundary), is
 * it free of mobile overflow, and screenshot it for design review.
 *
 * Admin auth is Google-Workspace only (no scriptable login), so we mint an admin
 * session for ADMIN_EMAIL via the Supabase service-role and inject the cookie.
 *
 *   node scripts/verify-admin-mobile.mjs            # scan all admin routes
 *   ROUTES=/admin/deals,/admin/crm node ...          # scan a subset
 *   DIAG=/admin/analytics node ...                   # list overflow offenders on one route
 *
 * Exit 0 = every scanned page works + no overflow.
 */
import { chromium, devices } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.BASE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'matt@ryan-realty.com'
const OUT = 'out/admin-mobile'
const iphone = devices['iPhone 13']
const LOGIN_RE = /continue with google|use your @ryan-realty\.com/i
const ERR_RE = /application error|something went wrong|this page could not be found|unhandled runtime|client-side exception|digest:/i

mkdirSync(OUT, { recursive: true })

function env(k) {
  const t = readFileSync('.env.local', 'utf8')
  return (t.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
}

// Discover every admin route from the filesystem (static routes only; dynamic
// [param] routes resolved separately with sample ids).
const PROT = 'app/admin/(protected)'
function discover(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...discover(p))
    else if (e === 'page.tsx') {
      const rel = dir.slice(PROT.length) // e.g. /analytics/ad-roi
      out.push('/admin' + rel)
    }
  }
  return out
}

async function sampleDynamicRoutes(supa) {
  const samples = []
  const q = async (sql) => { try { const { data } = await supa.rpc('noop'); return null } catch { return null } }
  // resolve one id per dynamic route via direct selects
  const one = async (table, col, where) => {
    try { let b = supa.from(table).select(col).limit(1); if (where) b = where(b); const { data } = await b; return data?.[0]?.[col] ?? null } catch { return null }
  }
  const cycleKey = await one('tc_cycles', 'deal_id')
  const dealKey = await one('tc_deals', 'property_key')
  const personId = await one('crm_people', 'id', (b) => b.eq('deleted', false))
  const fubId = await one('crm_people', 'fub_legacy_id', (b) => b.not('fub_legacy_id', 'is', null))
  const listingKey = await one('listings', 'ListingKey', (b) => b.eq('StandardStatus', 'Active'))
  const sessionId = await one('visitor_sessions', 'session_id')
  const envId = await one('tc_envelopes', 'id')
  if (dealKey) samples.push(`/admin/deals/${dealKey}`)
  if (personId) samples.push(`/admin/crm/${personId}`)
  if (fubId) samples.push(`/admin/people/${fubId}`)
  if (listingKey) samples.push(`/admin/listings/${encodeURIComponent(listingKey)}`)
  if (sessionId) samples.push(`/admin/visitors/${sessionId}`)
  if (envId) samples.push(`/admin/signing/${envId}`)
  return samples
}

async function mintCookies(email) {
  const url = env('NEXT_PUBLIC_SUPABASE_URL'); const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY'); const service = env('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createSb(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (le) throw new Error('generateLink: ' + le.message)
  const tokenHash = link?.properties?.hashed_token
  const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  let v = await anonC.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (v.error) v = await anonC.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (v.error) throw new Error('verifyOtp: ' + v.error.message)
  const session = v.data.session
  const jar = {}
  const ssr = createServerClient(url, anon, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => { jar[name] = value }) } })
  await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  return { cookies: Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE })), supa: admin }
}

const { cookies, supa } = await mintCookies(ADMIN_EMAIL)
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ ...iphone })
await ctx.addCookies(cookies)
const page = ctx.pages()[0] ?? (await ctx.newPage())

let consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + (e.message || '').slice(0, 160)))

await page.goto(`${BASE}/admin/broker-dashboard`, { waitUntil: 'load' })
if (LOGIN_RE.test(await page.evaluate(() => document.body.innerText))) {
  console.error('FAIL: minted session not accepted'); await browser.close(); process.exit(2)
}

let routes
if (process.env.ROUTES) routes = process.env.ROUTES.split(',').map((r) => r.trim())
else if (process.env.DIAG) routes = [process.env.DIAG]
else {
  const staticRoutes = [...new Set(discover(PROT).filter((r) => !r.includes('[')))].sort()
  const dyn = await sampleDynamicRoutes(supa)
  routes = [...staticRoutes, ...dyn]
}

if (process.env.DIAG) {
  await page.goto(`${BASE}${process.env.DIAG}`, { waitUntil: 'load' }); await page.waitForTimeout(900)
  const offenders = await page.evaluate(() => {
    const W = document.documentElement.clientWidth; const out = []
    for (const el of document.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0 && el.children.length <= 3) out.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 90), right: Math.round(r.right), w: Math.round(r.width) }) }
    return out.sort((a, b) => b.right - a.right).slice(0, 12)
  })
  console.log(JSON.stringify(offenders, null, 2)); await browser.close(); process.exit(0)
}

const THROTTLE = Number(process.env.THROTTLE ?? 3500)
console.log(`Scanning ${routes.length} admin routes at 390px (throttle ${THROTTLE}ms)...\n`)

async function scanOnce(route) {
  consoleErrors = []
  const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 45_000 })
  await page.waitForTimeout(700)
  const body = await page.evaluate(() => document.body.innerText)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  return { status: resp?.status() ?? 0, body, overflow, errs: [...consoleErrors] }
}

const results = []
for (const route of routes) {
  try {
    let r = await scanOnce(route)
    // 429 = self-inflicted rate limit from the scan; back off and retry once.
    if (r.errs.some((e) => /\b429\b/.test(e))) { await page.waitForTimeout(9000); r = await scanOnce(route) }
    await page.screenshot({ path: `${OUT}/${route.replace(/^\//, '').replace(/[\/]/g, '_')}.png`, fullPage: true })
    const realErrs = r.errs.filter((e) => !/\b429\b/.test(e))
    const rate = r.errs.length - realErrs.length
    const problems = []
    if (r.status >= 500) problems.push(`http ${r.status}`)
    if (LOGIN_RE.test(r.body)) problems.push('not authed')
    if (ERR_RE.test(r.body)) problems.push('error boundary')
    if (realErrs.length) problems.push(`console: ${realErrs[0]}`)
    if (r.overflow > 2) problems.push(`overflow ${r.overflow}px`)
    results.push({ route, ok: problems.length === 0, problems, rate })
    console.log(`${problems.length === 0 ? 'PASS' : 'FAIL'}  ${route.padEnd(40)} ${problems.join(' | ')}${rate && !problems.length ? `  (rate-limited x${rate}, ignored)` : ''}`)
  } catch (e) {
    results.push({ route, ok: false, problems: ['exception: ' + (e instanceof Error ? e.message : String(e)).slice(0, 80)] })
    console.log(`FAIL  ${route.padEnd(40)} exception`)
  }
  await page.waitForTimeout(THROTTLE)
}

await browser.close()
const fails = results.filter((r) => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} pages clean (429 rate-limits ignored). Screenshots: ${OUT}/`)
if (fails.length) { console.log('\nREAL FAILURES:'); for (const f of fails) console.log(`  ${f.route} — ${f.problems.join(' | ')}`) }
process.exit(fails.length ? 1 : 0)
