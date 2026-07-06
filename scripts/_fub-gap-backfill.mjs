#!/usr/bin/env node
/**
 * PHASE 3a — backfill the 44 mirror-gap contacts (FUB has an address the local
 * mirror lacks). Writes crm_people.addresses from FUB, and resolves their canonical
 * geo from the FUB neighborhood:/subdivision: tags via the existing rollup.
 *
 *   node scripts/_fub-gap-backfill.mjs           # DRY-RUN
 *   node scripts/_fub-gap-backfill.mjs --apply    # write
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const slugify = (x) => (x == null ? '' : String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

// rollup + registry (same canon as the main resolver)
const ns = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('neighborhood_subdivisions').select('neighborhood_slug,subdivision_label').range(from, from + 999);
  ns.push(...data); if (data.length < 1000) break;
}
const subToNbhd = new Map(), subToLabel = new Map();
for (const r of ns) { const k = slugify(r.subdivision_label); if (!k) continue; if (!subToNbhd.has(k)) subToNbhd.set(k, r.neighborhood_slug); if (!subToLabel.has(k)) subToLabel.set(k, r.subdivision_label); }
const nbhdSlugs = new Set(ns.map((r) => r.neighborhood_slug));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'resort-communities.json'), 'utf8'));
const isResort = new Map(registry.communities.map((c) => [c.slug, c.is_resort === true]));

function resolveFromTags(tags) {
  const subs = tags.filter((t) => t.startsWith('subdivision:')).map((t) => t.slice('subdivision:'.length));
  for (const s of subs) {
    const k = slugify(s), base = k.replace(/-(phase|phases|ph)-.*$/, '');
    const nb = subToNbhd.get(k) || subToNbhd.get(base) || (nbhdSlugs.has(k) ? k : nbhdSlugs.has(base) ? base : null);
    if (nb) return { neighborhood_slug: nb, subdivision: subToLabel.get(k) || subToLabel.get(base) || null, neighborhood_source: 'subdivision-rollup' };
  }
  const nbs = tags.filter((t) => t.startsWith('neighborhood:')).map((t) => slugify(t.slice('neighborhood:'.length))).filter((s) => nbhdSlugs.has(s));
  if (nbs.length === 1) return { neighborhood_slug: nbs[0], subdivision: null, neighborhood_source: 'neighborhood-field' };
  return null; // ambiguous / none — leave for the geocode pass
}

const { gap } = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'fub-address-reconcile.json'), 'utf8'));
let addrW = 0, geoW = 0;
const plan = gap.map((g) => ({ id: g.id, addresses: g.fub_addresses, geo: resolveFromTags(g.fub_geo_tags || []) }));
for (const p of plan) { if (p.addresses?.length) addrW++; if (p.geo) geoW++; }
console.log(`gap rows: ${gap.length}. would set address on ${addrW}, geo on ${geoW}. apply=${APPLY}`);
console.log('sample:', JSON.stringify(plan.slice(0, 3), null, 2));
if (!APPLY) process.exit(0);

for (const p of plan) {
  const patch = { addresses: p.addresses || [] };
  if (p.geo) Object.assign(patch, p.geo, { is_resort: isResort.get(p.geo.neighborhood_slug) === true });
  const { error } = await sb.from('crm_people').update(patch).eq('id', p.id);
  if (error) throw new Error(`id=${p.id}: ${error.message}`);
}
console.log(`applied ${plan.length} rows.`);
const { data: check } = await sb.from('crm_people').select('id,neighborhood_slug,subdivision,addresses').in('id', plan.slice(0, 5).map((p) => p.id));
console.log('read-back:', JSON.stringify(check?.map((c) => ({ id: c.id, nbhd: c.neighborhood_slug, sub: c.subdivision, addr: c.addresses?.[0]?.street })), null, 2));
