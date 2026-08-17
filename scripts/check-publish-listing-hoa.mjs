#!/usr/bin/env node
/**
 * Listing HOA publish lock.
 *
 * Facts and True cost must print the same monthly HOA. Facts used
 * nearest-thousand Price ($22 → $0, $1,529 → $2,000). True cost used exact.
 * Founding cases: Foley 220221409, 7th 220223472, Canyons 220210064.
 *
 *   node scripts/check-publish-listing-hoa.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-hoa.ts')
checks.push({
  label: 'publishListingHoa prefers monthly and formats exact dollars',
  ok:
    /export function publishListingHoa/.test(helper) &&
    /export function formatListingHoa/.test(helper) &&
    helper.includes('asPositive(input.hoaMonthly)') &&
    helper.includes('toLocaleString'),
})

const facts = src('components/site/listing-detail/PropertySpecs.tsx')
checks.push({
  label: 'PropertySpecs facts HOA gates through publishListingHoa + Price exact',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-hoa['"]/.test(facts) &&
    /publishListingHoa\(/.test(facts) &&
    facts.includes('<Price value={hoa.monthly} exact />') &&
    !/label: 'HOA', value: <>[\s\S]*<Price value=\{listing\.hoaMonthly\} \/>/.test(facts),
})

const trueCost = src('components/site/listing-detail/HouseMeReport.tsx')
checks.push({
  label: 'HouseMe True cost HOA gates through publishListingHoa',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-hoa['"]/.test(trueCost) &&
    /publishListingHoa\(/.test(trueCost) &&
    /formatListingHoa\(/.test(trueCost) &&
    !/HOA \$\{usdExact\(facts\.hoaMonthly\)\}/.test(trueCost),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-hoa: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-hoa: ${checks.length}/${checks.length}`)
