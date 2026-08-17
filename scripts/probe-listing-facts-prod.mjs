#!/usr/bin/env node
/**
 * Production accept for the listing-facts class.
 *
 *   node scripts/probe-listing-facts-prod.mjs
 */
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

async function load(url) {
  const res = await fetch(url, { headers: CI_PROBE_HEADERS })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return textOf(await res.text())
}

const kili = await load('https://ryan-realty.com/homes-for-sale/bend/21357-kilimanjaro-220222798')
const hale = await load('https://ryan-realty.com/homes-for-sale/bend/1019-hale-220225331')
const albany = await load('https://ryan-realty.com/homes-for-sale/albany/2448-violet-220223541')
const sunriver = await load(
  'https://ryan-realty.com/homes-for-sale/sunriver/river-village/58062-verdin-220224992',
)

const report = {
  kilimanjaro: {
    has614995: kili.includes('$614,995'),
    has615000: kili.includes('$615,000'),
    has615K: /\$615K|\$615k/.test(kili),
    hoa93: /HOA \$93 per month/.test(kili),
    hoa0: /HOA \$0 per month/.test(kili),
    down122999: kili.includes('$122,999'),
    down123000: kili.includes('$123,000'),
  },
  hale: {
    hoa22: /HOA \$22 per month/.test(hale),
    hoa0: /HOA \$0 per month/.test(hale),
    bedrooms5: /Bedrooms 5/.test(hale),
  },
  albany: {
    year3672: /Year built 3672/.test(albany),
    living3672: /Living area 3,672/.test(albany),
    bedrooms5: /Bedrooms 5/.test(albany),
    bathrooms4: /Bathrooms 4/.test(albany),
  },
  sunriver: {
    hoa173: /HOA \$173 per month/.test(sunriver),
    hoa0: /HOA \$0 per month/.test(sunriver),
  },
}

const ok =
  report.kilimanjaro.has614995 &&
  !report.kilimanjaro.has615000 &&
  !report.kilimanjaro.has615K &&
  report.kilimanjaro.hoa93 &&
  !report.kilimanjaro.hoa0 &&
  report.kilimanjaro.down122999 &&
  !report.kilimanjaro.down123000 &&
  report.hale.hoa22 &&
  !report.hale.hoa0 &&
  report.hale.bedrooms5 &&
  !report.albany.year3672 &&
  report.albany.living3672 &&
  report.albany.bedrooms5 &&
  report.albany.bathrooms4 &&
  report.sunriver.hoa173 &&
  !report.sunriver.hoa0

console.log(JSON.stringify({ ok, ...report }, null, 2))
if (!ok) {
  console.error('ACCEPT FAIL: listing-owned facts still disagree or year 3672 still prints')
  process.exit(1)
}
console.log('ACCEPT OK: listing money is exact; year 3672 withheld')
