import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/matthewryan/RyanRealty/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SLUGS = [
  // Tier 1
  'bend-river-west','bend-old-bend','bend-summit-west','bend-century-west',
  'bend-orchard-district','bend-mountain-view','bend-larkspur',
  'bend-old-farm-district','bend-boyd-acres','bend-southern-crossing',
  'bend-southwest-bend','bend-southeast-bend',
  // Tier 2
  'tetherow','broken-top','eagle-crest','sunriver','pronghorn',
  'black-butte-ranch','caldera-springs','awbrey-glen','northwest-crossing',
  'crosswater','brasada-ranch','widgi-creek','vandevert-ranch','three-rivers'
];

function extractRing(geojsonStr) {
  const geojson = JSON.parse(geojsonStr);
  let ring = [];
  
  function collectRing(geometry) {
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      ring = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
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

async function main() {
  const rings = {};
  for (const slug of SLUGS) {
    const { data, error } = await supabase.rpc('boundary_geojson', {
      p_geo_type: 'neighborhood',
      p_geo_slug: slug
    });
    if (error || !data) {
      console.error(`MISS: ${slug}`);
      rings[slug] = null;
    } else {
      const geojsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      rings[slug] = extractRing(geojsonStr);
      console.error(`OK: ${slug} → ${rings[slug].length} vertices`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(JSON.stringify(rings));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
