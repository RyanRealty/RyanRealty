#!/usr/bin/env node
/**
 * Fix: revert the suspect westside records the adversarial audit found.
 *  - 565 geo-conflicted NAME-matches (contact lives in a different city than the
 *    parcel): restore their exact pre-enrichment state from the backup + unlink parcel.
 *  - 98 net-new name-dupes + 9 bad-name net-new: soft-delete + unlink parcel.
 * DRY by default; --apply to write.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APPLY = process.argv.includes('--apply');
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const streetKey = (s) => (s || '').toLowerCase().replace(/[.,#]/g, ' ').replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir|place|pl|boulevard|blvd|way|terrace|ter|loop|trail|trl|highway|hwy|apt|unit|ste|suite)\b/g, ' ').replace(/\s+/g, ' ').trim();
const nameKey = (f, l) => `${(f || '').trim().toLowerCase().split(' ')[0]}|${(l || '').trim().toLowerCase().split(' ').pop()}`.replace(/[^a-z|]/g, '');
const cityN = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
async function pageAll(table, cols, filter) { const out = []; for (let f = 0; ; f += 1000) { let q = sb.from(table).select(cols).order(table === 'crm_people' ? 'id' : 'apn').range(f, f + 999); if (filter) q = filter(q); const { data, error } = await q; if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) break; } return out; }

const backup = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'westside-enrich-backup.json'), 'utf8')).map((b) => [b.id, b]));
const people = await pageAll('crm_people', 'id,first_name,last_name,name,addresses,source,neighborhood_slug', (q) => q.eq('deleted', false));
const cityById = new Map(), streetsById = new Map();
const preName = new Map(), preStreet = new Set();
for (const c of people) {
  const cities = new Set(), streets = new Set();
  if (Array.isArray(c.addresses)) for (const a of c.addresses) { if (a?.city) cities.add(cityN(a.city)); if (a?.street) streets.add(streetKey(a.street)); }
  cityById.set(c.id, cities); streetsById.set(c.id, streets);
  if (c.source !== 'westside-farm-assessor') { const nk = nameKey(c.first_name || (c.name || '').split(' ')[0], c.last_name || (c.name || '').split(' ').pop()); if (nk.includes('|')) { if (!preName.has(nk)) preName.set(nk, true); } }
}
const parcels = await pageAll('westside_parcels', 'apn,person_id,match_method,site_city');

// 1) 565 geo-conflicted name-matches -> restore + unlink
const conflictParcels = [], conflictPersons = new Set();
for (const p of parcels) {
  if (p.match_method !== 'name' || !p.person_id) continue;
  const cities = cityById.get(p.person_id) || new Set(); const pc = cityN(p.site_city);
  if (cities.size && pc && !cities.has(pc)) { conflictParcels.push(p.apn); conflictPersons.add(p.person_id); }
}
// 2) net-new dupes + bad names -> soft-delete + unlink
const badNetNew = [];
for (const c of people) {
  if (c.source !== 'westside-farm-assessor') continue;
  const nk = nameKey(c.first_name, c.last_name);
  const dup = preName.has(nk); const bad = !c.first_name || !c.last_name || /\d/.test(c.name || '');
  if (dup || bad) badNetNew.push(c.id);
}

console.log(`geo-conflict name-matches: ${conflictPersons.size} contacts / ${conflictParcels.length} parcels to restore+unlink`);
console.log(`net-new dupes/bad: ${badNetNew.length} contacts to soft-delete+unlink`);
if (!APPLY) { console.log('DRY — pass --apply to write'); process.exit(0); }

// restore the 565 from backup
let restored = 0, missingBackup = 0;
for (const id of conflictPersons) {
  const b = backup.get(id);
  if (!b) { missingBackup++; continue; }
  const { error } = await sb.from('crm_people').update({ tags: b.tags || [], custom: b.custom || {}, addresses: b.addresses || [], neighborhood_slug: b.neighborhood_slug ?? null, subdivision: b.subdivision ?? null }).eq('id', id);
  if (error) throw new Error(`restore ${id}: ${error.message}`); restored++;
}
// unlink their parcels
for (let i = 0; i < conflictParcels.length; i += 200) await Promise.all(conflictParcels.slice(i, i + 200).map((apn) => sb.from('westside_parcels').update({ person_id: null, match_method: 'name-conflict-review' }).eq('apn', apn)));

// soft-delete the bad net-new + reset their parcels
let deleted = 0;
for (let i = 0; i < badNetNew.length; i += 100) {
  const chunk = badNetNew.slice(i, i + 100);
  const { error } = await sb.from('crm_people').update({ deleted: true }).in('id', chunk);
  if (error) throw new Error(`soft-delete: ${error.message}`); deleted += chunk.length;
  await sb.from('westside_parcels').update({ person_id: null, match_method: 'none' }).in('person_id', chunk);
}
console.log(`\nrestored ${restored} (backup-missing ${missingBackup}), unlinked ${conflictParcels.length} parcels, soft-deleted ${deleted} net-new.`);
