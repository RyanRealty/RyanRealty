#!/usr/bin/env node
/**
 * render-panorama-tiles.mjs
 *
 * Pattern D — slice one wide aerial into three 1080×1350 portrait tiles that
 * flow seamlessly when swiped on Instagram. Uses sharp.
 *
 * Usage:
 *   node scripts/render-panorama-tiles.mjs <input-wide.jpg> <output-dir>
 *
 * Outputs:
 *   <output-dir>/tile-1.png
 *   <output-dir>/tile-2.png
 *   <output-dir>/tile-3.png
 *
 * Behavior:
 *   - Crops the source to fit a 3:3.75 (3-tile 1080×1350) panorama aspect
 *     (i.e. final combined output is 3240×1350 = 2.4:1 wide).
 *   - Slices into three 1080-wide portrait tiles with zero overlap.
 */

import sharp from 'sharp';
import { resolve, basename } from 'path';
import { mkdirSync, existsSync } from 'fs';

const TILE_W = 1080;
const TILE_H = 1350;
const TILES = 3;
const TARGET_W = TILE_W * TILES;  // 3240
const TARGET_RATIO = TARGET_W / TILE_H;  // 2.4

async function renderTiles(inputPath, outputDir) {
  if (!existsSync(inputPath)) throw new Error(`input not found: ${inputPath}`);
  mkdirSync(outputDir, { recursive: true });

  const meta = await sharp(inputPath).metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  const srcRatio = srcW / srcH;

  console.log(`Source: ${srcW}×${srcH} (ratio ${srcRatio.toFixed(2)})`);
  console.log(`Target combined: ${TARGET_W}×${TILE_H} (ratio ${TARGET_RATIO.toFixed(2)})`);

  // Compute crop to fit target ratio
  let cropW, cropH;
  if (srcRatio >= TARGET_RATIO) {
    // Source is wider than target — crop sides
    cropH = srcH;
    cropW = Math.round(srcH * TARGET_RATIO);
  } else {
    // Source is taller than target — crop top/bottom
    cropW = srcW;
    cropH = Math.round(srcW / TARGET_RATIO);
  }
  const cropX = Math.round((srcW - cropW) / 2);
  const cropY = Math.round((srcH - cropH) / 2);
  console.log(`Crop: ${cropW}×${cropH} at (${cropX}, ${cropY})`);

  // Extract + resize to combined target
  const combinedBuffer = await sharp(inputPath)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize(TARGET_W, TILE_H, { fit: 'fill' })
    .toBuffer();

  // Slice into 3 tiles
  for (let i = 0; i < TILES; i++) {
    const tileX = i * TILE_W;
    const outPath = resolve(outputDir, `tile-${i + 1}.png`);
    await sharp(combinedBuffer)
      .extract({ left: tileX, top: 0, width: TILE_W, height: TILE_H })
      .png({ quality: 92 })
      .toFile(outPath);
    console.log(`Wrote ${outPath}`);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const inputPath = process.argv[2];
  const outputDir = process.argv[3];
  if (!inputPath || !outputDir) {
    console.error('usage: node render-panorama-tiles.mjs <input-wide.jpg> <output-dir>');
    process.exit(1);
  }
  renderTiles(resolve(inputPath), resolve(outputDir)).catch(err => {
    console.error('Failed:', err.message);
    process.exit(2);
  });
}

export { renderTiles };
