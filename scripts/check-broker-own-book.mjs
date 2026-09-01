#!/usr/bin/env node
/**
 * G5 lock: own-book scoping fail-closes, slug comes from brokers, marketing
 * unlocks for brokers, day-one checklist exists.
 *
 *   node scripts/check-broker-own-book.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const scope = src('lib/crm/scope.ts')
checks.push({
  label: 'UNMAPPED_OWN_BOOK sentinel exists',
  ok: /export const UNMAPPED_OWN_BOOK = '__unmapped__'/.test(scope),
})
checks.push({
  label: 'scopeBroker fail-closes unmapped non-superusers',
  ok:
    /if \(access\.role === 'superuser'\) return null/.test(scope) &&
    /return slug \|\| UNMAPPED_OWN_BOOK/.test(scope) &&
    !/return access\.role === 'superuser' \? null : access\.brokerSlug/.test(scope),
})
checks.push({
  label: 'isPersonInScope refuses the unmapped sentinel',
  ok: /if \(slug === UNMAPPED_OWN_BOOK\) return false/.test(scope),
})

const resolve = src('lib/crm/resolve-broker-slug.ts')
checks.push({
  label: 'pickCrmSlug prefers table slugs over the hardcoded map',
  ok: /export function pickCrmSlug/.test(resolve) && /hardcodedSlugForEmail/.test(resolve),
})

const access = src('app/actions/crm.ts')
checks.push({
  label: 'getCrmAccess resolves slug via resolveCrmSlugForAccess',
  ok:
    /resolveCrmSlugForAccess/.test(access) &&
    !/brokerSlug: CRM_BROKER_BY_EMAIL\[email\]/.test(access),
})

const dal = src('lib/data/brokers/resolveCrmSlug.ts')
checks.push({
  label: 'DAL resolveCrmSlugForAccess reads brokers.crm_slug',
  ok: /from\('brokers'\)/.test(dal) && /crm_slug/.test(dal),
})

const caps = src('lib/admin/capabilities.ts')
checks.push({
  label: 'content.marketing is unlocked for brokers',
  ok: /'content\.marketing': \['broker'\]/.test(caps),
})

const today = src('app/admin/(protected)/today/page.tsx')
checks.push({
  label: 'Today uses scopeBroker (not the fail-open ternary)',
  ok:
    /scopeBroker\(ctx\)/.test(today) &&
    !/ctx\.role === 'superuser' \? null : ctx\.brokerSlug/.test(today) &&
    /getDayOneChecklist/.test(today),
})

// People-list fold (Matt lock 2026-09-01): /admin/people is a redirect bridge;
// the surviving list at /admin/crm carries the scope duty.
const people = src('app/admin/(protected)/crm/page.tsx')
checks.push({
  label: 'People uses scopeBroker',
  ok: /scopeBroker\(access\)/.test(people) && !/role === 'superuser' \? null : /.test(people),
})

const messages = src('app/admin/(protected)/messages/page.tsx')
checks.push({
  label: 'Messages uses scopeBroker',
  ok: /scopeBroker\(ctx\)/.test(messages) && !/ctx\.role === 'superuser' \? null : ctx\.brokerSlug/.test(messages),
})

// Email-performance fold (Matt lock 2026-09-01): the batch list lives inside
// /admin/reports/emails via BatchSendsSection; the old list route is a bridge.
const batch = src('app/admin/(protected)/reports/emails/BatchSendsSection.tsx')
checks.push({
  label: 'Batch emails uses scopeBroker without a fail-open ternary',
  ok:
    /getBatchEmailsReport\(scope\)/.test(batch) &&
    !/role === 'superuser' \? null : scope/.test(batch) &&
    /scopeBroker\(access\)/.test(src('app/admin/(protected)/reports/emails/page.tsx')),
})

const dayOne = src('lib/crm/day-one.ts')
checks.push({
  label: 'day-one checklist has the six closed items',
  ok:
    /'mapped'/.test(dayOne) &&
    /'profile'/.test(dayOne) &&
    /'book'/.test(dayOne) &&
    /'notifications'/.test(dayOne) &&
    /'socials'/.test(dayOne) &&
    /'marketing'/.test(dayOne),
})

const cmas = src('lib/data/sync/syncWrites.ts')
checks.push({
  label: 'listCmasForAdmin accepts an own-book brokerSlug filter',
  ok: /brokerSlug\?: string \| null/.test(cmas) && /if \(options\.brokerSlug\)/.test(cmas),
})

console.log('Broker own-book / day-one gate (G5)')
console.log('===================================\n')
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
  console.log(`${failed}/${checks.length} broker own-book checks FAILED.`)
  process.exit(1)
}
console.log(`All ${checks.length} broker own-book checks pass.`)
process.exit(0)
