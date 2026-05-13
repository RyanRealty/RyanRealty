#!/usr/bin/env node
/**
 * Build realistic platform-UI mockups showing how the new Ryan Realty avatar + banner +
 * bio will appear on each social channel once published. Self-contained HTML with all
 * assets base64-inlined.
 *
 * Channels: Instagram, Facebook Page, LinkedIn Company, YouTube, X/Twitter, TikTok,
 * Pinterest, Threads, Google Business Profile.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const AVATAR_DIR = 'design_system/ryan-realty/assets/social/avatar';
const BANNER_DIR = 'design_system/ryan-realty/assets/social/banner-photo';
const PHONE = '541.703.3095';
const WEBSITE = 'ryan-realty.com';

// Asset preload (resized to mockup sizes, base64-inlined for portability)
async function inlineImageResized(filePath, w, h, fit = 'cover') {
  if (!fs.existsSync(filePath)) return '';
  const buf = await sharp(filePath)
    .resize(w, h, { fit, background: { r: 0xfa, g: 0xf8, b: 0xf4, alpha: 1 } })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}
async function inlinePngResized(filePath, w, h) {
  if (!fs.existsSync(filePath)) return '';
  const buf = await sharp(filePath)
    .resize(w, h, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

// Preload avatars at various display sizes
const av300 = await inlinePngResized(path.join(AVATAR_DIR, 'avatar-1080-universal.png'), 300, 300);
const av160 = await inlinePngResized(path.join(AVATAR_DIR, 'avatar-1080-universal.png'), 160, 160);
const av120 = await inlinePngResized(path.join(AVATAR_DIR, 'avatar-1080-universal.png'), 120, 120);
const av96  = await inlinePngResized(path.join(AVATAR_DIR, 'avatar-1080-universal.png'), 96, 96);
const av72  = await inlinePngResized(path.join(AVATAR_DIR, 'avatar-1080-universal.png'), 72, 72);

// Preload banners at mockup sizes (match each platform's display aspect)
const bnYoutube  = await inlineImageResized(path.join(BANNER_DIR, 'banner-2048x1152-youtube.jpg'),  1024, 576);
const bnX        = await inlineImageResized(path.join(BANNER_DIR, 'banner-1500x500-x.jpg'),         900, 300);
const bnFB       = await inlineImageResized(path.join(BANNER_DIR, 'banner-820x312-facebook.jpg'),   820, 312);
const bnGBP      = await inlineImageResized(path.join(BANNER_DIR, 'banner-1024x576-gbp.jpg'),       720, 405);
const bnPin      = await inlineImageResized(path.join(BANNER_DIR, 'banner-800x450-pinterest.jpg'),  720, 405);
const bnLI       = await inlineImageResized(path.join(BANNER_DIR, 'banner-1128x191-linkedin.jpg'),  900, 152);

// Bios (Option C, mission verbatim, emoji on consumer platforms)
const bioShort = `Your trusted Central Oregon brokerage. 🤝
Building community through authentic relationships and exceptional customer service. 🏡🌲`;
const bioShortNoEmoji = `Your trusted Central Oregon brokerage.
Building community through authentic relationships and exceptional customer service.`;
const bioMedium = `Ryan Realty is your trusted Central Oregon real estate brokerage. 🤝

We're committed to building community through authentic relationships and exceptional customer service. 🏡🌲

Service area: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville
${PHONE} · ${WEBSITE}`;
const bioFB = `Your trusted Central Oregon real estate brokerage. 🤝 Building community through authentic relationships and exceptional customer service. 🏡🌲

How can we earn your business?
${PHONE} · ${WEBSITE}`;
const bioTikTok = `Building community through authentic relationships + service. 🏡🌲`;
const bioGBP = `Ryan Realty is your trusted Central Oregon real estate brokerage, based in downtown Bend.

Our mission: build community through authentic relationships and exceptional customer service.

Service area: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville

We work the way you'd want us to. Honest. Direct. Kind. Local.

How can we earn your business?
${PHONE} · matt@ryan-realty.com · ${WEBSITE}`;

// HTML mockups — each one styled to roughly match the platform's actual UI chrome
const mockups = `
<!-- =============== INSTAGRAM =============== -->
<section class="mockup ig">
  <div class="platform-tag"><span class="dot ig"></span>Instagram · @ryanrealtybend</div>
  <div class="ig-card">
    <div class="ig-topbar">
      <span class="ig-handle">ryanrealtybend</span>
      <span class="ig-icons">⊕ ☰</span>
    </div>
    <div class="ig-header">
      <img class="ig-avatar" src="${av160}" alt="">
      <div class="ig-stats">
        <div><strong>598</strong><span>posts</span></div>
        <div><strong>1,227</strong><span>followers</span></div>
        <div><strong>3,214</strong><span>following</span></div>
      </div>
    </div>
    <div class="ig-bio">
      <div class="ig-name">Ryan Realty</div>
      <div class="ig-cat">Real Estate</div>
      <div class="ig-text">${bioShort.replace(/\n/g, '<br>')}</div>
      <div class="ig-link">🔗 ${WEBSITE}</div>
    </div>
    <div class="ig-actions">
      <button>Follow</button>
      <button class="alt">Message</button>
      <button class="alt">+</button>
    </div>
  </div>
</section>

<!-- =============== FACEBOOK PAGE =============== -->
<section class="mockup fb">
  <div class="platform-tag"><span class="dot fb"></span>Facebook Page · Ryan Realty Bend</div>
  <div class="fb-card">
    <img class="fb-cover" src="${bnFB}" alt="">
    <div class="fb-avatar-wrap"><img class="fb-avatar" src="${av160}" alt=""></div>
    <div class="fb-body">
      <div class="fb-name">Ryan Realty Bend <span class="fb-verified">✓</span></div>
      <div class="fb-meta">Real Estate Company · 115 NW Oregon Ave, Bend, OR</div>
      <div class="fb-bio">${bioFB.replace(/\n/g, '<br>')}</div>
      <div class="fb-actions">
        <button class="primary">👍 Like</button>
        <button>Follow</button>
        <button>Share</button>
        <button>· · ·</button>
      </div>
    </div>
  </div>
</section>

<!-- =============== LINKEDIN COMPANY =============== -->
<section class="mockup li">
  <div class="platform-tag"><span class="dot li"></span>LinkedIn Company Page · Ryan Realty</div>
  <div class="li-card">
    <img class="li-cover" src="${bnLI}" alt="">
    <div class="li-body">
      <img class="li-avatar" src="${av120}" alt="">
      <div class="li-name">Ryan Realty</div>
      <div class="li-tagline">Your trusted Central Oregon real estate brokerage</div>
      <div class="li-meta">Real Estate · Bend, Oregon · 3 employees</div>
      <div class="li-bio">${bioMedium.replace(/\n/g, '<br>')}</div>
      <div class="li-actions">
        <button class="primary">+ Follow</button>
        <button>Visit website</button>
      </div>
    </div>
  </div>
</section>

<!-- =============== YOUTUBE CHANNEL =============== -->
<section class="mockup yt">
  <div class="platform-tag"><span class="dot yt"></span>YouTube · Ryan Realty · Bend, Oregon</div>
  <div class="yt-card">
    <div class="yt-cover-wrap"><img class="yt-cover" src="${bnYoutube}" alt=""></div>
    <div class="yt-header">
      <img class="yt-avatar" src="${av160}" alt="">
      <div class="yt-text">
        <div class="yt-name">Ryan Realty · Bend, Oregon</div>
        <div class="yt-handle">@RyanRealty · 0 subscribers · 0 videos</div>
        <div class="yt-desc">${bioShort.replace(/\n/g, ' ')}<br>${WEBSITE}</div>
        <div class="yt-actions">
          <button class="primary">Subscribe</button>
        </div>
      </div>
    </div>
    <div class="yt-tabs">Home · Videos · Shorts · Playlists · Community · About</div>
  </div>
</section>

<!-- =============== X / TWITTER =============== -->
<section class="mockup tw">
  <div class="platform-tag"><span class="dot tw"></span>X / Twitter · @ryanrealtybend</div>
  <div class="tw-card">
    <img class="tw-cover" src="${bnX}" alt="">
    <div class="tw-body">
      <img class="tw-avatar" src="${av120}" alt="">
      <div class="tw-actions">
        <button>· · ·</button>
        <button class="primary">Follow</button>
      </div>
      <div class="tw-name">Ryan Realty · Bend, OR</div>
      <div class="tw-handle">@ryanrealtybend</div>
      <div class="tw-bio">${bioShort.replace(/\n/g, '<br>')}</div>
      <div class="tw-meta">📍 Bend, OR &nbsp; 🔗 ${WEBSITE} &nbsp; 📅 Joined 2024</div>
      <div class="tw-stats"><strong>0</strong> Following · <strong>0</strong> Followers</div>
    </div>
  </div>
</section>

<!-- =============== TIKTOK =============== -->
<section class="mockup tt">
  <div class="platform-tag"><span class="dot tt"></span>TikTok · @ryanrealtybend</div>
  <div class="tt-card">
    <div class="tt-header">
      <img class="tt-avatar" src="${av120}" alt="">
      <div class="tt-name">Ryan Realty</div>
      <div class="tt-handle">@ryanrealtybend</div>
      <div class="tt-stats">
        <div><strong>0</strong><span>Following</span></div>
        <div><strong>0</strong><span>Followers</span></div>
        <div><strong>0</strong><span>Likes</span></div>
      </div>
      <div class="tt-actions">
        <button class="primary">Follow</button>
        <button>Message</button>
      </div>
      <div class="tt-bio">${bioTikTok}</div>
      <div class="tt-link">🔗 ${WEBSITE}</div>
    </div>
    <div class="tt-note-strip">
      ⓘ TikTok profiles don't support a banner image. Brand visual happens via the <strong>Featured / pinned video cover</strong> + the recent-videos grid. Publish a Reel with the F1 frame as the cover and pin it to set the visual identity.
    </div>
    <div class="tt-featured-row">
      <div class="tt-featured-label">FEATURED · PINNED</div>
      <div class="tt-featured-grid">
        <div class="tt-tile primary">
          <img src="${bnYoutube}" alt="">
          <div class="tt-tile-pin">📌 Pinned</div>
          <div class="tt-tile-stats">▶ 1.2M</div>
        </div>
        <div class="tt-tile placeholder"><div>+ Recent</div></div>
        <div class="tt-tile placeholder"><div>+ Recent</div></div>
      </div>
    </div>
  </div>
</section>

<!-- =============== PINTEREST =============== -->
<section class="mockup pin">
  <div class="platform-tag"><span class="dot pin"></span>Pinterest · @ryanrealtybend</div>
  <div class="pin-card">
    <img class="pin-cover" src="${bnPin}" alt="">
    <div class="pin-body">
      <img class="pin-avatar" src="${av120}" alt="">
      <div class="pin-name">Ryan Realty</div>
      <div class="pin-handle">@ryanrealtybend · 0 followers · 0 following</div>
      <div class="pin-bio">${bioShortNoEmoji.replace(/\n/g, ' ')}</div>
      <div class="pin-link">${WEBSITE}</div>
      <div class="pin-actions">
        <button class="primary">Follow</button>
        <button>Message</button>
        <button>Share</button>
      </div>
    </div>
  </div>
</section>

<!-- =============== THREADS =============== -->
<section class="mockup th">
  <div class="platform-tag"><span class="dot th"></span>Threads · @ryanrealtybend (inherits from IG)</div>
  <div class="th-card">
    <div class="th-header">
      <div class="th-text">
        <div class="th-name">Ryan Realty</div>
        <div class="th-handle">ryanrealtybend</div>
      </div>
      <img class="th-avatar" src="${av96}" alt="">
    </div>
    <div class="th-bio">${bioShort.replace(/\n/g, '<br>')}</div>
    <div class="th-meta">${WEBSITE} · 0 followers</div>
    <div class="th-actions">
      <button>Profile</button>
      <button class="primary">Share</button>
    </div>
  </div>
</section>

<!-- =============== GOOGLE BUSINESS PROFILE =============== -->
<section class="mockup gbp">
  <div class="platform-tag"><span class="dot gbp"></span>Google Business Profile · Ryan Realty</div>
  <div class="gbp-card">
    <img class="gbp-cover" src="${bnGBP}" alt="">
    <div class="gbp-body">
      <div class="gbp-header">
        <img class="gbp-avatar" src="${av96}" alt="">
        <div>
          <div class="gbp-name">Ryan Realty</div>
          <div class="gbp-rating">★★★★★ Real Estate Agency</div>
          <div class="gbp-loc">115 NW Oregon Ave Suite #2, Bend, OR · Open · Closes 5 PM</div>
        </div>
      </div>
      <div class="gbp-actions">
        <button class="primary">📞 Call</button>
        <button>↗ Directions</button>
        <button>🌐 Website</button>
        <button>📌 Save</button>
      </div>
      <div class="gbp-bio">${bioGBP.replace(/\n/g, '<br>')}</div>
    </div>
  </div>
</section>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ryan Realty — platform mockups</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --rr-navy: #102742; --rr-cream: #faf8f4; --rr-sand: #e8e2d4; }
body { background: var(--rr-cream); font-family: 'Inter', -apple-system, system-ui, sans-serif; color: var(--rr-navy); padding: 40px 24px 80px; line-height: 1.4; }
.container { max-width: 1300px; margin: 0 auto; }
h1 { font-size: 36px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 6px; }
.subtitle { opacity: 0.7; margin-bottom: 32px; font-size: 15px; max-width: 800px; line-height: 1.5; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 32px; }
.mockup { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgb(16 39 66 / 0.10); overflow: hidden; }
.platform-tag { padding: 12px 16px; background: #f5f5f7; border-bottom: 1px solid #e5e5ea; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; display: flex; align-items: center; gap: 8px; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.dot.ig { background: linear-gradient(45deg, #fdf497, #fd5949, #d6249f, #285AEB); }
.dot.fb { background: #1877f2; }
.dot.li { background: #0a66c2; }
.dot.yt { background: #ff0000; }
.dot.tw { background: #000; }
.dot.tt { background: linear-gradient(45deg, #25f4ee, #fe2c55); }
.dot.pin { background: #e60023; }
.dot.th { background: #000; }
.dot.gbp { background: #4285f4; }
button { font-family: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 6px; border: 1px solid #d0d0d8; background: white; cursor: pointer; }
button.primary { background: #0a66c2; color: white; border-color: #0a66c2; }
button.alt { background: #f5f5f7; }

/* ============== INSTAGRAM ============== */
.ig-card { padding: 20px; }
.ig-topbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #efefef; }
.ig-handle { font-weight: 600; font-size: 18px; }
.ig-icons { font-size: 18px; opacity: 0.6; }
.ig-header { display: grid; grid-template-columns: 160px 1fr; gap: 24px; padding: 24px 0; align-items: center; }
.ig-avatar { width: 160px; height: 160px; border-radius: 50%; object-fit: cover; border: 3px solid transparent; background: linear-gradient(45deg, #fdf497, #fd5949, #d6249f, #285AEB); padding: 3px; }
.ig-stats { display: flex; gap: 24px; }
.ig-stats > div { text-align: left; }
.ig-stats strong { font-size: 18px; font-weight: 600; display: block; }
.ig-stats span { font-size: 13px; opacity: 0.7; }
.ig-bio { padding: 8px 0; }
.ig-name { font-weight: 600; font-size: 15px; }
.ig-cat { font-size: 13px; opacity: 0.6; margin: 2px 0 8px; }
.ig-text { font-size: 14px; line-height: 1.4; }
.ig-link { color: #00376b; font-size: 14px; margin-top: 6px; }
.ig-actions { display: flex; gap: 8px; padding-top: 16px; }
.ig-actions button { flex: 1; padding: 7px 0; }

/* ============== FACEBOOK ============== */
.fb-cover { width: 100%; height: 220px; object-fit: cover; display: block; }
.fb-avatar-wrap { position: relative; margin: -84px 0 0 24px; }
.fb-avatar { width: 168px; height: 168px; border-radius: 50%; object-fit: cover; border: 4px solid white; }
.fb-body { padding: 8px 24px 24px; }
.fb-name { font-size: 28px; font-weight: 800; margin-top: 12px; }
.fb-verified { color: #1877f2; font-size: 20px; }
.fb-meta { font-size: 13px; opacity: 0.65; margin: 4px 0 14px; }
.fb-bio { font-size: 14px; line-height: 1.5; margin-bottom: 16px; }
.fb-actions { display: flex; gap: 8px; }

/* ============== LINKEDIN ============== */
.li-cover { width: 100%; height: 100px; object-fit: cover; display: block; background: #102742; }
.li-body { padding: 0 24px 24px; }
.li-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid white; margin-top: -60px; background: var(--rr-cream); }
.li-name { font-size: 24px; font-weight: 700; margin-top: 16px; }
.li-tagline { font-size: 14px; opacity: 0.85; margin-top: 4px; }
.li-meta { font-size: 12px; opacity: 0.6; margin: 6px 0 16px; }
.li-bio { font-size: 14px; line-height: 1.5; margin-bottom: 18px; }
.li-actions { display: flex; gap: 8px; }

/* ============== YOUTUBE ============== */
.yt-cover-wrap { width: 100%; background: #000; padding: 0; position: relative; }
.yt-cover { width: 100%; display: block; }
.yt-header { display: grid; grid-template-columns: 160px 1fr; gap: 24px; padding: 20px 24px; }
.yt-avatar { width: 160px; height: 160px; border-radius: 50%; object-fit: cover; }
.yt-text { padding-top: 8px; }
.yt-name { font-size: 32px; font-weight: 700; line-height: 1.1; }
.yt-handle { font-size: 13px; opacity: 0.65; margin: 6px 0; }
.yt-desc { font-size: 14px; line-height: 1.5; margin-bottom: 14px; }
.yt-actions button.primary { background: #000; padding: 9px 18px; border-radius: 999px; }
.yt-tabs { padding: 16px 24px; border-top: 1px solid #efefef; font-size: 14px; font-weight: 500; opacity: 0.85; }

/* ============== X / TWITTER ============== */
.tw-cover { width: 100%; height: 200px; object-fit: cover; display: block; background: #000; }
.tw-body { padding: 0 20px 20px; position: relative; }
.tw-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid white; margin-top: -64px; position: relative; }
.tw-actions { position: absolute; right: 20px; top: 16px; display: flex; gap: 8px; }
.tw-actions button.primary { background: #000; color: white; border-color: #000; border-radius: 999px; padding: 7px 16px; }
.tw-name { font-size: 22px; font-weight: 800; margin-top: 12px; }
.tw-handle { font-size: 14px; opacity: 0.6; }
.tw-bio { font-size: 14px; line-height: 1.5; margin: 10px 0; }
.tw-meta { font-size: 13px; opacity: 0.65; margin-bottom: 10px; }
.tw-stats { font-size: 13px; opacity: 0.85; }

/* ============== TIKTOK ============== */
.tt-card { padding: 28px 24px; background: #000; color: white; text-align: center; }
.tt-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin: 0 auto 14px; display: block; }
.tt-name { font-size: 22px; font-weight: 700; }
.tt-handle { font-size: 14px; opacity: 0.7; margin: 4px 0 18px; }
.tt-stats { display: flex; justify-content: center; gap: 28px; margin-bottom: 18px; }
.tt-stats > div { display: flex; flex-direction: column; align-items: center; }
.tt-stats strong { font-size: 18px; font-weight: 700; }
.tt-stats span { font-size: 12px; opacity: 0.7; margin-top: 2px; }
.tt-actions { display: flex; justify-content: center; gap: 10px; margin-bottom: 18px; }
.tt-actions button.primary { background: #fe2c55; color: white; border-color: #fe2c55; padding: 9px 28px; border-radius: 6px; }
.tt-actions button { background: transparent; color: white; border-color: #444; }
.tt-bio { font-size: 14px; line-height: 1.4; opacity: 0.95; }
.tt-link { font-size: 13px; color: #25f4ee; margin-top: 8px; }
.tt-note-strip { background: #1c1c1c; color: rgba(255,255,255,0.7); padding: 12px 16px; font-size: 11px; line-height: 1.5; text-align: left; border-top: 1px solid #222; }
.tt-note-strip strong { color: #25f4ee; }
.tt-featured-row { background: #000; padding: 12px 16px 16px; }
.tt-featured-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: rgba(255,255,255,0.55); text-align: left; margin-bottom: 8px; }
.tt-featured-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
.tt-tile { position: relative; aspect-ratio: 9/16; overflow: hidden; border-radius: 4px; background: #1a1a1a; }
.tt-tile.primary img { width: 100%; height: 100%; object-fit: cover; }
.tt-tile-pin { position: absolute; top: 6px; left: 6px; background: #fe2c55; color: white; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 3px; }
.tt-tile-stats { position: absolute; bottom: 6px; left: 6px; color: white; font-size: 11px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.tt-tile.placeholder { display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 11px; border: 1px dashed rgba(255,255,255,0.15); }

/* ============== PINTEREST ============== */
.pin-cover { width: 100%; height: 200px; object-fit: cover; display: block; }
.pin-body { padding: 0 24px 24px; text-align: center; }
.pin-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid white; margin: -60px auto 0; display: block; }
.pin-name { font-size: 24px; font-weight: 700; margin-top: 12px; }
.pin-handle { font-size: 13px; opacity: 0.65; margin: 4px 0 10px; }
.pin-bio { font-size: 14px; line-height: 1.5; margin-bottom: 8px; }
.pin-link { color: #e60023; font-size: 14px; margin-bottom: 16px; }
.pin-actions { display: flex; gap: 8px; justify-content: center; }
.pin-actions button.primary { background: #e60023; color: white; border-color: #e60023; border-radius: 999px; padding: 9px 22px; }

/* ============== THREADS ============== */
.th-card { padding: 24px; background: white; }
.th-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.th-name { font-size: 22px; font-weight: 700; }
.th-handle { font-size: 14px; opacity: 0.55; margin-top: 2px; }
.th-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; }
.th-bio { font-size: 14px; line-height: 1.5; margin-bottom: 12px; }
.th-meta { font-size: 13px; opacity: 0.55; margin-bottom: 16px; }
.th-actions { display: flex; gap: 8px; }
.th-actions button { flex: 1; border-radius: 8px; padding: 9px 0; border-color: #d0d0d8; }
.th-actions button.primary { background: #000; color: white; border-color: #000; }

/* ============== GBP ============== */
.gbp-cover { width: 100%; height: 240px; object-fit: cover; display: block; }
.gbp-body { padding: 20px 24px 24px; }
.gbp-header { display: flex; gap: 14px; align-items: center; margin-bottom: 16px; }
.gbp-avatar { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
.gbp-name { font-size: 22px; font-weight: 700; }
.gbp-rating { font-size: 13px; opacity: 0.85; margin: 2px 0; color: #fbbc04; }
.gbp-loc { font-size: 12px; opacity: 0.6; }
.gbp-actions { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.gbp-actions button.primary { background: #1a73e8; color: white; border-color: #1a73e8; }
.gbp-bio { font-size: 13px; line-height: 1.5; }
</style>
</head>
<body>
<div class="container">
  <h1>Ryan Realty — platform mockups</h1>
  <div class="subtitle">Exact preview of how the new avatar, banner, and bio will appear on each social channel once published. Bio Option C (your voice preserved with emoji on consumer platforms). Hero banner = F1 frame from iStock Old Mill District drone clip.</div>
  <div class="grid">
    ${mockups}
  </div>
</div>
</body>
</html>`;

const outPath = 'design_system/ryan-realty/assets/social/platform-mockups.html';
fs.writeFileSync(outPath, html);
console.log(`Wrote ${outPath}  (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
console.log(`Mockups for 9 platforms: Instagram, Facebook, LinkedIn, YouTube, X, TikTok, Pinterest, Threads, GBP`);
