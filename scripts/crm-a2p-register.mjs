#!/usr/bin/env node
// A2P 10DLC registration for Ryan Realty LLC (blueprint §5.5 / §6).
// Low-Volume Standard brand (EIN-backed, skip secondary vetting) + Messaging
// Service wiring. Re-runnable: state persists in tmp/a2p-state.json and every
// step checks before creating.
//
//   node scripts/crm-a2p-register.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE_PATH = path.join(ROOT, 'tmp/a2p-state.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
const state = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 1));

const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const AUTH = 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

const BIZ = {
  legalName: 'Ryan Realty LLC',
  ein: '82-4802553',
  website: 'https://ryan-realty.com',
  street: '115 NW Oregon Avenue',
  city: 'Bend',
  region: 'OR',
  zip: '97703',
  contactFirst: 'Matt',
  contactLast: 'Ryan',
  contactEmail: 'matt@ryan-realty.com',
  contactPhone: '+15412136706',
};

async function api(method, url, form) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}
const TH = 'https://trusthub.twilio.com/v1';
const MSG = 'https://messaging.twilio.com/v1';

(async () => {
  // 0. policies
  if (!state.policies || !Object.keys(state.policies).some((n) => /secondary customer profile/i.test(n))) {
    state.policies = {};
    let url = `${TH}/Policies?PageSize=100`;
    while (url) {
      const pol = await api('GET', url);
      for (const r of pol.results) state.policies[r.friendly_name] = r.sid;
      url = pol.meta?.next_page_url ?? null;
    }
    save();
  }
  console.log('relevant policies:', Object.fromEntries(Object.entries(state.policies).filter(([n]) => /customer profile|a2p/i.test(n))));
  const SECONDARY = Object.entries(state.policies).find(([n]) => /secondary customer profile/i.test(n))?.[1];
  const A2P_POLICY = Object.entries(state.policies).find(([n]) => /a2p messaging/i.test(n))?.[1];
  if (!SECONDARY || !A2P_POLICY) throw new Error('policy sids not found');

  // 1. secondary customer profile
  if (!state.profileSid) {
    const p = await api('POST', `${TH}/CustomerProfiles`, {
      FriendlyName: 'Ryan Realty LLC — Secondary Customer Profile',
      Email: BIZ.contactEmail,
      PolicySid: SECONDARY,
    });
    state.profileSid = p.sid; save();
  }
  console.log('profile:', state.profileSid);

  // 2. business info end user
  if (!state.bizEndUser) {
    const eu = await api('POST', `${TH}/EndUsers`, {
      FriendlyName: 'Ryan Realty business information',
      Type: 'customer_profile_business_information',
      Attributes: JSON.stringify({
        business_name: BIZ.legalName,
        business_identity: 'direct_customer',
        business_type: 'Limited Liability Corporation',
        business_industry: 'REAL_ESTATE',
        business_registration_identifier: 'EIN',
        business_registration_number: BIZ.ein,
        business_regions_of_operation: 'USA_AND_CANADA',
        website_url: BIZ.website,
        social_media_profile_urls: '',
      }),
    });
    state.bizEndUser = eu.sid; save();
  }
  // 3. authorized representative
  if (!state.repEndUser) {
    const eu = await api('POST', `${TH}/EndUsers`, {
      FriendlyName: 'Ryan Realty authorized representative',
      Type: 'authorized_representative_1',
      Attributes: JSON.stringify({
        first_name: BIZ.contactFirst,
        last_name: BIZ.contactLast,
        email: BIZ.contactEmail,
        phone_number: BIZ.contactPhone,
        business_title: 'Owner',
        job_position: 'CEO',
      }),
    });
    state.repEndUser = eu.sid; save();
  }
  // 4. address + supporting document
  if (!state.addressSid) {
    const a = await api('POST', `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Addresses.json`, {
      CustomerName: BIZ.legalName,
      Street: BIZ.street,
      City: BIZ.city,
      Region: BIZ.region,
      PostalCode: BIZ.zip,
      IsoCountry: 'US',
      FriendlyName: 'Ryan Realty office',
    });
    state.addressSid = a.sid; save();
  }
  if (!state.docSid) {
    const d = await api('POST', `${TH}/SupportingDocuments`, {
      FriendlyName: 'Ryan Realty address',
      Type: 'customer_profile_address',
      Attributes: JSON.stringify({ address_sids: state.addressSid }),
    });
    state.docSid = d.sid; save();
  }
  // 5. assignments
  state.assigned = state.assigned ?? [];
  for (const objectSid of [state.bizEndUser, state.repEndUser, state.docSid]) {
    if (!state.assigned.includes(objectSid)) {
      await api('POST', `${TH}/CustomerProfiles/${state.profileSid}/EntityAssignments`, { ObjectSid: objectSid })
        .catch((e) => { if (!/already|duplicate/i.test(e.message)) throw e; });
      state.assigned.push(objectSid); save();
    }
  }
  // 6. evaluate + submit
  if (state.profileStatus !== 'pending-review' && state.profileStatus !== 'twilio-approved') {
    const ev = await api('POST', `${TH}/CustomerProfiles/${state.profileSid}/Evaluations`, { PolicySid: SECONDARY });
    console.log('profile evaluation:', ev.status);
    if (ev.status !== 'compliant') {
      console.log(JSON.stringify(ev.results?.filter((r) => !r.passed) ?? ev, null, 1).slice(0, 1500));
      throw new Error('customer profile not compliant — see failed requirements above');
    }
    const upd = await api('POST', `${TH}/CustomerProfiles/${state.profileSid}`, { Status: 'pending-review' });
    state.profileStatus = upd.status; save();
  }
  console.log('profile status:', state.profileStatus);

  // 7. A2P trust product
  if (!state.trustProductSid) {
    const tp = await api('POST', `${TH}/TrustProducts`, {
      FriendlyName: 'Ryan Realty A2P Messaging Profile',
      Email: BIZ.contactEmail,
      PolicySid: A2P_POLICY,
    });
    state.trustProductSid = tp.sid; save();
  }
  if (!state.a2pEndUser) {
    const eu = await api('POST', `${TH}/EndUsers`, {
      FriendlyName: 'Ryan Realty A2P profile info',
      Type: 'us_a2p_messaging_profile_information',
      Attributes: JSON.stringify({ company_type: 'private' }),
    });
    state.a2pEndUser = eu.sid; save();
  }
  state.tpAssigned = state.tpAssigned ?? [];
  for (const objectSid of [state.a2pEndUser, state.profileSid]) {
    if (!state.tpAssigned.includes(objectSid)) {
      await api('POST', `${TH}/TrustProducts/${state.trustProductSid}/EntityAssignments`, { ObjectSid: objectSid })
        .catch((e) => { if (!/already|duplicate/i.test(e.message)) throw e; });
      state.tpAssigned.push(objectSid); save();
    }
  }
  if (state.trustProductStatus !== 'pending-review' && state.trustProductStatus !== 'twilio-approved') {
    const ev = await api('POST', `${TH}/TrustProducts/${state.trustProductSid}/Evaluations`, { PolicySid: A2P_POLICY });
    console.log('trust product evaluation:', ev.status);
    if (ev.status !== 'compliant') {
      console.log(JSON.stringify(ev.results?.filter((r) => !r.passed) ?? ev, null, 1).slice(0, 1500));
      throw new Error('A2P trust product not compliant');
    }
    const upd = await api('POST', `${TH}/TrustProducts/${state.trustProductSid}`, { Status: 'pending-review' });
    state.trustProductStatus = upd.status; save();
  }
  console.log('trust product status:', state.trustProductStatus);

  // 8. brand registration (Low-Volume Standard: skip secondary vetting)
  if (!state.brandSid) {
    const b = await api('POST', `${MSG}/a2p/BrandRegistrations`, {
      CustomerProfileBundleSid: state.profileSid,
      A2PProfileBundleSid: state.trustProductSid,
      SkipAutomaticSecVet: 'true',
    });
    state.brandSid = b.sid; state.brandStatus = b.status; save();
  }
  const brand = await api('GET', `${MSG}/a2p/BrandRegistrations/${state.brandSid}`);
  state.brandStatus = brand.status; save();
  console.log('brand:', state.brandSid, 'status:', brand.status, brand.failure_reason ?? '');

  // 9. messaging service + numbers (independent of brand approval)
  if (!state.messagingServiceSid) {
    const ms = await api('POST', `${MSG}/Services`, {
      FriendlyName: 'Ryan Realty CRM',
      InboundRequestUrl: 'https://ryan-realty.com/api/twilio/inbound-sms',
      InboundMethod: 'POST',
      UseInboundWebhookOnNumber: 'true',
    });
    state.messagingServiceSid = ms.sid; save();
  }
  console.log('messaging service:', state.messagingServiceSid);
  if (!state.numbersAttached) {
    const owned = await api('GET', `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=20`);
    for (const n of owned.incoming_phone_numbers) {
      if (n.phone_number.startsWith('+1541')) {
        await api('POST', `${MSG}/Services/${state.messagingServiceSid}/PhoneNumbers`, { PhoneNumberSid: n.sid })
          .catch((e) => { if (!/already|409/i.test(e.message)) throw e; });
        console.log('attached', n.phone_number);
      }
    }
    state.numbersAttached = true; save();
  }

  // 10. campaign (requires brand APPROVED — re-run this script when it is)
  if (brand.status === 'APPROVED' && !state.campaignSid) {
    const c = await api('POST', `${MSG}/Services/${state.messagingServiceSid}/Compliance/Usa2p`, {
      BrandRegistrationSid: state.brandSid,
      UsAppToPersonUsecase: 'LOW_VOLUME',
      Description: 'Ryan Realty is a residential real estate brokerage in Bend, Oregon. We text our clients and leads about home valuations they requested, property updates, showing scheduling, and follow-ups to their inquiries.',
      'MessageSamples': 'Hi %first%, this is Matt Ryan with Ryan Realty. Got your home value request for %address%. Your report will be in your inbox shortly. If you would rather not get texts, reply STOP.',
      MessageFlow: 'Contacts opt in by submitting a form on ryan-realty.com that states they agree to receive texts, by texting our business number first, or by giving verbal consent during a call with their broker. Opt-out via STOP is honored automatically.',
      HasEmbeddedLinks: 'true',
      HasEmbeddedPhone: 'true',
      OptOutKeywords: 'STOP',
      OptOutMessage: 'You have been unsubscribed from Ryan Realty texts. Reply START to resubscribe.',
      HelpMessage: 'Ryan Realty: reply STOP to unsubscribe. For help call 541.213.6706.',
      SubscriberOptIn: 'true',
    });
    state.campaignSid = c.sid; save();
    console.log('campaign created:', c.sid, c.campaign_status);
  } else if (brand.status !== 'APPROVED') {
    console.log('campaign: waiting for brand approval (re-run this script once APPROVED)');
  }

  console.log('\nA2P STATE:', JSON.stringify(state, null, 1));
})().catch((e) => { console.error('A2P FAILED at step:', e.message); save(); process.exit(1); });
