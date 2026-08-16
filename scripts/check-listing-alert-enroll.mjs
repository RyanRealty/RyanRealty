#!/usr/bin/env node
/**
 * G4 lock: account / LP / guest saved-search enrollment writes listing_alerts
 * with the native crm_people.id. Sends never read legacy saved_searches.
 *
 *   node scripts/check-listing-alert-enroll.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const dal = src('lib/data/leads/listingAlerts.ts')
checks.push({
  label: 'upsertListingAlert input accepts crmPersonId',
  ok: /crmPersonId\?: number \| null/.test(dal) && /export type ListingAlertInput/.test(dal),
})
checks.push({
  label: 'upsertListingAlert persists input.crmPersonId',
  ok: /const crmPersonId = input\.crmPersonId/.test(dal),
})
checks.push({
  label: 'resolveCrmPersonId prefers a native crmPersonId when the writer stamped one',
  ok: /if \(args\.crmPersonId/.test(dal) && /return args\.crmPersonId/.test(dal),
})
checks.push({
  label: 'stampListingAlertsCrmPerson exists',
  ok: /export async function stampListingAlertsCrmPerson/.test(dal),
})

const helper = src('lib/alerts/enroll-identity.ts')
checks.push({
  label: 'nativeCrmPersonId helper is the capture-id contract',
  ok: /export function nativeCrmPersonId/.test(helper),
})

const guest = src('app/actions/search-alert-capture.ts')
checks.push({
  label: 'guest /search capture passes crmPersonId to upsertListingAlert',
  ok: /crmPersonId/.test(guest) && /nativeCrmPersonId\(result\.personId\)/.test(guest),
})

const account = src('app/actions/saved-searches.ts')
checks.push({
  label: 'account createSavedSearch captures the person before upsert',
  ok:
    account.indexOf('sendEvent') < account.indexOf('upsertListingAlert({') &&
    /crmPersonId/.test(account) &&
    /nativeCrmPersonId\(result\.personId\)/.test(account),
})
checks.push({
  label: 'account createSavedSearch stamps listing_alerts.crm_person_id',
  ok: /stampListingAlertsCrmPerson\(email, crmPersonId\)/.test(account),
})

const lp = src('app/lp/buyer-listing-alerts/actions.ts')
checks.push({
  label: 'buyer LP passes crmPersonId (native id) into upsertListingAlert',
  ok: /crmPersonId: nativeCrmPersonId\(eventResult\.personId\)/.test(lp),
})

const bulk = src('app/actions/newsletter.ts')
checks.push({
  label: 'admin bulk assign passes crmPersonId: pid',
  ok: /createListingAlertForLead\(\{ email: contact\.email, crmPersonId: pid/.test(bulk),
})

const assign = src('lib/crm/bulk-handlers/assign-saved-search.ts')
checks.push({
  label: 'broker assign-saved-search already stamps crmPersonId: id',
  ok: /crmPersonId: id/.test(assign),
})

const engine = src('app/actions/saved-search-alerts.ts')
checks.push({
  label: 'send engine does not read legacy saved_searches',
  ok: !/\.from\(\s*['"]saved_searches['"]\s*\)/.test(engine),
})
checks.push({
  label: 'send engine reads listing_alerts via DAL',
  ok: /getActiveListingAlertsDue/.test(engine) && /from '@\/lib\/data\/leads\/listingAlerts'/.test(engine),
})

const cron = src('app/api/cron/saved-search-alerts/route.ts')
checks.push({
  label: 'cron scans listing_alerts only (not saved_searches)',
  ok: /listing_alerts/.test(cron) && !/\.from\(\s*['"]saved_searches['"]\s*\)/.test(cron),
})

console.log('Listing-alert enroll gate (G4)')
console.log('==============================\n')
let failed = 0
for (const c of checks) {
  if (c.ok) console.log(`  OK    ${c.label}`)
  else {
    failed++
    console.log(`  FAIL  ${c.label}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${checks.length} listing-alert enroll checks FAILED.`)
  process.exit(1)
}
console.log(`All ${checks.length} listing-alert enroll checks pass.`)
process.exit(0)
