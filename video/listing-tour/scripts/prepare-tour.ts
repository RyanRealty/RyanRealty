/**
 * Fetches listing + photos from Supabase, optional Replicate i2v clips,
 * ElevenLabs VO, and writes Remotion props to out/tour-props.json.
 *
 * Run from repo root:
 *   npx tsx video/listing-tour/scripts/prepare-tour.ts --listing-key="YOUR_KEY"
 *
 * Or from this directory:
 *   npm run prepare:tour -- --listing-key="YOUR_KEY"
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';

import type { Database } from '../../../types/database';
import {
  buildFactsFragment,
  buildPositioningPhrase,
  composeFullAddressFromMls,
  formatAddressForHookOverlay,
  formatListPrice,
} from '../src/mls-copy';

type Args = {
  listingKey: string;
  branded: boolean;
  i2v: boolean;
  voice: boolean;
  /** Ken-burns-only escape hatch (not recommended for Reels). */
  allowStills: boolean;
  /** Optional JSON of neighborhood B-roll (e.g. Caldera Springs). See `public/broll/caldera-springs.json`. */
  brollJsonPath: string | null;
};

function parseArgs(argv: string[]): Args {
  let listingKey = '';
  let branded = true;
  let i2v = true;
  let voice = true;
  let allowStills = false;
  let brollJsonPath: string | null = null;
  for (const a of argv) {
    if (a.startsWith('--listing-key='))
      listingKey = a.slice('--listing-key='.length).replace(/^["']|["']$/g, '');
    if (a.startsWith('--broll-json=')) {
      brollJsonPath = a.slice('--broll-json='.length).replace(/^["']|["']$/g, '').trim() || null;
    }
    if (a === '--unbranded') branded = false;
    if (a === '--no-i2v') {
      i2v = false;
      allowStills = true;
    }
    if (a === '--allow-stills') allowStills = true;
    if (a === '--skip-voice') voice = false;
  }
  if (!listingKey) {
    console.error(
      'Usage: prepare-tour.ts --listing-key="KEY" [--broll-json=path/to.json] [--unbranded] [--no-i2v|--allow-stills] [--skip-voice]',
    );
    process.exit(1);
  }
  return { listingKey, branded, i2v, voice, allowStills, brollJsonPath };
}

type BrollPhotoRow = { id: string; url: string; sortOrder: number };

function loadBrollPhotos(
  repoRoot: string,
  listingTourRoot: string,
  explicitPath: string | null,
): BrollPhotoRow[] {
  const candidates: string[] = [];
  if (explicitPath) {
    candidates.push(
      path.isAbsolute(explicitPath)
        ? explicitPath
        : path.join(repoRoot, explicitPath),
    );
  }
  candidates.push(
    path.join(listingTourRoot, 'public', 'broll', 'caldera-springs.json'),
  );
  const jsonPath = candidates.find((p) => fs.existsSync(p));
  if (!jsonPath) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.warn('[prepare-tour] B-roll JSON parse failed:', jsonPath, e);
    return [];
  }

  const rawList = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { photos?: unknown }).photos)
      ? (parsed as { photos: unknown[] }).photos
      : null;
  if (!rawList) {
    console.warn('[prepare-tour] B-roll JSON must be an array or { "photos": [...] }:', jsonPath);
    return [];
  }

  const out: BrollPhotoRow[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const row = rawList[i];
    if (!row || typeof row !== 'object') continue;
    const o = row as { id?: unknown; url?: unknown; sortOrder?: unknown };
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (!url) continue;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `broll-${i}`;
    const sortOrder =
      typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : i;
    out.push({ id, url, sortOrder });
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder);
  if (out.length) {
    console.log(`[prepare-tour] B-roll stills (${out.length}) from`, path.relative(repoRoot, jsonPath));
  }
  return out;
}

/** Keys prepare reads — file first, then fill gaps from `process.env` (CI / exported vars). */
const ENV_KEYS_FROM_PROCESS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REPLICATE_API_TOKEN',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  /** Optional: when MLS has zero photos, prepare can pull portrait stills from Unsplash (not the listing). */
  'UNSPLASH_ACCESS_KEY',
] as const;

function loadRootEnv(): Record<string, string> {
  /** scripts/ → listing-tour → video → repo root */
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const envPath = path.join(repoRoot, '.env.local');
  const out: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
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
  } else {
    console.warn('Missing .env.local — using process.env only for known keys:', envPath);
  }

  for (const k of ENV_KEYS_FROM_PROCESS) {
    const fromProc = process.env[k]?.trim();
    if (!fromProc) continue;
    if (!out[k]?.trim()) out[k] = fromProc;
  }

  if (!out.NEXT_PUBLIC_SUPABASE_URL?.trim() || !out.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error(
      'Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or environment.',
    );
    process.exit(1);
  }

  return out;
}

function median(nums: number[]): number | null {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function assertTourSourceFacts(
  listingKey: string,
  fullAddress: string,
  listNumber: string | null | undefined,
  listPrice: number | null | undefined,
): void {
  const missing: string[] = [];
  if (!fullAddress.trim()) missing.push('full address (street + city/state/zip or unparsed_address)');
  if (!String(listNumber ?? '').trim()) missing.push('ListNumber');
  if (listPrice == null || Number.isNaN(listPrice)) missing.push('ListPrice');
  if (missing.length) {
    console.error(
      `[prepare-tour] Refusing to write marketing props for ${listingKey}: missing ${missing.join('; ')}. Fix MLS sync — no placeholder reel.`,
    );
    process.exit(1);
  }
}

type SparkPhoto = {
  Id?: string;
  Uri1600?: string;
  Uri1280?: string;
  Uri1024?: string;
  Primary?: boolean;
};

type PhotoSource = { id: string; url: string; sortOrder: number };

/** MLS Spark `details.Photos` when `listing_photos` is empty. */
function photosFromListingDetails(details: unknown): PhotoSource[] {
  if (!details || typeof details !== 'object') return [];
  const raw = (details as { Photos?: unknown }).Photos;
  if (!Array.isArray(raw)) return [];
  const mapped: Array<PhotoSource & { primary: boolean }> = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i] as SparkPhoto;
    const url = p.Uri1600 || p.Uri1280 || p.Uri1024;
    const id = p.Id != null ? String(p.Id) : `spark-${i}`;
    if (!url) continue;
    mapped.push({
      id,
      url: String(url),
      sortOrder: i,
      primary: !!p.Primary,
    });
  }
  mapped.sort((a, b) => (a.primary === b.primary ? 0 : a.primary ? -1 : 1));
  return mapped.map(({ id, url, sortOrder }) => ({ id, url, sortOrder }));
}

type ListingGeoForStock = {
  city: string | null;
  state: string | null;
  postal: string | null;
  subdivision: string | null;
};

/**
 * Last-resort stills for prepare when MLS has no rows (not the subject property — editorial / area tone only).
 * Uses Unsplash Search API; follow Unsplash license when publishing.
 */
async function fetchUnsplashFallbackPhotos(
  geo: ListingGeoForStock,
  accessKey: string,
  targetCount: number,
): Promise<PhotoSource[]> {
  const city = geo.city?.trim();
  const state = geo.state?.trim();
  const sub = geo.subdivision?.trim();
  const q =
    city && state
      ? `${city} ${state} luxury home interior`
      : city
        ? `${city} luxury real estate interior`
        : sub
          ? `${sub} residential interior`
          : 'Pacific Northwest modern home interior';
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', q);
  url.searchParams.set('per_page', String(Math.min(30, targetCount + 8)));
  url.searchParams.set('orientation', 'portrait');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[prepare-tour] Unsplash fallback HTTP', res.status, t.slice(0, 200));
    return [];
  }
  const json = (await res.json()) as {
    results?: Array<{ id: string; urls?: { regular?: string; full?: string } }>;
  };
  const rows = json.results ?? [];
  const out: PhotoSource[] = [];
  for (let i = 0; i < rows.length && out.length < targetCount; i++) {
    const r = rows[i];
    const u = r?.urls?.regular || r?.urls?.full;
    if (!r?.id || !u) continue;
    out.push({ id: `unsplash-${r.id}`, url: u, sortOrder: i });
  }
  return out;
}

async function downloadUrlToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

async function elevenLabsTts(
  apiKey: string,
  voiceId: string,
  text: string,
  outFile: string,
): Promise<void> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
      }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${t}`);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
}

const WAN_MODEL =
  process.env.REPLICATE_WAN_I2V_MODEL?.trim() ||
  'wavespeedai/wan-2.1-i2v-480p';

async function runI2v(
  replicate: Replicate,
  imageUrl: string,
  prompt: string,
  outMp4: string,
): Promise<boolean> {
  try {
    const out = (await replicate.run(WAN_MODEL as `${string}/${string}`, {
      input: {
        image: imageUrl,
        prompt,
        num_frames: 81,
        fps: 16,
        motion_bucket_id: 80,
      },
    })) as unknown;
    const url =
      typeof out === 'string'
        ? out
        : Array.isArray(out)
          ? String(out[0])
          : (out as { output?: string })?.output ??
            (out as { url?: string })?.url;
    if (!url || !String(url).startsWith('http')) {
      console.warn('[i2v] Unexpected output shape:', out);
      return false;
    }
    await downloadUrlToFile(String(url), outMp4);
    return true;
  } catch (e) {
    console.warn('[i2v] failed:', e);
    return false;
  }
}

function syncPublicAssetsFromCascade(): void {
  const listingTourRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(listingTourRoot, '..', '..');
  const script = path.join(repoRoot, 'scripts', 'sync-listing-tour-assets.mjs');
  const r = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('sync-listing-tour-assets.mjs failed');
    process.exit(r.status ?? 1);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  syncPublicAssetsFromCascade();
  const env = loadRootEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const listingTourRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(listingTourRoot, '..', '..');
  const publicDir = path.join(listingTourRoot, 'public');
  const outDir = path.join(listingTourRoot, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const slug = args.listingKey.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 96);
  const cacheDir = path.join(publicDir, 'tour-cache', slug);

  const supabase = createClient<Database>(url, service);

  const { data: listing, error: le } = await supabase
    .from('listings')
    .select(
      'ListingKey,ListNumber,StreetNumber,StreetName,City,State,PostalCode,ListPrice,BedroomsTotal,BathroomsTotal,TotalLivingAreaSqFt,year_built,Latitude,Longitude,public_remarks,PropertyType,SubdivisionName,StandardStatus,details,PhotoURL',
    )
    .eq('ListingKey', args.listingKey)
    .maybeSingle();

  if (le || !listing) {
    console.error('Listing fetch failed:', le?.message ?? 'no row');
    process.exit(1);
  }

  const { data: photoRows, error: pe } = await supabase
    .from('listing_photos')
    .select('id, photo_url, cdn_url, sort_order, is_hero, caption')
    .eq('listing_key', args.listingKey)
    .order('sort_order', { ascending: true });

  if (pe) {
    console.error('Photos fetch failed:', pe.message);
    process.exit(1);
  }

  const dbRows = photoRows ?? [];
  let photoSources: PhotoSource[] = [];

  if (dbRows.length > 0) {
    const sorted = [...dbRows].sort((a, b) => {
      if (a.is_hero !== b.is_hero) return a.is_hero ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    photoSources = sorted.map((r, i) => ({
      id: r.id,
      url: (r.cdn_url || r.photo_url).trim(),
      sortOrder: r.sort_order ?? i,
    }));
  } else {
    photoSources = photosFromListingDetails(listing.details);
    const heroUrl = (listing.PhotoURL as string | null)?.trim();
    if (photoSources.length === 0 && heroUrl) {
      photoSources = [{ id: 'hero-mls', url: heroUrl, sortOrder: 0 }];
    }
  }

  if (photoSources.length < 4) {
    console.warn(
      `Warning: only ${photoSources.length} photos — tour still renders (ideal 6+).`,
    );
  }

  /** One reel timeline: hero + 6 interiors + 2 tail (matches Remotion act budgets). */
  const REEL_MAX_PHOTOS = 9;

  if (photoSources.length === 0) {
    const unsplashKey = env.UNSPLASH_ACCESS_KEY?.trim();
    if (unsplashKey) {
      console.warn(
        '[prepare-tour] No MLS photos — pulling Unsplash portrait stills as placeholders (not this listing). Replace with listing_photos before client-facing export.',
      );
      photoSources = await fetchUnsplashFallbackPhotos(
        {
          city: listing.City as string | null,
          state: listing.State as string | null,
          postal: listing.PostalCode as string | null,
          subdivision: listing.SubdivisionName as string | null,
        },
        unsplashKey,
        REEL_MAX_PHOTOS,
      );
    }
    if (photoSources.length === 0) {
      console.error(
        'No photos for listing (listing_photos, details.Photos, or PhotoURL). Add UNSPLASH_ACCESS_KEY to repo-root .env.local for Unsplash fallback, or sync MLS photos.',
      );
      process.exit(1);
    }
  }

  photoSources = photoSources.slice(0, REEL_MAX_PHOTOS);

  const street = [listing.StreetNumber, listing.StreetName]
    .filter(Boolean)
    .join(' ');

  let unparsedFromProperty: string | null = null;
  if (listing.StreetNumber && listing.PostalCode) {
    const { data: propRow } = await supabase
      .from('properties')
      .select('unparsed_address')
      .eq('street_number', String(listing.StreetNumber).trim())
      .eq('postal_code', String(listing.PostalCode).trim())
      .limit(1)
      .maybeSingle();
    unparsedFromProperty =
      (propRow as { unparsed_address?: string } | null)?.unparsed_address?.trim() ??
      null;
  }

  const fullAddress = composeFullAddressFromMls({
    StreetNumber: listing.StreetNumber,
    StreetName: listing.StreetName,
    City: listing.City,
    State: listing.State,
    PostalCode: listing.PostalCode,
    unparsedFromProperty,
  });

  assertTourSourceFacts(
    args.listingKey,
    fullAddress,
    listing.ListNumber,
    listing.ListPrice,
  );

  const priceStr = formatListPrice(listing.ListPrice);
  const sub = (listing.SubdivisionName as string | null)?.trim() || '';
  const positioning = buildPositioningPhrase(sub || null, listing.City);
  const factsFrag = buildFactsFragment(listing);
  const hookSubParts = [
    positioning,
    priceStr || null,
    factsFrag || null,
  ].filter(Boolean) as string[];
  const hookSubline = hookSubParts.length ? hookSubParts.join(' · ') : null;

  const listNum = String(listing.ListNumber ?? '').trim();
  const viral = {
    hookLine: formatAddressForHookOverlay(fullAddress),
    hookSubline,
    badgeText: listNum ? `MLS ${listNum}` : null,
  };

  const remarks = (listing.public_remarks as string | null)?.replace(
    /\s+/g,
    ' ',
  );
  const shortRemarks =
    remarks && remarks.length > 200 ? `${remarks.slice(0, 200)}…` : remarks;

  const script = args.branded
    ? [
        `Tour of ${fullAddress.replace(/\n/g, ', ')}.${sub ? ` In ${sub}.` : ''}${priceStr ? ` Listed ${priceStr}.` : ''} Quick walkthrough — Ryan Realty.`,
        shortRemarks ? shortRemarks.slice(0, 280) : '',
        `Matt Ryan — five four one, two one three, six seven zero six.`,
      ]
        .filter(Boolean)
        .join(' ')
    : [
        `Ask your agent about ${fullAddress.replace(/\n/g, ', ')} — MLS ${listing.ListNumber}.`,
        `Contact your agent for a showing.`,
      ].join(' ');

  let voiceRel: string | null = null;
  if (args.voice) {
    const ek = env.ELEVENLABS_API_KEY;
    const vid = env.ELEVENLABS_VOICE_ID;
    if (!ek || !vid) {
      console.warn('ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID missing — skip voice');
    } else {
      const voicePath = path.join(cacheDir, 'voice.mp3');
      await elevenLabsTts(ek, vid, script, voicePath);
      voiceRel = `tour-cache/${slug}/voice.mp3`;
      console.log('Wrote voice:', voicePath);
    }
  }

  const i2vRelById = new Map<string, string>();
  const repToken = env.REPLICATE_API_TOKEN?.trim();

  if (args.i2v && !repToken && !args.allowStills) {
    console.error(
      'REPLICATE_API_TOKEN is required for motion-first Reels. Add it to .env.local, or pass --allow-stills for Ken Burns only (weak for short-form).',
    );
    process.exit(1);
  }

  if (args.i2v && repToken) {
    const replicate = new Replicate({ auth: repToken });
    /** Prompts aligned with `interior-animation-rules.md` + banned vocab from `ai-video-production.md` (no "cinematic/photorealistic/etc."). */
    const INTERIOR_NEGATIVE =
      'morphing, swimming textures, distortion, camera drift, furniture movement, wall deformation, warping tile, morphing cabinets, zoom, pan, tilt, floor movement, texture swimming, wood grain flowing, marble drifting, grout lines moving, perspective creep, edge softening, corner drift, CGI, cartoon, illustration, 3D render, jello effect, rolling shutter, people, text, watermark, logo';

    const slotPrompts = [
      `[SCENE] Pacific Northwest luxury home exterior at golden hour, architectural photography. Camera: 35mm, ultra-slow dolly out on tripod, eye level. Lighting: warm sidelight 3200K, soft shadow fill. Film stock: Kodak 2383. Color palette: deep navy shadow, warm gold highlight, sage foliage. Duration: 5 seconds. Negative: ${INTERIOR_NEGATIVE}`,
      `[SCENE] Bright interior living space, natural window light. Camera: locked tripod, 35mm, zero pan tilt roll. MOTION: sheer curtains breathe subtly at one window only; all walls floors furniture rigid. Lighting: daylight 5600K. Film stock: ARRI Alexa neutral. Color palette: cream, walnut, soft white. Duration: 5 seconds. Negative: ${INTERIOR_NEGATIVE}`,
      `[SCENE] Interior depth toward adjoining space. Camera: locked, 50mm, static frame. MOTION: single light shaft shifts 2-3 degrees only; no camera move. Lighting: mixed daylight + soft fill. Film stock: Fujifilm Provia. Color palette: stone gray, warm wood, white trim. Duration: 5 seconds. Negative: ${INTERIOR_NEGATIVE}`,
      `[SCENE] Kitchen with window light. Camera: locked, 35mm. MOTION: optional single thin steam ribbon vertical from kettle only; counters cabinets tile rigid. Lighting: practical window key. Film stock: Kodak Vision 250D. Color palette: white cabinet, brushed metal, green plant. Duration: 5 seconds. Negative: ${INTERIOR_NEGATIVE}`,
      `[SCENE] Primary suite or bedroom, morning light. Camera: locked tripod, 50mm. MOTION: plant leaves micro-sway only if visible; bed and walls rigid. Lighting: soft morning 4800K. Film stock: Kodak 2383. Color palette: linen, oak, soft blue. Duration: 5 seconds. Negative: ${INTERIOR_NEGATIVE}`,
      `[SCENE] Outdoor living or patio, trees and sky. Camera: 35mm, locked tripod with 1% forward dolly only if model supports without distortion; otherwise fully locked. Lighting: natural daylight. Film stock: ARRI Alexa. Color palette: evergreen, sky blue, warm deck wood. Duration: 5 seconds. Negative: ${INTERIOR_NEGATIVE}`,
    ];
    const slots = Math.min(6, photoSources.length);
    const jobs = Array.from({ length: slots }, (_, index) => ({
      index,
      prompt: slotPrompts[index] ?? slotPrompts[1]!,
    }));

    const runOne = async (index: number, prompt: string) => {
      const row = photoSources[index];
      if (!row) return;
      const outMp4 = path.join(cacheDir, `i2v_${row.id}.mp4`);
      const ok = await runI2v(replicate, row.url.trim(), prompt, outMp4);
      if (ok) i2vRelById.set(row.id, `tour-cache/${slug}/i2v_${row.id}.mp4`);
    };

    for (let j = 0; j < jobs.length; j += 2) {
      const batch = jobs.slice(j, j + 2);
      await Promise.all(
        batch.map((job) => runOne(job.index, job.prompt)),
      );
    }
    console.log(`[i2v] ${i2vRelById.size} motion clips ready (of ${slots} attempted)`);
  }

  const tourPhotos = photoSources.map((r) => ({
    id: r.id,
    url: r.url.trim(),
    sortOrder: r.sortOrder,
    i2vStaticPath: i2vRelById.get(r.id) ?? null,
  }));

  const motionClipCount = tourPhotos.filter((p) => p.i2vStaticPath).length;
  if (args.i2v && !args.allowStills && repToken && motionClipCount < 5) {
    console.error(
      `[i2v] Only ${motionClipCount} clips succeeded (need ≥5 for a motion reel). Check model ${WAN_MODEL} or re-run. Use --allow-stills to bypass.`,
    );
    process.exit(1);
  }

  const zip = listing.PostalCode as string | null;
  let daysBack = 90;
  let compRows: Array<{
    DaysOnMarket: number | null;
    ListPrice: number | null;
    TotalLivingAreaSqFt: number | null;
  }> = [];

  const fetchComps = async (days: number) => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const iso = since.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('listings')
      .select('DaysOnMarket, ListPrice, TotalLivingAreaSqFt')
      .eq('PostalCode', zip ?? '')
      .eq('PropertyType', 'A')
      .gte('CloseDate', iso)
      .or('StandardStatus.ilike.%closed%,StandardStatus.ilike.%sold%')
      .limit(1200);
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  if (zip) {
    try {
      compRows = await fetchComps(daysBack);
      if (compRows.length < 5) {
        daysBack = 180;
        compRows = await fetchComps(daysBack);
      }
    } catch (e) {
      console.warn('Comp stats query failed:', e);
      compRows = [];
    }
  }

  const doms = compRows
    .map((r) => r.DaysOnMarket)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const ppsfs = compRows
    .map((r) => {
      const la = r.TotalLivingAreaSqFt;
      const p = r.ListPrice;
      if (!la || !p || la <= 0) return NaN;
      return p / la;
    })
    .filter((n) => Number.isFinite(n));

  const compStats = {
    sampleSize: compRows.length,
    avgDom: doms.length ? doms.reduce((a, b) => a + b, 0) / doms.length : null,
    medianPricePerSqft: median(ppsfs),
  };

  const brollPhotos = loadBrollPhotos(repoRoot, listingTourRoot, args.brollJsonPath);

  const props = {
    branded: args.branded,
    voiceStaticPath: voiceRel,
    viral,
    brollPhotos,
    listing: {
      ListingKey: String(listing.ListingKey ?? args.listingKey),
      ListNumber: String(listing.ListNumber ?? ''),
      StreetNumber: listing.StreetNumber,
      StreetName: listing.StreetName,
      City: listing.City,
      State: listing.State,
      PostalCode: listing.PostalCode,
      FullAddress: fullAddress,
      ListPrice: listing.ListPrice,
      BedroomsTotal: listing.BedroomsTotal,
      BathroomsTotal: listing.BathroomsTotal,
      LivingAreaSqFt: listing.TotalLivingAreaSqFt,
      YearBuilt: listing.year_built,
      Latitude: listing.Latitude,
      Longitude: listing.Longitude,
      SubdivisionName: listing.SubdivisionName,
      StandardStatus: listing.StandardStatus,
    },
    photos: tourPhotos,
    compStats,
  };

  const propsPath = path.join(outDir, 'tour-props.json');
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2), 'utf8');
  console.log('Wrote props:', propsPath);
  console.log('\nRender MP4 (from video/listing-tour):');
  console.log(
    `  cd "${listingTourRoot}" && npx remotion render src/index.ts ListingTour out/tour_render.mp4 --props="${propsPath}" --log=verbose`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
