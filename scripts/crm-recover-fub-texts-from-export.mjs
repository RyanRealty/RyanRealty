#!/usr/bin/env node
/**
 * crm-recover-fub-texts-from-export.mjs
 *
 * Recover the real body text of the FUB-imported SMS rows in crm_timeline
 * (source='fub-import', body NULL, payload.contentHidden=true) from a FUB
 * People "Export all columns" CSV. That export — unlike the FUB API — returns
 * the actual message bodies (verified 2026-07-14).
 *
 * The CSV "Texts" column (index 38) holds each contact's most-recent-50 texts
 * as a blob of:
 *     <Sender> texted <Recipient> on M/D/YYYY H:MMam
 *     <body, possibly multi-line>
 *     <blank line>
 *     <Sender> texted <Recipient> on ...
 * The CSV "ID" column (index 48) is the FUB person id == crm_people.fub_legacy_id.
 *
 * Matching: parse each text → (direction, Pacific local timestamp, body).
 * Direction: sender is one of our brokers → sms_out, else sms_in.
 * Match a parsed text to a crm_timeline row by
 *     (fub person id, direction, Pacific-local minute).
 * We compute each DB row's Pacific local minute from its UTC ts so no offset
 * math is needed. On a match, fill body + drop contentHidden.
 *
 * Usage:
 *   node scripts/crm-recover-fub-texts-from-export.mjs <export.csv>            # DRY-RUN
 *   node scripts/crm-recover-fub-texts-from-export.mjs <export.csv> --apply    # write
 * Backup-first on --apply: out/crm-recover-fub-texts-backup-<runId>.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = '/Users/matthewryan/RyanRealty';
const CSV_PATH = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!CSV_PATH || !fs.existsSync(CSV_PATH)) {
  console.error('Usage: node scripts/crm-recover-fub-texts-from-export.mjs <export.csv> [--apply]');
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BROKERS = new Set(['matt ryan', 'matthew ryan', 'paul stevenson', 'rebecca peterson']);

// ── CSV parse (RFC4180, handles quoted newlines/commas) ───────────────────────
function parseCsv(str) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (q) { if (c === '"') { if (str[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// ── parse a "Texts"/"Calls" blob into individual messages ─────────────────────
// Header line: "<Sender> texted <Recipient> on 6/6/2026 9:04am"
const HDR = /^(.+?) (?:texted|sent a text to) (.+?) on (\d{1,2}\/\d{1,2}\/\d{4}) (\d{1,2}:\d{2}[ap]m)\s*$/;
function parseTexts(blob) {
  const lines = blob.split('\n');
  const msgs = [];
  let cur = null;
  for (const ln of lines) {
    const m = ln.match(HDR);
    if (m) {
      if (cur) msgs.push(cur);
      cur = { sender: m[1].trim(), recipient: m[2].trim(), date: m[3], time: m[4], body: [] };
    } else if (cur) {
      cur.body.push(ln);
    }
  }
  if (cur) msgs.push(cur);
  return msgs.map((x) => ({
    dir: BROKERS.has(x.sender.toLowerCase()) ? 'out' : 'in',
    localKey: toLocalKey(x.date, x.time),
    body: x.body.join('\n').replace(/^\n+|\n+$/g, '').trim(),
  })).filter((x) => x.body);
}

// "6/6/2026" + "9:04am" -> "2026-06-06 09:04" (24h, Pacific local minute key)
function toLocalKey(date, time) {
  const [mo, d, y] = date.split('/').map(Number);
  const tm = time.match(/(\d{1,2}):(\d{2})([ap]m)/);
  let h = Number(tm[1]) % 12; if (tm[3] === 'pm') h += 12;
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(mo)}-${p(d)} ${p(h)}:${tm[2]}`;
}

// DB UTC ts -> Pacific local minute key "YYYY-MM-DD HH:mm"
const PT_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
function dbLocalKey(iso) {
  const parts = PT_FMT.formatToParts(new Date(iso));
  const g = (t) => parts.find((p) => p.type === t).value;
  let hh = g('hour'); if (hh === '24') hh = '00';
  return `${g('year')}-${g('month')}-${g('day')} ${hh}:${g('minute')}`;
}

// ── load DB target rows grouped by fub person id ──────────────────────────────
async function loadDbByFub() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('crm_timeline')
      .select('id, person_id, kind, ts, payload')
      .eq('source', 'fub-import').in('kind', ['sms_in', 'sms_out']).range(from, from + 999);
    if (error) throw error;
    rows.push(...data.filter((r) => r.payload?.contentHidden === true));
    if (data.length < 1000) break;
  }
  const pids = [...new Set(rows.map((r) => r.person_id))];
  const fubOf = new Map();
  for (let i = 0; i < pids.length; i += 500) {
    const { data, error } = await sb.from('crm_people').select('id, fub_legacy_id').in('id', pids.slice(i, i + 500));
    if (error) throw error;
    for (const p of data) if (p.fub_legacy_id) fubOf.set(p.id, p.fub_legacy_id);
  }
  // key: fubId -> array of {id, dir, key}
  const byFub = new Map();
  for (const r of rows) {
    const fub = fubOf.get(r.person_id);
    if (!fub) continue;
    if (!byFub.has(fub)) byFub.set(fub, []);
    byFub.get(fub).push({ id: r.id, dir: r.kind === 'sms_in' ? 'in' : 'out', key: dbLocalKey(r.ts) });
  }
  return byFub;
}

// ── run ───────────────────────────────────────────────────────────────────────
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const hdr = rows[0];
const cID = hdr.indexOf('ID'), cName = hdr.indexOf('Name'), cTexts = hdr.indexOf('Texts');
console.log(`CSV: ${rows.length - 1} contacts. cols ID=${cID} Name=${cName} Texts=${cTexts}`);

const byFub = await loadDbByFub();
console.log(`DB: ${[...byFub.values()].reduce((a, v) => a + v.length, 0)} redacted texts across ${byFub.size} FUB persons`);

const updates = [];         // {id, body}
const usedRow = new Set();   // DB row ids already matched
let csvTexts = 0, matched = 0, unmatched = 0;

for (let r = 1; r < rows.length; r++) {
  const fub = Number(rows[r][cID]);
  const dbRows = byFub.get(fub);
  if (!dbRows) continue;
  const msgs = parseTexts(rows[r][cTexts] || '');
  for (const msg of msgs) {
    csvTexts++;
    // candidate DB rows: same dir + same local-minute, not yet used
    let cand = dbRows.find((d) => !usedRow.has(d.id) && d.dir === msg.dir && d.key === msg.localKey);
    // fallback: same local-minute, any dir (direction attribution can differ)
    if (!cand) cand = dbRows.find((d) => !usedRow.has(d.id) && d.key === msg.localKey);
    if (cand) { usedRow.add(cand.id); updates.push({ id: cand.id, body: msg.body }); matched++; }
    else unmatched++;
  }
}

console.log(`\nParsed CSV texts: ${csvTexts}`);
console.log(`Matched to DB rows: ${matched}`);
console.log(`CSV texts with no DB match: ${unmatched}`);
console.log(`DB rows still unfilled: ${[...byFub.values()].reduce((a, v) => a + v.length, 0) - matched}`);

if (!APPLY) {
  console.log(`\nDRY-RUN — no writes. Sample recovered bodies:`);
  updates.slice(0, 3).forEach((u) => console.log(`  [${u.id}] ${JSON.stringify(u.body.slice(0, 70))}`));
  console.log(`Re-run with --apply to write ${updates.length} bodies.`);
  process.exit(0);
}

// backup + apply
const ids = updates.map((u) => u.id);
const backup = [];
for (let i = 0; i < ids.length; i += 1000) {
  const { data, error } = await sb.from('crm_timeline').select('id, body, payload').in('id', ids.slice(i, i + 1000));
  if (error) throw error;
  backup.push(...data);
}
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const bkPath = path.join(ROOT, 'out', `crm-recover-fub-texts-backup-${runId}.json`);
fs.writeFileSync(bkPath, JSON.stringify(backup, null, 2));
console.log(`\nBackup: ${bkPath} (${backup.length} rows)`);

let wrote = 0;
for (const u of updates) {
  const prev = backup.find((b) => b.id === u.id);
  const payload = { ...(prev?.payload || {}) };
  delete payload.contentHidden;
  payload.contentRecoveredFromFubExport = true;
  const { error } = await sb.from('crm_timeline').update({ body: u.body, payload }).eq('id', u.id);
  if (error) { console.warn(`  ! ${u.id}: ${error.message}`); continue; }
  if (++wrote % 250 === 0) console.log(`  …${wrote}/${updates.length}`);
}
console.log(`\n✓ Recovered ${wrote} text bodies into crm_timeline. Backup: ${bkPath}`);
