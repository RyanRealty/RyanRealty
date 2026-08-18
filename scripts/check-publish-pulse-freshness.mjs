#!/usr/bin/env node
/**
 * Pulse freshness publish lock.
 *
 * A live pulse vintage must name the Pacific calendar day. Clock-only
 * "Updated 1:45 PM" and month-only "as of August 2026" are incomplete.
 * Founding case: /cities/bend/summit-west (fleet 4331f59fc7a1a74e84eacae8cceae11b).
 *
 *   node scripts/check-publish-pulse-freshness.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-pulse-freshness.ts')
checks.push({
  label: 'publishPulseFreshness names the Pacific calendar day',
  ok:
    /export function publishPulseFreshnessStamp/.test(helper) &&
    /export function publishPulseAsOfLabel/.test(helper) &&
    /export function publishPulseAsOfIso/.test(helper) &&
    helper.includes('formatDateTime') &&
    helper.includes('summit-west') &&
    helper.includes('zonedDateKey'),
})

const hud = src('components/site/kb/KbMarketHud.client.tsx')
checks.push({
  label: 'KbMarketHud desk stamp gates through publishPulseFreshnessStamp',
  ok:
    /from ['"]@\/lib\/market\/publish-pulse-freshness['"]/.test(hud) &&
    /publishPulseFreshnessStamp\(/.test(hud) &&
    !/Updated \$\{updatedAt\}/.test(hud) &&
    !/toLocaleTimeString\(/.test(hud),
})

const faq = src('lib/site/market-faq.ts')
checks.push({
  label: 'buildMarketFaq as-of gates through publishPulseAsOfLabel',
  ok:
    /from ['"]@\/lib\/market\/publish-pulse-freshness['"]/.test(faq) &&
    /publishPulseAsOfLabel\(/.test(faq) &&
    /publishPulseAsOfIso\(/.test(faq) &&
    !/getUTCMonth\(/.test(faq),
})

const preset = src('lib/site/preset-faq.ts')
checks.push({
  label: 'preset FAQ as-of gates through publishPulseAsOfLabel',
  ok:
    /from ['"]@\/lib\/market\/publish-pulse-freshness['"]/.test(preset) &&
    /publishPulseAsOfLabel\(/.test(preset) &&
    !/getUTCMonth\(/.test(preset),
})

const snapshot = src('components/site/MarketSnapshot.tsx')
checks.push({
  label: 'MarketSnapshot freshness gates through publishPulseFreshnessStamp',
  ok:
    /from ['"]@\/lib\/market\/publish-pulse-freshness['"]/.test(snapshot) &&
    /publishPulseFreshnessStamp\(/.test(snapshot) &&
    !/toLocaleString\(/.test(snapshot),
})

const banner = src('components/reports/LivePulseBanner.tsx')
checks.push({
  label: 'LivePulseBanner freshness gates through publishPulseFreshnessStamp',
  ok:
    /from ['"]@\/lib\/market\/publish-pulse-freshness['"]/.test(banner) &&
    /publishPulseFreshnessStamp\(/.test(banner) &&
    !/toLocaleDateString\(/.test(banner),
})

const cma = src('lib/cma/render-market-page.ts')
checks.push({
  label: 'CMA market page pulse vintage uses dateLong (calendar day)',
  ok: /dateLong\(m\.pulseUpdatedAt/.test(cma) && /dateLong\(m\.computedAt/.test(cma),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-pulse-freshness: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-pulse-freshness: ${checks.length}/${checks.length}`)
