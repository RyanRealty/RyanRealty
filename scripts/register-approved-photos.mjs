#!/usr/bin/env node
/**
 * Register the 13 approved Bend/Central Oregon photos in data/asset-library/manifest.json
 * with geo_tags and subject_tags so future content searches surface them.
 *
 * Source: design_system/ryan-realty/assets/social/approved/manifest.json
 * Target: data/asset-library/manifest.json
 *
 * Files are copied to public/asset-library/photos/{source}/ so they're served by the
 * Next.js dev server and accessible by the asset-library CLI.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const APPROVED_MANIFEST = 'design_system/ryan-realty/assets/social/approved/manifest.json';
const TARGET_MANIFEST  = 'data/asset-library/manifest.json';
const PHOTOS_DIR       = 'public/asset-library/photos';

const TAGS_BY_PICK = {
  P1:  { geo: ['bend', 'central-oregon', 'three-sisters', 'cascade-range'],            subject: ['mountain', 'three-sisters', 'sunrise', 'alpenglow', 'peak', 'landscape', 'golden-hour'] },
  P2:  { geo: ['bend', 'cascade-lakes', 'central-oregon', 'cascade-range'],            subject: ['mountain', 'road', 'forest', 'landscape', 'road-trip', 'scenic-byway', 'pine'] },
  P3:  { geo: ['bend', 'cascade-lakes', 'central-oregon', 'cascade-range'],            subject: ['mountain', 'road', 'forest', 'landscape', 'road-trip', 'scenic-byway', 'pine'] },
  P4:  { geo: ['bend', 'downtown-bend', 'central-oregon'],                             subject: ['cafe', 'coffee-shop', 'interior', 'lifestyle', 'people', 'still-vibrato', 'modern', 'downtown'] },
  P5:  { geo: ['bend', 'downtown-bend', 'central-oregon'],                             subject: ['coffee', 'cafe', 'lifestyle', 'still-vibrato', 'food-and-beverage'] },
  P9:  { geo: ['smith-rock', 'central-oregon', 'redmond'],                             subject: ['river', 'canyon', 'sunset', 'landscape', 'hiking', 'recreation', 'rock', 'misery-ridge', 'crooked-river'] },
  P18: { geo: ['mt-bachelor', 'bend', 'central-oregon', 'deschutes-county', 'cascade-range'], subject: ['mountain', 'peak', 'snow', 'early-morning', 'alpine', 'ski-mountain'] },
  P19: { geo: ['mt-bachelor', 'bend', 'central-oregon', 'deschutes-county', 'cascade-range'], subject: ['mountain', 'peak', 'snow', 'early-morning', 'alpine', 'ski-mountain'] },
  P43: { geo: ['bend', 'downtown-bend', 'wall-street', 'minnesota-avenue'],            subject: ['storefront', 'brick', 'architecture', 'street', 'downtown', 'signage', 'crosswalk', 'urban', 'person', 'lamppost', 'building', '900-wall'] },
  P44: { geo: ['bend', 'cascade-lakes', 'central-oregon', 'cascade-range'],            subject: ['mountain', 'road', 'south-sister', 'landscape', 'road-trip', 'pine', 'forest'] },
  P47: { geo: ['trillium-lake', 'oregon-cascades', 'mt-hood-area'],                    subject: ['lake', 'reflection', 'sunrise', 'dawn', 'alpine', 'mountain', 'still-water'] },
  P48: { geo: ['sparks-lake', 'bend', 'cascade-lakes', 'central-oregon'],              subject: ['lake', 'sunrise', 'reflection', 'alpine', 'mountain', 'still-water', 'dawn'] },
  P50: { geo: ['sparks-lake', 'bend', 'cascade-lakes', 'central-oregon'],              subject: ['lake', 'winter', 'snow', 'alpine', 'mountain', 'season', 'reflection'] },
};

const approved = JSON.parse(fs.readFileSync(APPROVED_MANIFEST, 'utf8'));

// Load existing target manifest
let target;
if (fs.existsSync(TARGET_MANIFEST)) {
  target = JSON.parse(fs.readFileSync(TARGET_MANIFEST, 'utf8'));
} else {
  target = { version: 1, schema_version: 1, assets: [] };
}
target.updated_at = new Date().toISOString();

// Track existing assets by source_id to avoid duplicates
const existingBySourceId = new Set(target.assets.map(a => `${a.source}:${a.source_id || a.id}`));

let added = 0;
let skipped = 0;

for (const p of approved) {
  const tags = TAGS_BY_PICK[p.pick];
  if (!tags) { console.warn(`No tags defined for ${p.pick}`); continue; }

  // Source identifier — Unsplash photo ID or Wikimedia title
  const sourceId = p.src === 'unsplash' ? p.id : p.wikiTitle;
  const sourceKey = `${p.src}:${sourceId}`;
  if (existingBySourceId.has(sourceKey)) {
    console.log(`⏭  ${p.pick} (${sourceKey}) already in manifest`);
    skipped++;
    continue;
  }

  // Copy to public/asset-library/photos/{source}/{newName}
  const sourceFolder = p.src === 'unsplash' ? 'unsplash' : 'wikimedia';
  const sourceDir = path.join(PHOTOS_DIR, sourceFolder);
  fs.mkdirSync(sourceDir, { recursive: true });
  const newId = crypto.randomUUID();
  const ext = path.extname(p.file).toLowerCase() || '.jpg';
  const newFilename = `${newId}${ext}`;
  const newPath = path.join(sourceDir, newFilename);
  fs.copyFileSync(p.file, newPath);

  // Build manifest entry matching existing schema
  const entry = {
    id: newId,
    type: 'photo',
    source: p.src,
    source_id: sourceId,
    license: p.license || (p.src === 'unsplash' ? 'unsplash' : 'CC'),
    license_metadata: p.src === 'wikimedia' ? { permalink: p.permalink || '' } : {},
    creator: p.author,
    creator_url: p.author_url || '',
    file_path: newPath,
    file_url: null,
    file_size_bytes: p.sizeBytes,
    geo_tags: tags.geo,
    subject_tags: tags.subject,
    search_query: p.desc || '',
    width: p.width || 0,
    height: p.height || 0,
    duration_sec: null,
    registered_at: new Date().toISOString(),
    last_used_at: null,
    used_in: [],
    approval: 'approved',
    notes: `Approved by Matt 2026-05-13 (pick ${p.pick}). ${p.hero ? 'Hero/banner photo for social brand sync.' : ''}`.trim(),
    permalink: p.permalink || '',
  };
  target.assets.push(entry);
  added++;
  console.log(`✓ ${p.pick}  ${p.src}:${sourceId}  → ${newPath}`);
  console.log(`     geo=${tags.geo.join(',')}`);
  console.log(`     subject=${tags.subject.join(',')}`);
}

fs.writeFileSync(TARGET_MANIFEST, JSON.stringify(target, null, 2));
console.log(`\nAdded: ${added}  Skipped: ${skipped}  Total in manifest: ${target.assets.length}`);
console.log(`Manifest: ${TARGET_MANIFEST}`);
