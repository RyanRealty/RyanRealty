#!/usr/bin/env node
/**
 * Production accept for the listing down-payment class.
 *
 *   node scripts/probe-rockway-down-payment-prod.mjs
 */
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const URL = 'https://ryan-realty.com/homes-for-sale/bend/61579-rockway-220226183'

const html = await fetch(URL, { headers: CI_PROBE_HEADERS }).then(async (res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
})

const counts = {
  down130: (html.match(/\$130,000/g) ?? []).length,
  down1298: (html.match(/\$129,800/g) ?? []).length,
  loan519k: (html.match(/\$519,000/g) ?? []).length,
  loan5192: (html.match(/\$519,200/g) ?? []).length,
  price649: (html.match(/\$649,000/g) ?? []).length,
  monthly: (html.match(/Monthly payment/g) ?? []).length,
  rental: (html.match(/Rental analysis/g) ?? []).length,
}

const loanLine = html.match(/Loan amount[\s\S]{0,280}down/)
const rentalLine = html.match(/20[\s\S]{0,80}\$129,800/)

const ok =
  counts.monthly >= 1 &&
  counts.rental >= 1 &&
  counts.down1298 >= 2 &&
  counts.down130 === 0 &&
  counts.loan5192 >= 1 &&
  counts.loan519k === 0 &&
  /\$519,200/.test(loanLine?.[0] ?? '') &&
  /\$129,800/.test(loanLine?.[0] ?? '') &&
  Boolean(rentalLine)

console.log(
  JSON.stringify(
    {
      url: URL,
      counts,
      loanLine: loanLine?.[0]?.replace(/\s+/g, ' ').slice(0, 240) ?? null,
      rentalLine: rentalLine?.[0]?.replace(/\s+/g, ' ').slice(0, 160) ?? null,
      ok,
    },
    null,
    2,
  ),
)

if (!ok) {
  console.error('ACCEPT FAIL: listing down-payment figures still disagree')
  process.exit(1)
}
console.log('ACCEPT OK: Monthly payment and Rental analysis share $129,800 / $519,200')
