#!/usr/bin/env node
/**
 * Phase 2 — reconcile westside_parcels -> crm_people. Sets person_id + match_method
 * (address = exact street; name = unique owner first+last; none = net-new).
 * Writes only to westside_parcels (never touches crm_people). Idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const streetKey = (s) => (s || '').toLowerCase().replace(/[.,#]/g, ' ')
  .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir|place|pl|boulevard|blvd|way|terrace|ter|loop|trail|trl|highway|hwy|apt|unit|ste|suite)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const nameKey = (f, l) => `${(f || '').trim().toLowerCase().split(' ')[0]}|${(l || '').trim().toLowerCase().split(' ').pop()}`.replace(/[^a-z|]/g, '');

// contact indexes
const streetToId = new Map(); const nameToIds = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('crm_people').select('id,name,first_name,last_name,addresses,custom').eq('deleted', false).range(from, from + 999);
  if (error) throw new Error(error.message);
  for (const c of data) {
    const streets = [];
    if (Array.isArray(c.addresses)) for (const a of c.addresses) if (a?.street) streets.push(a.street);
    if (c.custom?.customSellerPropertyAddress) streets.push(c.custom.customSellerPropertyAddress);
    for (const s of streets) { const k = streetKey(s); if (k.length > 4 && !streetToId.has(k)) streetToId.set(k, c.id); }
    let f = c.first_name, l = c.last_name; if ((!f || !l) && c.name) { const p = c.name.trim().split(/\s+/); f = f || p[0]; l = l || p[p.length - 1]; }
    const nk = nameKey(f, l); if (nk.includes('|') && nk.length > 3) { if (!nameToIds.has(nk)) nameToIds.set(nk, new Set()); nameToIds.get(nk).add(c.id); }
  }
  if (data.length < 1000) break;
}
console.log(`contacts: ${streetToId.size} street-keys, ${nameToIds.size} name-keys`);

// parcels
const parcels = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('westside_parcels').select('apn,site_street,owner1_first,owner1_last').range(from, from + 999);
  if (error) throw new Error(error.message);
  parcels.push(...data); if (data.length < 1000) break;
}

let addr = 0, name = 0, none = 0;
const updates = parcels.map((p) => {
  const sk = streetKey(p.site_street);
  if (sk.length > 4 && streetToId.has(sk)) { addr++; return { apn: p.apn, person_id: streetToId.get(sk), match_method: 'address' }; }
  const nk = nameKey(p.owner1_first, p.owner1_last);
  const ids = nk.includes('|') ? nameToIds.get(nk) : null;
  if (ids && ids.size === 1) { name++; return { apn: p.apn, person_id: [...ids][0], match_method: 'name' }; }
  none++; return { apn: p.apn, person_id: null, match_method: 'none' };
});
console.log(`matched by address ${addr}, by unique name ${name}, net-new ${none}. writing...`);
let done = 0;
for (let i = 0; i < updates.length; i += 500) {
  // update only person_id + match_method (upsert needs full row; use update per-chunk via rpc-less loop)
  await Promise.all(updates.slice(i, i + 500).map(async (u) => {
    const { error } = await sb.from('westside_parcels').update({ person_id: u.person_id, match_method: u.match_method }).eq('apn', u.apn);
    if (error) throw new Error(`${u.apn}: ${error.message}`);
  }));
  done += Math.min(500, updates.length - i); process.stdout.write(`\r  wrote ${done}/${updates.length}`);
}
console.log('\ndone.');
