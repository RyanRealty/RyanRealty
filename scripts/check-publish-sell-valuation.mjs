#!/usr/bin/env node
/**
 * /sell valuation spine lock.
 *
 * Step 2 email is required. Name is not. Confirmation names the 24-hour
 * written CMA. Places autocomplete must reserve space for the Value my home
 * button and destroy its .pac-container on unmount.
 *
 *   node scripts/check-publish-sell-valuation.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/sell/publish-sell-valuation.ts')
checks.push({
  label: 'publishSellValuationConfirm names 24 hours, not a business day',
  ok:
    /export function publishSellValuationConfirm/.test(helper) &&
    helper.includes("SELL_VALUATION_CONFIRM_SLA = 'within 24 hours'") &&
    /export function sellQualifyNameRequired/.test(helper) &&
    !/business day/i.test(helper),
})

const sellForm = src('app/sell/_v3/SellValueForm.tsx')
checks.push({
  label: '/sell qualify does not require name; confirm uses the publisher',
  ok:
    /from ['"]@\/lib\/sell\/publish-sell-valuation['"]/.test(sellForm) &&
    /publishSellValuationConfirm\(isHot\)/.test(sellForm) &&
    !sellForm.includes('Please enter your name.') &&
    !/id="sell-value-name"[\s\S]{0,180}required/.test(sellForm),
})

const lpForm = src('app/lp/seller-home-value/SellerLPForm.tsx')
checks.push({
  label: 'seller LP qualify does not require name; confirm uses the publisher',
  ok:
    /from ['"]@\/lib\/sell\/publish-sell-valuation['"]/.test(lpForm) &&
    /publishSellValuationConfirm\(isHot\)/.test(lpForm) &&
    !lpForm.includes('Please enter your name.') &&
    !/one business day/i.test(lpForm) &&
    !/id="seller-lp-name"[\s\S]{0,180}required/.test(lpForm),
})

const ac = src('components/seller-lp/AddressAutocomplete.tsx')
checks.push({
  label: 'AddressAutocomplete reserves suggestion space and destroys pac-container',
  ok:
    ac.includes("suggesting && 'pb-48'") &&
    ac.includes('.pac-container') &&
    ac.includes('el.remove()') &&
    ac.includes('ignoreEmptyRef') &&
    ac.includes('place_changed'),
})

const page = src('app/sell/page.tsx')
checks.push({
  label: '/sell hosts SellValueForm on the valuation spine',
  ok: page.includes('<SellValueForm') && page.includes('pagePath={ROUTE_PATH}'),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-sell-valuation: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-sell-valuation: ${checks.length}/${checks.length}`)
