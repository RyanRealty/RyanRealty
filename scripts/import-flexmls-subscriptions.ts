#!/usr/bin/env node
/**
 * Import Matt's Flexmls subscriptions into the in-house alert engine.
 *
 * WHY A SCRIPT AND NOT AN API PULL: our Spark replication key is data-only.
 * /v1/savedsearches, /v1/subscriptions and /v1/contacts all answer "Your key
 * does not have permission to access this resource" (verified 2026-07-31), and
 * the Flexmls web UI is behind a CAPTCHA. The definitions are therefore
 * transcribed into data/flexmls-subscriptions.json and imported from there.
 *
 * SAFETY, and it is the point of this script:
 *   - rows are written is_active = FALSE. An imported alert cannot send until
 *     someone activates it. Alerts to real people are an outbound-message class
 *     action under CLAUDE.md §1 and need Matt's per-action approval.
 *   - --activate flips them on, and REFUSES on any subscription that has a
 *     recipient other than Matt unless --i-have-approval is also passed, so a
 *     client cannot start receiving mail as a side effect of an import.
 *   - re-running is idempotent on (email, filters_hash), matching the table's
 *     unique constraint: an existing row is updated, never duplicated.
 *
 * Usage:
 *   node scripts/import-flexmls-subscriptions.mjs --dry-run
 *   node scripts/import-flexmls-subscriptions.mjs
 *   node scripts/import-flexmls-subscriptions.mjs --activate [--i-have-approval]
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { getSavedSearchHash } from '../lib/search-filters'

const BROKER_EMAIL = 'matt@ryan-realty.com'
const SOURCE_FILE = 'data/flexmls-subscriptions.json'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const activate = args.has('--activate')
const haveApproval = args.has('--i-have-approval')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (source .env.local).')
  process.exit(1)
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

/**
 * The canonical hash, IMPORTED rather than reimplemented. An earlier draft of
 * this script hand-rolled a sha256 version, which would have produced rows
 * whose filters_hash never matched a search created on the site — breaking the
 * (email, filters_hash) dedupe silently. One implementation, no drift.
 */
function filtersHash(filters: Record<string, unknown>): string {
  return getSavedSearchHash(filters as never)
}

async function main() {
  const doc = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'))
  const subs = doc.subscriptions ?? []
  if (subs.length === 0) {
    console.error(`No subscriptions in ${SOURCE_FILE}.`)
    process.exit(1)
  }

  console.log(`Flexmls subscription import (${subs.length} defined)`)
  console.log('='.repeat(52))

  let created = 0, updated = 0, skipped = 0
  for (const sub of subs) {
    const recipients = (sub.recipients ?? []).filter(Boolean)
    const owner = recipients[0] ?? BROKER_EMAIL
    const hash = filtersHash(sub.filters ?? {})
    const externalOnly = recipients.some((r) => r.toLowerCase() !== BROKER_EMAIL)

    if (recipients.length === 0) {
      console.log(`  SKIP  ${sub.name} — no recipient recorded (see source_note)`)
      skipped++
      continue
    }
    if (activate && externalOnly && !haveApproval) {
      console.log(`  HOLD  ${sub.name} — external recipient; --activate refused without --i-have-approval`)
      skipped++
      continue
    }

    const row = {
      email: owner,
      name: sub.name,
      filters: sub.filters ?? {},
      filters_hash: hash,
      notification_frequency: sub.notification_frequency ?? 'daily',
      events: sub.events ?? undefined,
      recipients: recipients.length > 1 ? recipients : null,
      is_active: activate && (!externalOnly || haveApproval),
      // origin is CHECK-constrained to user|broker|system; these are Matt's own
    // subscriptions being migrated, so they are broker-originated.
    origin: 'broker',
      source: 'flexmls-migration',
      assigned_by: BROKER_EMAIL,
    }

    if (dryRun) {
      console.log(`  DRY   ${sub.name} -> ${owner} · hash ${hash} · active=${row.is_active}`)
      continue
    }

    const { data: existing } = await sb
      .from('listing_alerts')
      .select('id')
      .eq('email', owner)
      .eq('filters_hash', hash)
      .maybeSingle()

    if (existing) {
      const { error } = await sb.from('listing_alerts').update(row).eq('id', existing.id)
      if (error) { console.log(`  FAIL  ${sub.name} — ${error.message}`); continue }
      console.log(`  UPD   ${sub.name} -> ${owner} · active=${row.is_active}`)
      updated++
    } else {
      const { error } = await sb.from('listing_alerts').insert(row)
      if (error) { console.log(`  FAIL  ${sub.name} — ${error.message}`); continue }
      console.log(`  NEW   ${sub.name} -> ${owner} · active=${row.is_active}`)
      created++
    }
  }

  console.log('='.repeat(52))
  console.log(`created ${created} · updated ${updated} · skipped ${skipped}`)
  if (!activate && !dryRun) {
    console.log('Rows are INACTIVE. Activate with --activate once Matt approves the sends.')
  }

}

main().catch((e) => { console.error(e); process.exit(1) })
