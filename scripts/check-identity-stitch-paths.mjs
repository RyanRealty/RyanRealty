#!/usr/bin/env node
/**
 * G2 lock: every public lead-capture / sign-in door must call the identity
 * stitch (stitchFormSubmitIdentity or stitchVisitorIdentity) so
 * visitor_identity_map.crm_person_id is written. Session-only
 * backfillSessionToFub is not enough — a submit without a tracker session
 * never wrote the map.
 *
 *   node scripts/check-identity-stitch-paths.mjs
 */
import { readFileSync } from 'node:fs'

const PATHS = [
  'app/contact/actions.ts',
  'app/home-valuation/actions.ts',
  'app/actions/lead-landing.ts',
  'app/actions/lead-capture.ts',
  'app/actions/newsletter-subscribe.ts',
  'app/actions/search-alert-capture.ts',
  'app/lp/seller-home-value/actions.ts',
  'app/lp/fsbo/actions.ts',
  'app/lp/expired-listing/actions.ts',
  'app/lp/buyer-listing-alerts/actions.ts',
  'app/auth/callback/route.ts',
  'app/actions/identity-bridge.ts',
]

const STITCH_RE = /stitchFormSubmitIdentity|stitchVisitorIdentity/

const checks = []
for (const p of PATHS) {
  let src = ''
  try {
    src = readFileSync(p, 'utf8')
  } catch {
    checks.push({ label: `${p} exists`, ok: false })
    continue
  }
  checks.push({ label: `${p} exists`, ok: true })
  checks.push({
    label: `${p} calls stitchFormSubmitIdentity or stitchVisitorIdentity`,
    ok: STITCH_RE.test(src),
  })
}

const writer = readFileSync('lib/visitor-backfill.ts', 'utf8')
checks.push({
  label: 'buildIdentityMapPatch writes crm_person_id in lockstep with fub_person_id',
  ok: /row\.crm_person_id = params\.fubPersonId/.test(writer) && /row\.fub_person_id = params\.fubPersonId/.test(writer),
})
checks.push({
  label: 'CAPI user data includes external_id (same person as the CRM audience)',
  ok: /external_id/.test(readFileSync('lib/meta-capi.ts', 'utf8')) &&
    /getStitchedCrmPersonId/.test(readFileSync('app/api/meta-capi/route.ts', 'utf8')),
})
checks.push({
  label: 'listing_alerts stamp exists for the alerts plane',
  ok: /export async function stampListingAlertsCrmPerson/.test(
    readFileSync('lib/data/leads/listingAlerts.ts', 'utf8'),
  ),
})

console.log('Identity-stitch path gate')
console.log('=========================\n')
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
  console.log(`${failed}/${checks.length} identity-stitch checks FAILED.`)
  process.exit(1)
}
console.log(`All ${checks.length} identity-stitch checks pass.`)
process.exit(0)
