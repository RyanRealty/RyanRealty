import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/matthewryan/RyanRealty/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Tier 1: Bend neighborhoods (geo_type='neighborhood', geo_slug='bend-<slug>')
const TIER1 = [
  { slug: 'bend-river-west',       label: 'River West',        eyebrow: 'BEND · OREGON' },
  { slug: 'bend-old-bend',         label: 'Old Bend',          eyebrow: 'BEND · OREGON' },
  { slug: 'bend-summit-west',      label: 'Summit West',       eyebrow: 'BEND · OREGON' },
  { slug: 'bend-century-west',     label: 'Century West',      eyebrow: 'BEND · OREGON' },
  { slug: 'bend-orchard-district', label: 'Orchard District',  eyebrow: 'BEND · OREGON' },
  { slug: 'bend-mountain-view',    label: 'Mountain View',     eyebrow: 'BEND · OREGON' },
  { slug: 'bend-larkspur',         label: 'Larkspur',          eyebrow: 'BEND · OREGON' },
  { slug: 'bend-old-farm-district',label: 'Old Farm District', eyebrow: 'BEND · OREGON' },
  { slug: 'bend-boyd-acres',       label: 'Boyd Acres',        eyebrow: 'BEND · OREGON' },
  { slug: 'bend-southern-crossing',label: 'Southern Crossing', eyebrow: 'BEND · OREGON' },
  { slug: 'bend-southwest-bend',   label: 'Southwest Bend',    eyebrow: 'BEND · OREGON' },
  { slug: 'bend-southeast-bend',   label: 'Southeast Bend',    eyebrow: 'BEND · OREGON' },
];

// ── Tier 2: Resort communities (from resort-communities.json)
// geo_type='neighborhood', bare slug
const TIER2_REGISTRY = [
  { slug: 'tetherow',          label: 'Tetherow',         city: 'Bend',         eyebrow: 'BEND · OREGON' },
  { slug: 'broken-top',        label: 'Broken Top',       city: 'Bend',         eyebrow: 'BEND · OREGON' },
  { slug: 'eagle-crest',       label: 'Eagle Crest',      city: 'Redmond',      eyebrow: 'REDMOND · OREGON' },
  { slug: 'sunriver',          label: 'Sunriver',         city: 'Sunriver',     eyebrow: 'SUNRIVER · OREGON' },
  { slug: 'pronghorn',         label: 'Pronghorn',        city: 'Bend',         eyebrow: 'BEND · OREGON' },
  { slug: 'black-butte-ranch', label: 'Black Butte Ranch',city: 'Sisters',      eyebrow: 'SISTERS · OREGON' },
  { slug: 'caldera-springs',   label: 'Caldera Springs',  city: 'Sunriver',     eyebrow: 'SUNRIVER · OREGON' },
  { slug: 'awbrey-glen',       label: 'Awbrey Glen',      city: 'Bend',         eyebrow: 'BEND · OREGON' },
  { slug: 'northwest-crossing',label: 'NorthWest Crossing',city: 'Bend',        eyebrow: 'BEND · OREGON' },
  { slug: 'crosswater',        label: 'Crosswater',       city: 'Sunriver',     eyebrow: 'SUNRIVER · OREGON' },
  { slug: 'brasada-ranch',     label: 'Brasada Ranch',    city: 'Powell Butte', eyebrow: 'POWELL BUTTE · OREGON' },
  { slug: 'widgi-creek',       label: 'Widgi Creek',      city: 'Bend',         eyebrow: 'BEND · OREGON' },
  { slug: 'vandevert-ranch',   label: 'Vandevert Ranch',  city: 'Sunriver',     eyebrow: 'SUNRIVER · OREGON' },
  { slug: 'three-rivers',      label: 'Three Rivers',     city: 'Sunriver',     eyebrow: 'SUNRIVER · OREGON' },
];

function computeCentroid(geojsonStr) {
  const geojson = JSON.parse(geojsonStr);
  let coords = [];
  
  function collectCoords(geometry) {
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      coords.push(...geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(poly => coords.push(...poly[0]));
    } else if (geometry.type === 'Feature') {
      collectCoords(geometry.geometry);
    } else if (geometry.type === 'FeatureCollection') {
      geometry.features.forEach(f => collectCoords(f));
    }
  }
  collectCoords(geojson);
  
  if (coords.length === 0) return null;
  const lon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return { lat: Math.round(lat * 10000) / 10000, lon: Math.round(lon * 10000) / 10000 };
}

function getBoundingBox(geojsonStr) {
  const geojson = JSON.parse(geojsonStr);
  let coords = [];
  
  function collectCoords(geometry) {
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      coords.push(...geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(poly => coords.push(...poly[0]));
    } else if (geometry.type === 'Feature') {
      collectCoords(geometry.geometry);
    } else if (geometry.type === 'FeatureCollection') {
      geometry.features.forEach(f => collectCoords(f));
    }
  }
  collectCoords(geojson);
  
  if (coords.length === 0) return null;
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  
  // Approximate width and height in meters
  const degToRad = d => d * Math.PI / 180;
  const R = 6371000;
  const widthM = Math.abs(maxLon - minLon) * R * Math.cos(degToRad((minLat + maxLat) / 2)) * Math.PI / 180;
  const heightM = Math.abs(maxLat - minLat) * R * Math.PI / 180;
  const diagM = Math.sqrt(widthM * widthM + heightM * heightM);
  
  return { widthM: Math.round(widthM), heightM: Math.round(heightM), diagM: Math.round(diagM) };
}

function extractRing(geojsonStr) {
  const geojson = JSON.parse(geojsonStr);
  let ring = [];
  
  function collectRing(geometry) {
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      ring = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
      // Use the largest ring
      let maxLen = 0;
      geometry.coordinates.forEach(poly => {
        if (poly[0].length > maxLen) { maxLen = poly[0].length; ring = poly[0]; }
      });
    } else if (geometry.type === 'Feature') {
      collectRing(geometry.geometry);
    } else if (geometry.type === 'FeatureCollection') {
      geometry.features.forEach(f => collectRing(f));
    }
  }
  collectRing(geojson);
  return ring;
}

async function fetchBoundary(geoSlug, geoType = 'neighborhood') {
  const { data, error } = await supabase.rpc('boundary_geojson', {
    p_geo_type: geoType,
    p_geo_slug: geoSlug
  });
  if (error || !data) return null;
  
  const geojsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  try {
    const centroid = computeCentroid(geojsonStr);
    const bbox = getBoundingBox(geojsonStr);
    const ring = extractRing(geojsonStr);
    return { centroid, bbox, ring, geojsonStr };
  } catch(e) {
    return null;
  }
}

async function fetchMarketStat(geoSlug) {
  const { data, error } = await supabase
    .from('market_stats_cache')
    .select('median_sale_price, sold_count, computed_at')
    .eq('geo_type', 'neighborhood')
    .eq('geo_slug', geoSlug)
    .eq('period_type', 'rolling_90d')
    .order('computed_at', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0) return null;
  return data[0];
}

// Approximate ground elevation (meters) from lat/lon using rough terrain model
// Bend/Central Oregon: 
// - Bend urban ~1000-1100m
// - Awbrey Butte ~1160m (was pilot)
// - High desert communities (Pronghorn, Brasada) ~900-1000m
// - Sunriver/Caldera ~1300m
// - Black Butte Ranch ~1300m
// - Eagle Crest ~750m (lower Redmond area)
function estimateElevation(lat, lon) {
  // Sisters/Black Butte area (higher)
  if (lat > 44.3 && lon < -121.5) return 1200;
  // Sunriver/Caldera/Crosswater/Vandevert
  if (lat < 43.9 && lon < -121.3) return 1280;
  // Eagle Crest (Redmond, lower elevation)
  if (lat > 44.2 && lon > -121.35) return 770;
  // Brasada/Powell Butte (high desert plateau)
  if (lon > -121.2) return 960;
  // Three Rivers (lower Deschutes area)
  if (lat < 43.87) return 1250;
  // Northwest Crossing, Awbrey Glen (butte/elevated areas)
  if (lon < -121.33 && lat > 44.06) return 1130;
  // Generic Bend urban
  return 1050;
}

// Camera params based on polygon size
function computeCameraParams(diagM, centroid) {
  // Small: <3km diag (tight neighborhoods like Old Bend)
  // Medium: 3-8km
  // Large: >8km (big areas like Sunriver, Eagle Crest)
  
  let radiusM, altitudeM, pitchDeg, fovDeg;
  
  if (diagM < 2500) {
    // Small neighborhood
    radiusM = 1800; altitudeM = 1200; pitchDeg = 48; fovDeg = 32;
  } else if (diagM < 4000) {
    // Medium-small
    radiusM = 2500; altitudeM = 1600; pitchDeg = 50; fovDeg = 30;
  } else if (diagM < 6000) {
    // Medium
    radiusM = 3500; altitudeM = 2000; pitchDeg = 52; fovDeg = 28;
  } else if (diagM < 10000) {
    // Large
    radiusM = 5500; altitudeM = 3000; pitchDeg = 54; fovDeg = 26;
  } else {
    // Very large (Sunriver, Eagle Crest, BBR)
    radiusM = 8000; altitudeM = 4500; pitchDeg = 56; fovDeg = 24;
  }
  
  return { radiusM, altitudeM, pitchDeg, fovDeg };
}

function computeSocialPath(diagM) {
  // Scale path waypoints based on polygon size
  const scale = Math.max(0.7, Math.min(3.0, diagM / 3500));
  return [
    { t: 0.00, east: Math.round( 2800 * scale), north: Math.round( 2200 * scale), altitude: Math.round(3200 * scale) },
    { t: 0.20, east: Math.round( 1800 * scale), north: Math.round( 1400 * scale), altitude: Math.round(2200 * scale) },
    { t: 0.40, east: Math.round(-1200 * scale), north: Math.round( -400 * scale), altitude: Math.round(1800 * scale) },
    { t: 0.60, east: Math.round(-2200 * scale), north: Math.round(-1800 * scale), altitude: Math.round(1400 * scale) },
    { t: 0.75, east: Math.round(-1000 * scale), north: Math.round(-2200 * scale), altitude: Math.round( 900 * scale) },
    { t: 0.88, east: Math.round(  600 * scale), north: Math.round(-1600 * scale), altitude: Math.round( 600 * scale) },
    { t: 1.00, east: Math.round( 1200 * scale), north: Math.round(-1000 * scale), altitude: Math.round( 700 * scale) },
  ];
}

async function processArea(area, geoType = 'neighborhood') {
  console.error(`  Fetching boundary: ${area.slug} (${geoType})`);
  const boundary = await fetchBoundary(area.slug, geoType);
  
  if (!boundary) {
    console.error(`  SKIP: no boundary row for ${area.slug}`);
    return { ...area, status: 'NO_BOUNDARY', reason: 'No row in public.boundaries for this geo_slug' };
  }
  
  const { centroid, bbox } = boundary;
  const groundM = estimateElevation(centroid.lat, centroid.lon);
  const diagM = bbox.diagM;
  const cameraParams = computeCameraParams(diagM, centroid);
  const socialPath = computeSocialPath(diagM);
  
  console.error(`  Fetching market stats: ${area.slug}`);
  const stat = await fetchMarketStat(area.slug);
  
  console.error(`  ${area.slug}: centroid=(${centroid.lat},${centroid.lon}), diag=${diagM}m, stat=${stat ? '$' + stat.median_sale_price : 'none'}`);
  
  return {
    ...area,
    status: 'OK',
    centroid,
    groundM,
    diagM,
    bbox,
    cameraParams,
    socialPath,
    stat,
  };
}

async function main() {
  console.error('=== Fetching Tier 1 (Bend neighborhoods) ===');
  const tier1Results = [];
  for (const area of TIER1) {
    const result = await processArea(area, 'neighborhood');
    tier1Results.push(result);
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }
  
  console.error('\n=== Fetching Tier 2 (Resort communities) ===');
  const tier2Results = [];
  for (const area of TIER2_REGISTRY) {
    const result = await processArea(area, 'neighborhood');
    tier2Results.push(result);
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(JSON.stringify({ tier1: tier1Results, tier2: tier2Results }, null, 2));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
