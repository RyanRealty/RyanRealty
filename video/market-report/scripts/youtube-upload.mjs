#!/usr/bin/env node
/**
 * Uploads the 6 portrait market-report videos to @Ryan-Realty
 * (channel UCpxIXnNVeG25oeDjfE3b4lw), sets each thumbnail, and writes
 * out/_final/youtube_results.json with the resulting video IDs/URLs.
 *
 * Reads creds from /Users/matthewryan/RyanRealty/.env.local:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 *
 * Usage: node scripts/youtube-upload.mjs
 *   --only=bend,redmond     (optional: subset)
 *   --dry-run               (build the metadata bundle, don't actually upload)
 */

import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const ENV_PATH = '/Users/matthewryan/RyanRealty/.env.local';
const FINAL_DIR = '/Users/matthewryan/RyanRealty/video/market-report/out/_final';
const RESULTS_PATH = path.join(FINAL_DIR, 'youtube_results.json');
const EXPECTED_CHANNEL_ID = 'UCpxIXnNVeG25oeDjfE3b4lw';

function parseEnv(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadEnv() {
  return parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
}

const SHARED_TAGS_TAIL = []; // (per-city tags already include common items)

// Per-city metadata table — descriptions kept verbatim from the brief.
const VIDEOS = [
  {
    slug: 'bend',
    file: 'bend_market_report_ytd2026.mp4',
    thumb: 'bend_thumbnail.jpg',
    title: 'Bend Real Estate Just Hit a Balanced Market | YTD 2026 Report',
    description: `Bend's real estate market shifted to balanced in early 2026 — first time in years.

📊 The numbers (YTD 2026, single-family residential):
• Median sale price: $699,000 (down 7.3% YoY)
• Active listings: 1,149 homes
• Months of supply: 5.8 (BALANCED)
• Median days on market: 57
• Sale-to-list ratio: 97.1%
• Median price per sq ft: $386

Sources: Oregon MLS via Supabase, verified 2026-04-26. Single-family only (PropertyType A).

Full Bend market report → ryan-realty.com
Subscribe for monthly Central Oregon market updates.

#BendOregon #BendRealEstate #CentralOregonRealEstate #OregonRealEstate #MarketReport #RealEstateMarket #HomesForSale #RealEstateUpdate #Shorts`,
    tags: ['bend oregon','bend real estate','central oregon real estate','oregon real estate','bend homes for sale','bend market report','real estate market 2026','deschutes county','market update','ryan realty','monthly market report'],
  },
  {
    slug: 'redmond',
    file: 'redmond_market_report_ytd2026.mp4',
    thumb: 'redmond_thumbnail.jpg',
    title: "Redmond Real Estate Just Tipped Into a Buyer's Market | YTD 2026",
    description: `Redmond officially crossed into buyer's market territory in early 2026.

📊 The numbers (YTD 2026, single-family residential):
• Median sale price: $475,000 (down 8.7% YoY)
• Active listings: 440 homes
• Months of supply: 6.4 (BUYER'S MARKET)
• Median days on market: 62
• Sale-to-list ratio: 98.1%
• Median price per sq ft: $324

Sources: Oregon MLS via Supabase, verified 2026-04-26. Single-family only (PropertyType A).

Full Redmond market report → ryan-realty.com
Subscribe for monthly Central Oregon market updates.

#RedmondOregon #RedmondRealEstate #CentralOregonRealEstate #OregonRealEstate #MarketReport #BuyersMarket #HomesForSale #Shorts`,
    tags: ['redmond oregon','redmond real estate','central oregon real estate','oregon real estate','redmond homes for sale','redmond market report','buyers market','deschutes county','market update','ryan realty'],
  },
  {
    slug: 'sisters',
    file: 'sisters_market_report_ytd2026.mp4',
    thumb: 'sisters_thumbnail.jpg',
    title: 'Sisters Real Estate: 10 Months of Supply | YTD 2026 Report',
    description: `Sisters' market remains soft with nearly 10 months of inventory.

📊 The numbers (YTD 2026, single-family residential):
• Median sale price: $687,000 (down 5.3% YoY)
• Active listings: 156 homes
• Months of supply: 9.96 (BUYER'S MARKET)
• Median days on market: 75
• Sale-to-list ratio: 96.5%
• Median price per sq ft: $384

Sources: Oregon MLS via Supabase, verified 2026-04-26. Single-family only (PropertyType A).

Full Sisters market report → ryan-realty.com
Subscribe for monthly Central Oregon market updates.

#SistersOregon #SistersRealEstate #CentralOregonRealEstate #OregonRealEstate #MarketReport #BuyersMarket #HomesForSale #Shorts`,
    tags: ['sisters oregon','sisters real estate','central oregon real estate','oregon real estate','sisters homes for sale','sisters market report','deschutes county','market update','ryan realty'],
  },
  {
    slug: 'la-pine',
    file: 'la-pine_market_report_ytd2026.mp4',
    thumb: 'la-pine_thumbnail.jpg',
    title: 'La Pine Real Estate: 13.5 Months of Supply | YTD 2026 Report',
    description: `La Pine has the highest inventory months in Central Oregon — over a year of supply.

📊 The numbers (YTD 2026, single-family residential):
• Median sale price: $380,000 (down 1.3% YoY)
• Active listings: 303 homes
• Months of supply: 13.5 (BUYER'S MARKET)
• Median days on market: 100
• Sale-to-list ratio: 95.2%
• Median price per sq ft: $261

Sources: Oregon MLS via Supabase, verified 2026-04-26. Single-family only (PropertyType A).

Full La Pine market report → ryan-realty.com
Subscribe for monthly Central Oregon market updates.

#LaPineOregon #LaPineRealEstate #CentralOregonRealEstate #OregonRealEstate #MarketReport #BuyersMarket #HomesForSale #Shorts`,
    tags: ['la pine oregon','la pine real estate','central oregon real estate','oregon real estate','la pine homes for sale','la pine market report','deschutes county','market update','ryan realty'],
  },
  {
    slug: 'prineville',
    file: 'prineville_market_report_ytd2026.mp4',
    thumb: 'prineville_thumbnail.jpg',
    title: 'Prineville is the ONLY Central Oregon Market UP YoY | YTD 2026',
    description: `Prineville is bucking the Central Oregon trend — the only city up YoY in 2026.

📊 The numbers (YTD 2026, single-family residential):
• Median sale price: $428,900 (UP 4.6% YoY) ⭐
• Active listings: 412 homes
• Months of supply: 12.0 (BUYER'S MARKET)
• Median days on market: 64
• Sale-to-list ratio: 97.9%
• Median price per sq ft: $290

While the rest of the region cooled, Prineville's median sale price climbed.

Sources: Oregon MLS via Supabase, verified 2026-04-26. Single-family only (PropertyType A).

Full Prineville market report → ryan-realty.com
Subscribe for monthly Central Oregon market updates.

#PrinevilleOregon #PrinevilleRealEstate #CentralOregonRealEstate #OregonRealEstate #MarketReport #CrookCounty #HomesForSale #Shorts`,
    tags: ['prineville oregon','prineville real estate','central oregon real estate','oregon real estate','prineville homes for sale','prineville market report','crook county','market update','ryan realty','only market up'],
  },
  {
    slug: 'sunriver',
    file: 'sunriver_market_report_ytd2026.mp4',
    thumb: 'sunriver_thumbnail.jpg',
    title: 'Sunriver Real Estate: $768K Median, $430/SqFt | YTD 2026 Report',
    description: `Sunriver remains Central Oregon's premium short-term-rental market.

📊 The numbers (YTD 2026, single-family residential):
• Median sale price: $768,000 (down 3.4% YoY)
• Active listings: 114 homes
• Months of supply: 9.5 (BUYER'S MARKET)
• Median days on market: 55
• Sale-to-list ratio: 95.0%
• Median price per sq ft: $430 (highest in Central Oregon)

Sources: Oregon MLS via Supabase, verified 2026-04-26. Single-family only (PropertyType A).

Full Sunriver market report → ryan-realty.com
Subscribe for monthly Central Oregon market updates.

#SunriverOregon #SunriverRealEstate #CentralOregonRealEstate #OregonRealEstate #MarketReport #ShortTermRental #VacationHome #Shorts`,
    tags: ['sunriver oregon','sunriver real estate','central oregon real estate','oregon real estate','sunriver homes for sale','sunriver market report','deschutes county','vacation home','short term rental','ryan realty'],
  },
];

function parseArgs(argv) {
  const args = { only: null, dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--only=')) args.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return args;
}

async function getYouTubeClient(env) {
  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    'http://127.0.0.1:8765/oauth2callback' // must match the redirect used during auth
  );
  oauth2.setCredentials({ refresh_token: env.YOUTUBE_REFRESH_TOKEN });
  // Trigger an access-token refresh up front so we surface auth errors early.
  await oauth2.getAccessToken();
  return { oauth2, yt: google.youtube({ version: 'v3', auth: oauth2 }) };
}

async function uploadOne(yt, item) {
  const videoPath = path.join(FINAL_DIR, item.file);
  const thumbPath = path.join(FINAL_DIR, item.thumb);
  if (!fs.existsSync(videoPath)) throw new Error(`Missing video: ${videoPath}`);
  if (!fs.existsSync(thumbPath)) throw new Error(`Missing thumbnail: ${thumbPath}`);

  const fileSize = fs.statSync(videoPath).size;
  const t0 = Date.now();
  console.log(`\n[upload] ${item.slug} — ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  const insertRes = await yt.videos.insert(
    {
      part: ['snippet', 'status'],
      notifySubscribers: true,
      requestBody: {
        snippet: {
          title: item.title,
          description: item.description,
          tags: item.tags,
          categoryId: '22', // People & Blogs
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en',
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
          embeddable: true,
        },
      },
      media: { body: fs.createReadStream(videoPath) },
    },
    {
      // Resumable upload progress
      onUploadProgress: (evt) => {
        const pct = ((evt.bytesRead / fileSize) * 100).toFixed(1);
        process.stdout.write(`\r[upload] ${item.slug} ${pct}%   `);
      },
    }
  );
  process.stdout.write('\n');

  const videoId = insertRes.data.id;
  if (!videoId) throw new Error('insert returned no videoId');
  console.log(`[upload] ${item.slug} videoId=${videoId} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // Set thumbnail
  try {
    await yt.thumbnails.set({
      videoId,
      media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumbPath) },
    });
    console.log(`[upload] ${item.slug} thumbnail set`);
  } catch (e) {
    console.warn(`[upload] ${item.slug} thumbnail failed: ${e.message}`);
  }

  return {
    slug: item.slug,
    videoId,
    url: `https://youtu.be/${videoId}`,
    shortsUrl: `https://www.youtube.com/shorts/${videoId}`,
    title: item.title,
    fileSizeBytes: fileSize,
    uploadedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv();
  if (!env.YOUTUBE_REFRESH_TOKEN) {
    throw new Error('YOUTUBE_REFRESH_TOKEN not set in .env.local — run scripts/youtube-auth.mjs first');
  }

  const items = args.only ? VIDEOS.filter((v) => args.only.includes(v.slug)) : VIDEOS;
  if (!items.length) throw new Error('No videos selected');

  if (args.dryRun) {
    console.log('[upload] DRY RUN — would upload:');
    for (const it of items) {
      console.log(`  - ${it.slug}: ${it.title} (${it.file})`);
    }
    return;
  }

  const { oauth2, yt } = await getYouTubeClient(env);

  // Verify channel
  try {
    const me = await yt.channels.list({ part: ['snippet'], mine: true });
    const ch = me.data.items?.[0];
    if (ch) {
      console.log(`[upload] authorized channel: ${ch.snippet.title} (${ch.id})`);
      if (ch.id !== EXPECTED_CHANNEL_ID) {
        console.warn(`[upload] WARNING: channel ID ${ch.id} does not match expected ${EXPECTED_CHANNEL_ID}`);
      }
    }
  } catch (e) {
    console.warn(`[upload] channel verify failed: ${e.message}`);
  }

  const results = [];
  for (const item of items) {
    try {
      const r = await uploadOne(yt, item);
      results.push(r);
      // Persist incrementally so a mid-run failure doesn't lose successful uploads
      const existing = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')) : { uploads: [] };
      const updated = {
        channelId: EXPECTED_CHANNEL_ID,
        updatedAt: new Date().toISOString(),
        uploads: [...existing.uploads.filter((u) => u.slug !== r.slug), r],
      };
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(updated, null, 2));
    } catch (e) {
      console.error(`[upload] ${item.slug} FAILED: ${e.message}`);
      const existing = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8')) : { uploads: [] };
      const errEntry = { slug: item.slug, error: e.message, failedAt: new Date().toISOString() };
      existing.errors = [...(existing.errors || []).filter((u) => u.slug !== item.slug), errEntry];
      fs.writeFileSync(RESULTS_PATH, JSON.stringify(existing, null, 2));
    }
  }

  console.log('\n=== UPLOAD SUMMARY ===');
  for (const r of results) {
    console.log(`${r.slug.padEnd(12)} ${r.url}   (Shorts: ${r.shortsUrl})`);
  }
  console.log(`\n[upload] results saved to ${RESULTS_PATH}`);
}

main().catch((e) => {
  console.error('[upload] FAILED:', e.stack || e.message);
  process.exit(1);
});
