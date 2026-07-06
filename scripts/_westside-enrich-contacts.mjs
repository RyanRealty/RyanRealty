#!/usr/bin/env node
/**
 * Phase 3+4 — enrich + tag the MATCHED westside contacts from their linked parcel.
 * Empty-only for custom fields + addresses (never clobbers Matt-authored data);
 * tags are additive+deduped. Backs up the touched contacts first.
 *
 *   node scripts/_westside-enrich-contacts.mjs --smoke 10   # write 10, show before/after
 *   node scripts/_westside-enrich-contacts.mjs --apply       # all matched
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
const APPLY = process.argv.includes('--apply');
const si = process.argv.indexOf('--smoke');
const N = si > -1 ? Number(process.argv[si + 1] || 10) : (APPLY ? Infinity : 10);

const tenureBand = (y) => y == null ? null : y <= 2 ? '0-2' : y <= 5 ? '3-5' : y <= 8 ? '6-8' : y <= 12 ? '9-12' : y <= 17 ? '13-17' : y <= 24 ? '18-24' : '25plus';

// pull matched parcels (one per person; prefer the address-matched) — paginated
const parcels = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('westside_parcels')
    .select('apn,person_id,match_method,site_street,site_city,site_state,site_zip,mail_street,mail_city,mail_state,mail_zip,absentee,owner_occupied,owner_type,tenure_years,purchase_date,purchase_price,subdivision,year_built,bedrooms,baths,building_sqft,market_value,neighborhood_slug,subdivision_slug')
    .not('person_id', 'is', null).order('apn').range(from, from + 999);
  if (error) throw new Error(error.message);
  parcels.push(...data); if (data.length < 1000) break;
}
// one parcel per person (address-match wins)
const byPerson = new Map();
for (const p of parcels) { const cur = byPerson.get(p.person_id); if (!cur || (p.match_method === 'address' && cur.match_method !== 'address')) byPerson.set(p.person_id, p); }
const list = [...byPerson.values()].slice(0, N === Infinity ? undefined : N);
console.log(`matched contacts to enrich: ${byPerson.size}. this run: ${list.length}. apply=${APPLY}`);

const ids = list.map((p) => p.person_id);
const people = [];
for (let i = 0; i < ids.length; i += 900) {
  const { data, error } = await sb.from('crm_people').select('id,name,tags,custom,addresses,neighborhood_slug,subdivision').in('id', ids.slice(i, i + 900));
  if (error) throw new Error(error.message);
  people.push(...data);
}
const pmap = new Map(people.map((c) => [c.id, c]));

if (APPLY) {
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'westside-enrich-backup.json'), JSON.stringify(people.map((c) => ({ id: c.id, tags: c.tags, custom: c.custom, addresses: c.addresses, neighborhood_slug: c.neighborhood_slug, subdivision: c.subdivision }))));
}

const before = [], after = [];
let wrote = 0;
for (const p of list) {
  const c = pmap.get(p.person_id); if (!c) continue;
  const custom = { ...(c.custom || {}) };
  const setEmpty = (k, v) => { if (v != null && v !== '' && (custom[k] == null || custom[k] === '')) custom[k] = v; };
  setEmpty('customSellerPropertyAddress', p.site_street);
  setEmpty('customMailingAddress', p.mail_street ? `${p.mail_street}, ${p.mail_city || ''} ${p.mail_state || ''} ${p.mail_zip || ''}`.trim() : null);
  setEmpty('customAbsentee', p.absentee ? 'Yes' : 'No');
  setEmpty('customYearsOwned', p.tenure_years);
  setEmpty('customPurchaseDate', p.purchase_date);
  setEmpty('customPurchasePrice', p.purchase_price);
  setEmpty('customYearBuilt', p.year_built);
  setEmpty('customBedrooms', p.bedrooms);
  setEmpty('customBaths', p.baths);
  setEmpty('customBuildingSqft', p.building_sqft);
  setEmpty('customMarketValue', p.market_value);
  setEmpty('customAPN', p.apn);
  setEmpty('customSubdivision', p.subdivision);
  setEmpty('customOwnerType', p.owner_type);

  const tags = new Set(c.tags || []);
  tags.add('farm:westside');
  tags.add(p.absentee ? 'owner:absentee' : 'owner:occupied');
  const tb = tenureBand(p.tenure_years); if (tb) tags.add(`tenure:${tb}`);
  if (p.neighborhood_slug) tags.add(`neighborhood:${p.neighborhood_slug}`);
  if (p.subdivision_slug) tags.add(`subdivision:${p.subdivision_slug}`);
  if (p.mail_state && p.mail_state.toUpperCase() !== 'OR') tags.add('location:out-of-state');

  const addresses = Array.isArray(c.addresses) && c.addresses.length ? c.addresses
    : (p.site_street ? [{ type: 'Property', street: p.site_street, city: p.site_city, state: p.site_state, code: p.site_zip }] : []);

  const patch = { custom, tags: [...tags], addresses,
    neighborhood_slug: c.neighborhood_slug || p.neighborhood_slug || null,
    subdivision: c.subdivision || p.subdivision || null };

  if (before.length < 5) { before.push({ id: c.id, name: c.name, tags: (c.tags || []).length, hadAddr: (c.addresses || []).length > 0 }); after.push({ id: c.id, name: c.name, absentee: p.absentee, tenure: p.tenure_years, nbhd: p.neighborhood_slug, mail: p.mail_street, newTags: [...tags].filter((t) => !(c.tags || []).includes(t)) }); }
  if (APPLY) { const { error: e } = await sb.from('crm_people').update(patch).eq('id', c.id); if (e) throw new Error(`${c.id}: ${e.message}`); wrote++; }
}
console.log('BEFORE sample:', JSON.stringify(before, null, 2));
console.log('AFTER sample:', JSON.stringify(after, null, 2));
console.log(APPLY ? `\napplied ${wrote} (backup: out/westside-enrich-backup.json)` : '\nDRY/SMOKE — set --apply to write');
