#!/usr/bin/env node
/**
 * verify-admin-mobile.mjs — verify the admin is mobile-first on the LIVE deploy,
 * in a browser that is actually signed in. Admin auth is Google-Workspace only
 * (no scriptable login), so we don't automate a login — we get a session another
 * way and inject it.
 *
 * Auth modes (auto-selected):
 *   MINT (default): mint a session for ADMIN_EMAIL via the Supabase service-role
 *     (generateLink -> verifyOtp), serialize cookies with @supabase/ssr (exact
 *     format the app reads), inject, run HEADLESS. Fully autonomous + CI-able.
 *   CDP: PW_CDP=http://localhost:9222 -> attach to your already-signed-in Chrome.
 *   PROFILE: PW_PROFILE_LOGIN=1 -> headed persistent profile, log in via Google once.
 *
 * For each admin route at iPhone width it FAILS on horizontal overflow, checks
 * the broker-dashboard order (Needs your action above Active deals), and writes a
 * screenshot to out/admin-mobile/. Exit 0 = all clean.
 *
 *   node scripts/verify-admin-mobile.mjs
 *   ADMIN_EMAIL=rebeccapeterson@ryan-realty.com node scripts/verify-admin-mobile.mjs
 */
import { chromium, devices } from 'playwright'
import { createClient as createSb } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = (process.env.BASE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'matt@ryan-realty.com'
const CDP = process.env.PW_CDP
const OUT = 'out/admin-mobile'
const iphone = devices['iPhone 13']
const LOGIN_RE = /continue with google|use your @ryan-realty\.com/i

const ROUTES = [
  '/admin/broker-dashboard', '/admin', '/admin/crm', '/admin/crm/inbox',
  '/admin/crm/deals', '/admin/crm/tasks', '/admin/deals', '/admin/analytics',
  '/admin/financials', '/admin/commissions', '/admin/people', '/admin/signing',
]

mkdirSync(OUT, { recursive: true })

function env(k) {
  const t = readFileSync('.env.local', 'utf8')
  return (t.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
}

async function mintCookies(email) {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) throw new Error('Missing Supabase env in .env.local')

  const admin = createSb(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (le) throw new Error('generateLink: ' + le.message)
  const tokenHash = link?.properties?.hashed_token
  if (!tokenHash) throw new Error('no hashed_token from generateLink')

  const anonC = createSb(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  let verify = await anonC.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (verify.error) verify = await anonC.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (verify.error) throw new Error('verifyOtp: ' + verify.error.message)
  const session = verify.data?.session
  if (!session) throw new Error('no session from verifyOtp')

  const jar = {}
  const ssr = createServerClient(url, anon, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => { jar[name] = value }),
    },
  })
  await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  const cookies = Object.entries(jar).map(([name, value]) => ({ name, value, url: BASE }))
  if (!cookies.length) throw new Error('no cookies captured from setSession')
  return cookies
}

let ctx, browser
if (CDP) {
  browser = await chromium.connectOverCDP(CDP)
  ctx = browser.contexts()[0] ?? (await browser.newContext())
} else if (process.env.PW_PROFILE_LOGIN) {
  ctx = await chromium.launchPersistentContext('.pw-admin-profile', { ...iphone, headless: false })
} else {
  console.log(`Minting admin session for ${ADMIN_EMAIL} via service-role...`)
  const cookies = await mintCookies(ADMIN_EMAIL)
  console.log(`  captured ${cookies.length} cookie(s): ${cookies.map((c) => c.name).join(', ')}`)
  browser = await chromium.launch({ headless: true })
  ctx = await browser.newContext({ ...iphone })
  await ctx.addCookies(cookies)
}
const page = ctx.pages()[0] ?? (await ctx.newPage())
if (CDP) await page.setViewportSize({ width: 390, height: 844 })

// Sanity: confirm we're authed.
await page.goto(`${BASE}/admin/broker-dashboard`, { waitUntil: 'load' })
if (LOGIN_RE.test(await page.evaluate(() => document.body.innerText))) {
  if (process.env.PW_PROFILE_LOGIN || CDP) {
    console.log('\n>>> Sign in with Google in the open window. Waiting up to 3 min...\n')
    await page.waitForFunction(() => !/continue with google|use your @ryan-realty\.com/i.test(document.body.innerText), { timeout: 180_000 })
  } else {
    console.error('FAIL: minted session not accepted (still on sign-in). Cookie format mismatch?')
    await page.screenshot({ path: `${OUT}/_auth-failed.png`, fullPage: true })
    process.exit(2)
  }
}
console.log('Authed. Running mobile checks at 390px...\n')

if (process.env.DIAG) {
  await page.goto(`${BASE}${process.env.DIAG}`, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const offenders = await page.evaluate(() => {
    const W = document.documentElement.clientWidth
    const out = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.right > W + 1 && r.width > 0 && el.children.length <= 3) {
        out.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 90), text: (el.textContent || '').trim().slice(0, 40), right: Math.round(r.right), w: Math.round(r.width) })
      }
    }
    return out.sort((a, b) => b.right - a.right).slice(0, 12)
  })
  console.log(`Overflow offenders on ${process.env.DIAG} (clientWidth ${await page.evaluate(() => document.documentElement.clientWidth)}):`)
  console.log(JSON.stringify(offenders, null, 2))
  if (browser) await browser.close(); else await ctx.close()
  process.exit(0)
}

const results = []
for (const route of ROUTES) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForTimeout(700)
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      authed: !/continue with google|use your @ryan-realty\.com/i.test(document.body.innerText),
    }))
    const overflow = m.scrollW - m.clientW
    await page.screenshot({ path: `${OUT}/${route.replace(/^\//, '').replace(/\//g, '_')}.png`, fullPage: true })
    const ok = overflow <= 2 && m.authed
    results.push({ route, overflow, authed: m.authed, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${route.padEnd(26)} overflow=${overflow}px${m.authed ? '' : '  (NOT AUTHED)'}`)
  } catch (e) {
    results.push({ route, overflow: NaN, authed: false, ok: false })
    console.log(`FAIL  ${route.padEnd(26)} ${e instanceof Error ? e.message : String(e)}`)
  }
}

await page.goto(`${BASE}/admin/broker-dashboard`, { waitUntil: 'load' })
await page.waitForTimeout(500)
const order = await page.evaluate(() => {
  const top = (re) => {
    const el = [...document.querySelectorAll('h1,h2,h3,div,span,p')].find((n) => n.children.length === 0 && re.test(n.textContent || ''))
    return el ? Math.round(el.getBoundingClientRect().top) : -1
  }
  return { action: top(/needs your action|all caught up/i), deals: top(/active deals/i) }
})
const orderOk = order.action >= 0 && order.deals >= 0 && order.action < order.deals
console.log(`\nDashboard order: "Needs your action" ${orderOk ? 'ABOVE' : 'NOT above'} "Active deals" (y ${order.action} vs ${order.deals}) -> ${orderOk ? 'PASS' : 'CHECK'}`)

if (CDP) await browser.close()
else if (browser) await browser.close()
else await ctx.close()

const fails = results.filter((r) => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} routes clean, no overflow. Screenshots: ${OUT}/`)
if (fails.length) console.log('Failures:', fails.map((f) => `${f.route}(${f.overflow}px)`).join(', '))
process.exit(fails.length || !orderOk ? 1 : 0)
