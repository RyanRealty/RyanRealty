#!/usr/bin/env node
/**
 * Fills public/broll/caldera-springs.json with portrait Unsplash search hits
 * for Caldera Springs / Caldera Links (neighborhood B-roll — not MLS listing photos).
 *
 * Requires UNSPLASH_ACCESS_KEY in repo-root .env.local (same as main app).
 * Run from repo root: node video/listing-tour/scripts/fetch-caldera-unsplash-broll.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTING_TOUR = path.resolve(__dirname, '..');
const REPO = path.resolve(LISTING_TOUR, '..', '..');
const OUT = path.join(LISTING_TOUR, 'public', 'broll', 'caldera-springs.json');

function loadRootEnv() {
  const envPath = path.join(REPO, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error(`Missing ${envPath}`);
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq < 1) continue;
    const k = s.slice(0, eq).trim();
    let v = s.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

/** Tight queries first; broader only if we still need frames for Act4. */
const QUERIES = [
  'Caldera Springs Sunriver Oregon',
  'Caldera Links golf Sunriver Oregon',
  'Sunriver Oregon golf community',
];

async function searchUnsplash(accessKey, query, perPage) {
  const u = new URL('https://api.unsplash.com/search/photos');
  u.searchParams.set('query', query);
  u.searchParams.set('per_page', String(perPage));
  u.searchParams.set('orientation', 'portrait');
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Unsplash ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.results ?? [];
}

async function main() {
  const env = loadRootEnv();
  const key = env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) {
    console.error('Set UNSPLASH_ACCESS_KEY in repo-root .env.local');
    process.exit(1);
  }

  const seen = new Set();
  const photos = [];

  for (const q of QUERIES) {
    if (photos.length >= 8) break;
    const results = await searchUnsplash(key, q, 12);
    for (const r of results) {
      if (!r?.id || seen.has(r.id)) continue;
      const url = r.urls?.regular || r.urls?.small;
      if (!url) continue;
      seen.add(r.id);
      photos.push({
        id: `unsplash-${r.id}`,
        url,
        sortOrder: photos.length,
        description: r.description || r.alt_description || q,
      });
      if (photos.length >= 8) break;
    }
  }

  if (photos.length < 2) {
    console.error('Not enough Unsplash results; try different QUERIES or check API.');
    process.exit(1);
  }

  const payload = {
    note: 'Auto-fetched Unsplash portrait results for Caldera / Sunriver area tone — vet each frame before client use; follow Unsplash license.',
    sourceQueries: QUERIES,
    fetchedAt: new Date().toISOString(),
    photos: photos.map(({ id, url, sortOrder }) => ({ id, url, sortOrder })),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${photos.length} photos to`, path.relative(REPO, OUT));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
