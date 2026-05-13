#!/usr/bin/env node
/**
 * Composite Ryan Realty brand assets for social platforms.
 *  - Avatar: stacked wordmark on cream square, multiple sizes
 *  - Heritage banner: scene-downtown-skyline on cream, multiple aspect ratios
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const CREAM = '#faf8f4';
const NAVY = '#102742';

const WORDMARK = 'design_system/ryan-realty/assets/brand/logo-blue.png';
const HERITAGE_SCENE = 'design_system/ryan-realty/assets/brand/navy-cream/scene-downtown-skyline.png';

const AVATAR_OUT = 'design_system/ryan-realty/assets/social/avatar';
const BANNER_OUT = 'design_system/ryan-realty/assets/social/banner-illustration';
fs.mkdirSync(AVATAR_OUT, { recursive: true });
fs.mkdirSync(BANNER_OUT, { recursive: true });

// ============ AVATAR ============
// Stacked wordmark centered on cream square. Logo occupies ~78% of canvas width.

const AVATAR_SPECS = [
  { name: 'avatar-1080-universal',    size: 1080, label: 'Universal upload (works on every platform)' },
  { name: 'avatar-720-facebook-gbp',  size: 720,  label: 'Facebook Page / Google Business Profile' },
  { name: 'avatar-800-youtube',       size: 800,  label: 'YouTube channel' },
  { name: 'avatar-400-x',             size: 400,  label: 'X / Twitter' },
  { name: 'avatar-320-instagram',     size: 320,  label: 'Instagram (and Threads)' },
  { name: 'avatar-300-linkedin',      size: 300,  label: 'LinkedIn Company Page' },
];

// The wordmark has a y-descender on "Realty" that pulls the bounding box right.
// Bounding-box centering leaves the visual mass left-of-center. Compute the
// CENTROID of opaque pixels and offset placement so that point lands at canvas center.
// Matt: "centered ... too much white space on the right side ... could possibly be a little bit bigger"

const trimmedWmBuf = await sharp(WORDMARK)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
  .png()
  .toBuffer();
const trimmedMeta = await sharp(trimmedWmBuf).metadata();
const wmAspect = trimmedMeta.width / trimmedMeta.height;

// Compute centroid of opaque pixels in the trimmed wordmark
const { data: rawAlpha, info: alphaInfo } = await sharp(trimmedWmBuf)
  .extractChannel('alpha')
  .raw()
  .toBuffer({ resolveWithObject: true });
let sumX = 0, sumY = 0, sumW = 0;
for (let y = 0; y < alphaInfo.height; y++) {
  for (let x = 0; x < alphaInfo.width; x++) {
    const a = rawAlpha[y * alphaInfo.width + x];
    if (a > 50) {  // count substantially-opaque pixels
      sumX += x * a;
      sumY += y * a;
      sumW += a;
    }
  }
}
const centroidX = sumX / sumW;       // visual center X within wordmark
const centroidY = sumY / sumW;       // visual center Y within wordmark
const centroidFx = centroidX / alphaInfo.width;   // 0..1
const centroidFy = centroidY / alphaInfo.height;  // 0..1
console.log(`Wordmark: ${alphaInfo.width}x${alphaInfo.height}  centroid at (${centroidFx.toFixed(3)}, ${centroidFy.toFixed(3)})`);

for (const spec of AVATAR_SPECS) {
  const canvas = spec.size;
  // Bumped from 78% → 85% width per Matt's feedback ("could possibly be a little bit bigger")
  const wmTargetWidth = Math.round(canvas * 0.85);
  const wmTargetHeight = Math.round(wmTargetWidth / wmAspect);

  // Place wordmark so its CENTROID lands at canvas center (not bounding-box center).
  // If centroid is at 0.45 (left of bbox center), shift wordmark RIGHT so centroid aligns.
  const targetCentroidPx = canvas / 2;
  const centroidPxInWm = wmTargetWidth * centroidFx;
  const offsetX = Math.round(targetCentroidPx - centroidPxInWm);
  const centroidPyInWm = wmTargetHeight * centroidFy;
  const offsetY = Math.round(canvas / 2 - centroidPyInWm);

  const wmResized = await sharp(trimmedWmBuf)
    .resize(wmTargetWidth, wmTargetHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: CREAM,
    }
  })
    .composite([{ input: wmResized, top: offsetY, left: offsetX }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(AVATAR_OUT, `${spec.name}.png`));

  console.log(`✓ ${spec.name}.png (${canvas}x${canvas}) — ${spec.label}`);
}

// ============ HERITAGE BANNER ============
// scene-downtown-skyline composited on cream at platform aspect ratios.
// Strategy: cream background fills, illustration centered, scaled to fit with padding.

const BANNER_SPECS = [
  { name: 'banner-1500x500-x',         w: 1500, h: 500,  label: 'X / Twitter header' },
  { name: 'banner-820x312-facebook',   w: 820,  h: 312,  label: 'Facebook Page cover' },
  { name: 'banner-1128x191-linkedin',  w: 1128, h: 191,  label: 'LinkedIn Company cover (very wide)' },
  { name: 'banner-2048x1152-youtube',  w: 2048, h: 1152, label: 'YouTube channel art (safe zone 1546x423)' },
  { name: 'banner-1024x576-gbp',       w: 1024, h: 576,  label: 'Google Business Profile cover' },
  { name: 'banner-800x450-pinterest',  w: 800,  h: 450,  label: 'Pinterest cover' },
];

const scene = sharp(HERITAGE_SCENE);
const sceneMeta = await scene.metadata();
const sceneAspect = sceneMeta.width / sceneMeta.height;
console.log(`\nHeritage scene: ${sceneMeta.width}x${sceneMeta.height} ratio ${sceneAspect.toFixed(2)}`);

for (const spec of BANNER_SPECS) {
  const canvasAspect = spec.w / spec.h;
  // Fit scene inside canvas with cream padding. Use 85% height as target.
  const targetHeight = Math.round(spec.h * 0.85);
  const targetWidth = Math.round(targetHeight * sceneAspect);

  // For very wide banners (LinkedIn 5.9:1), the scene at 85% height would extend WAY past canvas width.
  // In that case, scale down so scene fits 50% of canvas width.
  const maxWidth = Math.round(spec.w * 0.55);
  let finalWidth, finalHeight;
  if (targetWidth > maxWidth) {
    finalWidth = maxWidth;
    finalHeight = Math.round(finalWidth / sceneAspect);
  } else {
    finalWidth = targetWidth;
    finalHeight = targetHeight;
  }

  const offsetX = Math.round((spec.w - finalWidth) / 2);
  const offsetY = Math.round((spec.h - finalHeight) / 2);

  const sceneResized = await sharp(HERITAGE_SCENE)
    .resize(finalWidth, finalHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: spec.w, height: spec.h, channels: 4, background: CREAM }
  })
    .composite([{ input: sceneResized, top: offsetY, left: offsetX }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(BANNER_OUT, `${spec.name}.png`));

  console.log(`✓ ${spec.name}.png (${spec.w}x${spec.h}) — illustration at ${finalWidth}x${finalHeight} — ${spec.label}`);
}

console.log(`\nAvatars in:  ${AVATAR_OUT}/`);
console.log(`Banners in:  ${BANNER_OUT}/`);
