#!/usr/bin/env node
/**
 * crm-geo-backfill.mjs — fill crm_people.{neighborhood_slug, subdivision,
 * is_resort, neighborhood_source} from EVERY geo signal we hold.
 *
 * Supersedes scripts/_crm-geo-populate.mjs (which read only the two custom.*
 * free-text fields and left 8,246 of 22,510 active contacts geo-invisible).
 * All resolution logic lives server-side in ONE place — the
 * crm_geo_backfill_candidates() RPC (migration 20260710190000) — so this
 * script, the crm-geo-resolve cron, and the crm-e2e-verify coverage check can
 * never drift apart. Sources, in confidence order per column:
 *
 *   neighborhood_slug: westside parcel → matched listing's boundary
 *     neighborhood (label→slug via boundaries.geo_label) → point-in-polygon →
 *     subdivision rollup → canonical customNeighborhood. Canonical vocabulary
 *     only — never a label, never an invented slug.
 *   subdivision: parcel → most-recent listing at the contact's address →
 *     humanized customSubdivision. This is the column community smart lists
 *     match (subdivision-contains, per 593f5fe4), so it fills even where no
 *     canonical neighborhood exists (Redmond, Sisters, La Pine, rural Bend).
 *
 * Fill-only: the RPC returns NULL for any column the contact already has.
 *
 *   node scripts/crm-geo-backfill.mjs           # DRY-RUN (default): summary, no writes
 *   node scripts/crm-geo-backfill.mjs --smoke    # write 25 rows, read them back
 *   node scripts/crm-geo-backfill.mjs --apply    # write all candidates in batches
 *
 * Backup-first: pre-write values of the 4 geo columns for every touched id go
 * to out/crm-geo-backfill-backup-<ts>.json before any write.
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

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'resort-communities.json'), 'utf8'));
const isResort = new Map(registry.communities.map((c) => [c.slug, c.is_resort === true]));

// ── candidates (server-side resolution; paginate past the PostgREST row cap) ──
const candidates = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb.rpc('crm_geo_backfill_candidates').range(from, from + PAGE - 1);
  if (error) throw new Error(`crm_geo_backfill_candidates: ${error.message}`);
  candidates.push(...data);
  if (data.length < PAGE) break;
}

const bySource = candidates.reduce((a, c) => ((a[c.fill_source] = (a[c.fill_source] || 0) + 1), a), {});
console.log(`candidates: ${candidates.length} (nbhd fills: ${candidates.filter((c) => c.fill_neighborhood_slug).length}, subdivision fills: ${candidates.filter((c) => c.fill_subdivision).length})`);
console.log('by source:', JSON.stringify(bySource));
console.log(`mode=${MODE}`);

if (MODE === 'dry') { console.log('DRY-RUN — no writes.'); process.exit(0); }

// ── backup pre-write values of every touched id ──────────────────────────────
const batch = MODE === 'smoke' ? candidates.slice(0, 25) : candidates;
const ids = batch.map((c) => c.person_id);
const pre = [];
for (let i = 0; i < ids.length; i += PAGE) {
  const { data, error } = await sb.from('crm_people')
    .select('id,neighborhood_slug,subdivision,is_resort,neighborhood_source')
    .in('id', ids.slice(i, i + PAGE));
  if (error) throw new Error(`backup read: ${error.message}`);
  pre.push(...data);
}
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const backupPath = path.join(ROOT, 'out', `crm-geo-backfill-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(backupPath, JSON.stringify({
  note: 'pre-write values of the 4 geo columns for every touched id. Revert = write these values back per id.',
  rows: pre,
}, null, 1));
console.log(`backup: ${path.relative(ROOT, backupPath)} (${pre.length} rows)`);

// ── fill-only targeted updates, bounded concurrency ──────────────────────────
const CONC = 25;
let written = 0;
for (let i = 0; i < batch.length; i += CONC) {
  const slice = batch.slice(i, i + CONC);
  await Promise.all(slice.map(async (c) => {
    const patch = {};
    if (c.fill_neighborhood_slug) {
      patch.neighborhood_slug = c.fill_neighborhood_slug;
      patch.neighborhood_source = c.fill_source;
      patch.is_resort = isResort.get(c.fill_neighborhood_slug) === true;
    }
    if (c.fill_subdivision) patch.subdivision = c.fill_subdivision;
    const { error } = await sb.from('crm_people').update(patch).eq('id', c.person_id);
    if (error) throw new Error(`update id=${c.person_id}: ${error.message}`);
  }));
  written += slice.length;
  process.stdout.write(`\r  written ${written}/${batch.length}`);
}
console.log(`\nwrote ${written} rows (${MODE}).`);

// ── read-back verification ────────────────────────────────────────────────────
const sampleIds = batch.slice(0, 10).map((c) => c.person_id);
const { data: check } = await sb.from('crm_people')
  .select('id,neighborhood_slug,subdivision,is_resort,neighborhood_source')
  .in('id', sampleIds);
console.log('read-back sample:', JSON.stringify(check, null, 2));
