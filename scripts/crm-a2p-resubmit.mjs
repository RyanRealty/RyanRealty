#!/usr/bin/env node
// A2P campaign resubmission after the 30909 CTA-verification rejection
// (2026-06-11). FAILED campaigns cannot be edited: DELETE the failed Usa2p
// resource, re-create with a verifiable MessageFlow that quotes the exact
// SMS-consent disclosure now live on every ryan-realty.com lead form
// (components/site/SmsConsentDisclosure.tsx — deployed + verified 2026-06-11).
//
//   node scripts/crm-a2p-resubmit.mjs            # dry-run (prints plan)
//   node scripts/crm-a2p-resubmit.mjs --execute  # delete + recreate
//
// Pre-submission checklist (crm-e2e SKILL escape-ledger 2026-06-11 — verify
// BEFORE running with --execute):
//   [ ] The consent text below matches SMS_CONSENT_TEXT in
//       components/site/SmsConsentDisclosure.tsx byte for byte.
//   [ ] Every URL listed in MESSAGE_FLOW returns 200 and contains the text
//       (this script verifies both automatically and aborts otherwise).
//   [ ] MessageFlow contains no consent channel that a carrier cannot verify
//       by visiting a URL (no "verbal consent", no "during a call").
//   [ ] Every message sample carries a STOP line.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const AUTH = 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
const MSG = 'https://messaging.twilio.com/v1';
const SERVICE = env.TWILIO_MESSAGING_SERVICE_SID;
const EXECUTE = process.argv.includes('--execute');

// Must match components/site/SmsConsentDisclosure.tsx SMS_CONSENT_TEXT exactly.
const CONSENT_TEXT =
  'By submitting, you agree to receive calls and texts from Ryan Realty about your request. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';

const CTA_URLS = [
  'https://ryan-realty.com/contact',
  'https://ryan-realty.com/sell/valuation',
  'https://ryan-realty.com/lp/seller-home-value',
  'https://ryan-realty.com/lp/sell-your-home',
  'https://ryan-realty.com/lp/buyer-listing-alerts',
  'https://ryan-realty.com/lp/expired-listing',
];

const MESSAGE_FLOW =
  `End users opt in to SMS by submitting a lead form on ryan-realty.com. Every lead form that collects a phone number displays this consent disclosure directly below the submit button: "${CONSENT_TEXT}" The disclosure links to the privacy policy at https://ryan-realty.com/privacy. The disclosure can be verified live on these pages: ${CTA_URLS.join(', ')}. End users can also opt in by texting our business number first. Opt-out (STOP) and HELP keywords are honored automatically.`;

const CAMPAIGN = {
  UsAppToPersonUsecase: 'LOW_VOLUME',
  Description:
    'Ryan Realty is a residential real estate brokerage in Bend, Oregon. We text our clients and leads about home valuations they requested, property updates, showing scheduling, and follow-ups to their inquiries.',
  MessageFlow: MESSAGE_FLOW,
  HasEmbeddedLinks: 'true',
  HasEmbeddedPhone: 'true',
  OptOutKeywords: 'STOP',
  OptOutMessage: 'You have been unsubscribed from Ryan Realty texts. Reply START to resubscribe.',
  HelpMessage: 'Ryan Realty: reply STOP to unsubscribe. For help call 541.213.6706.',
  SubscriberOptIn: 'true',
};
const SAMPLES = [
  'Hi John, this is Matt Ryan with Ryan Realty. Got your home value request for 123 Main St. Your report will be in your inbox shortly. If you would rather not get texts, reply STOP.',
  'Hi Sarah, Matt with Ryan Realty. Your Bend home search is set up. What is the best time to call you this week? Reply STOP to opt out.',
];

async function api(method, url, form) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form) : undefined,
  });
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

(async () => {
  // 0. Verify the on-page CTA is actually live before (re)submitting anything.
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  for (const url of CTA_URLS) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const html = await res.text();
    const ok = res.ok && html.includes('you agree to receive calls and texts from Ryan Realty');
    console.log(`${ok ? 'OK ' : 'FAIL'} ${res.status} ${url}`);
    if (!ok) throw new Error(`CTA not verifiable at ${url} — fix the page before resubmitting`);
  }

  // 1. Current campaign state.
  const list = await api('GET', `${MSG}/Services/${SERVICE}/Compliance/Usa2p`);
  const existing = list.compliance ?? [];
  for (const c of existing) console.log(`existing campaign: ${c.sid} status=${c.campaign_status}`);

  if (!EXECUTE) {
    console.log('\nDRY RUN. MessageFlow that will be submitted:\n');
    console.log(MESSAGE_FLOW);
    console.log(`\n(${MESSAGE_FLOW.length} chars; limit 2048). Re-run with --execute to delete + recreate.`);
    return;
  }

  // 2. Delete FAILED campaign(s).
  for (const c of existing) {
    if (c.campaign_status === 'FAILED') {
      await api('DELETE', `${MSG}/Services/${SERVICE}/Compliance/Usa2p/${c.sid}`);
      console.log(`deleted ${c.sid}`);
    } else {
      throw new Error(`campaign ${c.sid} is ${c.campaign_status}, not FAILED — refusing to delete`);
    }
  }

  // 3. Resolve brand sid (from state file or the deleted campaign).
  const statePath = path.join(ROOT, 'tmp/a2p-state.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  const brandSid = state.brandSid ?? existing[0]?.brand_registration_sid;
  if (!brandSid) throw new Error('no brand registration sid found');

  // 4. Re-create.
  const form = new URLSearchParams({ BrandRegistrationSid: brandSid, ...CAMPAIGN });
  for (const s of SAMPLES) form.append('MessageSamples', s);
  const res = await fetch(`${MSG}/Services/${SERVICE}/Compliance/Usa2p`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const created = await res.json();
  if (!res.ok) throw new Error(`create failed ${res.status}: ${JSON.stringify(created).slice(0, 600)}`);
  console.log(`created ${created.sid} status=${created.campaign_status}`);

  state.campaignSid = created.sid;
  state.campaignStatus = created.campaign_status;
  state.campaignResubmittedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 1));

  // 5. Confirm via fresh GET.
  const confirm = await api('GET', `${MSG}/Services/${SERVICE}/Compliance/Usa2p/${created.sid}`);
  console.log(`confirmed via GET: ${confirm.sid} status=${confirm.campaign_status}`);
})().catch((e) => { console.error('RESUBMIT FAILED:', e.message); process.exit(1); });
