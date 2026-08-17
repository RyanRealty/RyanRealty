#!/usr/bin/env node
/**
 * Listing-owned facts publish lock.
 *
 * List price and HOA on a listing page are exact whole dollars.
 * year_built outside 1800..now+2 is withheld. New construction is
 * withheld when that year cannot corroborate it.
 *
 * Founding cases: Kilimanjaro $615,000 vs $614,995 and HOA $0 vs $93;
 * Hale / Sunriver HOA $0 vs exact; Albany Year built 3672.
 *
 *   node scripts/check-publish-listing-facts.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-listing-facts.ts')
checks.push({
  label: 'publishListingMoney is whole dollars with no thousand-round',
  ok:
    /export function publishListingMoney/.test(helper) &&
    helper.includes('Math.round(value)') &&
    !helper.includes('Math.round(value / 1000)'),
})
checks.push({
  label: 'publishYearBuilt withholds years outside 1800..now+2',
  ok:
    /export function publishYearBuilt/.test(helper) &&
    helper.includes('YEAR_FLOOR = 1800') &&
    helper.includes('now + 2'),
})
checks.push({
  label: 'publishNewConstructionYn withholds when year is implausible',
  ok:
    /export function publishNewConstructionYn/.test(helper) &&
    helper.includes('publishYearBuilt(year'),
})

const dal = src('lib/data/listings/getListingDetail.ts')
checks.push({
  label: 'getListingDetail publishes year, new-construction, and HOA through the helper',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(dal) &&
    /publishYearBuilt\(/.test(dal) &&
    /publishNewConstructionYn\(/.test(dal) &&
    /publishListingMoney\(/.test(dal),
})

const mapper = src('lib/listing-mapper.ts')
checks.push({
  label: 'listing-mapper stores only a published year_built',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(mapper) &&
    /publishYearBuilt\(/.test(mapper),
})

const processor = src('lib/listing-processor.ts')
checks.push({
  label: 'listing-processor stores only a published year_built',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(processor) &&
    /publishYearBuilt\(/.test(processor),
})

const priceBlock = src('components/site/listing-detail/PriceBlock.tsx')
checks.push({
  label: 'PriceBlock prints list/close through publishListingMoney + Price exact',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(priceBlock) &&
    /publishListingMoney\(/.test(priceBlock) &&
    priceBlock.includes('<Price value={headlinePrice} exact />'),
})

const cta = src('components/site/listing-detail/PriceCtaStrip.tsx')
checks.push({
  label: 'PriceCtaStrip prints the listing price through publishListingMoney + Price exact',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(cta) &&
    /publishListingMoney\(/.test(cta) &&
    cta.includes('<Price value={headlinePrice} exact />'),
})

const hero = src('components/site/listing-detail/ListingHero.tsx')
checks.push({
  label: 'ListingHero overlay uses formatListingMoney (not compact K-round)',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(hero) &&
    /formatListingMoney\(/.test(hero) &&
    !/Math\.round\(\s*p\s*\/\s*1_000\s*\)/.test(hero) &&
    !/function formatPrice\(p: number\)/.test(hero),
})

const specs = src('components/site/listing-detail/PropertySpecs.tsx')
checks.push({
  label: 'PropertySpecs HOA and year go through the published helpers + Price exact',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(specs) &&
    /publishListingMoney\(/.test(specs) &&
    /publishYearBuilt\(/.test(specs) &&
    specs.includes('<Price value={hoaMonthly} exact />') &&
    specs.includes('<Price value={associationFee} exact />'),
})

const houseme = src('components/site/listing-detail/HouseMeReport.tsx')
checks.push({
  label: 'HouseMe true-cost HOA uses formatListingMoney',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-facts['"]/.test(houseme) &&
    /formatListingMoney\(/.test(houseme) &&
    /publishListingMoney\(/.test(houseme),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-listing-facts: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-listing-facts: ${checks.length}/${checks.length}`)
