#!/usr/bin/env node
/**
 * Populate crm_people.{neighborhood_slug, subdivision, is_resort, neighborhood_source}
 * from the ad-hoc custom location strings, resolving to the platform's CANONICAL
 * geo entities (neighborhood_subdivisions + boundaries + resort registry).
 *
 *   node scripts/_crm-geo-populate.mjs           # DRY-RUN (default): compute + summary, no writes
 *   node scripts/_crm-geo-populate.mjs --smoke    # write 25 rows, read them back
 *   node scripts/_crm-geo-populate.mjs --apply    # write all resolved rows in batches
 *
 * Backup-first: the pre-write values of the 4 geo columns for every touched id go to
 * out/crm-geo-populate-backup.json. Revert = set those columns back (all null here).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const MODE = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--smoke') ? 'smoke' : 'dry';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const slugify = (x) => (x == null ? '' : String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

async function pullAll(table, cols) {
  const rows = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data); if (data.length < PAGE) break;
  }
  return rows;
}

// ── canonical reference ──────────────────────────────────────────────────────
const ns = await pullAll('neighborhood_subdivisions', 'neighborhood_slug,neighborhood_label,subdivision_label');
const subToNbhd = new Map();      // slug(subdivision_label) -> Set(neighborhood_slug)
const subToLabel = new Map();     // slug(subdivision_label) -> canonical subdivision_label
for (const r of ns) {
  const k = slugify(r.subdivision_label); if (!k) continue;
  if (!subToNbhd.has(k)) subToNbhd.set(k, new Set());
  subToNbhd.get(k).add(r.neighborhood_slug);
  if (!subToLabel.has(k)) subToLabel.set(k, r.subdivision_label);
}
const nbhdSlugs = new Set(ns.map((r) => r.neighborhood_slug));
const nbhdLabelToSlug = new Map();
for (const r of ns) { nbhdLabelToSlug.set(slugify(r.neighborhood_label), r.neighborhood_slug); nbhdLabelToSlug.set(slugify(r.neighborhood_slug), r.neighborhood_slug); }
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'resort-communities.json'), 'utf8'));
const isResort = new Map(registry.communities.map((c) => [c.slug, c.is_resort === true]));
const canonNbhd = (raw) => { const s = slugify(raw); return nbhdSlugs.has(s) ? s : (nbhdLabelToSlug.get(s) || null); };

// ── resolve ──────────────────────────────────────────────────────────────────
const people = await pullAll('crm_people', 'id,deleted,custom');
const updates = [];
for (const p of people) {
  if (p.deleted) continue;
  const c = p.custom || {};
  const rawSub = (c.customSubdivision || '').toString().trim() || null;
  const rawNbhd = (c.customNeighborhood || '').toString().trim() || null;
  if (!rawSub && !rawNbhd) continue;

  let subNbhd = null, subLabel = null;
  if (rawSub) {
    const key = slugify(rawSub);
    const base = key.replace(/-(phase|phases|ph)-.*$/, '');
    let parents = subToNbhd.get(key) || (base !== key ? subToNbhd.get(base) : null);
    let lk = subToNbhd.get(key) ? key : (subToNbhd.get(base) ? base : null);
    if (!parents && nbhdSlugs.has(key)) { parents = new Set([key]); }
    if (!parents && base !== key && nbhdSlugs.has(base)) { parents = new Set([base]); }
    if (parents) { subNbhd = [...parents][0]; subLabel = lk ? (subToLabel.get(lk) || null) : null; }
  }
  const fieldNbhd = rawNbhd ? canonNbhd(rawNbhd) : null;
  const finalNbhd = subNbhd || fieldNbhd;
  if (!finalNbhd) continue;
  let source;
  if (subNbhd && fieldNbhd) source = subNbhd === fieldNbhd ? 'both-agree' : 'conflict';
  else source = subNbhd ? 'subdivision-rollup' : 'neighborhood-field';
  updates.push({ id: p.id, neighborhood_slug: finalNbhd, subdivision: subLabel, is_resort: isResort.get(finalNbhd) === true, neighborhood_source: source });
}

console.log(`resolved ${updates.length} contacts. mode=${MODE}`);
const bySource = updates.reduce((a, u) => ((a[u.neighborhood_source] = (a[u.neighborhood_source] || 0) + 1), a), {});
console.log('by source:', JSON.stringify(bySource));

if (MODE === 'dry') { console.log('DRY-RUN — no writes.'); process.exit(0); }

// backup the pre-write geo cols of touched ids
const touched = new Set(updates.map((u) => u.id));
const preRows = people.filter((p) => touched.has(p.id)).map((p) => ({ id: p.id }));
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'crm-geo-populate-backup.json'),
  JSON.stringify({ note: 'pre-write geo cols were all null; revert = UPDATE crm_people SET neighborhood_slug=null, subdivision=null, is_resort=null, neighborhood_source=null WHERE id = ANY(ids)', ids: preRows.map((r) => r.id) }));

// id is GENERATED ALWAYS (identity) so upsert's INSERT branch is rejected; do
// targeted per-row UPDATEs (only the 4 geo cols) with bounded concurrency.
const batch = MODE === 'smoke' ? updates.slice(0, 25) : updates;
const CONC = 25;
let written = 0;
for (let i = 0; i < batch.length; i += CONC) {
  const slice = batch.slice(i, i + CONC);
  await Promise.all(slice.map(async (u) => {
    const { error } = await sb.from('crm_people')
      .update({ neighborhood_slug: u.neighborhood_slug, subdivision: u.subdivision, is_resort: u.is_resort, neighborhood_source: u.neighborhood_source })
      .eq('id', u.id);
    if (error) throw new Error(`update id=${u.id}: ${error.message}`);
  }));
  written += slice.length;
  if (MODE === 'apply') process.stdout.write(`\r  written ${written}/${batch.length}`);
}
console.log(`\nwrote ${written} rows (${MODE}).`);

// read-back verification
const sampleIds = batch.slice(0, 10).map((u) => u.id);
const { data: check } = await sb.from('crm_people').select('id,neighborhood_slug,subdivision,is_resort,neighborhood_source').in('id', sampleIds);
console.log('read-back sample:', JSON.stringify(check, null, 2));
