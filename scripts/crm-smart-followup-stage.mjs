#!/usr/bin/env node
// Smart follow-ups, stage 3: take the drafts JSON the routine wrote, validate
// brand voice (hard fails), stage each as a note + review task on the
// contact, and email each broker a digest. NOTHING auto-sends to clients.
//
//   node scripts/crm-smart-followup-stage.mjs tmp/smart-followup-drafts.json

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const HARD_FAIL = /[—–;]|\b(stunning|breathtaking|gorgeous|charming|pristine|nestled|boasts|must-see|dream home|meticulously|truly|luxurious|immaculate|captivating|exquisite|delve|tapestry|robust|seamless|elevate|unlock|vibrant|bustling|curated|bespoke|don't miss out|act fast|won't last)\b/i;
const MAILBOX = { matt: 'matt@ryan-realty.com', rebecca: 'rebeccapeterson@ryan-realty.com', paul: 'paul@ryan-realty.com' };

const draftsPath = process.argv[2] ?? path.join(ROOT, 'tmp/smart-followup-drafts.json');
const { drafts } = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
if (!Array.isArray(drafts)) { console.error('drafts JSON must be {drafts:[...]}'); process.exit(1); }

const key = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
async function sendDigest(brokerSlug, lines) {
  const mailbox = MAILBOX[brokerSlug] ?? MAILBOX.matt;
  const jwt = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, key, scopes: ['https://www.googleapis.com/auth/gmail.send'], subject: mailbox });
  const gmail = google.gmail({ version: 'v1', auth: jwt });
  const body = `Drafts are staged on each contact's timeline. Open the contact, review, and send from the composer.\r\n\r\n${lines.join('\r\n\r\n')}`;
  const raw = Buffer.from([
    `From: ${mailbox}`, `To: ${mailbox}`,
    `Subject: ${lines.length} smart follow-up${lines.length === 1 ? '' : 's'} ready to send`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '', body,
  ].join('\r\n')).toString('base64url');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

const staged = { ok: 0, voiceFail: 0, badRow: 0 };
const byBroker = {};

for (const d of drafts) {
  if (!d?.personId || !d?.body) { staged.badRow++; continue; }
  if (HARD_FAIL.test(`${d.subject ?? ''} ${d.body}`)) {
    console.warn(`voice hard-fail, skipping person ${d.personId}:`, (d.body ?? '').slice(0, 80));
    staged.voiceFail++;
    continue;
  }
  const broker = d.broker ?? 'matt';
  await sb.from('crm_timeline').insert({
    person_id: d.personId,
    kind: 'note',
    title: `Suggested follow-up (AI draft, ${d.channel ?? 'email'})`,
    body: `${d.subject ? `Subject: ${d.subject}\n\n` : ''}${d.body}\n\nWhy now: ${d.why ?? ''}`,
    broker,
    source: 'smart-followup',
  });
  await sb.from('crm_tasks').insert({
    person_id: d.personId,
    name: `Send follow-up to ${d.name ?? 'lead'} (draft ready on timeline)`,
    type: d.channel === 'sms' ? 'Text' : 'Email',
    due_at: new Date(Date.now() + 6 * 3600e3).toISOString(),
    assigned_broker: broker,
    origin: 'smart-followup',
  });
  ;(byBroker[broker] ??= []).push(
    `• ${d.name} (${d.channel ?? 'email'})${d.subject ? ` | ${d.subject}` : ''}\r\n  ${String(d.body).slice(0, 220)}\r\n  Why: ${d.why ?? ''}\r\n  https://ryan-realty.com/admin/crm/${d.personId}`,
  );
  staged.ok++;
}

for (const [broker, lines] of Object.entries(byBroker)) {
  await sendDigest(broker, lines).catch((e) => console.warn('digest send failed for', broker, e.message));
}

console.log('STAGED', JSON.stringify({ ...staged, digests: Object.keys(byBroker) }));
