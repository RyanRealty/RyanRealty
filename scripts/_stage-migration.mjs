#!/usr/bin/env node
/**
 * Stage remap (streamline v2, Phase 3) — REVERSIBLE, IDEMPOTENT, DRY-RUN BY DEFAULT.
 * Executes the reviewed stage spec (CRM_STAGES_AUTOMATION_2026-07-03.md): consolidate
 * the 16 legacy stages to the active pipeline. Segment/realtor identity already lives
 * on tags (Phase 1), so folding Seller Prospect -> Nurture and Real Estate Agent ->
 * Sphere never loses a list (Sellers keys on segment:seller, not the stage).
 *
 *   node scripts/_stage-migration.mjs               # DRY-RUN: before/after distribution, NO writes
 *   node scripts/_stage-migration.mjs --apply       # backup-first, then remap
 *   node scripts/_stage-migration-restore.mjs --apply
 *
 * Safety rails mirror the tag migration: pre-image backup (id+stage) written FIRST,
 * write-once per runId, resumable, only changed rows written.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const RUN_ID = (process.argv.find((a) => a.startsWith('--run-id=')) || '').split('=')[1] || 'stage-v2-2026-07-03';
const OUT = path.join(ROOT, 'out');
const BACKUP_PATH = path.join(OUT, `stage-migration-backup-${RUN_ID}.json`);

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Old -> new stage map. Anything not listed is already a target stage (unchanged).
export const STAGE_MAP = {
  'Lead': 'Nurture',
  'Seller Prospect': 'Nurture',
  'A - Hot 1-3 Months': 'Nurture',
  'B - Warm 3-6 Months': 'Nurture',
  'C - Cold 6+ Months': 'Nurture',
  'Renter - future buyer': 'Nurture',
  'Real Estate Agent': 'Sphere',
  'Vendor': 'Sphere',
  'Archive': 'Trash',
};
const TARGET_STAGES = new Set(['Nurture', 'Engaged', 'Active Client', 'Pending', 'Closed', 'Past Client', 'Sphere', 'Trash']);

async function fetchAll() {
  const rows = []; let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb.from('crm_people').select('id,stage')
      .eq('deleted', false).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break; from += PAGE;
  }
  return rows;
}

async function main() {
  console.log(`\n${APPLY ? 'APPLY' : 'DRY-RUN'} — stage remap runId=${RUN_ID}`);
  const rows = await fetchAll();
  const before = {}, after = {}; const plan = [];
  for (const r of rows) {
    before[r.stage] = (before[r.stage] ?? 0) + 1;
    const next = STAGE_MAP[r.stage] ?? r.stage;
    after[next] = (after[next] ?? 0) + 1;
    if (next !== r.stage) plan.push({ id: r.id, from: r.stage, to: next });
  }
  // preflight: every resulting stage must be a known target
  const badTargets = [...new Set(Object.keys(after))].filter((s) => !TARGET_STAGES.has(s));
  console.log('\nBEFORE:', JSON.stringify(before));
  console.log('AFTER :', JSON.stringify(after));
  console.log(`\ncontacts to remap: ${plan.length} / ${rows.length}`);
  console.log(`reconcile: total in==out? ${rows.length === Object.values(after).reduce((a, b) => a + b, 0) ? '✅' : '❌'}`);
  console.log(`unknown target stages: ${badTargets.length ? '❌ ' + JSON.stringify(badTargets) : '✅ none'}`);

  if (!APPLY) { console.log('\nDRY-RUN — no writes.'); return; }
  if (badTargets.length) { console.error('❌ refusing to apply: unknown target stage'); process.exit(2); }
  if (fs.existsSync(BACKUP_PATH)) { console.error(`❌ backup ${BACKUP_PATH} exists (write-once)`); process.exit(3); }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(BACKUP_PATH, JSON.stringify({ runId: RUN_ID, count: plan.length, backup: plan.map((p) => ({ id: p.id, stage: p.from })) }));
  console.log(`\n✅ backup written FIRST: ${BACKUP_PATH} (${plan.length} rows). Writing...`);
  let n = 0;
  for (const p of plan) {
    const { error } = await sb.from('crm_people').update({ stage: p.to, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) throw new Error(`update ${p.id}: ${error.message}`);
    if (++n % 1000 === 0) console.log(`  ${n}/${plan.length}`);
  }
  console.log(`\n✅ APPLIED. ${n} contacts remapped.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
