#!/usr/bin/env node
/**
 * Phase 5 — insert net-new westside owners (parcels with no matching contact) as
 * crm_people rows. PERSONS ONLY by default (trusts/LLCs held for reverse skip-trace).
 * Each row: stage Nurture, source westside-farm-assessor, site+mailing address,
 * absentee/tenure/property custom, and the farm/segment/geo/owner/tenure tags.
 * After insert, links the parcel (person_id). Backs up inserted ids for reversal.
 *
 *   node scripts/_westside-insert-netnew.mjs --smoke 5   # insert 5, show them
 *   node scripts/_westside-insert-netnew.mjs --apply      # all persons
 *   node scripts/_westside-insert-netnew.mjs --apply --include-entities
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
const ENTITIES = process.argv.includes('--include-entities');
const si = process.argv.indexOf('--smoke');
const N = si > -1 ? Number(process.argv[si + 1] || 5) : (APPLY ? Infinity : 5);
const tb = (y) => y == null ? null : y <= 2 ? '0-2' : y <= 5 ? '3-5' : y <= 8 ? '6-8' : y <= 12 ? '9-12' : y <= 17 ? '13-17' : y <= 24 ? '18-24' : '25plus';
const cap = (s) => (s || '').trim().replace(/\s+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

// pull net-new parcels (paginated)
const parcels = [];
for (let from = 0; ; from += 1000) {
  let q = sb.from('westside_parcels').select('*').eq('match_method', 'none').order('apn').range(from, from + 999);
  const { data, error } = await q; if (error) throw new Error(error.message);
  parcels.push(...data); if (data.length < 1000) break;
}
const eligible = parcels.filter((p) => (ENTITIES || p.owner_type === 'person') && p.owner1_first && p.owner1_last);
const list = eligible.slice(0, N === Infinity ? undefined : N);
console.log(`net-new parcels: ${parcels.length}. eligible (${ENTITIES ? 'incl entities' : 'persons only'}): ${eligible.length}. this run: ${list.length}. apply=${APPLY}`);

function rowFor(p) {
  const first = cap(p.owner1_first), last = cap(p.owner1_last);
  const custom = {
    customSellerPropertyAddress: p.site_street,
    customMailingAddress: p.mail_street ? `${p.mail_street}, ${p.mail_city || ''} ${p.mail_state || ''} ${p.mail_zip || ''}`.trim() : null,
    customAbsentee: p.absentee ? 'Yes' : 'No', customYearsOwned: p.tenure_years, customPurchaseDate: p.purchase_date,
    customPurchasePrice: p.purchase_price, customYearBuilt: p.year_built, customBedrooms: p.bedrooms, customBaths: p.baths,
    customBuildingSqft: p.building_sqft, customMarketValue: p.market_value, customAPN: p.apn, customSubdivision: p.subdivision,
    customOwnerType: p.owner_type,
  };
  for (const k of Object.keys(custom)) if (custom[k] == null || custom[k] === '') delete custom[k];
  const tags = ['farm:westside', 'segment:seller', 'source:westside-farm', p.absentee ? 'owner:absentee' : 'owner:occupied'];
  const t = tb(p.tenure_years); if (t) tags.push(`tenure:${t}`);
  if (p.neighborhood_slug) tags.push(`neighborhood:${p.neighborhood_slug}`);
  if (p.subdivision_slug) tags.push(`subdivision:${p.subdivision_slug}`);
  if (p.mail_state && p.mail_state.toUpperCase() !== 'OR') tags.push('location:out-of-state');
  return {
    apn: p.apn,
    row: {
      first_name: first, last_name: last, name: `${first} ${last}`, stage: 'Nurture', source: 'westside-farm-assessor',
      addresses: p.site_street ? [{ type: 'Property', street: p.site_street, city: p.site_city, state: p.site_state, code: p.site_zip }] : [],
      emails: [], phones: [], custom, tags, deleted: false,
      neighborhood_slug: p.neighborhood_slug || null, subdivision: p.subdivision || null,
      is_resort: false,
    },
  };
}

if (!APPLY) {
  console.log('PREVIEW (first 5):', JSON.stringify(list.slice(0, 5).map((p) => rowFor(p).row), null, 2));
  process.exit(0);
}

const insertedIds = [];
for (let i = 0; i < list.length; i += 200) {
  const chunk = list.slice(i, i + 200).map(rowFor);
  const { data, error } = await sb.from('crm_people').insert(chunk.map((c) => c.row)).select('id');
  if (error) throw new Error(`insert @${i}: ${error.message}`);
  // link parcels back (by order — insert returns ids in insert order)
  for (let j = 0; j < data.length; j++) {
    insertedIds.push(data[j].id);
    await sb.from('westside_parcels').update({ person_id: data[j].id, match_method: 'net-new-created' }).eq('apn', chunk[j].apn);
  }
  process.stdout.write(`\r  inserted ${insertedIds.length}/${list.length}`);
}
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'westside-netnew-inserted-ids.json'), JSON.stringify(insertedIds));
console.log(`\ninserted ${insertedIds.length} net-new contacts (ids -> out/westside-netnew-inserted-ids.json for reversal).`);
