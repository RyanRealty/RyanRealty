#!/usr/bin/env node
/**
 * DILIGENT match of the westside assessor CSVs (export 23+24) against the
 * ADDRESSLESS contacts. READ-ONLY. Tiers the match so we see the true ceiling:
 *   T1 exact first+last
 *   T2 nickname-normalized first+last (Bob=Robert, Bill=William, …)
 *   T3 last + first-initial (catches middle-name / "J. Smith" / formatting)
 *   T4 last-name-only overlap (absolute ceiling; not a confident match)
 * Splits couples ("John & Mary Smith"), strips suffixes, tries every CSV owner
 * variant (1st owner, 2nd owner, spouse). Reports counts + fresh-match samples.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSVS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['/Users/matthewryan/Downloads/export (23).csv', '/Users/matthewryan/Downloads/export (24).csv'];
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── nickname canonicalization ────────────────────────────────────────────────
const NICK_GROUPS = [
  ['robert','rob','bob','bobby'],['william','will','bill','billy','willy'],['james','jim','jimmy','jamie'],
  ['michael','mike','mick','mikey'],['thomas','tom','tommy'],['richard','rich','rick','dick','ricky'],
  ['david','dave','davey'],['daniel','dan','danny'],['joseph','joe','joey'],['christopher','chris'],
  ['matthew','matt'],['anthony','tony'],['edward','ed','eddie','ted'],['theodore','ted','teddy'],
  ['steven','stephen','steve'],['kenneth','ken','kenny'],['ronald','ron','ronnie'],['donald','don','donnie'],
  ['gerald','jerry'],['lawrence','larry'],['gregory','greg'],['jeffrey','jeff'],['andrew','andy','drew'],
  ['patrick','pat'],['patricia','pat','patty','trish'],['samuel','sam'],['samantha','sam'],['benjamin','ben'],
  ['nicholas','nick'],['alexander','alex'],['alexandra','alex'],['katherine','kate','katie','kathy','kat'],
  ['elizabeth','liz','beth','betsy','lisa'],['susan','sue','suzy'],['margaret','peggy','meg','maggie'],
  ['jennifer','jen','jenny'],['rebecca','becky'],['cynthia','cindy'],['deborah','deb','debbie'],
  ['sandra','sandy'],['barbara','barb','babs'],['judith','judy'],['frederick','fred'],['henry','hank'],
  ['harold','harry'],['john','jack','johnny'],['francis','frank'],['franklin','frank'],['eugene','gene'],
  ['arthur','art'],['albert','al'],['walter','walt'],['russell','russ'],['douglas','doug'],['philip','phil'],
  ['raymond','ray'],['stanley','stan'],['vincent','vince'],['wesley','wes'],['charles','charlie','chuck'],
  ['ronald','ron'],['timothy','tim'],['jonathan','jon','john'],['nathaniel','nate','nathan'],
  ['zachary','zach'],['joshua','josh'],['jacob','jake'],['catherine','cathy','cate'],['victoria','vicky','tori'],
];
const canonOf = new Map();
for (const g of NICK_GROUPS) { const c = g[0]; for (const n of g) { const s = canonOf.get(n) || new Set(); s.add(c); canonOf.set(n, s); } }
const canonSet = (first) => { const f = first.toLowerCase(); return canonOf.get(f) || new Set([f]); };

const clean = (s) => (s || '').toLowerCase().replace(/[^a-z\s&]/g, ' ').replace(/\b(jr|sr|ii|iii|iv|md|dds|esq|trustee|trust|the|revocable|living|family|ttee|et al|etal)\b/g, ' ').replace(/\s+/g, ' ').trim();
const lastOf = (name) => { const p = clean(name).split(' ').filter(Boolean); return p.length ? p[p.length - 1] : ''; };
// split "john & mary smith" -> [{first:john,last:smith},{first:mary,last:smith}]
function personsFromName(name) {
  const c = clean(name); if (!c) return [];
  const parts = c.split(/\s*&\s*|\s+and\s+/);
  const out = [];
  if (parts.length === 2 && !parts[0].includes(' ')) {
    const last = lastOf(parts[1]);
    out.push({ first: parts[0], last }, { first: parts[1].split(' ')[0], last });
  } else {
    for (const seg of parts) { const w = seg.split(' ').filter(Boolean); if (w.length >= 2) out.push({ first: w[0], last: w[w.length - 1] }); }
  }
  return out.filter((p) => p.first && p.last && p.first.length > 1 && p.last.length > 1);
}

// ── parse CSV ────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else { if (c === '"') inQ = true; else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (c === '\r') {} else field += c; } }
  if (field.length || row.length) { row.push(field); rows.push(row); } return rows;
}

// CSV indexes: full "first|last", nickname "canonFirst|last", "last|initial", last-name set
const byFull = new Map(), byNick = new Map(), byLastInit = new Map(), lastNames = new Set();
const add = (m, k, parcel) => { if (!m.has(k)) m.set(k, []); m.get(k).push(parcel); };
let parcels = 0; const seenApn = new Set();
for (const CSV of CSVS) {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8')); const h = rows[0]; const col = (n) => h.indexOf(n);
  const ci = { f1: col("1st Owner's First Name"), l1: col("1st Owner's Last Name"), f2: col("2nd Owner's First Name"), l2: col("2nd Owner's Last Name"),
    sf: col("Primary Owner's Spouse's First Name"), site: col('Site Address'), city: col('Site City'), mail: col('Mail Address'),
    lat: col('Latitude'), lon: col('Longitude'), sub: col('Subdivision'), apn: col('APN / Parcel Number') };
  for (let r = 1; r < rows.length; r++) { const row = rows[r]; if (!row || row.length < 5) continue;
    const apn = (row[ci.apn] || '').trim(); if (apn && seenApn.has(apn)) continue; if (apn) seenApn.add(apn); parcels++;
    const parcel = { site: row[ci.site], city: row[ci.city], mail: row[ci.mail], lat: row[ci.lat], lon: row[ci.lon], sub: row[ci.sub], apn };
    const owners = [[row[ci.f1], row[ci.l1]], [row[ci.f2], row[ci.l2]], [row[ci.sf], row[ci.l1]]];
    for (const [f, l] of owners) { const first = clean(f).split(' ')[0], last = clean(l).split(' ').pop();
      if (!first || !last || first.length < 2 || last.length < 2) continue;
      add(byFull, `${first}|${last}`, parcel); lastNames.add(last);
      for (const cn of canonSet(first)) add(byNick, `${cn}|${last}`, parcel);
      add(byLastInit, `${first[0]}|${last}`, parcel);
    } } }
console.log(`CSV: ${parcels} parcels, ${byFull.size} full-name keys, ${lastNames.size} distinct last names`);

// ── addressless contacts ─────────────────────────────────────────────────────
const contacts = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('crm_people').select('id,name,first_name,last_name')
    .eq('deleted', false).is('neighborhood_slug', null).filter('addresses', 'eq', '[]').range(from, from + 999);
  if (error) throw new Error(error.message); contacts.push(...data); if (data.length < 1000) break;
}

// For each contact, collect candidate parcels from the BEST tier that hits,
// dedup by APN. Unique (1 parcel) = safe to backfill; >1 = ambiguous (hold).
const bestTierParcels = (p) => {
  if (byFull.has(`${p.first}|${p.last}`)) return { tier: 1, parcels: byFull.get(`${p.first}|${p.last}`) };
  for (const cn of canonSet(p.first)) if (byNick.has(`${cn}|${p.last}`)) return { tier: 2, parcels: byNick.get(`${cn}|${p.last}`) };
  if (byLastInit.has(`${p.first[0]}|${p.last}`)) return { tier: 3, parcels: byLastInit.get(`${p.first[0]}|${p.last}`) };
  return null;
};
let safeUnique = 0, ambiguousMulti = 0, none = 0;
const byTier = { 1: 0, 2: 0, 3: 0 };
const rows = [['contact_id', 'contact_name', 'tier', 'site_address', 'city', 'subdivision', 'lat', 'lng', 'apn']];
for (const c of contacts) {
  let persons = [];
  if (c.first_name && c.last_name) persons.push({ first: clean(c.first_name).split(' ')[0], last: clean(c.last_name).split(' ').pop() });
  persons = persons.concat(personsFromName(c.name || ''));
  persons = persons.filter((p) => p.first && p.last && p.first.length > 1 && p.last.length > 1);
  let best = null;
  for (const p of persons) { const r = bestTierParcels(p); if (r && (!best || r.tier < best.tier)) best = r; }
  if (!best) { none++; continue; }
  const uniq = new Map(); for (const pc of best.parcels) uniq.set(pc.apn || JSON.stringify(pc), pc);
  if (uniq.size === 1) {
    safeUnique++; byTier[best.tier]++;
    const pc = [...uniq.values()][0];
    rows.push([c.id, c.name, best.tier, pc.site, pc.city, pc.sub, pc.lat, pc.lon, pc.apn]);
  } else ambiguousMulti++;
}
const csvOut = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'westside-address-matches.csv'), csvOut);
console.log(JSON.stringify({
  addressless_total: contacts.length,
  SAFE_unique_parcel_matches: safeUnique,
  '  by tier (1 exact / 2 nickname / 3 last+initial)': byTier,
  ambiguous_multi_parcel_HOLD: ambiguousMulti,
  no_match: none,
}, null, 2));
console.log(`\nwrote ${safeUnique} safe matches -> out/westside-address-matches.csv (review sheet, NO db writes)`);
