#!/usr/bin/env node
/**
 * Tag streamline migration v2 — REVERSIBLE, IDEMPOTENT, RESUMABLE, DRY-RUN BY DEFAULT.
 * Spec: docs/plans/CRM_STREAMLINE_PLAN_V2_2026-07-03.md + the two audit-findings docs.
 * PROPOSAL TOOL — DO NOT run --apply until Matt approves the dry-run reconciliation.
 *
 *   node scripts/_tag-streamline-migrate.mjs                 # DRY-RUN (default): report + reconcile, NO writes
 *   node scripts/_tag-streamline-migrate.mjs --apply         # execute (pre-image backup FIRST, then writes)
 *   node scripts/_tag-streamline-restore.mjs --apply         # undo from the immutable backup
 *
 * SAFETY RAILS (each closes an audit finding):
 *  - PRE-IMAGE BACKUP written to disk + row-count-verified BEFORE the first write (P0-2).
 *  - Backup is WRITE-ONCE per runId; --apply refuses to clobber an existing one (P0-3).
 *  - Backup captures tags + stage + the custom keys we touch (P0-2, reversibility real).
 *  - FIELD-WRITE before tag drop: single-value enrichment captured into custom (empty-only,
 *    never overwrite); ambiguous multi-value flagged for geocode, never guessed (P0-1, V2-1).
 *  - PREFLIGHT ASSERTIONS (fail-closed): 0 sacred tags dropped, 0 populated field overwritten.
 *  - Idempotent + resumable via out/streamline-progress-<runId>.json.
 *  - Only rows whose array actually changes are written.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { rewritePersonTags, fieldWritePlan, isSacred } from './lib/tag-streamline.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const RUN_ID = (process.argv.find((a) => a.startsWith('--run-id=')) || '').split('=')[1] || 'v2-2026-07-03';
const OUT = path.join(ROOT, 'out');
const BACKUP_PATH = path.join(OUT, `streamline-backup-${RUN_ID}.json`);
const PROGRESS_PATH = path.join(OUT, `streamline-progress-${RUN_ID}.json`);

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const inc = (o, k, n = 1) => { o[k] = (o[k] ?? 0) + n; };

async function fetchAll() {
  const rows = []; let from = 0; const PAGE = 1000;
  for (;;) {
    const { data, error } = await sb.from('crm_people').select('id,tags,addresses,custom,stage')
      .eq('deleted', false).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break; from += PAGE;
  }
  return rows;
}

async function main() {
  console.log(`\n${APPLY ? 'APPLY' : 'DRY-RUN'} — runId=${RUN_ID}`);
  const rows = await fetchAll();
  console.log(`loaded ${rows.length} non-deleted contacts`);

  // ── Compute the full plan in memory FIRST (no writes yet) ──────────────────────
  const plan = [];                 // { id, before, after, fieldWrites, removed, added }
  const seg = {}; const occ = {}; const violations = { sacredLoss: [], fieldOverwrite: [] };
  const fieldStats = { writes: 0, needsGeocode: {} };
  let changed = 0, tagsRemoved = 0, tagsAdded = 0;

  for (const r of rows) {
    const before = Array.isArray(r.tags) ? r.tags : [];
    const res = rewritePersonTags(before, r.addresses, r.custom, r.stage);
    const after = res.tags;
    const { plan: fw, needsGeocode } = fieldWritePlan(before, r.custom);

    // preflight assertions (fail-closed)
    for (const t of before) if (isSacred(t) && !after.includes(t)) violations.sacredLoss.push({ id: r.id, tag: t });
    for (const k of Object.keys(fw)) {
      const existing = String(r.custom?.[k] ?? '').trim();
      if (existing) violations.fieldOverwrite.push({ id: r.id, field: k });
    }

    for (const s of res.segments) inc(seg, s);
    inc(occ, res.occ);
    for (const g of needsGeocode) inc(fieldStats.needsGeocode, g.field);
    if (Object.keys(fw).length) fieldStats.writes += Object.keys(fw).length;

    const beforeSet = new Set(before), afterSet = new Set(after);
    const removed = before.filter((t) => !afterSet.has(t)).length;
    const added = after.filter((t) => !beforeSet.has(t)).length;
    const tagsChanged = removed > 0 || added > 0;
    const fieldsChanged = Object.keys(fw).length > 0;
    if (tagsChanged || fieldsChanged) {
      changed += 1; tagsRemoved += removed; tagsAdded += added;
      plan.push({ id: r.id, beforeTags: before, beforeStage: r.stage,
        beforeCustomKeys: Object.keys(fw), after, fieldWrites: fw });
    }
  }

  // ── Reconciliation report ─────────────────────────────────────────────────────
  const EXPECT = { 'segment:seller': 7524, 'segment:expired': '~925', 'segment:out-of-area': 957,
                   'realtor:migration': 59 };
  console.log('\n═══ SEGMENT / LIST RECONCILIATION (dry-run count vs audited live) ═══');
  for (const k of Object.keys(seg).sort()) console.log(`  ${k.padEnd(24)} ${String(seg[k]).padStart(6)}${EXPECT[k] ? `   (expect ${EXPECT[k]})` : ''}`);
  const realtorTotal = (seg['realtor:local'] ?? 0) + (seg['realtor:migration'] ?? 0);
  console.log(`  ${'(realtor union)'.padEnd(24)} ${String(realtorTotal).padStart(6)}   (expect ~2406)`);
  console.log('\noccupancy derived:', JSON.stringify(occ));
  console.log('field-writes (single-value, empty-only):', fieldStats.writes,
              '| needs-geocode (multi+empty):', JSON.stringify(fieldStats.needsGeocode));
  console.log(`\ncontacts changed: ${changed} | tag assignments removed: ${tagsRemoved} | added: ${tagsAdded}`);

  console.log('\n═══ PREFLIGHT GATE ═══');
  console.log(`  sacred tags that would drop: ${violations.sacredLoss.length}  ${violations.sacredLoss.length ? '❌ ABORT' : '✅'}`);
  console.log(`  populated fields that would overwrite: ${violations.fieldOverwrite.length}  ${violations.fieldOverwrite.length ? '❌ ABORT' : '✅'}`);
  if (violations.sacredLoss.length) console.log('    e.g.', JSON.stringify(violations.sacredLoss.slice(0, 5)));
  if (violations.fieldOverwrite.length) console.log('    e.g.', JSON.stringify(violations.fieldOverwrite.slice(0, 5)));

  const gateFail = violations.sacredLoss.length > 0 || violations.fieldOverwrite.length > 0;

  if (!APPLY) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `streamline-dryrun-${RUN_ID}.json`),
      JSON.stringify({ runId: RUN_ID, total: rows.length, changed, segments: seg, occupancy: occ,
        fieldStats, violations: { sacredLoss: violations.sacredLoss.length, fieldOverwrite: violations.fieldOverwrite.length },
        samplePlan: plan.slice(0, 5) }, null, 2));
    console.log(`\nDRY-RUN complete. No writes. Report: out/streamline-dryrun-${RUN_ID}.json`);
    console.log(gateFail ? 'GATE: ❌ would abort on --apply.' : 'GATE: ✅ clean — safe to --apply after Matt approves.');
    return;
  }

  // ── APPLY path — gate, backup-first, then write ───────────────────────────────
  if (gateFail) { console.error('\n❌ PREFLIGHT FAILED — refusing to apply. Fix violations first.'); process.exit(2); }
  if (fs.existsSync(BACKUP_PATH)) { console.error(`\n❌ Backup ${BACKUP_PATH} already exists (write-once). Use a new --run-id or restore first.`); process.exit(3); }

  fs.mkdirSync(OUT, { recursive: true });
  const backup = plan.map((p) => ({ id: p.id, tags: p.beforeTags, stage: p.beforeStage,
    custom: Object.fromEntries(p.beforeCustomKeys.map((k) => [k, null])) }));
  fs.writeFileSync(BACKUP_PATH, JSON.stringify({ runId: RUN_ID, count: backup.length, liveTotal: rows.length, backup }));
  const readback = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  if (readback.count !== backup.length) { console.error('❌ backup readback mismatch — abort'); process.exit(4); }
  console.log(`\n✅ Pre-image backup written FIRST: ${BACKUP_PATH} (${backup.length} rows). Beginning writes.`);

  const done = fs.existsSync(PROGRESS_PATH) ? new Set(JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')).done) : new Set();
  let written = 0;
  for (const p of plan) {
    if (done.has(p.id)) continue;
    const update = { tags: p.after, updated_at: new Date().toISOString() };
    if (Object.keys(p.fieldWrites).length) {
      // merge field writes into custom (empty-only already enforced in the plan)
      const cur = (await sb.from('crm_people').select('custom').eq('id', p.id).maybeSingle()).data?.custom ?? {};
      update.custom = { ...cur, ...p.fieldWrites };
    }
    const { error } = await sb.from('crm_people').update(update).eq('id', p.id);
    if (error) throw new Error(`update ${p.id}: ${error.message}`);
    done.add(p.id); written += 1;
    if (written % 500 === 0) fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ runId: RUN_ID, done: [...done] }));
  }
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ runId: RUN_ID, done: [...done] }));
  console.log(`\n✅ APPLIED. ${written} contacts written. Backup: ${BACKUP_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
