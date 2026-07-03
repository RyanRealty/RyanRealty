#!/usr/bin/env node
// New-lead-report cleanup (Matt 2026-07-02): today's merge-victim splits recreated
// 16 spouse contacts that are OLD un-merged relationships (Past/Active Client,
// history back to January). The split wrongly (a) let the crm_people AFTER-INSERT
// trigger write a `lead_created` timeline event and (b) stamped created_at=today,
// so they surface as brand-new leads in the New Leads report + "recently added".
//
// This is a DATA CLEANUP with maximum reversibility. It:
//   1. BACKS UP every row it will change → out/newlead-cleanup-backup.json
//      (the lead_created rows in full, + old created_at/fub_created_at/source),
//   2. DELETES the wrong `lead_created` event (drops them from New Leads),
//   3. BACKDATES created_at + fub_created_at to the survivor spouse's honest
//      fub_created_at (the real household lead-origin date — NOT the 2026-06-10
//      bulk-import created_at, which is itself an artifact),
//   4. Confirms source == survivor source (already true — copied at split time),
//   5. Writes a Change Log `system` note on each contact documenting the fix.
//
// Undo: node scripts/_newlead-cleanup-restore.mjs --apply
//
// Usage:
//   node scripts/_newlead-cleanup-fix.mjs               # DRY RUN (no writes)
//   node scripts/_newlead-cleanup-fix.mjs --apply       # apply
//   node scripts/_newlead-cleanup-fix.mjs --apply --ids 52283   # one contact (smoke)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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

// The 16 recreated split contacts → their survivor spouse. Verified 2026-07-02:
// each has exactly one lead_created row (dedupe_key lead:<id>), is linked to the
// survivor via crm_relationships, and source already == survivor.source.
const CONTACTS = [
  { id: 52283, name: 'Yahson Terry',        survivor: 12967 },
  { id: 52284, name: 'Christopher Hoffman', survivor: 13014 },
  { id: 52285, name: 'Brian Smith',         survivor: 5689 },
  { id: 52286, name: 'Charise Millard',     survivor: 5746 },
  { id: 52287, name: 'Tess McFeley',        survivor: 5736 },
  { id: 52288, name: 'Martha Detweiler',    survivor: 5687 },
  { id: 52289, name: 'Abby Hogge',          survivor: 5566 },
  { id: 52290, name: 'Brenda Timms',        survivor: 5737 },
  { id: 52291, name: 'Gail Newton',         survivor: 5744 },
  { id: 52292, name: 'Edward Fess',         survivor: 5686 },
  { id: 52293, name: 'Susan Reese',         survivor: 5739 },
  { id: 52294, name: 'Evan Karp',           survivor: 5745 },
  { id: 52295, name: 'Debra Creekmore',     survivor: 5688 },
  { id: 52296, name: 'Samuel Robinson',     survivor: 5715 },
  { id: 52297, name: 'Devin Pohl',          survivor: 5749 },
  { id: 52298, name: 'Becky Crawley',       survivor: 5568 },
]

const targets = ONLY_IDS ? CONTACTS.filter((c) => ONLY_IDS.includes(c.id)) : CONTACTS
const die = (m) => { console.error('FATAL:', m); process.exit(1) }

const backup = { generated_at: new Date().toISOString(), apply: APPLY, contacts: [] }
let ledFixed = 0, dateFixed = 0, srcFixed = 0

for (const C of targets) {
  // Resolve the person + survivor honest origin date.
  const { data: p, error: pe } = await sb
    .from('crm_people')
    .select('id,name,source,created_at,fub_created_at')
    .eq('id', C.id).single()
  if (pe || !p) die(`person ${C.id}: ${pe?.message}`)

  const { data: surv, error: sve } = await sb
    .from('crm_people')
    .select('id,name,source,created_at,fub_created_at')
    .eq('id', C.survivor).single()
  if (sve || !surv) die(`survivor ${C.survivor}: ${sve?.message}`)

  // Honest household lead-origin date: survivor.fub_created_at (real FUB origin),
  // falling back to the contact's own earliest real timeline ts, else survivor.created_at.
  let honestTs = surv.fub_created_at
  if (!honestTs) {
    const { data: earliest } = await sb.from('crm_timeline')
      .select('ts').eq('person_id', C.id)
      .not('kind', 'in', '("lead_created","system")')
      .order('ts', { ascending: true }).limit(1)
    honestTs = (earliest && earliest[0] && earliest[0].ts) || surv.created_at
  }

  // The wrong lead_created row (full content, for restore).
  const { data: leadRows, error: le } = await sb.from('crm_timeline')
    .select('*').eq('person_id', C.id).eq('kind', 'lead_created')
  if (le) die(`lead_created lookup ${C.id}: ${le.message}`)

  // Source: keep survivor source (the real household source). Already aligned at
  // split time; only correct if it drifted. We NEVER invent — if survivor's source
  // is itself a placeholder (e.g. 'AI- Claude'), we keep survivor's + flag it.
  const targetSource = surv.source
  const sourceNeedsFix = p.source !== targetSource
  const sourceIsPlaceholder = /^AI-|^\s*$/i.test(String(targetSource ?? ''))

  const rec = {
    id: C.id,
    name: C.name,
    survivor: C.survivor,
    before: {
      created_at: p.created_at,
      fub_created_at: p.fub_created_at,
      source: p.source,
      lead_created_rows: leadRows ?? [],
    },
    after: {
      created_at: honestTs,
      fub_created_at: honestTs,
      source: sourceNeedsFix ? targetSource : p.source,
      lead_created_deleted: (leadRows ?? []).map((r) => r.id),
    },
    notes: sourceIsPlaceholder
      ? `source '${targetSource}' is the survivor's own recorded value (kept per rule; flagged as a placeholder inherited from the survivor household — Matt to review)`
      : undefined,
  }
  backup.contacts.push(rec)

  console.log(`#${C.id} ${C.name}`)
  console.log(`  lead_created delete: [${rec.after.lead_created_deleted.join(',')}]`)
  console.log(`  created_at   ${p.created_at}  ->  ${honestTs}`)
  console.log(`  fub_created  ${p.fub_created_at ?? 'null'}  ->  ${honestTs}`)
  console.log(`  source       '${p.source}'  ->  '${rec.after.source}'${sourceNeedsFix ? ' (CHANGED)' : ' (unchanged)'}${sourceIsPlaceholder ? '  [placeholder-flagged]' : ''}`)

  if (leadRows && leadRows.length) ledFixed++
  if (p.created_at !== honestTs || p.fub_created_at !== honestTs) dateFixed++
  if (sourceNeedsFix) srcFixed++

  if (APPLY) {
    // 1. Delete the wrong lead_created event(s).
    if (leadRows && leadRows.length) {
      const { error } = await sb.from('crm_timeline').delete().eq('person_id', C.id).eq('kind', 'lead_created')
      if (error) die(`delete lead_created ${C.id}: ${error.message}`)
    }
    // 2 + 3. Backdate created_at + fub_created_at (+ source only if drifted).
    const upd = { created_at: honestTs, fub_created_at: honestTs }
    if (sourceNeedsFix) upd.source = targetSource
    const { error: ue } = await sb.from('crm_people').update(upd).eq('id', C.id)
    if (ue) die(`update person ${C.id}: ${ue.message}`)

    // 4. Change Log note documenting the correction (system row = audit trail).
    const { error: te } = await sb.from('crm_timeline').insert({
      person_id: C.id, kind: 'system', source: 'app', ts: honestTs,
      title: `New-lead cleanup (Matt 2026-07-02): this contact is an UN-MERGE of a FUB duplicate collapsed into #${C.survivor} ${surv.name}, not a new lead. Removed the erroneous "New lead" event the split trigger created, and backdated created date to the household's real lead-origin (${String(honestTs).slice(0, 10)}) so it no longer reads as created today. Contact points, messages, relationships, stage, and name unchanged. Reversible via out/newlead-cleanup-backup.json.`,
    })
    if (te) die(`changelog ${C.id}: ${te.message}`)
  }
}

if (APPLY || true) {
  mkdirSync('out', { recursive: true })
  writeFileSync('out/newlead-cleanup-backup.json', JSON.stringify(backup, null, 2))
  console.log(`\nBackup written: out/newlead-cleanup-backup.json (${backup.contacts.length} contacts)`)
}
console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'} — contacts: ${targets.length} | lead_created removed: ${ledFixed} | dates backdated: ${dateFixed} | source changed: ${srcFixed}`)
if (!APPLY) console.log('Re-run with --apply to write.')
