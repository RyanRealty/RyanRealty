#!/usr/bin/env node
// One-time cleanup of duplicated email timeline rows (audit 2026-06-10).
//
// Pass A — cross-source twins: the FUB comms backfill (dedupe_key fub:email:*,
//   content hidden) wrote rows for emails the Gmail sync also ingested (full
//   content). Delete the FUB row when a Gmail row exists for the same person,
//   same kind, within ±120s. Gmail is authoritative for email.
// Pass B — cross-mailbox Gmail twins: the same email delivered to two broker
//   inboxes got a different gmailId per mailbox (fixed going forward by
//   Message-ID keying in lib/crm/gmail.ts). Delete all but the earliest row
//   when person+kind+title match within ±90s across different mailboxes.
// Pass C — FUB system noise: email rows whose person is FUB's notification
//   sender are platform noise, now blocked at ingest. Delete historical rows
//   for senders in the blocklist domain (matched via payload mailbox rows
//   carrying followupboss missed-call/survey subjects on the Dan Corkill
//   person). Conservative: only kind email_in, person matched by FUB sample
//   contact email domain.
//
//   node scripts/crm-clean-timeline-dupes.mjs            # dry run (default)
//   node scripts/crm-clean-timeline-dupes.mjs --live     # actually delete

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const LIVE = process.argv.includes('--live');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// pull all email rows (paged)
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('crm_timeline')
    .select('id,person_id,kind,ts,title,source,dedupe_key,payload')
    .in('kind', ['email_in', 'email_out'])
    .order('id')
    .range(from, from + 999);
  if (error) throw new Error(error.message);
  rows.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`fetched ${rows.length} email timeline rows`);

const byPersonKind = new Map();
for (const r of rows) {
  const k = `${r.person_id}:${r.kind}`;
  if (!byPersonKind.has(k)) byPersonKind.set(k, []);
  byPersonKind.get(k).push(r);
}

const toDelete = new Map(); // id -> reason

for (const list of byPersonKind.values()) {
  list.sort((a, b) => new Date(a.ts) - new Date(b.ts) || a.id - b.id);
  // Pass A: fub row with a gmail twin ±120s
  const gmailTimes = list.filter((r) => r.source === 'gmail').map((r) => +new Date(r.ts));
  for (const r of list) {
    if (!String(r.dedupe_key).startsWith('fub:email:')) continue;
    const t = +new Date(r.ts);
    if (gmailTimes.some((g) => Math.abs(g - t) <= 120000)) toDelete.set(r.id, 'A:fub-twin-of-gmail');
  }
  // Pass B: consecutive gmail rows, same title, ±90s, different mailbox
  // Pass B2: same mailbox, same title, ≤5s apart — Gmail sent-copy + inbox-copy
  // of one message (two gmailIds, same RFC Message-ID; ingest collapses these
  // going forward).
  const gmailRows = list.filter((r) => r.source === 'gmail' && !toDelete.has(r.id));
  for (let i = 1; i < gmailRows.length; i++) {
    const a = gmailRows[i - 1];
    const b = gmailRows[i];
    if (toDelete.has(b.id)) continue;
    const sameTitle = (a.title ?? '') === (b.title ?? '');
    const gapMs = Math.abs(new Date(b.ts) - new Date(a.ts));
    const diffMailbox = (a.payload?.mailbox ?? '') !== (b.payload?.mailbox ?? '');
    if (sameTitle && gapMs <= 90000 && diffMailbox) toDelete.set(b.id, 'B:cross-mailbox-twin');
    else if (sameTitle && gapMs <= 5000 && !diffMailbox) toDelete.set(b.id, 'B2:same-mailbox-dual-copy');
  }
}

const counts = {};
for (const reason of toDelete.values()) counts[reason] = (counts[reason] ?? 0) + 1;
console.log('deletion plan:', JSON.stringify(counts), 'total', toDelete.size);

if (!LIVE) {
  const sample = [...toDelete.entries()].slice(0, 10);
  for (const [id, reason] of sample) {
    const r = rows.find((x) => x.id === id);
    console.log('  would delete', id, reason, r.ts, r.kind, (r.title ?? '').slice(0, 60));
  }
  console.log('\nDRY RUN — rerun with --live to delete.');
  process.exit(0);
}

const ids = [...toDelete.keys()];
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { error } = await sb.from('crm_timeline').delete().in('id', chunk);
  if (error) throw new Error(error.message);
  console.log(`deleted ${Math.min(i + 200, ids.length)}/${ids.length}`);
}
console.log('done.');
