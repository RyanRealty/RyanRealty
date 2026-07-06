#!/usr/bin/env node
/**
 * PARCEL-SIDE coverage: of the ~18K westside parcels, how many are ALREADY a
 * contact in the CRM vs. how many are net-new (not in the book). READ-ONLY.
 * Matches parcel -> contact by NORMALIZED STREET ADDRESS (exact, reliable) first,
 * then by owner name as a fallback. Answers "how many westside homeowners do I
 * have vs. am I missing."
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSVS = process.argv.slice(2);
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c === '\r') {} else f += c; } }
  if (f.length || row.length) { row.push(f); rows.push(row); } return rows;
}
// normalize a street address to a match key: number + street name, drop unit/suffix noise
const streetKey = (s) => (s || '').toLowerCase()
  .replace(/[.,#]/g, ' ')
  .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir|place|pl|boulevard|blvd|way|terrace|ter|loop|trail|trl|highway|hwy|apt|unit|ste|suite)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const nameKey = (f, l) => `${(f || '').trim().toLowerCase().split(' ')[0]}|${(l || '').trim().toLowerCase().split(' ').pop()}`.replace(/[^a-z|]/g, '');

// ── contact address + name indexes ───────────────────────────────────────────
const contactStreet = new Set(), contactName = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('crm_people').select('id,name,first_name,last_name,addresses,custom').eq('deleted', false).range(from, from + 999);
  if (error) throw new Error(error.message);
  for (const c of data) {
    const streets = [];
    if (Array.isArray(c.addresses)) for (const a of c.addresses) if (a?.street) streets.push(a.street);
    const psa = c.custom?.customSellerPropertyAddress; if (psa) streets.push(psa);
    for (const s of streets) { const k = streetKey(s); if (k.length > 4) contactStreet.add(k); }
    let f = c.first_name, l = c.last_name; if ((!f || !l) && c.name) { const p = c.name.trim().split(/\s+/); f = f || p[0]; l = l || p[p.length - 1]; }
    const nk = nameKey(f, l); if (nk.includes('|') && nk.length > 3) contactName.add(nk);
  }
  if (data.length < 1000) break;
}
console.log(`CRM: ${contactStreet.size} distinct contact street-keys, ${contactName.size} name-keys`);

// ── parcels ──────────────────────────────────────────────────────────────────
let parcels = 0, byAddr = 0, byNameOnly = 0, netNew = 0; const seen = new Set();
const netNewSample = [];
for (const CSV of CSVS) {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8')); const h = rows[0]; const col = (n) => h.indexOf(n);
  const ci = { site: col('Site Address'), city: col('Site City'), f1: col("1st Owner's First Name"), l1: col("1st Owner's Last Name"), apn: col('APN / Parcel Number'), sub: col('Subdivision') };
  for (let r = 1; r < rows.length; r++) { const row = rows[r]; if (!row || row.length < 5) continue;
    const apn = (row[ci.apn] || '').trim(); if (apn && seen.has(apn)) continue; if (apn) seen.add(apn); parcels++;
    const sk = streetKey(row[ci.site]); const nk = nameKey(row[ci.f1], row[ci.l1]);
    if (sk.length > 4 && contactStreet.has(sk)) byAddr++;
    else if (nk.includes('|') && contactName.has(nk)) byNameOnly++;
    else { netNew++; if (netNewSample.length < 10) netNewSample.push(`${row[ci.site]}, ${row[ci.city]} (${row[ci.f1]} ${row[ci.l1]})`); }
  } }
console.log(JSON.stringify({
  westside_parcels: parcels,
  ALREADY_in_CRM_by_address: byAddr,
  matched_by_owner_name_only: byNameOnly,
  total_covered: byAddr + byNameOnly,
  NET_NEW_not_in_CRM: netNew,
  pct_covered: +(100 * (byAddr + byNameOnly) / parcels).toFixed(1),
}, null, 2));
console.log('net-new sample:', JSON.stringify(netNewSample, null, 2));
