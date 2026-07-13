#!/usr/bin/env node
/**
 * crm-recover-fub-text-bodies.mjs — recover the REAL body text of the ~2,680
 * historical SMS messages that were imported from Follow Up Boss with their
 * content redacted.
 *
 * WHY THESE ROWS ARE BLANK
 * ------------------------
 * When the FUB comms were imported, the FUB API returned every text body as
 * "* Body is hidden for privacy reasons *" because the API system was not
 * registered with content sharing enabled. The importer stored those rows as
 * `body = NULL, payload.contentHidden = true, source = 'fub-import'`. The words
 * were never captured on our side — they exist ONLY inside the FUB account.
 * No local export holds them either. So the only way to get them back is to
 * re-pull from FUB with content sharing turned on.
 *
 * PREREQUISITES (one-time, done by Matt in FUB — see the printed guidance):
 *   1. A FUB API key.               → set FOLLOW_UP_BOSS_API_KEY in .env.local
 *   2. Register an API system at
 *      https://apps.followupboss.com/system-registration
 *      → set FOLLOWUPBOSS_SYSTEM + FOLLOWUPBOSS_SYSTEM_KEY in .env.local
 *   3. Enable CONTENT SHARING for that system in FUB so text/email bodies are
 *      returned by the API instead of the "hidden for privacy" placeholder.
 * Without #3 the API keeps returning the redaction string and nothing can be
 * recovered — the script detects this and tells you.
 *
 * USAGE
 *   node scripts/crm-recover-fub-text-bodies.mjs           # DRY-RUN (default):
 *        reads from FUB read-only, reports how many bodies are recoverable,
 *        prints a few samples, writes NOTHING.
 *   node scripts/crm-recover-fub-text-bodies.mjs --apply    # write recovered
 *        bodies into crm_timeline.body and clear payload.contentHidden.
 *
 * Backup-first: on --apply, every touched row's pre-write (id, body, payload)
 * is written to out/crm-recover-fub-text-bodies-backup-<runId>.json first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ── env ──────────────────────────────────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const FUB_KEY = (env.FOLLOW_UP_BOSS_API_KEY || env.FOLLOWUPBOSS_API_KEY || env.FUB_API_KEY || '').trim();
const FUB_SYSTEM = (env.FOLLOWUPBOSS_SYSTEM || 'RyanRealty').trim();
const FUB_SYSTEM_KEY = (env.FOLLOWUPBOSS_SYSTEM_KEY || '').trim();
const FUB_BASE = 'https://api.followupboss.com/v1';

if (!FUB_KEY) {
  console.error(
    '\n✗ No FUB API key found in .env.local (looked for FOLLOW_UP_BOSS_API_KEY / FOLLOWUPBOSS_API_KEY / FUB_API_KEY).\n' +
      '  The FUB integration was decommissioned, so the key was removed. To recover the historical text\n' +
      '  bodies you must, in Follow Up Boss:\n' +
      '    1. Generate an API key (Admin → API) and set FOLLOW_UP_BOSS_API_KEY in .env.local.\n' +
      '    2. Register a system at https://apps.followupboss.com/system-registration and set\n' +
      '       FOLLOWUPBOSS_SYSTEM + FOLLOWUPBOSS_SYSTEM_KEY.\n' +
      '    3. Enable CONTENT SHARING for that system so bodies are returned by the API.\n' +
      '  Then re-run this script.\n',
  );
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const fubHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`,
  'X-System': FUB_SYSTEM,
  ...(FUB_SYSTEM_KEY ? { 'X-System-Key': FUB_SYSTEM_KEY } : {}),
};

const REDACTED_RE = /hidden for privacy|content hidden|\[content hidden\]/i;
const isRedacted = (s) => !s || REDACTED_RE.test(String(s));
const bodyOf = (m) => m?.message ?? m?.body ?? m?.text ?? null;

// ── 1. target rows: every redacted, imported SMS ──────────────────────────────
async function loadTargets() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('crm_timeline')
      .select('id, person_id, fub_legacy_id, kind, payload')
      .eq('source', 'fub-import')
      .in('kind', ['sms_in', 'sms_out'])
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  // only rows still marked contentHidden and lacking a fub text id are unusable
  return rows.filter((r) => r.payload?.contentHidden === true);
}

// map our local person_id → FUB person id (crm_people.fub_legacy_id)
async function loadPersonFubIds(personIds) {
  const map = new Map();
  const ids = [...new Set(personIds)];
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id, fub_legacy_id')
      .in('id', ids.slice(i, i + CHUNK));
    if (error) throw error;
    for (const p of data) if (p.fub_legacy_id) map.set(p.id, p.fub_legacy_id);
  }
  return map;
}

// ── 2. pull a person's texts from FUB (content shared → real bodies) ──────────
async function fetchPersonTexts(fubPersonId) {
  const out = [];
  let offset = 0;
  const LIMIT = 100;
  for (;;) {
    const url = `${FUB_BASE}/textMessages?personId=${fubPersonId}&limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url, { headers: fubHeaders });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`FUB ${res.status} for personId=${fubPersonId}: ${txt.slice(0, 300)}`);
    }
    const json = await res.json();
    const batch = json.textmessages || json.textMessages || json.data || [];
    out.push(...batch);
    if (batch.length < LIMIT) break;
    offset += LIMIT;
  }
  return out;
}

// ── run ───────────────────────────────────────────────────────────────────────
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const targets = await loadTargets();
console.log(`Redacted imported SMS rows to recover: ${targets.length}`);
if (targets.length === 0) process.exit(0);

const personFub = await loadPersonFubIds(targets.map((r) => r.person_id));
// fubTextId → [crm_timeline rows] (a FUB text can fan out to >1 person row for group texts)
const byFubText = new Map();
for (const r of targets) {
  if (r.fub_legacy_id == null) continue;
  const k = String(r.fub_legacy_id);
  if (!byFubText.has(k)) byFubText.set(k, []);
  byFubText.get(k).push(r);
}
const noFubTextId = targets.filter((r) => r.fub_legacy_id == null).length;

// group target person ids by their FUB person id
const fubPersonIds = [...new Set(targets.map((r) => personFub.get(r.person_id)).filter(Boolean))];
console.log(`Distinct FUB persons to query: ${fubPersonIds.length}` + (noFubTextId ? `  (${noFubTextId} rows have no FUB text id — will report as unrecoverable)` : ''));

const updates = []; // { id, body }
let sampled = 0;
let redactedSeen = 0;
let fetchedTexts = 0;

for (const fpid of fubPersonIds) {
  let texts;
  try {
    texts = await fetchPersonTexts(fpid);
  } catch (e) {
    console.warn(`  ! ${e.message}`);
    continue;
  }
  fetchedTexts += texts.length;
  for (const m of texts) {
    const rows = byFubText.get(String(m.id));
    if (!rows) continue;
    const body = bodyOf(m);
    if (isRedacted(body)) {
      redactedSeen++;
      continue;
    }
    for (const row of rows) updates.push({ id: row.id, body });
    if (sampled < 5) {
      console.log(`  ✓ text ${m.id}: ${JSON.stringify(String(body).slice(0, 80))}`);
      sampled++;
    }
  }
}

console.log(`\nFUB texts fetched: ${fetchedTexts}`);
console.log(`Recoverable (real body returned): ${updates.length} rows`);
console.log(`Still redacted by FUB (content sharing NOT enabled): ${redactedSeen}`);

if (redactedSeen > 0 && updates.length === 0) {
  console.error(
    '\n✗ FUB is still returning redacted bodies. Content sharing is not enabled for this API system.\n' +
      '  Enable it at https://apps.followupboss.com/system-registration (Content Sharing) and re-run.\n',
  );
  process.exit(2);
}

if (!APPLY) {
  console.log(`\nDRY-RUN — no writes. Re-run with --apply to fill ${updates.length} bodies into crm_timeline.`);
  process.exit(0);
}

// ── 3. backup then apply ──────────────────────────────────────────────────────
const touchedIds = updates.map((u) => u.id);
const backup = [];
for (let i = 0; i < touchedIds.length; i += 1000) {
  const { data, error } = await sb.from('crm_timeline').select('id, body, payload').in('id', touchedIds.slice(i, i + 1000));
  if (error) throw error;
  backup.push(...data);
}
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const backupPath = path.join(ROOT, 'out', `crm-recover-fub-text-bodies-backup-${runId}.json`);
fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(`\nBackup written: ${backupPath} (${backup.length} rows)`);

let written = 0;
for (const u of updates) {
  const prev = backup.find((b) => b.id === u.id);
  const nextPayload = { ...(prev?.payload || {}) };
  delete nextPayload.contentHidden;
  nextPayload.contentRecoveredFromFub = true;
  const { error } = await sb.from('crm_timeline').update({ body: u.body, payload: nextPayload }).eq('id', u.id);
  if (error) {
    console.warn(`  ! update failed id=${u.id}: ${error.message}`);
    continue;
  }
  written++;
  if (written % 200 === 0) console.log(`  …${written}/${updates.length}`);
}
console.log(`\n✓ Recovered ${written} text bodies into crm_timeline. Backup: ${backupPath}`);
