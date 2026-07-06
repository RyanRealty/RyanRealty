#!/usr/bin/env node
/**
 * PHASE 1 — full FUB<->crm_people address reconcile. READ-ONLY.
 * Pulls EVERY FUB person (paginated) and diffs addresses against the local mirror,
 * so we know exactly how many local rows are missing an address FUB actually holds.
 *
 * Buckets (by source): both_have | mirror_gap (local empty, FUB has) | both_empty
 *   | local_only | no_fub_match. For mirror_gap we also record whether the FUB
 * address carries lat/lng and whether FUB tags carry neighborhood:/subdivision:
 * (so we know how many resolve to a neighborhood WITHOUT paid geocoding).
 *
 * Writes the mirror_gap worklist to out/fub-address-reconcile.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const auth = 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64');

const hasAddr = (arr) => Array.isArray(arr) && arr.some((a) => a && (String(a.street || '').trim() || String(a.city || '').trim()));
const geoFromTags = (tags) => (tags || []).some((t) => /^(neighborhood|subdivision):/.test(t));
const addrHasLatLng = (arr) => Array.isArray(arr) && arr.some((a) => a && a.lat != null && (a.lng != null || a.lon != null));

// ── pull ALL FUB people (paginated) ──────────────────────────────────────────
async function pullFub() {
  const byId = new Map();
  let total = null;
  // Cursor pagination via _metadata.nextLink (offset > 2000 is blocked by FUB).
  let url = `https://api.followupboss.com/v1/people?limit=100&fields=id,source,addresses,tags&includeTrash=false&sort=id`;
  for (;;) {
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (!r.ok) { throw new Error(`FUB ${r.status}: ${await r.text()}`); }
    const j = await r.json();
    total = total ?? j?._metadata?.collection?.total ?? null;
    const people = j.people || [];
    for (const p of people) byId.set(p.id, { addresses: p.addresses || [], tags: p.tags || [], source: p.source || null });
    process.stdout.write(`\r  FUB pulled ${byId.size}${total ? '/' + total : ''}`);
    const next = j?._metadata?.nextLink;
    if (!next || people.length === 0) break;
    url = next;
  }
  process.stdout.write('\n');
  return byId;
}

// ── pull local mirror ────────────────────────────────────────────────────────
async function pullLocal() {
  const rows = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('crm_people').select('id,fub_legacy_id,addresses,source,deleted').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data); if (data.length < PAGE) break;
  }
  return rows.filter((r) => !r.deleted);
}

const [fub, local] = await Promise.all([pullFub(), pullLocal()]);
console.log(`local non-deleted: ${local.length}, FUB people: ${fub.size}`);

const B = { both_have: 0, mirror_gap: 0, both_empty: 0, local_only: 0, no_fub_match: 0, no_fub_id: 0 };
const gapBySource = {}; const emptyBySource = {};
const gap = [];
let gapWithLatLng = 0, gapWithGeoTags = 0;

for (const r of local) {
  if (!r.fub_legacy_id) { B.no_fub_id++; continue; }
  const f = fub.get(r.fub_legacy_id);
  if (!f) { B.no_fub_match++; continue; }
  const localHas = hasAddr(r.addresses);
  const fubHas = hasAddr(f.addresses);
  const src = r.source || '(null)';
  if (localHas && fubHas) B.both_have++;
  else if (!localHas && fubHas) {
    B.mirror_gap++; gapBySource[src] = (gapBySource[src] || 0) + 1;
    if (addrHasLatLng(f.addresses)) gapWithLatLng++;
    if (geoFromTags(f.tags)) gapWithGeoTags++;
    gap.push({ id: r.id, fub_legacy_id: r.fub_legacy_id, source: src, fub_addresses: f.addresses, fub_geo_tags: (f.tags || []).filter((t) => /^(neighborhood|subdivision|city):/.test(t)) });
  } else if (!localHas && !fubHas) { B.both_empty++; emptyBySource[src] = (emptyBySource[src] || 0) + 1; }
  else { B.local_only++; }
}

const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'fub-address-reconcile.json'), JSON.stringify({ generatedFor: 'phase1-reconcile', buckets: B, gap }, null, 2));

console.log('\n=== RECONCILE ===');
console.log(JSON.stringify({
  buckets: B,
  mirror_gap_by_source: top(gapBySource),
  mirror_gap_resolvable_without_geocoding: { has_latlng: gapWithLatLng, has_geo_tags: gapWithGeoTags, of_total_gap: B.mirror_gap },
  both_empty_by_source: top(emptyBySource),
}, null, 2));
console.log(`\nwrote ${gap.length} mirror-gap rows -> out/fub-address-reconcile.json (NO writes)`);
