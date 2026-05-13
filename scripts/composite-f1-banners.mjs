#!/usr/bin/env node
/**
 * Composite the F1 frame (iStock Old Mill drone shot, 3.61s timestamp) as banners
 * at every platform spec. F1 has: 3 smokestacks centered, American flag, Deschutes
 * River with floaters, theater stage left, mountains on horizon. Best Bend banner
 * the codebase has ever seen.
 *
 * Source: 720p extracted from the 21 MB MP4 web copy. For YouTube 2048×1152 we'll
 * lanczos-upscale (sharp-quality). If the 244 MB MOV becomes accessible we'll re-composite
 * from a true 4K source.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const HERO = 'design_system/ryan-realty/assets/social/istock-frames/frame-01-t3.61s.jpg';
const OUT_DIR = 'design_system/ryan-realty/assets/social/banner-photo';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Composition: smokestacks centered slightly right, flag at top-center, river spans bottom-left,
// mountains at the top. We want to preserve the smokestacks + flag at all aspects.
// Vertical anchor: smokestacks span y~10% to y~95%, flag at y~10%. Anchor to ~25% from top.
// Horizontal anchor: smokestacks at x~55%. Anchor to center for most aspects.

const BANNER_SPECS = [
  { name: 'banner-2048x1152-youtube',  w: 2048, h: 1152, label: 'YouTube channel art' },
  { name: 'banner-1500x500-x',         w: 1500, h: 500,  label: 'X / Twitter header' },
  { name: 'banner-820x312-facebook',   w: 820,  h: 312,  label: 'Facebook Page cover' },
  { name: 'banner-1024x576-gbp',       w: 1024, h: 576,  label: 'Google Business Profile' },
  { name: 'banner-800x450-pinterest',  w: 800,  h: 450,  label: 'Pinterest cover' },
  { name: 'banner-1128x191-linkedin',  w: 1128, h: 191,  label: 'LinkedIn Company cover (5.9:1)' },
];

const heroMeta = await sharp(HERO).metadata();
const heroAspect = heroMeta.width / heroMeta.height;
console.log(`Hero source: ${heroMeta.width}×${heroMeta.height} (aspect ${heroAspect.toFixed(2)}, expect 16:9)`);

for (const spec of BANNER_SPECS) {
  const out = path.join(OUT_DIR, `${spec.name}.jpg`);
  const targetAspect = spec.w / spec.h;

  // Crop math
  let cropBox;
  if (Math.abs(targetAspect - heroAspect) < 0.05) {
    // Same aspect — no crop needed
    cropBox = { left: 0, top: 0, width: heroMeta.width, height: heroMeta.height };
  } else if (targetAspect > heroAspect) {
    // Banner wider than source — full width, partial height. Anchor vertically to keep
    // smokestacks + flag in frame (they span the upper-mid portion).
    const cropHeight = Math.round(heroMeta.width / targetAspect);
    // Smokestacks centered around y ~50%; anchor crop so that point lands at crop center.
    let cropTop = Math.round(heroMeta.height * 0.50 - cropHeight * 0.50);
    cropTop = Math.max(0, Math.min(heroMeta.height - cropHeight, cropTop));
    cropBox = { left: 0, top: cropTop, width: heroMeta.width, height: cropHeight };
  } else {
    // Banner narrower than source — full height, partial width. Anchor to smokestacks at x~55%.
    const cropWidth = Math.round(heroMeta.height * targetAspect);
    let cropLeft = Math.round(heroMeta.width * 0.55 - cropWidth * 0.50);
    cropLeft = Math.max(0, Math.min(heroMeta.width - cropWidth, cropLeft));
    cropBox = { left: cropLeft, top: 0, width: cropWidth, height: heroMeta.height };
  }

  // Sharp's resize with lanczos3 gives the best upscale quality.
  // We add gentle unsharp mask to compensate for any softness in upscaled output.
  await sharp(HERO)
    .extract(cropBox)
    .resize(spec.w, spec.h, { fit: 'cover', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.5 })
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(out);

  const meta = await sharp(out).metadata();
  console.log(`✓ ${spec.name}.jpg  ${meta.width}×${meta.height}  crop ${cropBox.width}×${cropBox.height}@${cropBox.left},${cropBox.top}`);
}
console.log(`\nF1 banners written to ${OUT_DIR}/`);
