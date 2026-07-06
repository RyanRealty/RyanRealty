#!/usr/bin/env node
/**
 * Purge the "Automated outreach packet generated…" log-note spam from
 * crm_timeline. These are automation-generated drafts (source='dual-write',
 * 2026-05/06) with zero human content — they pollute contact timelines and make
 * dead contacts look engaged. Every dual-write note is one of these (verified).
 *
 * Reversible: backs up every deleted row (full) to out/ before deleting.
 *
 *   node scripts/_crm-purge-packet-notes.mjs            # dry (count only)
 *   node scripts/_crm-purge-packet-notes.mjs --apply    # back up + delete
 *   node scripts/_crm-purge-packet-notes.mjs --restore out/<backup>.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const APPLY = process.argv.includes('--apply')
const RESTORE = process.argv.includes('--restore') ? process.argv[process.argv.indexOf('--restore') + 1] : null
const env = {}
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const MATCH = 'Automated outreach packet generated%'

if (RESTORE) {
  const rows = JSON.parse(fs.readFileSync(RESTORE, 'utf8'))
  console.log(`restoring ${rows.length} timeline rows from ${RESTORE}`)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('crm_timeline').insert(rows.slice(i, i + 500))
    if (error) throw new Error(error.message)
    console.log(`  ${Math.min(i + 500, rows.length)}/${rows.length}`)
  }
  console.log('restored.'); process.exit(0)
}

// pull the full matching rows (backup + ids)
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('crm_timeline').select('*').eq('kind', 'note').like('body', MATCH).range(from, from + 999)
  if (error) throw new Error(error.message)
  rows.push(...data)
  if (data.length < 1000) break
}
const contacts = new Set(rows.map((r) => r.person_id)).size
console.log(`matched: ${rows.length} packet-log notes across ${contacts} contacts. apply=${APPLY}`)
if (rows.length === 0) process.exit(0)

if (!APPLY) { console.log('\nDRY — pass --apply to back up + delete'); process.exit(0) }

const backupPath = path.join(ROOT, 'out', 'timeline-packet-spam-backup.json')
fs.mkdirSync(path.dirname(backupPath), { recursive: true })
fs.writeFileSync(backupPath, JSON.stringify(rows))
console.log(`backed up ${rows.length} full rows -> ${backupPath}`)

const ids = rows.map((r) => r.id)
let deleted = 0
for (let i = 0; i < ids.length; i += 500) {
  const batch = ids.slice(i, i + 500)
  const { error } = await sb.from('crm_timeline').delete().in('id', batch)
  if (error) throw new Error(error.message)
  deleted += batch.length
  console.log(`  deleted ${deleted}/${ids.length}`)
}

// verify none remain
const { count } = await sb.from('crm_timeline').select('id', { count: 'exact', head: true }).eq('kind', 'note').like('body', MATCH)
console.log(`\ndeleted ${deleted}. remaining packet-log notes: ${count ?? 0}. restore: node scripts/_crm-purge-packet-notes.mjs --restore ${backupPath}`)
