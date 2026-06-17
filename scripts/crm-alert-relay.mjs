#!/usr/bin/env node
// Broker alert relay + number watchdog — runs on the mac mini every ~45s via
// LaunchAgent com.ryanrealty.crm-alert-relay.
//
// 1. Drains crm_broker_alerts (status=pending):
//    - If CRM_SMS_ALERTS=twilio in .env.local AND the A2P campaign is
//      VERIFIED: sends via Twilio Messaging Service (broker lines).
//    - Otherwise: sends as iMessage from this Mac's Messages app (Matt's
//      Apple ID) — works today, no carrier registration needed.
//    - Failure → status=failed with error (email alerts on the webhook paths
//      remain the guaranteed channel).
// 2. Watchdog: any Twilio number on the account missing our SMS/voice
//    webhooks gets wired instantly — this is what catches 541.703.3095 the
//    moment the FUB transfer lands, so zero inbound is dropped.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TW_AUTH = { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64') };
const SITE = 'https://ryan-realty.com';

function sendIMessage(to, body) {
  const script = `
    on run {targetPhone, msgBody}
      tell application "Messages"
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant targetPhone of targetService
        send msgBody to targetBuddy
      end tell
    end run`;
  execFileSync('osascript', ['-e', script, to, body], { timeout: 30000 });
}

async function sendTwilioSms(to, body) {
  const form = new URLSearchParams({ To: to, MessagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { ...TW_AUTH, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${(await res.text()).slice(0, 140)}`);
}

async function campaignVerified() {
  try {
    const res = await fetch(`https://messaging.twilio.com/v1/Services/${env.TWILIO_MESSAGING_SERVICE_SID}/Compliance/Usa2p`, { headers: TW_AUTH });
    const d = await res.json();
    const c = (d.compliance ?? d.us_app_to_person ?? [])[0];
    return (c?.campaign_status ?? c?.status) === 'VERIFIED';
  } catch { return false; }
}

// ── broker-phone whitelist (hard backstop) ──────────────────────────────────
// This relay sends ONLY internal broker alerts (to Matt / Rebecca / Paul). It
// must NEVER text a lead/homeowner — lead SMS goes through Twilio's A2P-
// registered messaging service, never an agent's personal iMessage. Any queued
// row whose to_phone is not a broker line is refused (status='skipped'). This
// backstops the 2026-06-16 expired-listing iMessage incident where
// LEAD_SMS_IMESSAGE_FALLBACK routed homeowner texts (incl. DNC contacts) here.
// Upstream fix: app/api/cron/crm-sequence-engine.
const last10 = (p) => String(p ?? '').replace(/\D/g, '').slice(-10);
const BROKER_PHONES = new Set(
  [env.TWILIO_FORWARD_MATT, env.TWILIO_FORWARD_REBECCA, env.TWILIO_FORWARD_PAUL]
    .map(last10).filter(Boolean),
);

// ── 1. drain pending alerts ────────────────────────────────────────────────
const { data: pending } = await sb.from('crm_broker_alerts').select('*').eq('status', 'pending').order('id').limit(20);
if (pending?.length) {
  const useTwilio = env.CRM_SMS_ALERTS === 'twilio' && (await campaignVerified());
  for (const a of pending) {
    if (!BROKER_PHONES.has(last10(a.to_phone))) {
      // Terminal 'failed' (an allowed status) so the row clears from pending.
      // The error text records WHY: this is a policy skip, not a send failure.
      const { error: upErr } = await sb.from('crm_broker_alerts').update({
        status: 'failed', error: 'skipped: non-broker to_phone, lead SMS must use Twilio A2P not a personal iMessage',
      }).eq('id', a.id);
      console.warn(`skipped #${a.id}: non-broker to_phone ${a.to_phone}${upErr ? ` (update err: ${upErr.message})` : ''}`);
      continue;
    }
    try {
      const to = a.to_phone.startsWith('+') ? a.to_phone : `+1${a.to_phone.replace(/\D/g, '').slice(-10)}`;
      if (useTwilio) await sendTwilioSms(to, a.body);
      else sendIMessage(to, a.body);
      await sb.from('crm_broker_alerts').update({ status: 'sent', channel: useTwilio ? 'twilio-sms' : 'imessage', sent_at: new Date().toISOString() }).eq('id', a.id);
      console.log(`sent #${a.id} → ${a.broker} via ${useTwilio ? 'twilio' : 'imessage'}`);
    } catch (e) {
      // Transient failures (osascript ETIMEDOUT, Twilio 5xx) get retried on the
      // next 45s run; only after 3 attempts does the row go terminally failed.
      const attempts = (a.attempts ?? 0) + 1;
      const terminal = attempts >= 3;
      await sb.from('crm_broker_alerts').update({
        status: terminal ? 'failed' : 'pending', attempts,
        error: String(e.message ?? e).slice(0, 300),
      }).eq('id', a.id);
      console.warn(`${terminal ? 'failed' : `retry ${attempts}/3`} #${a.id}:`, String(e.message ?? e).slice(0, 140));
    }
  }
}

// ── 2. number watchdog (catches the 3095 transfer landing) ────────────────
try {
  const d = await (await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=20`, { headers: TW_AUTH })).json();
  for (const n of d.incoming_phone_numbers ?? []) {
    const smsOk = String(n.sms_url).includes('/api/twilio/inbound-sms');
    const voiceOk = String(n.voice_url).includes('/api/twilio/voice');
    if (smsOk && voiceOk) continue;
    const form = new URLSearchParams({
      SmsUrl: `${SITE}/api/twilio/inbound-sms`, SmsMethod: 'POST',
      VoiceUrl: `${SITE}/api/twilio/voice`, VoiceMethod: 'POST',
      StatusCallback: `${SITE}/api/twilio/status`, StatusCallbackMethod: 'POST',
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${n.sid}.json`, {
      method: 'POST', headers: { ...TW_AUTH, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    });
    console.log(`WATCHDOG: webhooked ${n.phone_number} → ${res.status}`);
    if (n.phone_number === '+15417033095') {
      await sb.from('crm_broker_alerts').insert({
        broker: 'matt', to_phone: env.TWILIO_FORWARD_MATT ?? '+15412136706',
        body: 'The 541.703.3095 transfer LANDED. Webhooks wired automatically. Inbound texts and calls to the main line now route through the CRM.',
      });
    }
  }
} catch (e) {
  console.warn('watchdog error:', String(e.message ?? e).slice(0, 140));
}
