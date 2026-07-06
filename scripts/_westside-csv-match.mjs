#!/usr/bin/env node
/**
 * Match the downloaded county-assessor CSV (owner name + site/mailing address +
 * lat/lng + subdivision) against the ADDRESSLESS crm_people contacts. READ-ONLY —
 * measures the match rate and flags ambiguity; writes nothing.
 *
 * The CSV has NO email/phone, so the only join key is the OWNER NAME. Name-only
 * matching carries the Hoffman wrong-household risk, so we report:
 *   - unique 1:1 name matches (safe to attach)
 *   - contacts matching >1 parcel, and parcels matching >1 contact (ambiguous — hold)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSV_PATHS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/Users/matthewryan/Downloads/export (23).csv', '/Users/matthewryan/Downloads/export (24).csv'];
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── RFC4180-ish CSV parser (handles quotes + doubled-quote escapes) ──────────
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const nameKey = (first, last) => `${(first || '').trim().toLowerCase()}|${(last || '').trim().toLowerCase()}`.replace(/[^a-z|]/g, '');
const valid = (k) => k.length > 2 && k.includes('|') && k.split('|').every((p) => p.length > 0);

// Load + combine all CSVs, dedup parcels by APN.
const csvByName = new Map();
const seenApn = new Set();
let csvRows = 0, dupApn = 0;
for (const CSV_PATH of CSV_PATHS) {
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const header = rows[0];
  const col = (name) => header.indexOf(name);
  const ci = {
    f1: col("1st Owner's First Name"), l1: col("1st Owner's Last Name"),
    f2: col("2nd Owner's First Name"), l2: col("2nd Owner's Last Name"),
    site: col('Site Address'), city: col('Site City'), state: col('Site State'), zip: col('Site Zip Code'),
    mail: col('Mail Address'), mcity: col('Mailing City'), mstate: col('Mailing State'), mzip: col('Mailing Zip Code'),
    lon: col('Longitude'), lat: col('Latitude'), sub: col('Subdivision'), apn: col('APN / Parcel Number'),
  };
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; if (!row || row.length < 5) continue;
    const apn = (row[ci.apn] || '').trim();
    if (apn && seenApn.has(apn)) { dupApn++; continue; }
    if (apn) seenApn.add(apn);
    csvRows++;
    const parcel = { site: row[ci.site], city: row[ci.city], state: row[ci.state], zip: row[ci.zip],
      mail: row[ci.mail], mcity: row[ci.mcity], mstate: row[ci.mstate], mzip: row[ci.mzip],
      lat: row[ci.lat], lon: row[ci.lon], sub: row[ci.sub], apn };
    for (const [f, l] of [[row[ci.f1], row[ci.l1]], [row[ci.f2], row[ci.l2]]]) {
      const k = nameKey(f, l); if (!valid(k)) continue;
      if (!csvByName.has(k)) csvByName.set(k, []);
      csvByName.get(k).push(parcel);
    }
  }
}
console.log(`CSV: ${CSV_PATHS.length} files, ${csvRows} unique parcels (${dupApn} dup-APN skipped), ${csvByName.size} distinct owner names`);

// ── addressless contacts ─────────────────────────────────────────────────────
async function pull() {
  const out = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('crm_people')
      .select('id,name,first_name,last_name,addresses')
      .eq('deleted', false)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...data); if (data.length < PAGE) break;
  }
  return out;
}
const allContacts = await pull();
const contacts = allContacts; // match against the WHOLE book
const isAddressless = (c) => !Array.isArray(c.addresses) || c.addresses.length === 0;

function contactKey(c) {
  let f = c.first_name, l = c.last_name;
  if ((!f || !l) && c.name) { const parts = c.name.trim().split(/\s+/); f = f || parts[0]; l = l || parts[parts.length - 1]; }
  return nameKey(f, l);
}

let m1_addressless = 0, m1_addressed = 0, matchedMulti = 0, unmatched = 0;
const sample = [];
const contactKeyCount = new Map();
for (const c of contacts) { const k = contactKey(c); if (valid(k)) contactKeyCount.set(k, (contactKeyCount.get(k) || 0) + 1); }

for (const c of contacts) {
  const k = contactKey(c);
  if (!valid(k)) { unmatched++; continue; }
  const parcels = csvByName.get(k);
  if (!parcels) { unmatched++; continue; }
  const ambiguous = parcels.length > 1 || (contactKeyCount.get(k) || 0) > 1;
  if (ambiguous) { matchedMulti++; continue; }
  if (isAddressless(c)) { m1_addressless++; if (sample.length < 10) sample.push({ id: c.id, name: c.name, site: parcels[0].site + ', ' + parcels[0].city, sub: parcels[0].sub, mail: parcels[0].mail }); }
  else m1_addressed++;
}
console.log(JSON.stringify({
  book_total: contacts.length,
  unique_1to1_matches_total: m1_addressless + m1_addressed,
  '  of which ADDRESSLESS (backfill candidates)': m1_addressless,
  '  of which already-addressed (verify)': m1_addressed,
  matched_ambiguous_multi_HOLD: matchedMulti,
  unmatched: unmatched,
}, null, 2));
console.log('sample addressless 1:1 matches (site + mailing addr):', JSON.stringify(sample, null, 2));
