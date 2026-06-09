#!/usr/bin/env node
/**
 * check-rental-calculator.mjs — smoke gate: the rental property calculator tool
 * renders its interactive calculator, not just a page shell.
 *
 * WHY: /tools/rental-property-calculator is a lead-gen + utility surface (run the
 * numbers on any rental: cash flow, cap rate, cash-on-cash, 30-yr projection). A
 * blank shell or a hydration failure would silently kill it on an HTTP 200. This
 * asserts the calculator's result labels render so a broken build or a removed
 * island is caught.
 *
 * Runs against the live deploy. Override with RENTAL_SMOKE_BASE.
 *
 * Usage: node scripts/check-rental-calculator.mjs
 */
const BASE = (process.env.RENTAL_SMOKE_BASE || 'https://ryan-realty.com').replace(/\/$/, '')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const LATENCY_BUDGET_MS = 10000
const PATH = '/tools/rental-property-calculator'
// Markers the calculator island renders (result labels + the page title).
const REQUIRED = [/Rental Property Calculator/i, /Cap rate/i, /Monthly cash flow/i, /Cash-on-cash/i]

async function main() {
  const url = `${BASE}${PATH}?_smoke=${Date.now()}`
  const t0 = Date.now()
  let res, html
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    html = await res.text()
  } catch (e) {
    console.log(`  FAIL  ${PATH} — fetch failed: ${e.message}`)
    process.exit(1)
  }
  const ms = Date.now() - t0
  console.log('Rental-calculator smoke gate')
  console.log('============================\n')
  console.log(`Host: ${BASE}\n`)

  const fails = []
  if (res.status !== 200) fails.push(`HTTP ${res.status}`)
  if (/"digest":"\d+"/.test(html)) fails.push('server error boundary (Next digest)')
  for (const re of REQUIRED) if (!re.test(html)) fails.push(`missing marker ${re}`)
  if (ms > LATENCY_BUDGET_MS) fails.push(`too slow: ${ms}ms`)

  if (fails.length) {
    console.log(`  FAIL  ${PATH} — ${fails.join('; ')}`)
    console.log('\nThe rental calculator must render its interactive calculator within the budget.')
    process.exit(1)
  }
  console.log(`  OK    ${PATH} — calculator rendered, ${ms}ms`)
  process.exit(0)
}

main()
