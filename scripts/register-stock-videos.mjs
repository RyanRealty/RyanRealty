#!/usr/bin/env node
/**
 * Register the 24 stock video clips from Drive folder 17agk0Pj5CF_TqBQxsozKJ_7WXfWFtW7k
 * in the asset library manifest, with geo + subject tags. Artlist branding stripped
 * per Matt's directive.
 *
 * Files stay in Drive — we register pointers (drive_file_id + viewUrl), not local copies.
 * If a clip needs local access later, the Drive download tool pulls it on demand.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const TARGET = 'data/asset-library/manifest.json';

// Inline catalogue (extracted from Drive search 2026-05-13)
const STOCK_CLIPS = [
  { driveId: '17fvNo97koHi-feKp6QWO8xm6AilMX3UV', title: 'Mountains View Scenic Oregon', sizeBytes: 61500287, geo: ['oregon'], subject: ['mountain', 'aerial', 'scenic', 'landscape', 'wide'] },
  { driveId: '17eRx17Y6b3mq9A4H2uc4I16eG5GHMWZ-', title: 'Hiking Forest Oregon', sizeBytes: 54610484, geo: ['oregon'], subject: ['hiking', 'forest', 'lifestyle', 'outdoor-recreation'] },
  { driveId: '17fpP0Sq0-9Vqsu2fiTM0Gpk9oFT_sVqr', title: 'Kayak Fly Fishing Lake', sizeBytes: 100481912, geo: [], subject: ['kayak', 'fly-fishing', 'lake', 'outdoor-recreation', 'lifestyle'] },
  { driveId: '17hgTjxs6WSivIBuuijWwUqAF3gDHDz-X', title: 'Screenshot reference', sizeBytes: 3738498, geo: [], subject: ['reference-screenshot'], skip_register: true },
  { driveId: '17if7PCpwTV90gtcrqMMPT6Dl0ovVXseB', title: 'Mountains Lake Trees Alpine', sizeBytes: 143564495, geo: [], subject: ['mountain', 'lake', 'alpine', 'trees', 'scenic'] },
  { driveId: '17jgUdQxKGwmzCovu8Y7R-zBlY3ElhPZD', title: 'Forest Fire Hills Timelapse', sizeBytes: 49444198, geo: [], subject: ['fire', 'forest-fire', 'timelapse', 'hills', 'news-bgs', 'caution-content'] },
  { driveId: '17qJIY6ur5_y49KoXr25GFWkldxa8_xRJ', title: 'Wind Blowing Lake Timelapse', sizeBytes: 52646553, geo: [], subject: ['lake', 'wind', 'timelapse', 'weather', 'scenic'] },
  { driveId: '17s7BKvEEeuW2bFvLPGuLnzgITs629MfP', title: 'Lake HD', sizeBytes: 89572581, geo: [], subject: ['lake', 'scenic'] },
  { driveId: '17tUZEA1VrG1c75NLH7YWh97Gj-jHHSi9', title: 'Family Hiking Mountain Silhouette', sizeBytes: 36213547, geo: [], subject: ['family', 'hiking', 'mountain', 'silhouette', 'lifestyle', 'sunset'] },
  { driveId: '17w4grCkyPYaoieHqUqluuJkKEj4oW6HQ', title: 'Woman Running Forest', sizeBytes: 36106114, geo: [], subject: ['running', 'forest', 'fitness', 'lifestyle'] },
  { driveId: '17xTj_Ij0s1LPO_5am0taglkcnW2qtviJ', title: 'Woman Running Forest Path', sizeBytes: 38621430, geo: [], subject: ['running', 'forest', 'path', 'fitness', 'lifestyle'] },
  { driveId: '180u9jqtyrN7nwenu5oPXJFok-I22Rp4O', title: 'River Stream Rocks', sizeBytes: 119701715, geo: [], subject: ['river', 'stream', 'rocks', 'water', 'nature'] },
  { driveId: '182n7FREGBXyctGHb8UBKUuwQOtR6lO0T', title: 'Two Women Mountain Bikes Aerial', sizeBytes: 29650574, geo: [], subject: ['mountain-bike', 'aerial', 'lifestyle', 'fitness', 'outdoor-recreation'] },
  { driveId: '18BKQ9OseSEQtwiW56DAYaUPLOmCQBy6v', title: 'Cyclist Forest', sizeBytes: 232090369, geo: [], subject: ['cyclist', 'cycling', 'forest', 'lifestyle', 'outdoor-recreation'] },
  { driveId: '18BNXsjmRYZcmjZGbzG4Fc9nhkP8yxhGG', title: 'Women Off-Road Biking Mountain Aerial', sizeBytes: 174360193, geo: [], subject: ['mountain-bike', 'off-road', 'aerial', 'fitness', 'lifestyle', 'outdoor-recreation'] },
  { driveId: '18N9JmHKuvTjHbOsKYZxkxzuDFmlC9pSg', title: 'Mountain Bike POV Extreme', sizeBytes: 103782113, geo: [], subject: ['mountain-bike', 'pov', 'extreme-sport', 'fitness'] },
  { driveId: '18RGkTnvNPVSiLhCfd6kcSdmn2DPKKI3A', title: 'People Snowboarding Hill', sizeBytes: 133477624, geo: [], subject: ['snowboarding', 'winter', 'snow', 'lifestyle', 'outdoor-recreation'] },
  { driveId: '18e_Za2ue9wqpQWC9nXBjMJYjZoBm6Key', title: 'Cross-Country Skiing Forest', sizeBytes: 213669838, geo: [], subject: ['cross-country-skiing', 'winter', 'snow', 'forest', 'fitness', 'lifestyle'] },
  { driveId: '18mEvQrb83-Nh5LsXB1nWk7P_8CHRuBsD', title: 'Fisherman Lake', sizeBytes: 59711476, geo: [], subject: ['fishing', 'fisherman', 'lake', 'lifestyle', 'outdoor-recreation'] },
  { driveId: '18n2rlhLG4pdv2NWyRF8M6r8-SoEoq0pG', title: 'Fisherman River', sizeBytes: 51445865, geo: [], subject: ['fishing', 'fisherman', 'river', 'lifestyle', 'outdoor-recreation'] },
  { driveId: '18ndIBEwyQQH8TpB2vGbi0PMRSY1zqcge', title: 'Horses Running Fields Windy', sizeBytes: 70975415, geo: [], subject: ['horses', 'running', 'fields', 'windy', 'rural', 'lifestyle'] },
  { driveId: '18oAfxAmT0OpOIqcG3qO42qQtIUvkoK1Z', title: 'Lake HD wide', sizeBytes: 62185850, geo: [], subject: ['lake', 'scenic'] },
  { driveId: '18tGv-jg_FccnVRv8_NdoNA7BoYoiPaEa', title: 'Drone Above Forest Road', sizeBytes: 62984598, geo: [], subject: ['drone', 'aerial', 'forest', 'road', 'scenic'] },
  { driveId: '18tJAF-O7QG4jO2wKhZS7LUyH5XbHJqMg', title: 'Yellowstone Park Drone Campervan', sizeBytes: 47763247, geo: ['yellowstone', 'wyoming'], subject: ['drone', 'aerial', 'national-park', 'campervan', 'travel', 'roadtrip'] },
];

const manifest = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
const existingIds = new Set(manifest.assets.map(a => a.drive_file_id).filter(Boolean));

let added = 0;
let skipped = 0;

for (const clip of STOCK_CLIPS) {
  if (clip.skip_register) { skipped++; continue; }
  if (existingIds.has(clip.driveId)) {
    console.log(`⏭ already registered: ${clip.title}`);
    skipped++;
    continue;
  }

  const newId = crypto.randomUUID();
  const entry = {
    id: newId,
    type: 'video',
    source: 'stock',
    source_id: null,
    license: 'stock (subscription)',
    license_metadata: {
      note: 'Originally sourced from a stock subscription service. Use must be covered by an active subscription at publish time.',
    },
    creator: '',
    creator_url: '',
    file_path: null,
    file_url: `https://drive.google.com/file/d/${clip.driveId}/view?usp=drivesdk`,
    drive_file_id: clip.driveId,
    file_size_bytes: clip.sizeBytes,
    geo_tags: clip.geo,
    subject_tags: clip.subject,
    search_query: clip.title.toLowerCase(),
    width: null,
    height: null,
    duration_sec: null,
    registered_at: new Date().toISOString(),
    last_used_at: null,
    used_in: [],
    approval: 'approved',
    notes: `Stock video clip — ${clip.title}. Registered 2026-05-13 from Drive folder 17agk0Pj5CF_TqBQxsozKJ_7WXfWFtW7k. To use: download via Drive on demand.`,
    permalink: `https://drive.google.com/file/d/${clip.driveId}/view`,
  };
  manifest.assets.push(entry);
  added++;
  console.log(`✓ ${clip.title}`);
  console.log(`     geo: ${clip.geo.join(', ') || '(none)'}`);
  console.log(`     subject: ${clip.subject.join(', ')}`);
}

manifest.updated_at = new Date().toISOString();
fs.writeFileSync(TARGET, JSON.stringify(manifest, null, 2));

console.log(`\nAdded: ${added}, skipped: ${skipped}`);
console.log(`Total assets in manifest: ${manifest.assets.length} (${manifest.assets.filter(a=>a.type==='video').length} videos, ${manifest.assets.filter(a=>a.type==='photo').length} photos)`);
