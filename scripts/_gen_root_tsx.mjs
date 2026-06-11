import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, '_neighborhood_manifest.json'), 'utf-8'));
const areas = manifest.areas;

function titleCase(slug) {
  return slug.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// Build import list
const importLines = areas.map(a => 
  `import { ${a.constName}, ${a.constName}_RING } from './neighborhoodConfig';`
).join('\n');

// Build composition blocks
const compositionBlocks = areas.map(a => {
  const heroId = `${a.constName}Hero`;
  const socialId = `${a.constName}Social`;
  return `      {/* ${a.label} (${a.constName}) */}
      <Composition
        id="${heroId}"
        component={NeighborhoodHeroGeneric}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ config: ${a.constName}, ring: ${a.constName}_RING }}
      />
      <Composition
        id="${socialId}"
        component={NeighborhoodSocialGeneric}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ config: ${a.constName}, ring: ${a.constName}_RING }}
      />`;
}).join('\n\n');

const output = `// Tumalo aerial — isolated Remotion project for Photorealistic 3D Tiles
// productions targeted at 19496 Tumalo Reservoir Rd. Sibling of cascade-peaks
// because cascade-peaks/Root.tsx is locked.
//
// 2026-06-09: Added neighborhood flyover compositions — config-driven batch
// for 27 neighborhoods + resort communities. PILOT: Awbrey Butte.
// Batch of 26 added 2026-06-09 via _gen_root_tsx.mjs

import React from 'react';
import { Composition } from 'remotion';

import { EarthZoomTumalo } from './EarthZoomTumalo';
import { FlyoverTumalo } from './FlyoverTumalo';
import { NeighborhoodHero } from './NeighborhoodHero';
import { NeighborhoodSocial } from './NeighborhoodSocial';
import { NeighborhoodHeroGeneric } from './NeighborhoodHeroGeneric';
import { NeighborhoodSocialGeneric } from './NeighborhoodSocialGeneric';
import { AWBREY_BUTTE } from './neighborhoodConfig';

// ── Batch area configs + rings (26 areas)
${importLines}

const FPS = 30;
const W = 1080;
const H = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EarthZoomTumalo"
        component={EarthZoomTumalo}
        durationInFrames={10 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="FlyoverTumalo"
        component={FlyoverTumalo}
        durationInFrames={12 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />

      {/* ─── Neighborhood Flyover PILOT: Awbrey Butte ─────────────────────────
          Hard-coded compositions — pilot approved by Matt 2026-06-09.
          Hero: 16:9 1920×1080 seamless orbital loop for geo-page header.
          Social: 9:16 1080×1920 portrait flyover for Reels/TikTok/Shorts.
          ─────────────────────────────────────────────────────────────────── */}
      <Composition
        id="AwbreyButteHero"
        component={NeighborhoodHero}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="AwbreyButteSocial"
        component={NeighborhoodSocial}
        durationInFrames={35 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
      />

      {/* ─── Neighborhood Flyover BATCH (26 areas) ───────────────────────────
          Config-driven via NeighborhoodHeroGeneric + NeighborhoodSocialGeneric.
          All data from Supabase — no hand-drawn polygons.
          Generated 2026-06-09 via scripts/_gen_root_tsx.mjs
          ─────────────────────────────────────────────────────────────────── */}
${compositionBlocks}
    </>
  );
};
`;

const outPath = join(__dirname, '../video/tumalo-aerial/src/Root.tsx');
writeFileSync(outPath, output);
console.log('Written Root.tsx — ' + areas.length + ' batch areas registered (' + areas.length * 2 + ' compositions)');
