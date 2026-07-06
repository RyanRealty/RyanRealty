#!/usr/bin/env node
/**
 * PHASE 4 — complete the neighborhood map for contacts that HAVE a street address
 * but no canonical neighborhood yet. Reuses the platform's existing pipeline:
 * Google geocode (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) -> lookup_address_geo RPC
 * (PostGIS point-in-polygon over boundaries) -> canonical neighborhood/subdivision.
 *
 *   node scripts/_crm-geo-geocode.mjs --smoke 10   # geocode 10, report, no writes
 *   node scripts/_crm-geo-geocode.mjs --apply       # geocode + write all
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
const GKEY = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const APPLY = process.argv.includes('--apply');
const smokeIdx = process.argv.indexOf('--smoke');
const SMOKE_N = smokeIdx > -1 ? Number(process.argv[smokeIdx + 1] || 10) : (APPLY ? Infinity : 10);

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'resort-communities.json'), 'utf8'));
const isResort = new Map(registry.communities.map((c) => [c.slug, c.is_resort === true]));

async function geocode(addr) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GKEY}&region=us&components=country:US|administrative_area:OR`;
  for (let a = 1; a <= 3; a++) {
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    if (j.status === 'OK' && j.results?.length) return j.results[0].geometry.location; // {lat,lng}
    if (j.status === 'OVER_QUERY_LIMIT' || j.status === 'UNKNOWN_ERROR') { await new Promise((s) => setTimeout(s, 500 * a)); continue; }
    return null; // ZERO_RESULTS etc
  }
  return null;
}

// Process the addressed-but-unmapped set in batches until exhausted. Every
// processed contact gets a neighborhood_source stamp (even no-match) so it is
// geocoded EXACTLY ONCE and re-runs are cheap + idempotent.
let geocoded = 0, resolved = 0, wrote = 0, zeroResult = 0, outsidePolys = 0;
const sample = [];
for (let batch = 0; ; batch++) {
  const { data: targets, error } = await sb
    .from('crm_people')
    .select('id,addresses')
    .eq('deleted', false)
    .is('neighborhood_slug', null)
    .is('neighborhood_source', null)   // exclude already-processed (match or no-match)
    .not('addresses', 'eq', '[]')
    .limit(1000);
  if (error) throw new Error(error.message);
  const rows = (targets || []).filter((r) => Array.isArray(r.addresses) && r.addresses[0]?.street);
  if (rows.length === 0) break;
  const cap = SMOKE_N === Infinity ? rows.length : Math.min(SMOKE_N, rows.length);
  for (let i = 0; i < cap; i++) {
    const r = rows[i];
    const a = r.addresses[0];
    const addr = [a.street, a.city, a.state, a.code].filter(Boolean).join(', ');
    const loc = await geocode(addr);
    let patch;
    if (!loc) { zeroResult++; patch = { neighborhood_source: 'geocode-failed' }; }
    else {
      geocoded++;
      const { data: geo } = await sb.rpc('lookup_address_geo', { lat: loc.lat, lng: loc.lng });
      const g = Array.isArray(geo) ? geo[0] : geo;
      const nbhd = g?.neighborhood_slug ?? null;
      if (!nbhd) { outsidePolys++; patch = { neighborhood_source: g?.city_slug ? 'geocoded-city-only' : 'geocoded-none' };
        if (sample.length < 10) sample.push({ id: r.id, addr, city_slug: g?.city_slug ?? null, nbhd: null }); }
      else { resolved++; patch = { neighborhood_slug: nbhd, subdivision: g?.subdivision_slug ?? null, is_resort: isResort.get(nbhd) === true, neighborhood_source: 'geocoded' };
        if (sample.length < 10) sample.push({ id: r.id, addr, nbhd, sub: g?.subdivision_slug ?? null }); }
    }
    if (APPLY) { const { error: uerr } = await sb.from('crm_people').update(patch).eq('id', r.id); if (uerr) throw new Error(`id=${r.id}: ${uerr.message}`); wrote++; }
  }
  process.stdout.write(`\r  processed batch ${batch + 1}: geocoded=${geocoded} resolved=${resolved} outside=${outsidePolys} failed=${zeroResult}`);
  if (!APPLY) break; // smoke: one batch only
}
console.log('\n' + JSON.stringify({ geocoded, resolved_to_neighborhood: resolved, geocode_zero_result: zeroResult, geocoded_but_outside_neighborhood_polys: outsidePolys, wrote }, null, 2));
console.log('sample:', JSON.stringify(sample, null, 2));
