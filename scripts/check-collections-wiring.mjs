#!/usr/bin/env node
/**
 * check-collections-wiring.mjs — static gate: the account Collections feature
 * is wired to the real listing_collections backend, not the saved-listings
 * stand-in.
 *
 * WHY: the listing_collections table never existed, so the collections actions
 * silently returned empty and the collections page fell back to rendering the
 * flat saved_listings set mislabeled as "My Collections." This is an auth-gated
 * surface (a public smoke gate can't reach it), so this asserts the wiring
 * statically: the list page reads getUserCollections (not getSavedListingKeys),
 * the detail route exists and reads getCollectionById, and the migration that
 * creates the table is present. If collections regress to the saved-listings
 * stand-in, this fails the build.
 *
 * Repointed 2026-06-22 (audit p?.? deferred item 6): the logged-in visitor
 * surface consolidated from /dashboard/* onto /account/* (memory:
 * ryanrealty-visitor-dashboard-and-broker-attribution). The live impl is now
 * app/account/collections/*; the old /dashboard/collections routes are pure
 * redirect stubs, which this gate also pins so the consolidation can't half-undo.
 *
 * Usage: node scripts/check-collections-wiring.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const checks = []
function check(label, ok, detail = '') {
  checks.push({ label, ok, detail })
}

function read(p) {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

const listPage = read('app/account/collections/page.tsx')
check('collections list page reads getUserCollections', /getUserCollections/.test(listPage))
check(
  'collections list page is NOT the saved-listings stand-in',
  !/getSavedListingKeys/.test(listPage),
  'page must read collections, not saved_listings',
)
check('collections list page offers create + delete', /CreateCollectionForm/.test(listPage) && /CollectionDeleteButton/.test(listPage))

const detailPage = read('app/account/collections/[id]/page.tsx')
check('collection detail route exists', existsSync('app/account/collections/[id]/page.tsx'))
check('detail page reads getCollectionById', /getCollectionById/.test(detailPage))
check('detail page can add + remove listings', /CollectionListingButton/.test(detailPage) && /mode="add"/.test(detailPage) && /mode="remove"/.test(detailPage))

const actions = read('app/actions/collections.ts')
check('collections actions expose create/add/remove/delete', /createCollection/.test(actions) && /addToCollection/.test(actions) && /removeFromCollection/.test(actions) && /deleteCollection/.test(actions))

// The legacy /dashboard/collections routes must stay pure redirects to /account
// so the consolidation can't silently half-undo (a re-added stand-in page there
// would resurrect the original "My Collections = saved_listings" bug).
//
// The redirect moved from the page body to next.config.ts redirects() on
// 2026-08-19: a page-body redirect() under the app/loading.tsx Suspense boundary
// cannot write a Location header, so /dashboard/collections served HTTP 200 with
// layout chrome, no <h1>, and robots "index, follow" (measured on production,
// browser UA + redirect:manual). So the assertion is now: no page file at those
// paths, and an unconditional redirect rule in next.config.ts.
const nextConfig = read('next.config.ts')
check(
  'legacy /dashboard/collections redirects to /account/collections',
  !existsSync('app/dashboard/collections/page.tsx') &&
    /source:\s*'\/dashboard\/collections'\s*,\s*destination:\s*'\/account\/collections'/.test(nextConfig),
  'old dashboard route must 308 from next.config.ts, not render a collections stand-in',
)
check(
  'legacy /dashboard/collections/[id] redirects to /account',
  !existsSync('app/dashboard/collections/[id]/page.tsx') &&
    /source:\s*'\/dashboard\/collections\/:id'\s*,\s*destination:\s*'\/account\/collections\/:id'/.test(nextConfig),
  'old dashboard detail route must 308 from next.config.ts, not render',
)

// The table must be created by a committed migration.
import { readdirSync } from 'node:fs'
let migrationFound = false
try {
  migrationFound = readdirSync('supabase/migrations').some((f) => {
    const sql = read(`supabase/migrations/${f}`)
    return /create table[^;]*listing_collections/i.test(sql)
  })
} catch {
  migrationFound = false
}
check('listing_collections migration is committed', migrationFound)

console.log('Collections wiring gate')
console.log('=======================\n')
let failed = 0
for (const c of checks) {
  if (c.ok) console.log(`  OK    ${c.label}`)
  else {
    failed++
    console.log(`  FAIL  ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
  }
}
console.log()
if (failed) {
  console.log(`${failed}/${checks.length} collections wiring checks FAILED.`)
  process.exit(1)
}
console.log(`All ${checks.length} collections wiring checks pass.`)
process.exit(0)
