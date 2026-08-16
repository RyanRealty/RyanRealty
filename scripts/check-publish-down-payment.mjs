#!/usr/bin/env node
/**
 * Listing down-payment publish lock.
 *
 * Two financing widgets on one listing must print the same down-payment
 * dollars. publishFinancingSplit is the split. Display is exact whole
 * dollars, never nearest-thousand.
 * Founding case: /homes-for-sale/bend/61579-rockway-220226183 Monthly
 * payment $130,000 vs Rental analysis $129,800
 * (fleet 0b2eea305a233f4a1d246cf2e8f1a299).
 *
 *   node scripts/check-publish-down-payment.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/finance/publish-down-payment.ts')
checks.push({
  label: 'publishFinancingSplit is whole-dollar down plus remainder loan',
  ok:
    /export function publishFinancingSplit/.test(helper) &&
    helper.includes('Math.round((price * downPaymentPct) / 100)') &&
    helper.includes('price - downPayment'),
})

const listingMortgage = src('components/site/listing-detail/MortgageCalculator.tsx')
checks.push({
  label: 'listing Monthly payment gates loan/down through publishFinancingSplit + Price exact',
  ok:
    /from ['"]@\/lib\/finance\/publish-down-payment['"]/.test(listingMortgage) &&
    /publishFinancingSplit\(/.test(listingMortgage) &&
    listingMortgage.includes('<Price value={result.principal} exact />') &&
    listingMortgage.includes('<Price value={result.down} exact />') &&
    !/Loan amount <Price value=\{Math\.round\(result\.principal\)\} \/>/.test(listingMortgage),
})

const rental = src('lib/rental-analysis.ts')
checks.push({
  label: 'rental engine acquires down/loan through publishFinancingSplit',
  ok:
    /from ['"]\.\/finance\/publish-down-payment['"]/.test(rental) &&
    /publishFinancingSplit\(/.test(rental),
})

const mortgage = src('lib/mortgage.ts')
checks.push({
  label: 'estimatedMonthlyPayment uses the published loan amount',
  ok:
    /from ['"]\.\/finance\/publish-down-payment['"]/.test(mortgage) &&
    /publishFinancingSplit\(/.test(mortgage),
})

const tools = src('app/tools/mortgage-calculator/MortgageCalculator.tsx')
checks.push({
  label: 'standalone mortgage calculator gates down/loan through publishFinancingSplit',
  ok:
    /from ['"]@\/lib\/finance\/publish-down-payment['"]/.test(tools) &&
    /publishFinancingSplit\(/.test(tools),
})

const showcase = src('components/listing/PaymentCalculator.tsx')
checks.push({
  label: 'showcase payment calculator uses the published loan amount',
  ok:
    /from ['"]@\/lib\/finance\/publish-down-payment['"]/.test(showcase) &&
    /publishFinancingSplit\(/.test(showcase),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-down-payment: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-down-payment: ${checks.length}/${checks.length}`)
