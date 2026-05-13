#!/usr/bin/env node
/**
 * Register F1 (iStock-1330945786 frame at 3.61s) in the asset library.
 * F1 = Old Mill District drone shot — three smokestacks, American flag, Deschutes River
 * with floaters, theater stage, Cascade mountains horizon. Approved by Matt 2026-05-13
 * as the social hero banner across all platforms.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TARGET = 'data/asset-library/manifest.json';
const SOURCE_FRAME = 'design_system/ryan-realty/assets/social/istock-frames/frame-01-t3.61s.jpg';
const PHOTOS_DIR = 'public/asset-library/photos/stock';
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(TARGET, 'utf8'));

// Dedup
const existing = manifest.assets.find(a => a.source_id === 'iStock-1330945786-frame-3.61s');
if (existing) {
  console.log(`⏭ F1 already registered as ${existing.id}`);
  process.exit(0);
}

const newId = crypto.randomUUID();
const newFilename = `${newId}.jpg`;
const newPath = path.join(PHOTOS_DIR, newFilename);
fs.copyFileSync(SOURCE_FRAME, newPath);
const stat = fs.statSync(SOURCE_FRAME);

const entry = {
  id: newId,
  type: 'photo',
  source: 'stock',
  source_id: 'iStock-1330945786-frame-3.61s',
  license: 'stock (subscription)',
  license_metadata: {
    note: 'Extracted frame from a licensed stock video. Use must be covered by active subscription at publish time.',
    extracted_from_video: true,
    timestamp_sec: 3.61,
    source_drive_file: 'iStock-1330945786.mov (4.3GB master), iStock-1330945786.mp4 (21MB web copy)',
  },
  creator: '',
  creator_url: '',
  file_path: newPath,
  file_url: null,
  file_size_bytes: stat.size,
  geo_tags: ['bend', 'old-mill-district', 'central-oregon', 'deschutes-county', 'deschutes-river'],
  subject_tags: [
    'old-mill-district', 'smokestack', 'smokestacks', 'three-smokestacks',
    'american-flag', 'deschutes-river', 'river', 'floaters', 'kayakers', 'paddleboard',
    'aerial', 'drone', 'summer', 'lifestyle', 'theater-stage', 'amphitheater',
    'cascade-mountains', 'mountain-horizon', 'landmark', 'iconic',
  ],
  search_query: 'old mill district bend oregon smokestacks river floaters drone',
  width: 1280,
  height: 720,
  duration_sec: null,
  registered_at: new Date().toISOString(),
  last_used_at: new Date().toISOString(),
  used_in: ['social-brand-hero-banner-2026-05-13'],
  approval: 'approved',
  notes: 'F1 hero — Approved by Matt 2026-05-13 as the social hero banner across YouTube, X, Pinterest, Facebook, GBP, LinkedIn, TikTok, Instagram. 720p source upscaled with lanczos+sharpen for YouTube 2048x1152. Higher-res 4K master available at Drive ID iStock-1330945786.mov if re-extraction needed.',
  permalink: '',
};

manifest.assets.push(entry);
manifest.updated_at = new Date().toISOString();
fs.writeFileSync(TARGET, JSON.stringify(manifest, null, 2));

console.log(`✓ F1 registered as ${newId}`);
console.log(`  geo: ${entry.geo_tags.join(', ')}`);
console.log(`  subject: ${entry.subject_tags.slice(0,6).join(', ')}...`);
console.log(`  total manifest assets: ${manifest.assets.length}`);
