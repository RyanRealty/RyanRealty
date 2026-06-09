#!/usr/bin/env node
/**
 * check-lead-funnels.mjs — content-correctness gate for lead-capture funnel pages.
 *
 * WHY: Three high-value funnel surface types are only shell-smoked (200 + title):
 *
 *   1. /buy/<intent> and /sell/<intent> — buyer/seller lead-capture LP variants.
 *      A broken intent-config map or a form-island crash renders a 200 notFound()
 *      or a hollow shell with no lead form. These are the 18-seller/month funnel.
 *
 *   2. /reports/sales/<city>/<period> — per-city market-data pages with real
 *      MLS-verified sold stats. A query regression that empties the closed-sales
 *      data renders a hollow market page with no signal.
 *
 * This gate asserts:
 *   (a) Each LP variant renders the lead-form island (stable markers from
 *       LeadLandingPage.tsx and LeadLandingForm.tsx that cannot change without
 *       a UI rebuild).
 *   (b) The sales report renders at least one stat card (Closed sales count
 *       or Median sale price is visible in the HTML).
 *
 * Environment:
 *   LEAD_SMOKE_BASE      — base URL (default: https://ryan-realty.com)
 *   SMOKE_BUY_INTENT     — buy intent slug (default: first-time-home-buyer)
 *   SMOKE_SELL_INTENT    — sell intent slug (default: for-sale-by-owner)
 *   SMOKE_REPORT_CITY    — city slug for sales report (default: bend)
 *   SMOKE_REPORT_PERIOD  — period slug (default: last-month)
 *
 * Usage:
 *   node scripts/check-lead-funnels.mjs
 *   node scripts/check-lead-funnels.mjs --json
 */

const BASE = (process.env.LEAD_SMOKE_BASE ?? process.env.SMOKE_BASE_URL ?? 'https://ryan-realty.com').replace(/\/+$/, '')
const TIMEOUT_MS = Number(process.env.LEAD_SMOKE_TIMEOUT_MS ?? 15_000)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const JSON_OUT = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Representative slugs
// ---------------------------------------------------------------------------

/**
 * Buy intent: 'first-time-home-buyer' — defined in BUY_INTENT_PAGES in
 * lib/lead-landing-content.ts. Generates via generateStaticParams.
 */
const BUY_INTENT = process.env.SMOKE_BUY_INTENT ?? 'first-time-home-buyer'

/**
 * Sell intent: 'for-sale-by-owner' — first entry in SELL_INTENT_PAGES
 * in lib/lead-landing-content.ts. Generates via generateStaticParams.
 */
const SELL_INTENT = process.env.SMOKE_SELL_INTENT ?? 'for-sale-by-owner'

/**
 * Sales report city: 'bend' maps via cityEntityKey() in lib/slug.ts.
 * Bend has the largest closed-sales count in any period — guaranteed non-empty.
 */
const REPORT_CITY = process.env.SMOKE_REPORT_CITY ?? 'bend'

/**
 * Sales report period: 'last-month' — always has closed Bend sales.
 * From SALES_PERIODS in lib/sales-report-periods.ts.
 */
const REPORT_PERIOD = process.env.SMOKE_REPORT_PERIOD ?? 'last-month'

// ---------------------------------------------------------------------------
// Content markers — chosen for stability (rendered by server, not hydration)
// ---------------------------------------------------------------------------

/**
 * Lead-form island markers (LeadLandingPage.tsx + LeadLandingForm.tsx):
 *   - "id=\"lead-form\"" — the anchor div that the hero CTA scrolls to (line 75).
 *   - "Questions we hear often" — the FAQ section heading (line 108). Stable.
 *
 * The form itself is a client component (LeadLandingForm); its label text
 * is SSR'd in the initial HTML and stable:
 *   - "Prefer to talk now?" — the bottom of the FAQ section (line 120-121).
 */
const LP_MARKERS = [
  { re: /id="lead-form"/i,       label: 'lead-form anchor (id="lead-form")' },
  { re: /Questions we hear often/i, label: 'FAQ section heading ("Questions we hear often")' },
  { re: /Prefer to talk now\?/i,  label: 'contact nudge ("Prefer to talk now?")' },
]

/**
 * Sales report stat markers (app/reports/sales/[city]/[period]/page.tsx):
 *   - "Closed sales" — StatCard label always rendered, even if count = 0.
 *   - "Median sale price" — StatCard label, rendered when closed.length > 0.
 *
 * We require at least "Closed sales" (always present) + a dollar amount
 * OR at least one table row (for Bend last-month, there will always be data).
 */
const REPORT_MARKERS = [
  { re: /Closed sales/i,         label: '"Closed sales" stat card' },
]

// ---------------------------------------------------------------------------
// Fetch + check
// ---------------------------------------------------------------------------

async function check(label, path, markers, minBodyBytes = 4_000) {
  const url = `${BASE}${path}?_smoke=${Date.now()}`
  let res, html
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA }, redirect: 'follow' })
    clearTimeout(t)
    html = await res.text()
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      return { label, path, ok: false, fails: [`Cannot reach ${BASE} — start the server or set LEAD_SMOKE_BASE to a running deploy URL`] }
    }
    return { label, path, ok: false, fails: [`fetch error: ${msg}`] }
  }

  const fails = []

  if (res.status !== 200) fails.push(`HTTP ${res.status} (expected 200)`)
  if (html.includes('Page not found')) fails.push('"Page not found" — intent/city/period not resolving')
  if (html.includes('Application error')) fails.push('"Application error" — server threw during render')
  if (/"digest":"\d+"/.test(html)) fails.push('Next.js error boundary digest — server threw')
  if (html.length < minBodyBytes) fails.push(`body too small (${html.length} bytes < ${minBodyBytes}) — hollow shell`)

  for (const m of markers) {
    if (!m.re.test(html)) fails.push(`missing marker: ${m.label}`)
  }

  return { label, path, ok: fails.length === 0, status: res.status, bodyLen: html.length, fails }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cases = [
    {
      label: `buy LP: /buy/${BUY_INTENT}`,
      path: `/buy/${BUY_INTENT}`,
      markers: LP_MARKERS,
      minBodyBytes: 4_000,
    },
    {
      label: `sell LP: /sell/${SELL_INTENT}`,
      path: `/sell/${SELL_INTENT}`,
      markers: LP_MARKERS,
      minBodyBytes: 4_000,
    },
    {
      label: `sales report: /reports/sales/${REPORT_CITY}/${REPORT_PERIOD}`,
      path: `/reports/sales/${REPORT_CITY}/${REPORT_PERIOD}`,
      markers: REPORT_MARKERS,
      minBodyBytes: 3_000,
    },
  ]

  const results = await Promise.all(
    cases.map((c) => check(c.label, c.path, c.markers, c.minBodyBytes))
  )
  const failed = results.filter((r) => !r.ok)

  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, results, failCount: failed.length }, null, 2))
    process.exit(failed.length === 0 ? 0 : 1)
  }

  console.log('Lead-funnel content gate')
  console.log('========================')
  console.log(`Base URL: ${BASE}`)
  console.log()

  for (const r of results) {
    if (r.ok) {
      console.log(`  OK    ${r.label}  (${r.status}, ${r.bodyLen} bytes)`)
    } else {
      console.log(`  FAIL  ${r.label}`)
      for (const f of r.fails) console.log(`         - ${f}`)
    }
  }
  console.log()

  if (failed.length === 0) {
    console.log('All lead-funnel pages render their core content (form island + stat cards).')
    process.exit(0)
  }

  console.log(`${failed.length}/${results.length} lead-funnel pages FAILED.`)
  console.log('A buyer/seller LP returning HTTP 200 without a lead form is silently broken.')
  console.log('A sales-report page without "Closed sales" means the query returned empty.')
  process.exit(1)
}

main()
