#!/usr/bin/env node
/**
 * WESTSIDE PARCEL STRIP — ONE-COMMAND RESTORE / UNDO (2026-07-02)
 *
 * Reads out/westside-strip-backup.json and restores any/all contacts to their
 * EXACT pre-strip state (tags, custom, addresses, background). This is the undo
 * for scripts/_westside-parcel-strip.mjs.
 *
 * Restores are IDEMPOTENT — restoring a contact already at its backed-up state
 * is a no-op (reported as "already restored").
 *
 * Usage:
 *   node scripts/_westside-parcel-restore.mjs --dry-run            # show what WOULD change, no writes
 *   node scripts/_westside-parcel-restore.mjs --apply              # restore ALL backed-up contacts
 *   node scripts/_westside-parcel-restore.mjs --apply --ids 13014  # restore specific ids
 *   node scripts/_westside-parcel-restore.mjs --dry-run --ids 9828,3989
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const DRY = args.includes('--dry-run') || !APPLY
const idsIdx = args.indexOf('--ids')
const ONLY_IDS = idsIdx > -1 ? new Set(String(args[idsIdx + 1] || '').split(',').map((s) => Number(s.trim())).filter(Boolean)) : null

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BACKUP_PATH = 'out/westside-strip-backup.json'

function stableEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

async function main() {
  if (!existsSync(BACKUP_PATH)) {
    console.error(`missing ${BACKUP_PATH} — nothing to restore from`)
    process.exit(1)
  }
  const backup = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'))
  let entries = Object.values(backup.people || {})
  if (ONLY_IDS) entries = entries.filter((e) => ONLY_IDS.has(e.id))
  console.log(`${DRY ? 'DRY-RUN' : 'APPLY'} restore from ${BACKUP_PATH} (backedUpAt ${backup.backedUpAt})`)
  console.log(`  candidates: ${entries.length}${ONLY_IDS ? ` (filtered to ${[...ONLY_IDS].join(',')})` : ''}`)

  const ids = entries.map((e) => e.id)
  const { data: current, error } = await sb
    .from('crm_people')
    .select('id,tags,custom,addresses,background')
    .in('id', ids)
  if (error) throw new Error('fetch current failed: ' + error.message)
  const curById = Object.fromEntries(current.map((c) => [c.id, c]))

  let restored = 0, already = 0, missing = 0
  for (const e of entries) {
    const cur = curById[e.id]
    if (!cur) { missing += 1; console.log(`  MISSING ${e.id} ${e.name} — not in DB, skipped`); continue }
    const needs =
      !stableEqual(cur.tags, e.tags) ||
      !stableEqual(cur.custom, e.custom) ||
      !stableEqual(cur.addresses, e.addresses) ||
      !stableEqual(cur.background, e.background)
    if (!needs) { already += 1; continue }
    console.log(`  ${DRY ? 'WOULD RESTORE' : 'RESTORE'} ${e.id} ${e.name}`)
    if (!DRY) {
      const { error: upErr } = await sb
        .from('crm_people')
        .update({
          tags: e.tags,
          custom: e.custom,
          addresses: e.addresses,
          background: e.background,
          updated_at: new Date().toISOString(),
        })
        .eq('id', e.id)
      if (upErr) { console.error(`    ERROR ${e.id}: ${upErr.message}`); continue }
      await sb.from('crm_timeline').insert({
        person_id: e.id,
        kind: 'system',
        title: `Westside parcel data RESTORED from backup (${backup.backedUpAt}) — undo of the 2026-07-02 wrong-household strip.`,
        source: 'app',
        broker: null,
      })
    }
    restored += 1
  }

  console.log(`\n${DRY ? 'WOULD restore' : 'RESTORED'}: ${restored} · already at backup state: ${already} · missing: ${missing}`)
  if (DRY) console.log('DRY-RUN — no writes. Re-run with --apply to restore.')
}

main().catch((e) => { console.error(e); process.exit(1) })
