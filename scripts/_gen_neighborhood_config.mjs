import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '_neighborhood_data.json'), 'utf-8'));
const rings = JSON.parse(readFileSync(join(__dirname, '_neighborhood_rings.json'), 'utf-8'));

const all = [...data.tier1, ...data.tier2];

function formatRing(ring) {
  if (!ring || ring.length === 0) return '[]';
  const tuples = ring.map(c => `[${c[0]},${c[1]}]`);
  const lines = [];
  for (let i = 0; i < tuples.length; i += 3) {
    lines.push('  ' + tuples.slice(i, i+3).join(','));
  }
  return '[\n' + lines.join(',\n') + '\n]';
}

function formatPath(path) {
  return path.map(w => 
    `  { t: ${w.t.toFixed(2)}, east: ${String(w.east).padStart(5)}, north: ${String(w.north).padStart(5)}, altitude: ${String(w.altitude).padStart(5)} }`
  ).join(',\n');
}

function camelSlug(slug) {
  // bend-river-west -> BendRiverWest, river-west -> RiverWest, etc.
  return slug.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function buildEntry(area) {
  const ring = rings[area.slug];
  const ringLen = ring ? ring.length : 0;
  const stat = area.stat;
  const cp = area.cameraParams;
  const sp = area.socialPath;
  const constName = camelSlug(area.slug);

  // A row can exist with null median_sale_price when sold_count=0
  const hasValidStat = stat && stat.median_sale_price != null;

  const statBlock = hasValidStat
    ? `  verifiedStat: {
    label: 'median sale',
    value: '$${stat.median_sale_price.toLocaleString()}',
    source: 'market_stats_cache · ${area.slug} · rolling_90d · ${stat.computed_at.substring(0,10)}',
  },`
    : `  verifiedStat: null,  // rolling_90d median is null (sold_count=0) — stat beat omitted per §0`;

  const verifiedNote = hasValidStat
    ? `// Stat: market_stats_cache geo_slug='${area.slug}' period_type='rolling_90d'\n//   median_sale_price=${stat && stat.median_sale_price}, sold_count=${stat && stat.sold_count}, computed_at='${stat && stat.computed_at}'`
    : `// Stat: rolling_90d row has null median_sale_price — verifiedStat=null (no number to show)`;

  return `// ─────────────────────────────────────────────────────────────────────────────
// ${area.label}
// geo_slug='${area.slug}' | centroid=(${area.centroid.lat},${area.centroid.lon}) | diag≈${area.diagM}m
// Ring: ${ringLen} vertices from public.boundaries boundary_geojson RPC, fetched 2026-06-09.
${verifiedNote}
// ─────────────────────────────────────────────────────────────────────────────
export const ${constName}_RING: ReadonlyArray<readonly [number, number]> = ${formatRing(ring)};

export const ${constName}: NeighborhoodConfig = {
  geoSlug: '${area.slug}',
  label: '${area.label}',
  eyebrow: '${area.eyebrow}',
  origin: {
    lat: ${area.centroid.lat},
    lon: ${area.centroid.lon},
    height: ${area.groundM},
  },
  socialPath: [
${formatPath(sp)}
  ],
  heroOrbit: {
    azStart: 135,
    azEnd:   270,
    altitudeM: ${cp.altitudeM},
    radiusM:   ${cp.radiusM},
    pitchDeg:  ${cp.pitchDeg},
    fovDeg:    ${cp.fovDeg},
  },
  tileConfig: {
    minLoads: 80,
    quietMs:  8_000,
    maxWaitMs: 240_000,
  },
${statBlock}
};`;
}

const header = `/**
 * neighborhoodConfig — config-driven spec for every neighborhood flyover.
 *
 * 27 total: Awbrey Butte (pilot, Matt-approved 2026-06-09) + 26 batch areas.
 * Config-only batch: all data from Supabase, no hand-drawn polygons.
 *
 * Data fetched 2026-06-09:
 *   centroids + diags: scripts/_neighborhood_data_fetch.mjs
 *   polygon rings:     scripts/_neighborhood_rings_fetch.mjs
 *   market stats:      market_stats_cache, period_type='rolling_90d'
 */

import * as THREE from 'three';

export type CameraWaypoint = {
  t: number;
  east: number;
  north: number;
  altitude: number;
};

export type NeighborhoodConfig = {
  geoSlug: string;
  label: string;
  eyebrow: string;
  origin: { lat: number; lon: number; height?: number };
  socialPath: CameraWaypoint[];
  heroOrbit: {
    azStart: number;
    azEnd: number;
    altitudeM: number;
    radiusM: number;
    pitchDeg: number;
    fovDeg: number;
  };
  tileConfig?: {
    minLoads?: number;
    quietMs?: number;
    maxWaitMs?: number;
  };
  verifiedStat?: {
    label: string;
    value: string;
    source: string;
  } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// PILOT: Awbrey Butte (Matt-approved 2026-06-09)
// ─────────────────────────────────────────────────────────────────────────────
export const AWBREY_BUTTE: NeighborhoodConfig = {
  geoSlug: 'bend-awbrey-butte',
  label: 'Awbrey Butte',
  eyebrow: 'BEND · OREGON',
  origin: { lat: 44.0834, lon: -121.3327, height: 1160 },
  socialPath: [
    { t: 0.00, east:  2800, north:  2200, altitude: 3200 },
    { t: 0.20, east:  1800, north:  1400, altitude: 2200 },
    { t: 0.40, east: -1200, north:  -400, altitude: 1800 },
    { t: 0.60, east: -2200, north: -1800, altitude: 1400 },
    { t: 0.75, east: -1000, north: -2200, altitude:  900 },
    { t: 0.88, east:   600, north: -1600, altitude:  600 },
    { t: 1.00, east:  1200, north: -1000, altitude:  700 },
  ],
  heroOrbit: { azStart: 135, azEnd: 270, altitudeM: 1800, radiusM: 3500, pitchDeg: 52, fovDeg: 28 },
  tileConfig: { minLoads: 80, quietMs: 8_000, maxWaitMs: 240_000 },
  verifiedStat: {
    label: 'median sale',
    value: '$1,302,000',
    source: 'market_stats_cache · bend-awbrey-butte · rolling_90d · 2026-06-09',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BATCH (26 areas — Tier 1: Bend neighborhoods, Tier 2: resort communities)
// Generated 2026-06-09 from Supabase boundary_geojson RPC + market_stats_cache.
// ─────────────────────────────────────────────────────────────────────────────

`;

const body = all.map(buildEntry).join('\n\n');
const output = header + body + '\n';
writeFileSync(join(__dirname, '../video/tumalo-aerial/src/neighborhoodConfig.ts'), output);
console.log('Written neighborhoodConfig.ts — ' + output.length + ' bytes, ' + all.length + ' areas');
// Also write a manifest for other scripts
const manifest = all.map(a => ({
  slug: a.slug, label: a.label, eyebrow: a.eyebrow,
  tier: a.tier1 ? 1 : 2,
  constName: camelSlug(a.slug),
  centroid: a.centroid,
  diagM: a.diagM,
  hasStat: !!a.stat,
}));
writeFileSync(join(__dirname, '_neighborhood_manifest.json'), JSON.stringify({ areas: manifest }, null, 2));
console.log('Written _neighborhood_manifest.json');
