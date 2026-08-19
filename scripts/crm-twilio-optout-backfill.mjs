#!/usr/bin/env node
// Backfill native CRM SMS opt-outs into Twilio via the Consent Management API
// (Compliance Toolkit). People tagged contact:do-not-text / compliance:hard-stop
// on crm_people, plus crm_suppressions rows on sms/all, must be registered as
// opt-out at the Twilio layer too, so a send can never slip past our own gate
// (lib/crm/suppressions.ts stays the first line of defense).
//
// Endpoint: POST https://accounts.twilio.com/v1/Consents/Bulk
//   - up to 25 items/request, 100 requests/min
//   - item: contact_id (E.164), correlation_id (32-char hex), sender_id
//     (Messaging Service SID), status opt-out, source, date_of_consent
//   - per-item result: error_code 0 = stored
//
//   node scripts/crm-twilio-optout-backfill.mjs --smoke    # first 2 numbers only
//   node scripts/crm-twilio-optout-backfill.mjs --execute  # full backfill
//   node scripts/crm-twilio-optout-backfill.mjs            # dry-run: list + count only
//
// Scope: full company (all brokers) — compliance syncs are never narrowed.
// Read-only against crm_people / crm_suppressions; writes only to Twilio.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TW_AUTH = 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
const SERVICE = env.TWILIO_MESSAGING_SERVICE_SID;
const SMOKE = process.argv.includes('--smoke');
const EXECUTE = process.argv.includes('--execute');

const OPT_OUT_TAGS = ['contact:do-not-text', 'compliance:hard-stop'];
const PAGE = 1000;

function toE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+1') && digits.length === 12) return digits;
  if (digits.startsWith('+')) return digits.length >= 11 ? digits : null;
  const d = digits.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

async function pageAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

async function peopleByOptOutTags() {
  return pageAll(() =>
    sb.from('crm_people').select('id,name,phones,tags').overlaps('tags', OPT_OUT_TAGS),
  );
}

async function peopleBySmsSuppression() {
  const rows = await pageAll(() =>
    sb.from('crm_suppressions').select('person_id').in('channel', ['sms', 'all']).not('person_id', 'is', null),
  );
  const ids = [...new Set(rows.map((r) => r.person_id).filter(Boolean))];
  const people = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await sb.from('crm_people').select('id,name,phones,tags').in('id', chunk);
    if (error) throw new Error(error.message);
    people.push(...(data ?? []));
  }
  return people;
}

async function phonesFromContactPoints(personIds) {
  const byPerson = new Map();
  for (let i = 0; i < personIds.length; i += 200) {
    const chunk = personIds.slice(i, i + 200);
    const { data, error } = await sb
      .from('crm_contact_points')
      .select('person_id,value')
      .eq('kind', 'phone')
      .in('person_id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const list = byPerson.get(row.person_id) ?? [];
      list.push(row.value);
      byPerson.set(row.person_id, list);
    }
  }
  return byPerson;
}

(async () => {
  const tagged = await peopleByOptOutTags();
  console.log(`crm_people opt-out tags (${OPT_OUT_TAGS.join(', ')}): ${tagged.length} people`);
  const suppressed = await peopleBySmsSuppression();
  console.log(`crm_suppressions sms/all: ${suppressed.length} people`);

  const byId = new Map();
  for (const p of [...tagged, ...suppressed]) byId.set(p.id, p);

  const extraPhones = await phonesFromContactPoints([...byId.keys()]);
  const numbers = new Map();
  for (const p of byId.values()) {
    const raw = [
      ...(p.phones ?? []).map((ph) => (typeof ph === 'string' ? ph : ph?.value)),
      ...(extraPhones.get(p.id) ?? []),
    ];
    for (const value of raw) {
      const e = toE164(value);
      if (e && !numbers.has(e)) numbers.set(e, p.name ?? `person ${p.id}`);
    }
  }
  console.log(`unique opted-out people: ${byId.size}; unique E.164 numbers: ${numbers.size}`);

  let targets = [...numbers.keys()];
  if (SMOKE) targets = targets.slice(0, 2);
  if (!SMOKE && !EXECUTE) {
    console.log('DRY RUN — no Twilio writes. Re-run with --smoke (2 numbers) or --execute (all).');
    console.log('first 5:', targets.slice(0, 5));
    return;
  }
  console.log(`${SMOKE ? 'SMOKE TEST' : 'FULL BACKFILL'}: writing ${targets.length} opt-out consents to ${SERVICE}`);

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  let ok = 0, failed = 0;
  for (let i = 0; i < targets.length; i += 25) {
    const chunk = targets.slice(i, i + 25);
    const form = new URLSearchParams();
    for (const e164 of chunk) {
      form.append('Items', JSON.stringify({
        contact_id: e164,
        correlation_id: crypto.randomUUID().replace(/-/g, ''),
        sender_id: SERVICE,
        status: 'opt-out',
        source: 'others',
        date_of_consent: now,
      }));
    }
    const res = await fetch('https://accounts.twilio.com/v1/Consents/Bulk', {
      method: 'POST',
      headers: { Authorization: TW_AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Consents/Bulk ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
    for (const item of data.items ?? []) {
      if (item.error_code === 0 || item.error_code === '0' || item.error_code == null) ok++;
      else { failed++; console.log(`  FAIL ${item.contact_id}: ${item.error_code} ${JSON.stringify(item.error_messages ?? [])}`); }
    }
    console.log(`  batch ${1 + i / 25}: ${chunk.length} sent (running ok=${ok} failed=${failed})`);
    if (i + 25 < targets.length) await new Promise((r) => setTimeout(r, 700));
  }
  console.log(`DONE: ${ok} stored, ${failed} failed, of ${targets.length} numbers.`);
  if (SMOKE) console.log('Smoke response validated — re-run with --execute for the full backfill.');
})().catch((e) => { console.error('BACKFILL FAILED:', e.message); process.exit(1); });
