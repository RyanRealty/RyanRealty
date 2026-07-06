#!/usr/bin/env node
/**
 * ADVERSARIAL audit of the westside farm build. READ-ONLY. Assumes it's broken.
 * Checks:
 *  1. Address-match city mismatch — streetKey dropped city, so a contact's address
 *     in a DIFFERENT city could have been falsely linked to a Bend parcel.
 *  2. Name-match wrong-household — a name-matched contact whose OWN pre-existing
 *     address is elsewhere (different city) => likely a different person (Hoffman).
 *  3. Net-new duplicates — a just-created net-new whose name OR property street
 *     collides with a PRE-EXISTING contact (should have matched, not created).
 *  4. Insert integrity — net-new rows with bad name / no neighborhood / no tags.
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
  .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir|place|pl|boulevard|blvd|way|terrace|ter|loop|trail|trl|highway|hwy|apt|unit|ste|suite)\b/g, ' ').replace(/\s+/g, ' ').trim();
const nameKey = (f, l) => `${(f || '').trim().toLowerCase().split(' ')[0]}|${(l || '').trim().toLowerCase().split(' ').pop()}`.replace(/[^a-z|]/g, '');
const cityN = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

async function pageAll(table, cols, filter) {
  const out = []; for (let f = 0; ; f += 1000) { let q = sb.from(table).select(cols).order(table === 'crm_people' ? 'id' : 'apn').range(f, f + 999); if (filter) q = filter(q); const { data, error } = await q; if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) break; } return out;
}

// contacts: id, name, city of their addresses, street-keys, source, created ordering
const people = await pageAll('crm_people', 'id,first_name,last_name,name,addresses,source,tags,neighborhood_slug', (q) => q.eq('deleted', false));
const contactCities = new Map();   // id -> Set(cityN)
const contactStreets = new Map();  // id -> Set(streetKey)
const preExistingByName = new Map(); // nameKey -> [ids] for NON-westside-created contacts
const preExistingByStreet = new Map();
for (const c of people) {
  const cities = new Set(), streets = new Set();
  if (Array.isArray(c.addresses)) for (const a of c.addresses) { if (a?.city) cities.add(cityN(a.city)); if (a?.street) streets.add(streetKey(a.street)); }
  contactCities.set(c.id, cities); contactStreets.set(c.id, streets);
  if (c.source !== 'westside-farm-assessor') {
    const nk = nameKey(c.first_name || (c.name || '').split(' ')[0], c.last_name || (c.name || '').split(' ').pop());
    if (nk.includes('|')) { if (!preExistingByName.has(nk)) preExistingByName.set(nk, []); preExistingByName.get(nk).push(c.id); }
    for (const s of streets) if (s.length > 4) { if (!preExistingByStreet.has(s)) preExistingByStreet.set(s, []); preExistingByStreet.get(s).push(c.id); }
  }
}

const parcels = await pageAll('westside_parcels', 'apn,person_id,match_method,site_city,site_street,owner1_first,owner1_last');
const pById = new Map(people.map((c) => [c.id, c]));

// 1 + 2: match-quality on matched parcels
let addrCityMismatch = 0, addrCityOk = 0, nameElsewhere = 0, nameOk = 0;
const addrBad = [], nameBad = [];
for (const p of parcels) {
  if (!p.person_id) continue;
  const cities = contactCities.get(p.person_id) || new Set();
  const pcity = cityN(p.site_city);
  if (p.match_method === 'address') {
    if (cities.size && pcity && !cities.has(pcity)) { addrCityMismatch++; if (addrBad.length < 8) addrBad.push({ apn: p.apn, parcel_city: p.site_city, contact_cities: [...cities], person: p.person_id }); }
    else addrCityOk++;
  } else if (p.match_method === 'name') {
    if (cities.size && pcity && !cities.has(pcity)) { nameElsewhere++; if (nameBad.length < 8) nameBad.push({ apn: p.apn, name: `${p.owner1_first} ${p.owner1_last}`, parcel_city: p.site_city, contact_cities: [...cities], person: p.person_id }); }
    else nameOk++;
  }
}

// 3 + 4: net-new duplicates + integrity
let dupName = 0, dupStreet = 0, badName = 0, noNbhd = 0, noSellerTag = 0, netNewTotal = 0;
const dupSample = [];
for (const c of people) {
  if (c.source !== 'westside-farm-assessor') continue;
  netNewTotal++;
  const nk = nameKey(c.first_name, c.last_name);
  if (preExistingByName.has(nk)) { dupName++; if (dupSample.length < 8) dupSample.push({ id: c.id, name: c.name, collides_with: preExistingByName.get(nk).slice(0, 3) }); }
  const st = [...(contactStreets.get(c.id) || [])][0];
  if (st && preExistingByStreet.has(st)) dupStreet++;
  if (!c.first_name || !c.last_name || /\d/.test(c.name || '')) badName++;
  if (!c.neighborhood_slug) noNbhd++;
  if (!(c.tags || []).includes('segment:seller')) noSellerTag++;
}

console.log(JSON.stringify({
  '1_address_match_city_MISMATCH': addrCityMismatch, address_match_city_ok: addrCityOk,
  '2_name_match_contact_lives_ELSEWHERE': nameElsewhere, name_match_ok: nameOk,
  '3_netnew_name_collides_with_preexisting': dupName, netnew_street_collides_preexisting: dupStreet, net_new_total: netNewTotal,
  '4_netnew_bad_name': badName, netnew_no_neighborhood: noNbhd,
}, null, 2));
console.log('addr city-mismatch sample:', JSON.stringify(addrBad, null, 2));
console.log('name-match-elsewhere sample:', JSON.stringify(nameBad.slice(0, 5), null, 2));
console.log('netnew dup sample:', JSON.stringify(dupSample.slice(0, 5), null, 2));
