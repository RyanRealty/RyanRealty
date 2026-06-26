#!/usr/bin/env node
/**
 * admin-route-smoke.mjs (npm run e2e:admin-smoke)
 *
 * Renders the authed /admin/crm/* surfaces and fails if any returns a runtime
 * error boundary. This catches the RSC RUNTIME crash class that NO build catches
 * — e.g. a function passed from a server component to a client component 500s on
 * every request ("Functions cannot be passed directly to Client Components"),
 * which took down /admin/crm/tasks and /admin/crm/inbox while tsc + next build +
 * ci:gates were all green. The static ci:rsc-fn-props gate catches the known
 * format*-prop shape; this is the broad runtime backstop.
 *
 * OPT-IN: admin pages require an authenticated admin session, so this needs a
 * cookie. It SKIPS cleanly (exit 0) when ADMIN_SMOKE_COOKIE is unset, so it is
 * safe to wire anywhere (CI without the secret is a no-op).
 *
 *   ADMIN_SMOKE_COOKIE='<full Cookie header from a logged-in admin browser>' \
 *   ADMIN_SMOKE_BASE_URL='https://ryan-realty.com' \
 *   npm run e2e:admin-smoke
 *
 * Grab the cookie from DevTools → Network → any /admin request → Request Headers
 * → Cookie. To run in CI, store it as a secret (refresh when the session rotates)
 * or have a setup step log a CI-only admin account in and capture the cookie.
 */

const BASE = (process.env.ADMIN_SMOKE_BASE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
const COOKIE = process.env.ADMIN_SMOKE_COOKIE

const ROUTES = [
  '/admin/crm',
  '/admin/crm/inbox',
  '/admin/crm/tasks',
  '/admin/crm/deals',
  '/admin/crm/sequences',
  '/admin/crm/workflows',
  '/admin/crm/approvals',
  '/admin/crm/new',
  '/admin/crm/settings',
  '/admin/crm/settings/stages',
  '/admin/crm/settings/tags',
  '/admin/crm/settings/templates',
  '/admin/crm/settings/segments',
  '/admin/crm/settings/areas',
  '/admin/crm/settings/brokers',
  '/admin/crm/settings/suppression',
  '/admin/crm/settings/custom-fields',
  '/admin/crm/settings/assignment',
  '/admin/crm/settings/market-reports',
  '/admin/reports/emails',
]

// Substrings that mean the page hit an error boundary / 404 rather than rendering.
const FAIL_MARKERS = [
  'Admin error',
  'Something went wrong in the admin',
  'Application error',
  'Page not found',
]

console.log('admin-route-smoke (npm run e2e:admin-smoke)')
console.log('===========================================')

if (!COOKIE) {
  console.log('SKIP — ADMIN_SMOKE_COOKIE not set. Pass a logged-in admin Cookie header to run.')
  console.log('  (No-op so this is safe to wire into CI without the secret.)')
  process.exit(0)
}

const failures = []
let ok = 0

for (const route of ROUTES) {
  const url = BASE + route
  try {
    const res = await fetch(url, {
      headers: { Cookie: COOKIE, 'User-Agent': 'admin-route-smoke' },
      redirect: 'manual',
    })
    // A 3xx means the auth layer bounced us — the cookie is missing/expired, so
    // we are NOT actually testing the page. Treat as a hard failure (bad cookie),
    // not a pass, so a stale cookie can never give a false green.
    if (res.status >= 300 && res.status < 400) {
      failures.push(`${route} → ${res.status} redirect (cookie expired? not authenticated as admin)`)
      continue
    }
    if (res.status !== 200) {
      failures.push(`${route} → HTTP ${res.status}`)
      continue
    }
    const body = await res.text()
    const hit = FAIL_MARKERS.find((m) => body.includes(m))
    if (hit) {
      failures.push(`${route} → rendered error boundary ("${hit}")`)
      continue
    }
    ok++
    console.log(`  ✓ ${route}`)
  } catch (err) {
    failures.push(`${route} → ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log('')
if (failures.length) {
  console.error(`✗ ${failures.length} admin route(s) failed (${ok} ok):`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  if (failures.every((f) => f.includes('redirect'))) {
    console.error('\nAll failures are redirects — the cookie is almost certainly expired. Grab a fresh one.')
  }
  process.exit(1)
}
console.log(`✓ all ${ok} admin routes rendered without an error boundary.`)
process.exit(0)
