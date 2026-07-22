#!/usr/bin/env node
/**
 * check-ods-compliance.mjs — G54: Oregon Data Share display rules, pinned.
 *
 * Matt is an ODS Participant (directive 2026-07-21: "review their rules and
 * commit them to memory or a gate"). Source of truth: ODS Rules and
 * Regulations, Last Revised/Adopted August 2024 — §5-3 (IDX), §5-4 (VOW),
 * §4-4 (Coming Soon), §7-3 (compilation-based advertising). The operative
 * rules this gate can assert statically:
 *
 *  §5-3 P/S/T — every IDX listing display identifies the listing firm AND the
 *    email or phone the listing participant provided, shows ODS as source,
 *    and carries the reliability + non-commercial-use disclaimer.
 *  §5-3 B/G + VOW K — seller internet opt-out (permit_internet_yn=false),
 *    address-only opt-out (permit_address_internet_yn=false), and non-IDX
 *    brokers (idx_participant=false) must never render publicly. Enforced in
 *    the detail DAL guard and in the public MV predicates.
 *  §5-4 A.4 — SOLD data is VOW-only (registered, logged-in consumers with a
 *    terms-of-use agreement). No indexable public sold surface may exist:
 *    no 'sold' search preset, and status query-variants stay noindexed.
 *  §5-3 I — IDX displays refresh at least every 12 hours: sync-delta must be
 *    registered in vercel.json (ours runs every 15 minutes).
 *  §4-4 — Coming Soon is not licensed for display outside the MLS (enforced
 *    by the existing ci:public-listing-status gate; not re-checked here).
 *
 * Non-static obligations (memory: reference_ods_rules): AVM/comment features
 * disable-able per seller request (§5-3 L), accuracy-comment channel with
 * 48h correction (VOW P), §7-3 advertising notice on ODS-based stats claims.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'

const failures = []
function must(cond, msg) {
  if (!cond) failures.push(msg)
}
function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

// --- §5-3 P/S/T: attribution block content + mount -------------------------
const attribution = read('components/listing/ListingAttribution.tsx')
must(attribution.includes('Listing courtesy of'), 'ListingAttribution: missing "Listing courtesy of" firm line (ODS §5-3 P)')
must(attribution.includes('Oregon Data Share'), 'ListingAttribution: missing ODS source identification (ODS §5-3 S)')
must(attribution.includes('deemed reliable'), 'ListingAttribution: missing reliability disclaimer (ODS §5-3 T)')
must(attribution.includes('non-commercial'), 'ListingAttribution: missing non-commercial-use disclaimer (ODS §5-3 T)')
must(attribution.includes('listContact'), 'ListingAttribution: missing listing-participant contact (email/phone) rendering (ODS §5-3 P)')

const listingPage = read('app/listing/[listingKey]/page.tsx')
must(listingPage.includes('<ListingAttribution'), 'Listing detail page: ListingAttribution not rendered (ODS §5-3)')
must(/listContact=\{/.test(listingPage), 'Listing detail page: listContact prop not passed to ListingAttribution (ODS §5-3 P)')

must(existsSync('public/images/oregon-data-share-logo.svg'), 'ODS logo asset missing: public/images/oregon-data-share-logo.svg')

// --- §5-3 B/G + VOW K: opt-out enforcement ----------------------------------
const detailDal = read('lib/data/listings/getListingDetail.ts')
for (const flag of ['permit_internet_yn === false', 'permit_address_internet_yn === false', 'idx_participant === false']) {
  must(detailDal.includes(flag), `getListingDetail guard: missing "${flag}" exclusion (ODS §5-3 B/G)`)
}

// Public MV ratchet: the newest migration that (re)creates each public listing
// MV must carry the opt-out predicates. Migrations dated after this gate
// landed (2026-07-21) must also carry the address-only opt-out predicate.
const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
for (const mv of ['listing_tile_mv', 'listing_search_mv']) {
  const creators = migrations.filter((f) => {
    const sql = read(`supabase/migrations/${f}`)
    return new RegExp(`CREATE MATERIALIZED VIEW (IF NOT EXISTS )?public\\.${mv}\\b`).test(sql)
  })
  if (creators.length === 0) continue
  const latest = creators[creators.length - 1]
  const sql = read(`supabase/migrations/${latest}`)
  must(
    sql.includes('permit_internet_yn IS DISTINCT FROM false'),
    `${latest}: ${mv} definition lost the seller internet opt-out predicate (ODS §5-3 B/G)`
  )
  must(
    /idx_participant\s+IS DISTINCT FROM false/.test(sql),
    `${latest}: ${mv} definition lost the idx_participant predicate (ODS §5-3)`
  )
  const stamp = Number((latest.match(/^(\d{8})/) || [])[1] ?? 0)
  if (stamp > 20260721) {
    must(
      sql.includes('permit_address_internet_yn IS DISTINCT FROM false'),
      `${latest}: new ${mv} definition must add the address-only opt-out predicate permit_address_internet_yn IS DISTINCT FROM false (ODS §5-3 G / VOW K)`
    )
  }
}

// --- §5-4 A.4: sold data is VOW-only — no indexable public sold surface -----
const presets = read('lib/search-presets.ts')
must(!/slug:\s*'[^']*sold[^']*'/i.test(presets), 'search-presets: a sold preset would create an indexable public sold page — sold data is VOW-only (ODS §5-4 A.4)')
const seoRouting = read('lib/seo-routing.ts')
must(seoRouting.includes("'statusFilter'"), 'seo-routing: statusFilter no longer noindexed — sold query variants would become indexable (ODS §5-4 A.4)')

// --- §5-3 I: refresh cadence ------------------------------------------------
const vercel = read('vercel.json')
must(vercel.includes('/api/cron/sync-delta'), 'vercel.json: sync-delta cron unregistered — IDX requires refresh at least every 12 hours (ODS §5-3 I)')

// -----------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`ODS-compliance gate FAILED (${failures.length}):`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('ODS-compliance gate passed — §5-3 attribution + opt-outs, VOW-only sold, 12h refresh all pinned.')
