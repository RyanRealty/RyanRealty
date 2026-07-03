#!/usr/bin/env node
// One-command undo for scripts/_newlead-cleanup-fix.mjs.
// Reads out/newlead-cleanup-backup.json and restores every changed contact:
//   - re-inserts the deleted lead_created timeline row(s) verbatim,
//   - restores created_at / fub_created_at / source to their pre-fix values,
//   - removes the cleanup Change Log note this session wrote.
// Idempotent + byte-faithful. Dry-run by default.
//
// Usage:
//   node scripts/_newlead-cleanup-restore.mjs                 # DRY RUN
//   node scripts/_newlead-cleanup-restore.mjs --apply         # restore all
//   node scripts/_newlead-cleanup-restore.mjs --apply --ids 52283
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const APPLY = process.argv.includes('--apply')
const idsArgIdx = process.argv.indexOf('--ids')
const ONLY_IDS = idsArgIdx > -1 ? process.argv[idsArgIdx + 1].split(',').map(Number) : null
const die = (m) => { console.error('FATAL:', m); process.exit(1) }

const backup = JSON.parse(readFileSync('out/newlead-cleanup-backup.json', 'utf8'))
const targets = ONLY_IDS ? backup.contacts.filter((c) => ONLY_IDS.includes(c.id)) : backup.contacts
let restored = 0

for (const C of targets) {
  console.log(`#${C.id} ${C.name}`)
  console.log(`  re-insert lead_created rows: [${(C.before.lead_created_rows ?? []).map((r) => r.id).join(',')}]`)
  console.log(`  created_at   ${C.after.created_at}  ->  ${C.before.created_at}`)
  console.log(`  fub_created  ${C.after.fub_created_at}  ->  ${C.before.fub_created_at ?? 'null'}`)
  console.log(`  source       '${C.after.source}'  ->  '${C.before.source}'`)

  if (!APPLY) continue

  // 1. Restore person fields.
  const { error: ue } = await sb.from('crm_people')
    .update({ created_at: C.before.created_at, fub_created_at: C.before.fub_created_at, source: C.before.source })
    .eq('id', C.id)
  if (ue) die(`restore person ${C.id}: ${ue.message}`)

  // 2. Re-insert the deleted lead_created row(s) verbatim (ON CONFLICT dedupe_key skips if present).
  for (const row of C.before.lead_created_rows ?? []) {
    const { id: _drop, ...insertRow } = row  // let the sequence assign a fresh id
    const { error } = await sb.from('crm_timeline').upsert(insertRow, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    if (error) die(`re-insert lead_created ${C.id}: ${error.message}`)
  }

  // 3. Remove the cleanup Change Log note this session wrote (match the exact prefix).
  const { data: notes } = await sb.from('crm_timeline')
    .select('id,title').eq('person_id', C.id).eq('kind', 'system')
    .like('title', 'New-lead cleanup (Matt 2026-07-02):%')
  for (const n of notes ?? []) {
    const { error } = await sb.from('crm_timeline').delete().eq('id', n.id)
    if (error) die(`remove changelog ${C.id}: ${error.message}`)
  }

  restored++
}

console.log(`\n${APPLY ? 'RESTORED' : 'DRY RUN'} — contacts: ${targets.length}${APPLY ? ` | restored: ${restored}` : ''}`)
if (!APPLY) console.log('Re-run with --apply to restore.')
