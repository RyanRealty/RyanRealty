#!/usr/bin/env node
/**
 * Composite P69 (Old Mill District 2019, Wikimedia CC BY-SA 4.0 by Beastes35) as banners
 * at every platform spec.
 *
 * Native aspect: 2048×1364 (1.50). Hero composition:
 *   - Three smokestacks upper-center (~50% x, ~30% y)
 *   - Deschutes River flowing bottom-left to mid
 *   - Footbridge mid-bottom
 *   - Shops + golden-hour sky
 *
 * Strategy for each banner aspect:
 *   - YouTube/Pinterest/GBP (1.78:1): trim some top + bottom, keep smokestacks centered
 *   - X (3:1) + Facebook (2.63:1): trim more top + bottom, smokestacks remain visible
 *   - LinkedIn (5.9:1): very thin slice through middle — keeps smokestacks + river horizon
 *
 * For all crops, anchor vertically to ~35% from top so smokestacks stay in frame.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const HERO = 'design_system/ryan-realty/assets/social/approved/p69-old-mill-district-2019.jpg';
const OUT_DIR = 'design_system/ryan-realty/assets/social/banner-photo';
fs.mkdirSync(OUT_DIR, { recursive: true });

const BANNER_SPECS = [
  { name: 'banner-2048x1152-youtube',  w: 2048, h: 1152, label: 'YouTube channel art' },
  { name: 'banner-1500x500-x',         w: 1500, h: 500,  label: 'X / Twitter header' },
  { name: 'banner-820x312-facebook',   w: 820,  h: 312,  label: 'Facebook Page cover' },
  { name: 'banner-1024x576-gbp',       w: 1024, h: 576,  label: 'Google Business Profile' },
  { name: 'banner-800x450-pinterest',  w: 800,  h: 450,  label: 'Pinterest cover' },
  { name: 'banner-1128x191-linkedin',  w: 1128, h: 191,  label: 'LinkedIn Company cover' },
];

const heroMeta = await sharp(HERO).metadata();
const heroAspect = heroMeta.width / heroMeta.height;
console.log(`Hero source: ${heroMeta.width}x${heroMeta.height} (aspect ${heroAspect.toFixed(2)})`);

for (const spec of BANNER_SPECS) {
  const out = path.join(OUT_DIR, `${spec.name}.jpg`);
  const targetAspect = spec.w / spec.h;

  // Compute crop box
  let cropBox;
  if (targetAspect > heroAspect) {
    // Banner is wider than source — full width, partial height. Anchor toward upper-center
    // so smokestacks (at ~30% from top) stay in frame.
    const cropHeight = Math.round(heroMeta.width / targetAspect);
    // Vertical anchor: place smokestacks at ~40% from top of crop
    // If smokestacks are at y=30% of source, and we want them at 40% of crop:
    //   cropTop = sourceY_smokestacks - (cropHeight * 0.40)
    //   cropTop = (heroMeta.height * 0.30) - (cropHeight * 0.40)
    let cropTop = Math.round(heroMeta.height * 0.30 - cropHeight * 0.40);
    cropTop = Math.max(0, Math.min(heroMeta.height - cropHeight, cropTop));
    cropBox = { left: 0, top: cropTop, width: heroMeta.width, height: cropHeight };
  } else {
    // Banner is narrower than source — full height, centre horizontally
    const cropWidth = Math.round(heroMeta.height * targetAspect);
    const cropLeft = Math.round((heroMeta.width - cropWidth) / 2);
    cropBox = { left: cropLeft, top: 0, width: cropWidth, height: heroMeta.height };
  }

  await sharp(HERO)
    .extract(cropBox)
    .resize(spec.w, spec.h, { fit: 'cover' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(out);
  console.log(`✓ ${spec.name}.jpg (${spec.w}x${spec.h})  crop ${cropBox.width}x${cropBox.height}@${cropBox.left},${cropBox.top}`);
}

console.log(`\nDone. Hero banners in: ${OUT_DIR}/`);
