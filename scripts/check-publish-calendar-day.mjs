#!/usr/bin/env node
/**
 * Listing calendar days must not shift a Pacific day.
 *
 * Founding case: 21357 Kilimanjaro (220222798) stored OpenHouses
 * 08/18, 08/19, 08/20 and rendered Aug 17–19
 * (fleet:e100e9e1a244369ec0d5b7aee1ce11a6).
 *
 *   node scripts/check-publish-calendar-day.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/listing/publish-calendar-day.ts')
checks.push({
  label: 'publishOpenHouseDay / publishHistoryDay wrap formatCalendarDay',
  ok:
    /export function publishCalendarDay/.test(helper) &&
    /export function publishOpenHouseDay/.test(helper) &&
    /export function publishHistoryDay/.test(helper) &&
    helper.includes('e100e9e1a244369ec0d5b7aee1ce11a6') &&
    helper.includes('220222798'),
})

const format = src('lib/format/date.ts')
checks.push({
  label: 'formatCalendarDay anchors YYYY-MM-DD at noon UTC',
  ok:
    /export function formatCalendarDay/.test(format) &&
    format.includes('T12:00:00Z'),
})

const listingOh = src('components/site/listing-detail/OpenHouses.tsx')
checks.push({
  label: 'listing-detail OpenHouses publishes the calendar day',
  ok:
    /from ['"]@\/lib\/listing\/publish-calendar-day['"]/.test(listingOh) &&
    /publishOpenHouseDay\(/.test(listingOh) &&
    !listingOh.includes('timeZone: \'America/Los_Angeles\''),
})

const history = src('components/site/listing-detail/PropertyHistory.tsx')
checks.push({
  label: 'listing-detail PropertyHistory publishes the calendar day',
  ok:
    /from ['"]@\/lib\/listing\/publish-calendar-day['"]/.test(history) &&
    /publishHistoryDay\(/.test(history),
})

const grid = src('components/site/OpenHousesGrid.tsx')
checks.push({
  label: 'OpenHousesGrid badge publishes the calendar weekday',
  ok:
    /from ['"]@\/lib\/listing\/publish-calendar-day['"]/.test(grid) &&
    /publishCalendarDay\(/.test(grid),
})

const kb = src('lib/kb/place-sections.ts')
checks.push({
  label: 'KB open-house when-line publishes the calendar day',
  ok:
    /from ['"]@\/lib\/listing\/publish-calendar-day['"]/.test(kb) &&
    /publishCalendarDay\(/.test(kb),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-calendar-day: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-calendar-day: ${checks.length}/${checks.length}`)
