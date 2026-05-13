#!/usr/bin/env node
/**
 * Register P69 (Old Mill District 2019 by Beastes35) in the asset library manifest.
 * Locked as the social hero banner across all Ryan Realty platforms.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TARGET_MANIFEST = 'data/asset-library/manifest.json';
const SOURCE_FILE = 'design_system/ryan-realty/assets/social/approved/p69-old-mill-district-2019.jpg';
const PHOTOS_DIR = 'public/asset-library/photos/wikimedia';
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(TARGET_MANIFEST, 'utf8'));
const sourceId = 'File:Old Mill District 2019.jpg';
const sourceKey = `wikimedia:${sourceId}`;
const existing = manifest.assets.find(a => `${a.source}:${a.source_id}` === sourceKey);
if (existing) {
  console.log(`⏭ P69 already registered as ${existing.id}`);
  process.exit(0);
}

const newId = crypto.randomUUID();
const newFilename = `${newId}.jpg`;
const newPath = path.join(PHOTOS_DIR, newFilename);
fs.copyFileSync(SOURCE_FILE, newPath);

const stat = fs.statSync(SOURCE_FILE);
const entry = {
  id: newId,
  type: 'photo',
  source: 'wikimedia',
  source_id: sourceId,
  license: 'CC BY-SA 4.0',
  license_metadata: {
    permalink: 'https://commons.wikimedia.org/wiki/File:Old_Mill_District_2019.jpg',
    attribution_required: true,
    attribution_text: 'Beastes35 / Wikimedia Commons (CC BY-SA 4.0)',
    share_alike: true,
  },
  creator: 'Beastes35',
  creator_url: 'https://commons.wikimedia.org/wiki/User:Beastes35',
  file_path: newPath,
  file_url: null,
  file_size_bytes: stat.size,
  geo_tags: ['bend', 'old-mill-district', 'central-oregon', 'deschutes-county'],
  subject_tags: [
    'old-mill-district', 'smokestack', 'smokestacks', 'deschutes-river',
    'river', 'footbridge', 'riverside', 'aerial', 'golden-hour',
    'sunset', 'cityscape', 'cascades', 'mountain', 'commerce',
    'shopping', 'tourism', 'landmark', 'iconic',
  ],
  search_query: 'old mill district bend oregon river',
  width: 2048,
  height: 1364,
  duration_sec: null,
  registered_at: new Date().toISOString(),
  last_used_at: new Date().toISOString(),
  used_in: ['social-brand-banner-2026-05-13'],
  approval: 'approved',
  notes: 'P69 — Approved by Matt 2026-05-13 as the social hero banner across YouTube, X, Pinterest, Facebook, LinkedIn, GBP, TikTok (also referenced from Instagram bio attribution). Composited at every platform spec; output in design_system/ryan-realty/assets/social/banner-photo/. CC BY-SA 4.0 attribution baked into every social bio.',
  permalink: 'https://commons.wikimedia.org/wiki/File:Old_Mill_District_2019.jpg',
};

manifest.assets.push(entry);
manifest.updated_at = new Date().toISOString();
fs.writeFileSync(TARGET_MANIFEST, JSON.stringify(manifest, null, 2));

console.log(`✓ Registered P69 as ${newId}`);
console.log(`  geo: ${entry.geo_tags.join(', ')}`);
console.log(`  subject: ${entry.subject_tags.slice(0, 6).join(', ')}...`);
console.log(`  copied to: ${newPath}`);
console.log(`  manifest total: ${manifest.assets.length} assets`);
