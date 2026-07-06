#!/usr/bin/env node
/**
 * CRM name scrub. Repairs the assessor-parse damage in crm_people names:
 *   1. mechanical (all rows): collapse duplicated trailing phrases, fix LLC/INC
 *      casing, normalize '& ' spacing + collapse double spaces.
 *   2. entity/joint repair (westside-linked broken rows): re-derive the display
 *      name from the authoritative westside_parcels.all_owners / owner1_* fields,
 *      so "Winnie Properties Llc" -> "Anthony Chen & Lauren Ladky" and a stranded
 *      "Trust"/"Llc" last_name is removed.
 *
 * Preview-first + reversible. Default writes NOTHING — it emits a preview JSON +
 * samples. --apply backs up (id, old name/first/last) then updates only changed
 * rows. --revert <backup.json> restores.
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
const REVERT = process.argv.includes('--revert') ? process.argv[process.argv.indexOf('--revert') + 1] : null;

// ── cleaning helpers ─────────────────────────────────────────────────────────
const ENTITY_LAST = /^(trust|llc|inc|ltd|living trust|joint trust|revocable trust|family trust|and trust|survivors trust|l l c)$/i;
const ENTITY_WORD = /\b(trust|llc|inc|ltd|revocable|survivors|properties|holdings|ventures|management)\b/i;

const cleanSpaces = (s) => (s || '').replace(/\s+/g, ' ').trim();
function fixTokenCase(t) {
  const up = t.toUpperCase().replace(/[^A-Z]/g, '');
  if (['LLC', 'LLP', 'LP', 'INC', 'LTD'].includes(up)) return up === 'LP' && t.length > 2 ? t : up;
  if (['II', 'III', 'IV'].includes(up)) return up;
  return t;
}
const fixCasing = (s) => cleanSpaces(s).split(' ').map(fixTokenCase).join(' ');
function fixAmp(s) { return cleanSpaces((s || '').replace(/\s*&\s*/g, ' & ')); }
function dedupeTail(sIn) {
  let tokens = cleanSpaces(sIn).split(' ');
  let changed = true;
  while (changed) {
    changed = false;
    const n = tokens.length;
    for (let k = Math.floor(n / 2); k >= 1; k--) {
      if (n - 2 * k < 0) continue;
      const a = tokens.slice(n - k).join(' ').toLowerCase();
      const b = tokens.slice(n - 2 * k, n - k).join(' ').toLowerCase();
      if (a === b) { tokens = tokens.slice(0, n - k); changed = true; break; }
    }
  }
  return tokens.join(' ');
}
const mechanical = (s) => fixCasing(fixAmp(dedupeTail(s || '')));
const titlecase = (s) => cleanSpaces(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
function cleanOwners(ao) { return fixCasing(fixAmp((ao || '').replace(/\s+and\s+/gi, ' & '))); }

// ── load everyone + westside parcels ─────────────────────────────────────────
async function pullAll(table, cols, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

if (REVERT) {
  const backup = JSON.parse(fs.readFileSync(REVERT, 'utf8'));
  console.log(`reverting ${backup.length} rows`);
  let n = 0;
  for (const r of backup) {
    const { error } = await sb.from('crm_people').update({ name: r.name, first_name: r.first_name, last_name: r.last_name }).eq('id', r.id);
    if (error) throw new Error(`${r.id}: ${error.message}`);
    if (++n % 500 === 0) console.log(`  ${n}/${backup.length}`);
  }
  console.log(`reverted ${n}.`); process.exit(0);
}

console.log('loading contacts + parcels...');
const people = await pullAll('crm_people', 'id,name,first_name,last_name', (q) => q.eq('deleted', false));
const parcels = await pullAll('westside_parcels', 'person_id,owner1_first,owner1_last,owner_type,all_owners', (q) => q.not('person_id', 'is', null));
// best parcel per person: prefer a person-typed parcel with real first+last
const bestParcel = new Map();
for (const p of parcels) {
  const cur = bestParcel.get(p.person_id);
  const score = (p.owner_type === 'person' && p.owner1_first && p.owner1_last) ? 2 : (p.all_owners ? 1 : 0);
  if (!cur || score > cur._score) bestParcel.set(p.person_id, { ...p, _score: score });
}

// ── compute proposed new values ──────────────────────────────────────────────
const changes = [];
for (const r of people) {
  const curName = r.name || '';
  const curFirst = r.first_name || '';
  const curLast = r.last_name || '';
  const parcel = bestParcel.get(r.id);
  const lastIsEntity = ENTITY_LAST.test(curLast.trim());
  const nameMessy = ENTITY_WORD.test(curName) && (lastIsEntity || dedupeTail(curName) !== cleanSpaces(curName) || /  |,/.test(curName));

  // Clean what's there — never invent. The assessor owner fields are too often
  // Last-First / multi-parcel to re-derive a name safely, so we do NOT pull from
  // the parcel. Mechanical repair for everyone; strip a fake entity "surname".
  void parcel; void nameMessy;
  let newName = mechanical(curName);
  let newFirst = mechanical(curFirst);
  let newLast = mechanical(curLast);
  let reason = 'mechanical';

  if (lastIsEntity) {
    // "Trust" / "Llc" / "Inc" is never a surname — drop the fake first/last split,
    // keep the cleaned entity display name.
    newFirst = '';
    newLast = '';
    reason = 'strip-entity-surname';
  }

  newName = cleanSpaces(newName);
  newFirst = cleanSpaces(newFirst);
  newLast = cleanSpaces(newLast);
  if (newName !== cleanSpaces(curName) || newFirst !== cleanSpaces(curFirst) || newLast !== cleanSpaces(curLast)) {
    if (!newName) continue; // never blank a name
    changes.push({ id: r.id, reason, old: { name: r.name, first_name: r.first_name, last_name: r.last_name }, new: { name: newName, first_name: newFirst || null, last_name: newLast || null } });
  }
}

const byReason = {};
for (const c of changes) byReason[c.reason] = (byReason[c.reason] || 0) + 1;
console.log(`\ntotal changes: ${changes.length}`);
console.log(byReason);
const previewPath = path.join(ROOT, 'out', 'name-scrub-preview.json');
fs.mkdirSync(path.dirname(previewPath), { recursive: true });
fs.writeFileSync(previewPath, JSON.stringify(changes, null, 2));
console.log(`preview -> ${previewPath}`);
for (const reason of Object.keys(byReason)) {
  console.log(`\n── ${reason} (samples) ──`);
  changes.filter((c) => c.reason === reason).slice(0, 10).forEach((c) => console.log(`  "${c.old.name}"  ->  "${c.new.name}"`));
}

if (!APPLY) { console.log('\nDRY — pass --apply to back up + write'); process.exit(0); }

const backupPath = path.join(ROOT, 'out', 'name-scrub-backup.json');
fs.writeFileSync(backupPath, JSON.stringify(changes.map((c) => ({ id: c.id, ...c.old })), null, 0));
console.log(`\nbacked up ${changes.length} -> ${backupPath}`);
let n = 0;
for (const c of changes) {
  const { error } = await sb.from('crm_people').update(c.new).eq('id', c.id);
  if (error) throw new Error(`${c.id}: ${error.message}`);
  if (++n % 100 === 0) console.log(`  ${n}/${changes.length}`);
}
console.log(`\nwrote ${n}. revert: node scripts/_crm-name-scrub.mjs --revert ${backupPath}`);
