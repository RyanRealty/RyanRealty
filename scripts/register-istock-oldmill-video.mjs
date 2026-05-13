#!/usr/bin/env node
/**
 * Register the iStock Old Mill drone video in the asset library. One primary entry
 * pointing at the 4K master (Drive file iStock-1330945786.mov, 4.3GB), with metadata
 * noting the alternate web copies for on-demand use. Matt called this out as a reusable
 * asset 2026-05-13.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const TARGET = 'data/asset-library/manifest.json';
const manifest = JSON.parse(fs.readFileSync(TARGET, 'utf8'));

// Dedup
const sourceId = 'iStock-1330945786';
const existing = manifest.assets.find(a => a.source_id === sourceId && a.type === 'video');
if (existing) {
  console.log(`⏭ already registered as ${existing.id}`);
  process.exit(0);
}

const newId = crypto.randomUUID();
const entry = {
  id: newId,
  type: 'video',
  source: 'stock',
  source_id: sourceId,
  license: 'stock (subscription)',
  license_metadata: {
    note: 'Originally sourced from a stock subscription service. Use must be covered by an active subscription at publish time.',
    license_id: 'iStock-1330945786',
  },
  creator: '',
  creator_url: '',
  file_path: null,
  file_url: 'https://drive.google.com/file/d/1T3juCcPSF0Qw-YA-xAnMetHbYJcltcsz/view?usp=drivesdk',
  drive_file_id: '1T3juCcPSF0Qw-YA-xAnMetHbYJcltcsz',
  drive_alternates: [
    { format: '4K MOV master', drive_file_id: '1T3juCcPSF0Qw-YA-xAnMetHbYJcltcsz', size_bytes: 4294470182 },
    { format: 'compressed MOV', drive_file_id: '1T43HR15R0QwASM1KuSanmIKuwZIXAjZH', size_bytes: 244032103 },
    { format: 'MP4 web copy', drive_file_id: '1T0kIElK3ZtznUCmzJa9hWyGfS3jHNMsL', size_bytes: 21447096 },
    { format: 'MP4 web copy (dup)', drive_file_id: '1SoYM5fn5so5ftNwlqRU_dBY3mGwjylQY', size_bytes: 21447096 },
    { format: 'small preview MP4', drive_file_id: '1TBHSFJOPhkOUH5Z5Sx-VBYZAqyv8zuAD', size_bytes: 7311237 },
  ],
  file_size_bytes: 4294470182,
  geo_tags: ['bend', 'old-mill-district', 'central-oregon', 'deschutes-county', 'deschutes-river'],
  subject_tags: [
    'old-mill-district', 'smokestack', 'smokestacks', 'three-smokestacks',
    'american-flag', 'deschutes-river', 'river', 'floaters', 'kayakers',
    'paddleboard', 'river-float', 'aerial', 'drone', 'summer', 'lifestyle',
    'theater-stage', 'amphitheater', 'cascade-mountains', 'mountain-horizon',
    'landmark', 'iconic', 'hero-content',
  ],
  search_query: 'old mill district bend oregon drone river floaters smokestacks',
  width: 3840,  // 4K master is 4K UHD
  height: 2160,
  duration_sec: 32.57,
  registered_at: new Date().toISOString(),
  last_used_at: new Date().toISOString(),
  used_in: ['social-brand-hero-banner-2026-05-13'],
  approval: 'approved',
  notes: 'iStock Old Mill District drone clip. Approved by Matt 2026-05-13 as a primary reusable asset. F1 frame (3.61s timestamp) extracted as the social hero banner across all Ryan Realty platforms. 5 Drive copies exist (4K master + compressed + 2 web MP4s + preview); use the smallest copy that meets the use case. Stock subscription license must be active at publish time.',
  permalink: 'https://drive.google.com/file/d/1T3juCcPSF0Qw-YA-xAnMetHbYJcltcsz/view',
};

manifest.assets.push(entry);
manifest.updated_at = new Date().toISOString();
fs.writeFileSync(TARGET, JSON.stringify(manifest, null, 2));

console.log(`✓ iStock Old Mill video registered as ${newId}`);
console.log(`  geo: ${entry.geo_tags.join(', ')}`);
console.log(`  subject: ${entry.subject_tags.slice(0,6).join(', ')}...`);
console.log(`  4K master + 4 alternates linked`);
console.log(`  total manifest assets: ${manifest.assets.length} (${manifest.assets.filter(a=>a.type==='video').length} videos, ${manifest.assets.filter(a=>a.type==='photo').length} photos)`);
