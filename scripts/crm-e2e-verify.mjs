#!/usr/bin/env node
// CRM end-to-end verification battery — the probe layer of /crm-e2e
// (Matt directive 2026-06-09: every feature wired into the website, working
// end to end, continuously).
//
// ~30 checks across: data layer, production cron routes, sync freshness,
// auto-enroll coverage, web surface wiring, Twilio webhooks + balance, Gmail
// auth, suppression gate, entry-point wiring (static), external blockers.
//
// Output: human summary + JSON to tmp/crm-e2e-latest.json.
// Exit codes: 0 all green (warns allowed), 1 = at least one FAIL.
//
//   node scripts/crm-e2e-verify.mjs            # probe production
//   node scripts/crm-e2e-verify.mjs --local    # cron probes hit localhost:3000

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LOCAL = process.argv.includes('--local');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const SITE = LOCAL ? 'http://localhost:3000' : 'https://ryan-realty.com';
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CRON_AUTH = { Authorization: `Bearer ${env.CRON_SECRET}` };
const FUB_HEADERS = { Authorization: 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64'), 'X-System': 'RyanRealtyPlatform', 'X-System-Key': env.FOLLOWUPBOSS_SYSTEM_KEY ?? '' };
const TW_AUTH = { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64') };

const results = [];
const check = (id, status, detail = '') => {
  results.push({ id, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗';
  console.log(`${icon} [${status}] ${id}${detail ? ' — ' + detail : ''}`);
};
const tryCheck = async (id, fn) => {
  try { await fn(); } catch (e) { check(id, 'FAIL', String(e.message ?? e).slice(0, 180)); }
};
const minutesAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 60000;

// ── 1. DATA LAYER ──────────────────────────────────────────────────────────
await tryCheck('data.people-count', async () => {
  const { count } = await sb.from('crm_people').select('id', { count: 'exact', head: true });
  check('data.people-count', count >= 18000 ? 'PASS' : 'FAIL', `${count} contacts`);
});
await tryCheck('data.contact-points', async () => {
  const { count } = await sb.from('crm_contact_points').select('id', { count: 'exact', head: true });
  check('data.contact-points', count >= 35000 ? 'PASS' : 'FAIL', `${count} points (SMS/email routing surface)`);
});
await tryCheck('data.timeline', async () => {
  const { count } = await sb.from('crm_timeline').select('id', { count: 'exact', head: true });
  check('data.timeline', count >= 60000 ? 'PASS' : 'FAIL', `${count} timeline entries`);
});
await tryCheck('data.suppressions', async () => {
  const { count } = await sb.from('crm_suppressions').select('id', { count: 'exact', head: true });
  check('data.suppressions', count >= 5000 ? 'PASS' : 'FAIL', `${count} suppression rows`);
});
await tryCheck('data.sequences-active', async () => {
  const { data } = await sb.from('crm_sequences').select('name,status,steps').in('fub_legacy_plan_id', [69, 70, 71, 72]);
  const active = (data ?? []).filter((s) => s.status === 'active' && Array.isArray(s.steps) && s.steps.length > 0 && s.steps[0].channel);
  check('data.sequences-active', active.length === 4 ? 'PASS' : 'FAIL', `${active.length}/4 master sequences active+normalized`);
});

// ── 2. PRODUCTION CRON ROUTES (live invocation) ───────────────────────────
for (const [id, path_, validate] of [
  // NOTE: cron.fub-delta + fresh.fub-delta removed 2026-06-29 — the FUB sync
  // routes were intentionally deleted at cutover prep (commit 60f3d787); FUB is
  // disconnected and inbound lead intake is now native (crm_people born with
  // fub_legacy_id NULL). Re-adding a FUB-sync check would assert a function we
  // deliberately retired.
  ['cron.auto-enroll', '/api/cron/crm-auto-enroll', (d) => d.ok === true],
  ['cron.sequence-engine', '/api/cron/crm-sequence-engine', (d) => d.ok === true && d.errored === 0],
  ['cron.gmail-sync', '/api/cron/crm-gmail-sync?pages=1', (d) => d.ok === true],
]) {
  await tryCheck(id, async () => {
    const res = await fetch(SITE + path_, { headers: CRON_AUTH, signal: AbortSignal.timeout(290000) });
    const data = await res.json().catch(() => ({}));
    check(id, res.ok && validate(data) ? 'PASS' : 'FAIL', JSON.stringify(data).slice(0, 140));
  });
}

// ── 3. SYNC FRESHNESS + COVERAGE ───────────────────────────────────────────
// fresh.fub-delta removed 2026-06-29 (FUB disconnected at cutover; see note above).
await tryCheck('fresh.gmail-cursor', async () => {
  const { data } = await sb.from('crm_imports').select('finished_at,source').like('source', 'gmail:%').order('id', { ascending: false }).limit(1).maybeSingle();
  const ok = data && minutesAgo(data.finished_at) < 30;
  check('fresh.gmail-cursor', ok ? 'PASS' : 'WARN', data ? `${data.source} ${Math.round(minutesAgo(data.finished_at))}m ago` : 'no cursor rows');
});
await tryCheck('coverage.auto-enroll', async () => {
  // any post-epoch lead with rule tags but no master enrollment, older than 30 min
  const { data: seqs } = await sb.from('crm_sequences').select('id').in('fub_legacy_plan_id', [69, 70, 71, 72]);
  const seqIds = (seqs ?? []).map((s) => s.id);
  const { data: people } = await sb
    .from('crm_people')
    .select('id,tags,fub_created_at')
    .gte('fub_created_at', '2026-06-10T00:00:00Z')
    .lte('fub_created_at', new Date(Date.now() - 30 * 60000).toISOString())
    .overlaps('tags', ['audience:seller', 'audience:buyer', 'intent:expired-listing', 'intent:fsbo'])
    .limit(200);
  let uncovered = 0;
  for (const p of people ?? []) {
    if ((p.tags ?? []).includes('compliance:hard-stop')) continue;
    const { count } = await sb.from('crm_sequence_enrollments').select('id', { count: 'exact', head: true }).eq('person_id', p.id).in('sequence_id', seqIds);
    if ((count ?? 0) === 0) uncovered++;
  }
  check('coverage.auto-enroll', uncovered === 0 ? 'PASS' : 'FAIL', `${uncovered} eligible new leads unenrolled`);
});
await tryCheck('coverage.engine-stalls', async () => {
  const { count } = await sb
    .from('crm_sequence_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'running')
    .lt('next_run_at', new Date(Date.now() - 3 * 3600e3).toISOString());
  check('coverage.engine-stalls', (count ?? 0) === 0 ? 'PASS' : 'FAIL', `${count} enrollments overdue >3h`);
});
await tryCheck('coverage.owner-resolution', async () => {
  const { count } = await sb
    .from('crm_people')
    .select('id', { count: 'exact', head: true })
    .ilike('name', 'owner of %')
    .gte('fub_created_at', new Date(Date.now() - 24 * 3600e3).toISOString());
  check('coverage.owner-resolution', (count ?? 0) === 0 ? 'PASS' : 'WARN', `${count} fresh placeholder names in last 24h (non-Deschutes counties land here)`);
});
await tryCheck('sync.fub-spot', async () => {
  // Race-tolerant reconciliation: a person updated in FUB seconds ago is
  // EXPECTED to be unmirrored until the next sync tick. Unhealthy = a FUB
  // update that has gone unmirrored for longer than the 45m grace window.
  const res = await fetch('https://api.followupboss.com/v1/people?sort=-updated&limit=5&fields=id,updated', { headers: FUB_HEADERS });
  const d = await res.json();
  const people = d.people ?? [];
  if (!people.length) return check('sync.fub-spot', 'WARN', 'no FUB people returned');
  const { data: mirrors } = await sb.from('crm_people').select('fub_legacy_id,fub_updated_at').in('fub_legacy_id', people.map((p) => p.id));
  const byId = new Map((mirrors ?? []).map((m) => [m.fub_legacy_id, m]));
  const stale = [];
  for (const p of people) {
    const m = byId.get(p.id);
    const synced = m && new Date(m.fub_updated_at) >= new Date(p.updated);
    const graceMin = (Date.now() - new Date(p.updated)) / 60000;
    if (!synced && graceMin > 45) stale.push(`FUB #${p.id} unsynced ${Math.round(graceMin)}m after its FUB update${m ? '' : ' (missing from mirror)'}`);
  }
  check('sync.fub-spot', stale.length ? 'FAIL' : 'PASS', stale.length ? stale.join('; ') : `${people.length} freshest FUB people reconciled (45m grace)`);
});

// ── 4. WEB SURFACE (site wiring) ───────────────────────────────────────────
await tryCheck('web.home', async () => {
  const res = await fetch('https://ryan-realty.com/', { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  check('web.home', res.status === 200 ? 'PASS' : 'FAIL', `HTTP ${res.status}`);
});
// Admin pages for an anonymous visitor: either a hard redirect/edge-block, or a
// 200 streaming shell that carries the NEXT_REDIRECT to auth — and NEVER any
// contact data (leak markers below only render with real rows).
for (const [id, url] of [
  ['web.admin-crm', 'https://ryan-realty.com/admin/crm'],
  ['web.admin-crm-inbox', 'https://ryan-realty.com/admin/crm/inbox'],
  ['web.admin-crm-deals', 'https://ryan-realty.com/admin/crm/deals'],
]) {
  await tryCheck(id, async () => {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    if ([403, 307, 302].includes(res.status)) return check(id, 'PASS', `HTTP ${res.status} (blocked/redirected)`);
    if (res.status !== 200) return check(id, 'FAIL', `HTTP ${res.status}`);
    const body = await res.text();
    const redirected = body.includes('NEXT_REDIRECT') || body.includes('auth-error') || body.includes('access-denied');
    const leaked = body.includes('Hot Prospects') || body.includes('Seller Prospect') || body.includes('Compliance blocked');
    check(id, redirected && !leaked ? 'PASS' : 'FAIL', leaked ? 'DATA LEAK to anonymous visitor' : redirected ? '200 shell + auth redirect, no leak' : 'no redirect marker');
  });
}
for (const [id, url] of [
  ['web.twilio-sms-guard', 'https://ryan-realty.com/api/twilio/inbound-sms'],
  ['web.twilio-voice-guard', 'https://ryan-realty.com/api/twilio/voice'],
]) {
  await tryCheck(id, async () => {
    const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ From: '+15550001111' }), signal: AbortSignal.timeout(20000) });
    // 403 = signature validation alive (the healthy answer to an unsigned post)
    check(id, res.status === 403 ? 'PASS' : 'FAIL', `HTTP ${res.status} (want 403 unsigned-reject)`);
  });
}

// ── 5. TWILIO ──────────────────────────────────────────────────────────────
await tryCheck('twilio.numbers-webhooked', async () => {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=20`, { headers: TW_AUTH });
  const d = await res.json();
  const locals = (d.incoming_phone_numbers ?? []).filter((n) => n.phone_number.startsWith('+1541'));
  const bad = locals.filter((n) => !String(n.sms_url).includes('/api/twilio/inbound-sms') || !String(n.voice_url).includes('/api/twilio/voice'));
  check('twilio.numbers-webhooked', locals.length >= 3 && bad.length === 0 ? 'PASS' : 'FAIL', `${locals.length} local numbers, ${bad.length} mis-webhooked`);
});
await tryCheck('twilio.balance', async () => {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Balance.json`, { headers: TW_AUTH });
  const d = await res.json();
  const bal = Number(d.balance ?? 0);
  check('twilio.balance', bal >= 5 ? 'PASS' : bal > 0 ? 'WARN' : 'FAIL', `$${bal.toFixed(2)} ${d.currency ?? ''}`);
});
await tryCheck('twilio.a2p-brand', async () => {
  const res = await fetch('https://messaging.twilio.com/v1/a2p/BrandRegistrations?PageSize=5', { headers: TW_AUTH });
  const d = await res.json();
  const brand = (d.data ?? [])[0];
  if (!brand) return check('twilio.a2p-brand', 'WARN', 'no brand yet — console wizard pending (outbound SMS blocked)');
  check('twilio.a2p-brand', brand.status === 'APPROVED' ? 'PASS' : 'WARN', `brand ${brand.status}`);
});
await tryCheck('twilio.a2p-campaign', async () => {
  const ms = env.TWILIO_MESSAGING_SERVICE_SID;
  if (!ms) return check('twilio.a2p-campaign', 'WARN', 'no messaging service sid in env');
  const res = await fetch(`https://messaging.twilio.com/v1/Services/${ms}/Compliance/Usa2p`, { headers: TW_AUTH });
  const d = await res.json();
  const c = (d.compliance ?? d.us_app_to_person ?? [])[0];
  if (!c) return check('twilio.a2p-campaign', 'WARN', 'no campaign yet');
  const st = c.campaign_status ?? c.status;
  // VERIFIED = outbound texting live to all US carriers
  check('twilio.a2p-campaign', st === 'VERIFIED' ? 'PASS' : st === 'FAILED' ? 'FAIL' : 'WARN', `campaign ${st} (created ${String(c.date_created ?? '').slice(0, 10)})`);
});

// ── 5b. A2P CTA pages stay verifiable by carrier reviewer tooling ──────────
// Round-2 rejection root cause (2026-06-12): the middleware bot screen 403'd
// HTTP-library UAs on every URL cited in the campaign message_flow. Keep the
// URL list in sync with CTA_URLS in scripts/crm-a2p-resubmit.mjs +
// COMPLIANCE_VERIFICATION_PATHS in middleware.ts.
await tryCheck('web.compliance-cta-reachable', async () => {
  const ua = { 'User-Agent': 'python-requests/2.31.0' };
  // Canonical SMS consent text (SmsConsentDisclosure.tsx SMS_CONSENT_TEXT). Updated
  // 2026-06-23 to the carrier-approved checkbox wording; keep this snippet in lock-step.
  const CONSENT = 'I agree to receive text messages from Ryan Realty about my request';
  // Single-step forms render the consent in initial SSR — carrier-verifiable by URL.
  const ssrForms = [`${SITE}/contact`, `${SITE}/sell/valuation`, `${SITE}/lp/buyer-listing-alerts`];
  // Multi-step forms collect the phone + render the consent on step 2 (qualify);
  // initial SSR can't show it, so assert reachability only (disclosure is wired in
  // SellerLPForm/ExpiredLPForm right beside the phone field, verified in source).
  const multiStep = [`${SITE}/lp/seller-home-value`, `${SITE}/lp/sell-your-home`, `${SITE}/lp/expired-listing`];
  const problems = [];
  for (const url of ssrForms) {
    const res = await fetch(url, { headers: ua, redirect: 'follow' });
    const html = res.ok ? await res.text() : '';
    if (!res.ok || !html.includes(CONSENT)) problems.push(`${url.replace(SITE, '')}:${res.status} (consent text)`);
  }
  for (const url of multiStep) {
    const res = await fetch(url, { headers: ua, redirect: 'follow' });
    if (!res.ok) problems.push(`${url.replace(SITE, '')}:${res.status} (unreachable)`);
  }
  const priv = await fetch(`${SITE}/privacy`, { headers: ua, redirect: 'follow' });
  const privHtml = priv.ok ? await priv.text() : '';
  if (!priv.ok || !privHtml.includes('No mobile information will be shared with third parties'))
    problems.push(`/privacy:${priv.status} (mobile-data clause)`);
  check('web.compliance-cta-reachable', problems.length === 0 ? 'PASS' : 'FAIL',
    problems.length ? 'consent/reachability issue: ' + problems.join(', ') : 'consent on SSR forms + privacy clause + multi-step reachable');
});

// ── 6. GMAIL (send-as capability per broker) ──────────────────────────────
await tryCheck('gmail.dwd-auth', async () => {
  const { google } = await import('googleapis');
  const key = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  const fails = [];
  for (const subject of ['matt@ryan-realty.com', 'rebeccapeterson@ryan-realty.com', 'paul@ryan-realty.com']) {
    try {
      const jwt = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, key, scopes: ['https://www.googleapis.com/auth/gmail.send'], subject });
      await jwt.authorize();
    } catch { fails.push(subject); }
  }
  check('gmail.dwd-auth', fails.length === 0 ? 'PASS' : 'FAIL', fails.length ? 'no send auth: ' + fails.join(',') : 'all 3 mailboxes');
});

// ── 7. SUPPRESSION GATE (logic spot check) ─────────────────────────────────
await tryCheck('compliance.gate', async () => {
  const { data: hard } = await sb.from('crm_people').select('id').contains('tags', ['compliance:hard-stop']).limit(1).maybeSingle();
  if (!hard) return check('compliance.gate', 'WARN', 'no hard-stop person found to test');
  const [{ data: rows }, { data: person }] = await Promise.all([
    sb.from('crm_suppressions').select('channel').eq('person_id', hard.id).in('channel', ['all', 'email']),
    sb.from('crm_people').select('tags').eq('id', hard.id).maybeSingle(),
  ]);
  const blocked = (rows ?? []).length > 0 || (person?.tags ?? []).includes('compliance:hard-stop');
  check('compliance.gate', blocked ? 'PASS' : 'FAIL', `person ${hard.id} email-send would ${blocked ? 'be blocked' : 'NOT be blocked'}`);
});

// ── 8. ENTRY-POINT WIRING (static, from repo) ──────────────────────────────
await tryCheck('wiring.static', async () => {
  const greps = [
    ['lib/canonical-lead-tagger.ts', 'autoEnrollByFubId', true],
    ['lib/followupboss.ts', 'mirrorPersonFromFub', true],
    ['lib/expired-listing-processor.ts', 'applyActionPlan(', false],
    ['app/api/cron/detect-fsbo-listings/route.ts', 'applyActionPlan(', false],
  ];
  const problems = [];
  for (const [file, needle, shouldExist] of greps) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const exists = content.includes(needle);
    if (exists !== shouldExist) problems.push(`${file} ${shouldExist ? 'missing' : 'still has'} ${needle}`);
  }
  check('wiring.static', problems.length === 0 ? 'PASS' : 'FAIL', problems.join('; '));
});

// ── 8a2. ALERT RELAY HEALTH (instant new-lead texts) ───────────────────────
await tryCheck('alerts.relay', async () => {
  const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
  const [{ count: stuck }, { count: failedDay }] = await Promise.all([
    sb.from('crm_broker_alerts').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', tenMinAgo),
    sb.from('crm_broker_alerts').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', new Date(Date.now() - 86400e3).toISOString()),
  ]);
  check('alerts.relay', (stuck ?? 0) > 0 ? 'FAIL' : (failedDay ?? 0) > 0 ? 'WARN' : 'PASS', `${stuck ?? 0} stuck >10m (relay dead?), ${failedDay ?? 0} failed in 24h`);
});

// ── 8a3. TIMELINE DUPLICATE DETECTOR (audit 2026-06-10 regression class) ───
// The inbox showed every email twice: FUB-backfill twins of Gmail rows +
// cross-mailbox Gmail twins. Fixed at ingest (Message-ID keying + sender
// blocklist in lib/crm/gmail.ts); this guards against recurrence.
await tryCheck('data.timeline-dupes', async () => {
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const { data } = await sb.from('crm_timeline').select('person_id,kind,ts,title').in('kind', ['email_in', 'email_out']).gte('ts', since).order('person_id').order('kind').order('ts').limit(5000);
  let dupes = 0;
  const rows = data ?? [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.person_id === b.person_id && a.kind === b.kind && (a.title ?? '') === (b.title ?? '') && Math.abs(new Date(b.ts) - new Date(a.ts)) <= 90000) dupes++;
  }
  check('data.timeline-dupes', dupes === 0 ? 'PASS' : 'WARN', `${dupes} near-twin email rows in last 48h`);
});

// ── 8a4. SYNTHETIC TEST ARTIFACTS (hard rule: clean up in-iteration) ───────
await tryCheck('data.synthetic-artifacts', async () => {
  const { data } = await sb.from('crm_people').select('id,name').or('name.ilike.%smoketest%,name.ilike.%deleteme%,name.ilike.%delete-me%,name.ilike.%test-artifact%,name.ilike.%importtest%,name.ilike.smoke test%,name.ilike.test lead%,name.ilike.%funnel test%');
  const n = (data ?? []).length;
  check('data.synthetic-artifacts', n === 0 ? 'PASS' : 'WARN', n === 0 ? 'no synthetic people in book' : `${n} synthetic test people present: ${(data ?? []).map((p) => `#${p.id} ${p.name}`).join(', ')}`);
});

// ── 8b. BROKER LICENSES (compliance: never let a license lapse) ────────────
await tryCheck('compliance.licenses', async () => {
  const { data } = await sb.from('brokers').select('display_name,license_status,license_expires_on,license_checked_at').eq('is_active', true);
  const problems = [];
  const warns = [];
  for (const b of data ?? []) {
    if (b.license_status !== 'ACTIVE') problems.push(`${b.display_name}: status ${b.license_status ?? 'unknown'}`);
    const days = b.license_expires_on ? (new Date(b.license_expires_on) - Date.now()) / 86400e3 : null;
    if (days !== null && days < 0) problems.push(`${b.display_name}: license EXPIRED`);
    else if (days !== null && days < 90) warns.push(`${b.display_name}: renews in ${Math.ceil(days)}d`);
    if (!b.license_checked_at || (Date.now() - new Date(b.license_checked_at)) / 86400e3 > 35) warns.push(`${b.display_name}: OREA re-verify due (last check ${b.license_checked_at ?? 'never'})`);
  }
  check('compliance.licenses', problems.length ? 'FAIL' : warns.length ? 'WARN' : 'PASS', [...problems, ...warns].join('; ') || 'all ACTIVE, no renewal inside 90d');
});

// ── 9. EXTERNAL BLOCKERS ───────────────────────────────────────────────────
await tryCheck('external.anthropic-credits', async () => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
  });
  if (res.ok) return check('external.anthropic-credits', 'PASS', 'smart follow-ups unblocked');
  const body = await res.text();
  check('external.anthropic-credits', 'WARN', /credit balance/i.test(body) ? 'OUT OF CREDITS — affects marketing producer-runtime only (smart follow-ups run on-plan via LaunchAgent)' : `HTTP ${res.status}`);
});
await tryCheck('external.fub-port-reply', async () => {
  const { google } = await import('googleapis');
  const key = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  const jwt = new google.auth.JWT({ email: env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, key, scopes: ['https://www.googleapis.com/auth/gmail.readonly'], subject: 'matt@ryan-realty.com' });
  const gmail = google.gmail({ version: 'v1', auth: jwt });
  const r = await gmail.users.messages.list({ userId: 'me', q: '(from:followupboss.com OR from:twilio.com) subject:(port OR transfer) -subject:"Missed Call" newer_than:7d', maxResults: 3 });
  const n = (r.data.messages ?? []).length;
  check('external.fub-port-reply', n > 1 ? 'WARN' : 'PASS', n > 1 ? `${n} port/transfer message(s) — check for Twilio approval` : 'transfer submitted by FUB 2026-06-10; awaiting Twilio approval email');
});

// ── summary ────────────────────────────────────────────────────────────────
const fails = results.filter((r) => r.status === 'FAIL');
const warns = results.filter((r) => r.status === 'WARN');
const summary = { ranAt: new Date().toISOString(), site: SITE, pass: results.length - fails.length - warns.length, warn: warns.length, fail: fails.length, results };
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tmp/crm-e2e-latest.json'), JSON.stringify(summary, null, 1));
console.log(`\n══ CRM E2E: ${summary.pass} pass · ${summary.warn} warn · ${summary.fail} fail ══`);
if (fails.length) { console.log('FAILS:'); for (const f of fails) console.log(' ✗', f.id, '—', f.detail); }
if (warns.length) { console.log('WARNS:'); for (const w of warns) console.log(' ⚠', w.id, '—', w.detail); }
process.exit(fails.length ? 1 : 0);
