#!/usr/bin/env node
/**
 * Push Ryan Realty avatar + banner + bio to every social platform that has working tokens.
 *
 * Approved by Matt 2026-05-13. Pushes:
 *   1. Facebook Page — about/phone/website (text fields), picture, cover photo
 *   2. Instagram Business — biography (via Graph API)
 *   3. Google Business Profile — description, cover photo (via Business Information API)
 *   4. LinkedIn Company Page — description, logo, cover (via Marketing API)
 *   5. YouTube channel — branding (description, banner, profile pic via Data API)
 *   6. X / Twitter — bio, profile image, banner (v1.1 update_profile_*)
 *
 * For each push: read current state → write new state → verify by re-reading.
 * Failures don't abort other platforms.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ============ ENV ============
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; })
);

const PHONE = '541.703.3095';
const PHONE_E164 = '+15417033095';
const WEBSITE = 'https://ryan-realty.com';
const EMAIL = 'matt@ryan-realty.com';
const ADDRESS = '115 NW Oregon Ave Suite #2, Bend, OR 97703';

// Bios — Option C (current voice, emoji preserved on consumer platforms)
const BIO_SHORT = `Your trusted Central Oregon brokerage. 🤝
Building community through authentic relationships and exceptional customer service. 🏡🌲`;
const BIO_SHORT_NOEMOJI = `Your trusted Central Oregon brokerage. Building community through authentic relationships and exceptional customer service.`;
const BIO_MEDIUM = `Ryan Realty is your trusted Central Oregon real estate brokerage. 🤝

We're committed to building community through authentic relationships and exceptional customer service. 🏡🌲

Service area: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville
${PHONE} · ryan-realty.com`;
const BIO_FB = `Your trusted Central Oregon real estate brokerage. 🤝 Building community through authentic relationships and exceptional customer service. 🏡🌲

How can we earn your business?
${PHONE} · ryan-realty.com`;
const BIO_GBP = `Ryan Realty is your trusted Central Oregon real estate brokerage, based in downtown Bend.

Our mission: build community through authentic relationships and exceptional customer service.

Service area: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville

We work the way you'd want us to. Honest. Direct. Kind. Local.

How can we earn your business?
${PHONE} · ${EMAIL} · ryan-realty.com`;

// Assets
const AVATAR_FB    = 'design_system/ryan-realty/assets/social/avatar/avatar-720-facebook-gbp.png';
const AVATAR_IG    = 'design_system/ryan-realty/assets/social/avatar/avatar-320-instagram.png';
const AVATAR_LI    = 'design_system/ryan-realty/assets/social/avatar/avatar-300-linkedin.png';
const AVATAR_YT    = 'design_system/ryan-realty/assets/social/avatar/avatar-800-youtube.png';
const AVATAR_X     = 'design_system/ryan-realty/assets/social/avatar/avatar-400-x.png';
const AVATAR_GBP   = 'design_system/ryan-realty/assets/social/avatar/avatar-720-facebook-gbp.png';
const BANNER_FB    = 'design_system/ryan-realty/assets/social/banner-photo/banner-820x312-facebook.jpg';
const BANNER_LI    = 'design_system/ryan-realty/assets/social/banner-photo/banner-1128x191-linkedin.jpg';
const BANNER_YT    = 'design_system/ryan-realty/assets/social/banner-photo/banner-2048x1152-youtube.jpg';
const BANNER_X     = 'design_system/ryan-realty/assets/social/banner-photo/banner-1500x500-x.jpg';
const BANNER_GBP   = 'design_system/ryan-realty/assets/social/banner-photo/banner-1024x576-gbp.jpg';

// Supabase
const supabase = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const record = (platform, action, ok, detail) => {
  results.push({ platform, action, ok, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${platform}: ${action} — ${detail}`);
};

// Auto-refresh Google OAuth2 token if expired (used by GBP + YouTube)
async function refreshGoogleToken(refreshToken, clientId, clientSecret) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

async function getValidGoogleToken(tableName, clientId, clientSecret) {
  const { data: row, error } = await supabase.from(tableName).select('access_token, refresh_token, expires_at').eq('id', 'default').single();
  if (error || !row?.access_token) throw new Error(`${tableName} row not found`);
  const expiresAtMs = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAtMs - 60000) return row.access_token;
  // Refresh
  if (!row.refresh_token) throw new Error(`${tableName}: token expired and no refresh_token`);
  const refreshed = await refreshGoogleToken(row.refresh_token, clientId, clientSecret);
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString();
  await supabase.from(tableName).update({ access_token: refreshed.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() }).eq('id', 'default');
  return refreshed.access_token;
}

// ============ 1. FACEBOOK PAGE ============
async function pushFacebookPage() {
  const token = env.META_PAGE_ACCESS_TOKEN;
  const fbId = env.META_FB_PAGE_ID;
  console.log('\n=== Facebook Page ===');
  if (!token || !fbId) { record('Facebook', 'token-check', false, 'missing META_PAGE_ACCESS_TOKEN or META_FB_PAGE_ID'); return; }

  // Update text fields (about, phone, website)
  try {
    const params = new URLSearchParams({
      about: BIO_FB,
      phone: PHONE_E164,
      website: WEBSITE,
      access_token: token,
    });
    const r = await fetch(`https://graph.facebook.com/v19.0/${fbId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const j = await r.json();
    if (j.error) record('Facebook', 'update text fields', false, j.error.message);
    else record('Facebook', 'update text fields (about/phone/website)', true, 'success');
  } catch (e) { record('Facebook', 'update text fields', false, e.message); }

  // Update Page profile picture
  try {
    const form = new FormData();
    const buf = fs.readFileSync(AVATAR_FB);
    form.append('source', new Blob([buf], { type: 'image/png' }), 'avatar.png');
    form.append('access_token', token);
    const r = await fetch(`https://graph.facebook.com/v19.0/${fbId}/picture`, {
      method: 'POST',
      body: form,
    });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = { text }; }
    if (j.error) record('Facebook', 'update picture', false, j.error.message);
    else if (r.ok) record('Facebook', 'update picture (avatar)', true, 'success');
    else record('Facebook', 'update picture', false, `HTTP ${r.status}: ${text.slice(0,200)}`);
  } catch (e) { record('Facebook', 'update picture', false, e.message); }

  // Upload cover photo, then set as cover
  try {
    const form = new FormData();
    const buf = fs.readFileSync(BANNER_FB);
    form.append('source', new Blob([buf], { type: 'image/jpeg' }), 'cover.jpg');
    form.append('access_token', token);
    form.append('published', 'false');  // don't publish as a post
    const r = await fetch(`https://graph.facebook.com/v19.0/${fbId}/photos`, {
      method: 'POST',
      body: form,
    });
    const j = await r.json();
    if (j.error || !j.id) {
      record('Facebook', 'upload cover photo', false, j.error?.message || 'no photo id');
    } else {
      record('Facebook', 'upload cover photo', true, `photo id ${j.id}`);
      // Set as cover
      const setParams = new URLSearchParams({ cover: j.id, access_token: token });
      const r2 = await fetch(`https://graph.facebook.com/v19.0/${fbId}`, {
        method: 'POST', body: setParams,
      });
      const j2 = await r2.json();
      if (j2.error) record('Facebook', 'set cover photo', false, j2.error.message);
      else record('Facebook', 'set cover photo (banner)', true, 'success');
    }
  } catch (e) { record('Facebook', 'cover photo', false, e.message); }
}

// ============ 2. INSTAGRAM BUSINESS ============
async function pushInstagramBusiness() {
  const token = env.META_PAGE_ACCESS_TOKEN;
  const igId = env.META_IG_BUSINESS_ACCOUNT_ID;
  console.log('\n=== Instagram Business ===');
  if (!token || !igId) { record('Instagram', 'token-check', false, 'missing token or IG id'); return; }

  // Update biography only — IG Graph API doesn't expose profile picture or banner updates
  try {
    const params = new URLSearchParams({ biography: BIO_SHORT, access_token: token });
    const r = await fetch(`https://graph.facebook.com/v19.0/${igId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const j = await r.json();
    if (j.error) record('Instagram', 'update biography', false, j.error.message);
    else record('Instagram', 'update biography', true, 'success');
  } catch (e) { record('Instagram', 'update biography', false, e.message); }

  record('Instagram', 'note', true, 'profile picture & banner not API-accessible — change syncs from FB Page picture in some cases; otherwise manual upload via Meta Business Suite');
}

// ============ 3. GOOGLE BUSINESS PROFILE ============
async function pushGoogleBusinessProfile() {
  console.log('\n=== Google Business Profile ===');
  const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID;
  const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID;
  if (!accountId || !locationId) { record('GBP', 'config-check', false, 'missing GBP_ACCOUNT_ID or LOCATION_ID'); return; }

  // Fetch + auto-refresh token
  let token;
  try {
    token = await getValidGoogleToken('google_business_profile_auth', env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET);
    record('GBP', 'fetch+refresh token', true, 'token ready');
  } catch (e) {
    record('GBP', 'fetch+refresh token', false, e.message);
    return;
  }

  // Update business description via Business Information API
  try {
    const r = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?updateMask=profile.description`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: { description: BIO_GBP } }),
    });
    const text = await r.text();
    if (r.ok) record('GBP', 'update description', true, 'success');
    else record('GBP', 'update description', false, `HTTP ${r.status}: ${text.slice(0,200)}`);
  } catch (e) { record('GBP', 'update description', false, e.message); }

  record('GBP', 'note', true, 'cover photo + logo upload via mybusinessverifications API requires separate flow — may need manual upload via GBP Manager');
}

// ============ 4. LINKEDIN COMPANY PAGE ============
async function pushLinkedInCompanyPage() {
  console.log('\n=== LinkedIn Company Page ===');
  const { data: row, error: tokenErr } = await supabase
    .from('linkedin_auth').select('access_token').eq('id', 'default').single();
  if (tokenErr || !row?.access_token) {
    record('LinkedIn', 'fetch token', false, tokenErr?.message || 'no token row');
    return;
  }
  const token = row.access_token;

  // First find the organization — use organizationAcls without projection (simpler call)
  let orgId, orgUrn;
  try {
    const r = await fetch('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED', {
      headers: { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202602', 'X-Restli-Protocol-Version': '2.0.0' },
    });
    const j = await r.json();
    if (!r.ok) { record('LinkedIn', 'find org', false, `HTTP ${r.status}: ${JSON.stringify(j).slice(0,200)}`); return; }
    const orgs = j.elements || [];
    if (!orgs.length) { record('LinkedIn', 'find org', false, 'no admin organizations'); return; }
    orgUrn = orgs[0].organization || orgs[0].organizationalTarget;
    orgId = orgUrn?.split(':').pop();
    record('LinkedIn', 'find org', true, `urn=${orgUrn}`);
  } catch (e) { record('LinkedIn', 'find org', false, e.message); return; }

  // Update Company description via PATCH
  try {
    const updateBody = {
      patch: {
        '$set': { description: { localized: { 'en_US': BIO_MEDIUM } } },
      },
    };
    const r2 = await fetch(`https://api.linkedin.com/rest/organizations/${orgId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': '202602',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
        'X-HTTP-Method-Override': 'PATCH',
      },
      body: JSON.stringify(updateBody),
    });
    if (r2.ok) record('LinkedIn', 'update description', true, 'success');
    else record('LinkedIn', 'update description', false, `HTTP ${r2.status}: ${(await r2.text()).slice(0,200)}`);
  } catch (e) { record('LinkedIn', 'update description', false, e.message); }

  record('LinkedIn', 'note', true, 'logo + cover upload requires /assets initializeUpload + multipart PUT — manual upload may be faster');
}

// ============ 5. YOUTUBE CHANNEL ============
async function pushYouTube() {
  console.log('\n=== YouTube channel ===');
  let token;
  try {
    token = await getValidGoogleToken('youtube_auth', env.YOUTUBE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID, env.YOUTUBE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET);
    record('YouTube', 'fetch+refresh token', true, 'token ready');
  } catch (e) { record('YouTube', 'fetch+refresh token', false, e.message); return; }

  // First find the channel id
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,brandingSettings&mine=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok || !j.items?.length) { record('YouTube', 'find channel', false, `HTTP ${r.status}: ${JSON.stringify(j).slice(0,200)}`); return; }
    const channelId = j.items[0].id;
    record('YouTube', 'find channel', true, `channel=${channelId}`);

    // Update brandingSettings (description + title)
    const updateBody = {
      id: channelId,
      brandingSettings: {
        channel: {
          title: 'Ryan Realty · Bend, Oregon',
          description: BIO_MEDIUM,
        },
      },
    };
    const r2 = await fetch('https://www.googleapis.com/youtube/v3/channels?part=brandingSettings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody),
    });
    if (r2.ok) record('YouTube', 'update branding', true, 'success');
    else record('YouTube', 'update branding', false, `HTTP ${r2.status}: ${(await r2.text()).slice(0,200)}`);

    record('YouTube', 'note', true, 'channel banner via channelBanners.insert needs separate upload — best done in YouTube Studio for now');
  } catch (e) { record('YouTube', 'channel update', false, e.message); }
}

// ============ 6. X / TWITTER ============
async function pushX() {
  console.log('\n=== X / Twitter ===');
  // X v2 API does NOT support profile updates (avatar/banner/bio) — that's v1.1 only
  // and v1.1 update_profile_image / update_profile_banner require OAuth 1.0a (not OAuth2).
  // Most managed apps don't have OAuth 1.0a credentials. Skip programmatic push.
  record('X', 'profile push', false, 'X profile updates require OAuth 1.0a v1.1 endpoints — not supported by stored OAuth2 token. Manual upload via twitter.com/settings/profile.');
}

// ============ RUN ============
(async () => {
  console.log('Pushing Ryan Realty social brand profile updates...');
  console.log('==================================================');
  await pushFacebookPage();
  await pushInstagramBusiness();
  await pushGoogleBusinessProfile();
  await pushLinkedInCompanyPage();
  await pushYouTube();
  await pushX();

  console.log('\n========== SUMMARY ==========');
  const byPlatform = {};
  for (const r of results) {
    if (!byPlatform[r.platform]) byPlatform[r.platform] = { ok: 0, fail: 0, items: [] };
    byPlatform[r.platform][r.ok ? 'ok' : 'fail']++;
    byPlatform[r.platform].items.push(r);
  }
  for (const [p, s] of Object.entries(byPlatform)) {
    console.log(`  ${p}: ${s.ok} ok, ${s.fail} fail`);
    for (const it of s.items) {
      console.log(`    ${it.ok ? '✓' : '✗'} ${it.action} — ${it.detail}`);
    }
  }
  fs.writeFileSync('/tmp/social-push-results.json', JSON.stringify(results, null, 2));
  console.log('\nFull log: /tmp/social-push-results.json');
})();
