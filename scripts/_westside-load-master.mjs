#!/usr/bin/env node
/**
 * Phase 0 — load the westside assessor CSVs (source of truth = exports 23+24)
 * into public.westside_parcels, deriving absentee / tenure / owner_type.
 * Idempotent (upsert on APN).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSVS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['/Users/matthewryan/Downloads/export (23).csv', '/Users/matthewryan/Downloads/export (24).csv'];
const env = {};
for (const l of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c === '\r') {} else f += c; } }
  if (f.length || row.length) { row.push(f); rows.push(row); } return rows;
}
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };
const int = (v) => { const n = num(v); return n == null ? null : Math.round(n); };
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TODAY = new Date('2026-07-04');
const tenure = (d) => { const t = Date.parse(d); if (Number.isNaN(t)) return null; return +(((TODAY - t) / (365.25 * 864e5))).toFixed(1); };
function ownerType(allOwners, l1) {
  const s = `${allOwners || ''} ${l1 || ''}`.toLowerCase();
  if (/\b(trust|living|revocable|estate|ttee|trustee|family)\b/.test(s)) return 'trust';
  if (/\b(llc|inc|ltd|properties|company|corp|lp|holdings|group)\b/.test(s)) return 'llc';
  return 'person';
}

const parcels = new Map();
for (const CSV of CSVS) {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8')); const h = rows[0]; const C = (n) => h.indexOf(n);
  const ix = {
    apn: C('APN / Parcel Number'), site: C('Site Address'), scity: C('Site City'), sstate: C('Site State'), szip: C('Site Zip Code'),
    lon: C('Longitude'), lat: C('Latitude'), beds: C('Bedrooms'), baths: C('Baths'), bsize: C('Building Size'), lot: C('Lot Size (SqFt)'),
    acre: C('Acreage'), ptype: C('Property Type'), occ: C('Owner Occupied'), f1: C("1st Owner's First Name"), l1: C("1st Owner's Last Name"),
    f2: C("2nd Owner's First Name"), l2: C("2nd Owner's Last Name"), sf: C("Primary Owner's Spouse's First Name"), all: C('All Owners'),
    pdate: C('Purchase Date'), pprice: C('Purchase Price'), sub: C('Subdivision'), yb: C('Year Built'),
    mail: C('Mail Address'), mcity: C('Mailing City'), mzip: C('Mailing Zip Code'), mstate: C('Mailing State'),
    av: C('Assessed Value'), mv: C('Market Value (Assessed)'),
  };
  const file = path.basename(CSV);
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; if (!row || row.length < 5) continue;
    const apn = (row[ix.apn] || '').trim(); if (!apn) continue;
    const occ = (row[ix.occ] || '').trim().toUpperCase() === 'Y';
    const absentee = !occ || (norm(row[ix.mail]) && norm(row[ix.site]) && norm(row[ix.mail]) !== norm(row[ix.site]));
    parcels.set(apn, {
      apn, site_street: row[ix.site] || null, site_city: row[ix.scity] || null, site_state: row[ix.sstate] || null, site_zip: row[ix.szip] || null,
      lat: num(row[ix.lat]), lon: num(row[ix.lon]),
      mail_street: row[ix.mail] || null, mail_city: row[ix.mcity] || null, mail_state: row[ix.mstate] || null, mail_zip: row[ix.mzip] || null,
      owner1_first: row[ix.f1] || null, owner1_last: row[ix.l1] || null, owner2_first: row[ix.f2] || null, owner2_last: row[ix.l2] || null,
      spouse_first: row[ix.sf] || null, all_owners: row[ix.all] || null, owner_occupied: occ, absentee: !!absentee,
      owner_type: ownerType(row[ix.all], row[ix.l1]),
      purchase_date: (() => { const d = (row[ix.pdate] || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) && !d.startsWith('0000') && !Number.isNaN(Date.parse(d)) ? d : null; })(),
      purchase_price: num(row[ix.pprice]), tenure_years: tenure(row[ix.pdate]),
      subdivision: row[ix.sub] || null, year_built: int(row[ix.yb]), bedrooms: int(row[ix.beds]), baths: num(row[ix.baths]),
      building_sqft: int(row[ix.bsize]), lot_sqft: num(row[ix.lot]), acreage: num(row[ix.acre]), property_type: row[ix.ptype] || null,
      assessed_value: num(row[ix.av]), market_value: num(row[ix.mv]), source_file: file,
    });
  }
}
const all = [...parcels.values()];
console.log(`parsed ${all.length} unique parcels. absentee: ${all.filter((p) => p.absentee).length}. loading...`);
let done = 0;
for (let i = 0; i < all.length; i += 500) {
  const { error } = await sb.from('westside_parcels').upsert(all.slice(i, i + 500), { onConflict: 'apn' });
  if (error) throw new Error(`upsert @${i}: ${error.message}`);
  done += Math.min(500, all.length - i); process.stdout.write(`\r  loaded ${done}/${all.length}`);
}
console.log('\ndone.');
