#!/usr/bin/env node
/**
 * WESTSIDE PARCEL STRIP — FULL BACKUP (2026-07-02)
 *
 * Writes the COMPLETE current state of every flagged wrong-household contact to
 * out/westside-strip-backup.json BEFORE anything is mutated. This is the restore
 * source of truth: scripts/_westside-parcel-restore.mjs reads it to put any/all
 * contacts back to their exact pre-strip state (one-command undo).
 *
 * Backs up ALL 75 flagged targets (incl. the 8 SKIP_IDS) so restore works for
 * any of them. The strip itself (_westside-parcel-strip.mjs) only touches the 67
 * non-skipped contacts.
 *
 * Backup shape per person_id:
 *   { id, name, tags, custom, addresses, background, backed_up_at }
 * (These are exactly the mutable fields the strip may touch. phones/emails/
 * contact points / stage / relationships are NEVER touched and not backed up.)
 *
 * PII: the backup file is gitignored — never committed. Reference by path.
 *
 * Usage: node scripts/_westside-parcel-backup.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { computeStrip, SKIP_IDS } from './_westside-strip-rules.mjs'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const IDS_PATH = 'out/westside-target-ids.json'
const BACKUP_PATH = 'out/westside-strip-backup.json'

async function main() {
  if (!existsSync(IDS_PATH)) {
    console.error(`missing ${IDS_PATH} — run the target-id extraction first`)
    process.exit(1)
  }
  const ids = JSON.parse(readFileSync(IDS_PATH, 'utf8'))
  console.log(`target ids: ${ids.length}`)

  const { data, error } = await sb
    .from('crm_people')
    .select('id,name,tags,custom,addresses,background')
    .in('id', ids)
  if (error) throw new Error('fetch failed: ' + error.message)
  if (data.length !== ids.length) {
    console.error(`WARN: fetched ${data.length} of ${ids.length} — some ids missing; aborting for safety`)
    process.exit(1)
  }

  const backedUpAt = new Date().toISOString()
  const backup = {}
  const preview = { strip: [], skip: [], noop: [], bgKeep: [] }
  for (const p of data) {
    backup[p.id] = {
      id: p.id,
      name: p.name,
      tags: p.tags ?? null,
      custom: p.custom ?? null,
      addresses: p.addresses ?? null,
      background: p.background ?? null,
      backed_up_at: backedUpAt,
    }
    if (SKIP_IDS.has(p.id)) { preview.skip.push(p.id); continue }
    const s = computeStrip(p)
    if (!s.changed) preview.noop.push(p.id)
    else preview.strip.push(p.id)
    if (s.removed.backgroundKeptForReview) preview.bgKeep.push(p.id)
  }

  mkdirSync('out', { recursive: true })
  writeFileSync(BACKUP_PATH, JSON.stringify({ backedUpAt, count: data.length, people: backup }, null, 2))

  console.log(`\nBACKUP written: ${BACKUP_PATH} (${data.length} contacts, ${backedUpAt})`)
  console.log(`  will STRIP:            ${preview.strip.length}`)
  console.log(`  will SKIP (manual):    ${preview.skip.length}  → ${JSON.stringify(preview.skip)}`)
  console.log(`  no-op (already clean): ${preview.noop.length}  → ${JSON.stringify(preview.noop)}`)
  console.log(`  background KEPT (non-template, manual review): ${preview.bgKeep.length}  → ${JSON.stringify(preview.bgKeep)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
