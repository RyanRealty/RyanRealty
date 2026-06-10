#!/usr/bin/env node
// Post-upgrade Twilio provisioning (blueprint §5.5).
// Run after the account flips Trial → Full:
//   1. Buys one local 541 number per broker (Matt, Rebecca, Paul).
//   2. Points every owned number (incl. the existing toll-free) at the CRM
//      webhooks (/api/twilio/inbound-sms + /api/twilio/voice).
//   3. Prints the env lines to add + what still needs human input (EIN for
//      A2P brand, FUB account info for the 541.703.3095 port).
//
//   node scripts/crm-twilio-provision.mjs --dry   # search + plan only
//   node scripts/crm-twilio-provision.mjs         # buy + configure

import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SID = env.TWILIO_ACCOUNT_SID;
const AUTH = 'Basic ' + Buffer.from(`${SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
const API = `https://api.twilio.com/2010-04-01/Accounts/${SID}`;
const SITE = 'https://ryan-realty.com';

const get = async (p) => {
  const r = await fetch(API + p, { headers: { Authorization: AUTH } });
  if (!r.ok) throw new Error(`GET ${p} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};
const post = async (p, form) => {
  const r = await fetch(API + p, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`POST ${p} → ${r.status}: ${JSON.stringify(data).slice(0, 250)}`);
  return data;
};

const BROKERS = [
  { slug: 'matt', name: 'Matt Ryan' },
  { slug: 'rebecca', name: 'Rebecca Peterson' },
  { slug: 'paul', name: 'Paul Stevenson' },
];

(async () => {
  const account = await get('.json');
  console.log(`account: ${account.friendly_name} | type: ${account.type} | status: ${account.status}`);
  if (account.type !== 'Full' && !DRY) {
    console.error('Account is still Trial — upgrade (card) must complete first. Aborting.');
    process.exit(2);
  }

  // Existing inventory
  const owned = await get('/IncomingPhoneNumbers.json?PageSize=50');
  console.log('owned numbers:', owned.incoming_phone_numbers.map((n) => `${n.phone_number} (${n.friendly_name})`));

  // Search local 541
  const avail = await get('/AvailablePhoneNumbers/US/Local.json?AreaCode=541&SmsEnabled=true&VoiceEnabled=true&PageSize=20');
  const candidates = (avail.available_phone_numbers ?? []).map((n) => n.phone_number);
  console.log('available 541 candidates:', candidates.slice(0, 10));
  if (candidates.length < BROKERS.length) throw new Error('not enough 541 inventory returned');

  const webhookCfg = {
    SmsUrl: `${SITE}/api/twilio/inbound-sms`,
    SmsMethod: 'POST',
    VoiceUrl: `${SITE}/api/twilio/voice`,
    VoiceMethod: 'POST',
  };

  const envLines = [];
  if (!DRY) {
    for (let i = 0; i < BROKERS.length; i++) {
      const broker = BROKERS[i];
      const number = candidates[i];
      const bought = await post('/IncomingPhoneNumbers.json', {
        PhoneNumber: number,
        FriendlyName: `Ryan Realty — ${broker.name}`,
        ...webhookCfg,
      });
      console.log(`bought ${bought.phone_number} for ${broker.name} (sid ${bought.sid})`);
      envLines.push(`TWILIO_NUMBER_${broker.slug.toUpperCase()}=${bought.phone_number}`);
    }
    // point the existing toll-free at the same webhooks
    for (const n of owned.incoming_phone_numbers) {
      await post(`/IncomingPhoneNumbers/${n.sid}.json`, webhookCfg);
      console.log(`webhooks configured on existing ${n.phone_number}`);
    }
  } else {
    console.log('[dry] would buy:', candidates.slice(0, 3), 'and configure webhooks on all owned numbers');
  }

  console.log('\n=== add to .env.local + Vercel env ===');
  for (const l of envLines) console.log(l);
  console.log('\n=== still needs human input ===');
  console.log('1. A2P 10DLC brand: business EIN (LLC). Then: TrustHub brand + campaign via API.');
  console.log('2. Port 541.703.3095: FUB account # + service address via FUB support (porting-out request).');
})().catch((e) => { console.error('PROVISION FAILED:', e.message); process.exit(1); });
