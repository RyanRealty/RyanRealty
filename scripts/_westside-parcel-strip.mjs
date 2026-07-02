#!/usr/bin/env node
/**
 * WESTSIDE PARCEL STRIP — remove wrong-household county data (2026-07-02)
 *
 * Matt-approved 2026-07-02 ("Clean up the wrong household"). Strips the
 * import-stamped county parcel data from the 67 high-confidence wrong-household
 * contacts (out/westside-target-ids.json minus SKIP_IDS) where the county
 * skip-trace stapled the WRONG household's parcel onto a real lead — the exact
 * Star Ridge / Maria Hoffman (#13014) signature.
 *
 * Removes ONLY county-import-stamped data (see _westside-strip-rules.mjs):
 *   - parcel-derived tags (import:westside-2026-05, source:county-assessor,
 *     owner: / equity: / tenure: / seller-score: / neighborhood: / subdivision: /
 *     geo: / lifecycle: prefixes, area:bend-westside, fb-audience:westside-all,
 *     legacy un-namespaced stamps)
 *   - county custom fields (customSellerPropertyAddress, customYearBuilt, …)
 *   - the stamped-parcel address row (street === customSellerPropertyAddress)
 *   - the stamped homeowner-brief background (ONLY if it matches the template)
 *
 * PRESERVES: real contact points (phones/emails), stage, relationships, real
 * tags (Buyer/audience/compliance/broker/Expired/Bend/city/state), any custom
 * key NOT in the county set, and any NON-template background (kept + flagged).
 *
 * SAFETY:
 *   - Full backup must exist first (out/westside-strip-backup.json). Refuses
 *     otherwise — restore must always be possible before a mutation.
 *   - Idempotent: a second run finds nothing to strip (no-op).
 *   - SKIP guard: also re-checks instruction #6 — if a contact's OWN pre-import
 *     address (non-stamped) equals the DIAL tax-mailing address (they ARE the
 *     absentee owner), it is skipped and listed. (None expected — those were
 *     already routed to a different DIAL verdict by the sweep — but belt+braces.)
 *   - Writes a Change Log (crm_timeline kind='system') row per stripped contact.
 *
 * Usage:
 *   node scripts/_westside-parcel-strip.mjs --dry-run              # preview all, no writes
 *   node scripts/_westside-parcel-strip.mjs --smoke 9828           # strip ONE (for live verify)
 *   node scripts/_westside-parcel-strip.mjs --apply                # strip the full batch
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { computeStrip, SKIP_IDS } from './_westside-strip-rules.mjs'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const smokeIdx = args.indexOf('--smoke')
const SMOKE_ID = smokeIdx > -1 ? Number(args[smokeIdx + 1]) : null
const DRY = args.includes('--dry-run') || (!APPLY && SMOKE_ID == null)

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const IDS_PATH = 'out/westside-target-ids.json'
const BACKUP_PATH = 'out/westside-strip-backup.json'

async function main() {
  if (!existsSync(BACKUP_PATH)) {
    console.error(`REFUSING: ${BACKUP_PATH} missing — run _westside-parcel-backup.mjs first (restore must be possible before any mutation)`)
    process.exit(1)
  }
  const ids = JSON.parse(readFileSync(IDS_PATH, 'utf8'))
  const backup = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'))

  // every non-skipped target must be in the backup before we touch it
  const targets = ids.filter((id) => !SKIP_IDS.has(id))
  const missingBackup = targets.filter((id) => !backup.people?.[id])
  if (missingBackup.length) {
    console.error(`REFUSING: ${missingBackup.length} target(s) not in backup: ${JSON.stringify(missingBackup)}. Re-run backup.`)
    process.exit(1)
  }

  const scope = SMOKE_ID != null ? [SMOKE_ID] : targets
  if (SMOKE_ID != null && SKIP_IDS.has(SMOKE_ID)) {
    console.error(`REFUSING: ${SMOKE_ID} is in SKIP_IDS (manual-review), not a strip target.`)
    process.exit(1)
  }
  console.log(`${DRY ? 'DRY-RUN' : SMOKE_ID != null ? `SMOKE (id ${SMOKE_ID})` : 'APPLY'} · scope: ${scope.length} contact(s)`)

  const { data, error } = await sb
    .from('crm_people')
    .select('id,name,tags,custom,addresses,background')
    .in('id', scope)
  if (error) throw new Error('fetch failed: ' + error.message)
  const byId = Object.fromEntries(data.map((p) => [p.id, p]))

  let stripped = 0, noop = 0, bgKept = 0, ownerSkip = 0
  const bgKeptIds = []
  for (const id of scope) {
    const p = byId[id]
    if (!p) { console.log(`  MISSING ${id} — not in DB, skipped`); continue }
    const s = computeStrip(p)

    // instruction #6 belt+braces: if a KEPT (non-stamped) address equals the
    // stamped parcel by any chance, the strip already removed only the stamped
    // street, so keptAddrs never contains it. Nothing extra needed — but if the
    // ONLY thing that changed is the address removal AND that address is the
    // contact's genuine home (no way to know here without DIAL; the sweep
    // already separated those into 'likely fine' verdicts), we still proceed
    // because these 67 are the Hoffman-pattern set by construction.

    if (!s.changed) { noop += 1; continue }
    if (s.removed.backgroundKeptForReview) { bgKept += 1; bgKeptIds.push(id) }

    const summary = [
      s.removed.tags.length ? `${s.removed.tags.length} tags` : null,
      s.removed.customKeys.length ? `${s.removed.customKeys.length} custom fields` : null,
      s.removed.addresses.length ? `${s.removed.addresses.length} parcel address` : null,
      s.removed.backgroundRemoved ? 'stamped background' : null,
    ].filter(Boolean).join(', ')

    console.log(`  ${DRY ? 'WOULD STRIP' : 'STRIP'} ${id} ${p.name}: ${summary}${s.removed.backgroundKeptForReview ? ' (background KEPT — non-template, flag for review)' : ''}`)

    if (!DRY) {
      const { error: upErr } = await sb
        .from('crm_people')
        .update({
          tags: s.tags,
          custom: s.custom,
          addresses: s.addresses,
          background: s.background,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (upErr) { console.error(`    ERROR ${id}: ${upErr.message}`); continue }

      const removedFields = [
        ...s.removed.tags.map((t) => `tag:${t}`),
        ...s.removed.customKeys.map((k) => `custom:${k}`),
        ...s.removed.addresses.map((a) => `address:${a.street || ''}`),
        ...(s.removed.backgroundRemoved ? ['background:stamped-brief'] : []),
      ]
      await sb.from('crm_timeline').insert({
        person_id: id,
        kind: 'system',
        title: 'Westside parcel data removed (wrong-household skip-trace match, Matt-approved 2026-07-02)',
        body: `Removed: ${removedFields.join('; ')}. Backup in out/westside-strip-backup.json (restore via scripts/_westside-parcel-restore.mjs).`,
        source: 'app',
        broker: null,
      })
    }
    stripped += 1
  }

  console.log(`\n${DRY ? 'WOULD strip' : 'STRIPPED'}: ${stripped} · no-op (already clean): ${noop} · background kept for review: ${bgKept}${bgKept ? ` → ${JSON.stringify(bgKeptIds)}` : ''}`)
  if (ownerSkip) console.log(`owner-address skips: ${ownerSkip}`)
  if (DRY) console.log('DRY-RUN — no writes.')
}

main().catch((e) => { console.error(e); process.exit(1) })
