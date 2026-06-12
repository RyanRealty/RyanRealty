#!/usr/bin/env node
// Backfill FUB SMS opt-outs into Twilio via the Consent Management API
// (Compliance Toolkit). TCPA P0 per crm-e2e SKILL PRIORITY INPUT 2: people
// tagged contact:do-not-text / compliance:hard-stop in FUB must be registered
// as opt-out at the Twilio layer too, so a send can never slip past our own
// gate (lib/crm/suppressions.ts stays the first line of defense).
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
// Read-only against FUB; writes only to Twilio consent records.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const FUB_AUTH = 'Basic ' + Buffer.from(`${env.FOLLOWUPBOSS_API_KEY}:`).toString('base64');
const TW_AUTH = 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
const SERVICE = env.TWILIO_MESSAGING_SERVICE_SID;
const SMOKE = process.argv.includes('--smoke');
const EXECUTE = process.argv.includes('--execute');

const OPT_OUT_TAGS = ['contact:do-not-text', 'compliance:hard-stop'];

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

async function fubPeopleByTag(tag) {
  const people = [];
  let url = `https://api.followupboss.com/v1/people?tags=${encodeURIComponent(tag)}&fields=id,name,phones,tags&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: FUB_AUTH, 'X-System': env.FOLLOWUPBOSS_SYSTEM, 'X-System-Key': env.FOLLOWUPBOSS_SYSTEM_KEY } });
    if (!res.ok) throw new Error(`FUB ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    people.push(...(data.people ?? []));
    url = data._metadata?.nextLink ?? null;
  }
  return people;
}

(async () => {
  // 1. Collect opted-out people from FUB (source of truth for the tags).
  const byId = new Map();
  for (const tag of OPT_OUT_TAGS) {
    const people = await fubPeopleByTag(tag);
    console.log(`FUB tag "${tag}": ${people.length} people`);
    for (const p of people) byId.set(p.id, p);
  }

  // 2. Extract + dedupe E.164 phone numbers.
  const numbers = new Map(); // e164 -> person name (first seen)
  for (const p of byId.values()) {
    for (const ph of p.phones ?? []) {
      const e = toE164(ph.value);
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

  // 3. Bulk upsert, 25/request, ≤100 req/min (sleep 700ms between requests).
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
