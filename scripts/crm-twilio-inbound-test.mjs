#!/usr/bin/env node
// Probe inbound SMS: signed webhook simulation + optional live Twilio send.
//   node scripts/crm-twilio-inbound-test.mjs           # signature probe only
//   node scripts/crm-twilio-inbound-test.mjs --live    # also SMS Matt line -> 3095

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const LIVE = process.argv.includes('--live');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const token = env.TWILIO_AUTH_TOKEN;
const sid = env.TWILIO_ACCOUNT_SID;
const TW_AUTH = { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') };
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function sign(url, params) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf8')).digest('base64');
}

async function postSigned(baseUrl, params) {
  const url = `${baseUrl}/api/twilio/inbound-sms`;
  const sig = sign(url, params);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sig },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  return { url, status: res.status, body: text.slice(0, 160) };
}

const probeSid = `SMprobe${Date.now()}`;
const params = {
  From: env.TWILIO_NUMBER_MATT ?? '+15412245025',
  To: '+15417033095',
  Body: `CRM inbound probe ${new Date().toISOString()}`,
  MessageSid: probeSid,
  AccountSid: sid,
};

console.log('=== Signed webhook probe ===');
for (const base of ['https://ryan-realty.com', 'https://ryanrealty.vercel.app']) {
  const r = await postSigned(base, { ...params, MessageSid: `${probeSid}-${base.includes('vercel') ? 'v' : 'c'}` });
  console.log(r.status, r.url, r.body);
}

if (!LIVE) {
  console.log('\nPass --live to also send a real SMS between Twilio numbers.');
  process.exit(0);
}

console.log('\n=== Live Twilio send -> 3095 ===');
const body = `Live probe ${Date.now()}`;
const send = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
  method: 'POST',
  headers: { ...TW_AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    From: env.TWILIO_NUMBER_MATT ?? '+15412245025',
    To: '+15417033095',
    Body: body,
  }),
});
const sendData = await send.json();
console.log('send', send.status, sendData.sid ?? sendData.message ?? JSON.stringify(sendData).slice(0, 200));

if (!sendData.sid) process.exit(1);

await new Promise((r) => setTimeout(r, 10000));
const { data: rows } = await sb
  .from('crm_timeline')
  .select('id,kind,body,ts,source,dedupe_key,payload')
  .eq('source', 'twilio')
  .gte('ts', new Date(Date.now() - 120000).toISOString())
  .order('ts', { ascending: false })
  .limit(5);

console.log('\n=== CRM timeline (twilio, last 2m) ===');
for (const r of rows ?? []) {
  console.log(r.ts, r.kind, r.body?.slice(0, 80), r.dedupe_key);
}
const hit = (rows ?? []).some((r) => String(r.payload?.sid ?? '') === sendData.sid || (r.body ?? '').includes(String(body)));
process.exit(hit ? 0 : 2);
