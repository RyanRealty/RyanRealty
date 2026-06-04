#!/usr/bin/env node
/**
 * Ryan Realty asset library — Supabase-backed cloud store + local cache.
 *
 * Architecture (rewritten 2026-05-07 to add cloud durability):
 *   PRIMARY  → Supabase Postgres table `asset_library` (queryable index)
 *              + Supabase Storage bucket `asset-library` (durable file store)
 *   CACHE    → Local filesystem at `public/asset-library/` (fast access during builds)
 *   FALLBACK → Local manifest at `data/asset-library/manifest.json` (when offline)
 *
 * Every register() call writes to BOTH Supabase and the local cache. Every
 * search() call hits Supabase first; if that fails (offline / down), reads
 * the local manifest. This gives us cloud durability + multi-machine access
 * without losing build speed.
 *
 * CLI usage (unchanged from local-only version):
 *   node lib/asset-library.mjs search --geo bend --type photo --tags "smith-rock"
 *   node lib/asset-library.mjs register <file> --type photo --source shutterstock \
 *     --license-id 123 --geo "bend,central-oregon" --subject "mountain,snow" \
 *     --search-query "smith rock oregon" --creator "Jane Photographer" \
 *     --width 4000 --height 6000
 *   node lib/asset-library.mjs mark-used <asset-id> --render <path> --scene <id> \
 *     --render-type short-form
 *   node lib/asset-library.mjs stats
 *   node lib/asset-library.mjs list --recent 10 --type photo
 *
 * Programmatic usage (ESM):
 *   import { search, register, markUsed, stats } from './lib/asset-library.mjs'
 *
 * Storage schema:
 *   - Postgres table public.asset_library (see supabase/migrations/*_asset_library_v1.sql)
 *   - Storage bucket asset-library (public read on approved files)
 *   - Object path pattern: {type}s/{source}/{uuid}.{ext}
 *     e.g. photos/shutterstock/abc123.jpg, videos/pexels/xyz789.mp4
 */

import { readFile, writeFile, mkdir, copyFile, stat, readFile as fsReadFile } from 'node:fs/promises'
import { resolve, dirname, basename, extname, relative, join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MANIFEST_PATH = resolve(ROOT, 'data', 'asset-library', 'manifest.json')
const ASSETS_ROOT = resolve(ROOT, 'public', 'asset-library')

// ---------------------------------------------------------------------------
// Supabase client (lazy-initialized on first use)
// ---------------------------------------------------------------------------

let _supabase = null
function getSupabase() {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  _supabase = {
    url: url.replace(/\/+$/, ''),
    key,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  }
  return _supabase
}

const STORAGE_BUCKET = 'asset-library'

// MIME map for Storage uploads
function mimeFor(ext) {
  const e = ext.toLowerCase()
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg'
  if (e === '.png') return 'image/png'
  if (e === '.webp') return 'image/webp'
  if (e === '.gif') return 'image/gif'
  if (e === '.mp4') return 'video/mp4'
  if (e === '.mov') return 'video/quicktime'
  if (e === '.webm') return 'video/webm'
  if (e === '.mp3') return 'audio/mpeg'
  if (e === '.m4a') return 'audio/mp4'
  if (e === '.wav') return 'audio/wav'
  return 'application/octet-stream'
}

// Upload a file to Supabase Storage. Returns { path, publicUrl } or null on failure.
async function uploadToStorage(localPath, objectPath) {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const buf = await fsReadFile(localPath)
    const ext = extname(localPath)
    const r = await fetch(`${sb.url}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: {
        ...sb.headers,
        'Content-Type': mimeFor(ext),
        'x-upsert': 'true',
      },
      body: buf,
    })
    if (!r.ok) {
      console.warn(`asset-library: Storage upload failed (${r.status}): ${await r.text().catch(() => 'no body')}`)
      return null
    }
    const publicUrl = `${sb.url}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`
    return { path: objectPath, publicUrl }
  } catch (e) {
    console.warn(`asset-library: Storage upload error: ${e.message}`)
    return null
  }
}

// Insert/upsert into the asset_library table. Returns the row or null on failure.
async function insertRow(asset) {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const r = await fetch(`${sb.url}/rest/v1/asset_library?on_conflict=source,source_id`, {
      method: 'POST',
      headers: {
        ...sb.headers,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(asset),
    })
    if (!r.ok) {
      console.warn(`asset-library: Postgres insert failed (${r.status}): ${await r.text().catch(() => 'no body')}`)
      return null
    }
    const rows = await r.json()
    return rows[0] || null
  } catch (e) {
    console.warn(`asset-library: Postgres insert error: ${e.message}`)
    return null
  }
}

// Precise existing-row lookup by (source, source_id). Unlike searchSupabase
// (capped at `limit` and recency-ordered), this finds the canonical row no
// matter how many assets share the same source — so a re-ingest dedups
// reliably and NEVER overwrites curated fields (approval, geo_tags,
// subject_tags, notes) via the merge-duplicates upsert.
// Returns: the row if found · null if cloud says not-found · false if cloud
// is unavailable (so the caller can fall back to the local manifest).
async function findBySourceId(source, sourceId) {
  const sb = getSupabase()
  if (!sb) return false
  try {
    const params = new URLSearchParams()
    params.set('source', `eq.${source}`)
    params.set('source_id', `eq.${sourceId}`)
    params.set('limit', '1')
    const r = await fetch(`${sb.url}/rest/v1/asset_library?${params.toString()}`, {
      headers: sb.headers,
    })
    if (!r.ok) return false
    const rows = await r.json()
    return rows[0] || null
  } catch (e) {
    console.warn(`asset-library: findBySourceId error: ${e.message}`)
    return false
  }
}

// Search via Postgres (preferred) or fall back to local manifest.
async function searchSupabase(filters) {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const params = new URLSearchParams()
    if (filters.type) params.set('type', `eq.${filters.type}`)
    if (filters.source) params.set('source', `eq.${filters.source}`)
    if (filters.approval) params.set('approval', `eq.${filters.approval}`)
    if (filters.geo && filters.geo.length) {
      // PostgREST array-overlap filter on text[] column
      const arr = filters.geo.map(g => `"${g.toLowerCase()}"`).join(',')
      params.set('geo_tags', `ov.{${arr}}`)
    }
    if (filters.subject && filters.subject.length) {
      const arr = filters.subject.map(s => `"${s.toLowerCase()}"`).join(',')
      params.set('subject_tags', `ov.{${arr}}`)
    }
    if (filters.unusedOnly) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      params.set('or', `(last_used_at.is.null,last_used_at.lt.${cutoff})`)
    }
    params.set('order', 'registered_at.desc')
    params.set('limit', String(filters.limit || 20))
    const r = await fetch(`${sb.url}/rest/v1/asset_library?${params.toString()}`, {
      headers: sb.headers,
    })
    if (!r.ok) {
      console.warn(`asset-library: Postgres search failed (${r.status})`)
      return null
    }
    return await r.json()
  } catch (e) {
    console.warn(`asset-library: Postgres search error: ${e.message}`)
    return null
  }
}

// Append a usage record to the row's used_in array atomically.
async function appendUsageSupabase(assetId, usage) {
  const sb = getSupabase()
  if (!sb) return null
  try {
    // Read current used_in, append, write back.
    const getR = await fetch(`${sb.url}/rest/v1/asset_library?id=eq.${assetId}&select=used_in`, {
      headers: sb.headers,
    })
    if (!getR.ok) return null
    const rows = await getR.json()
    if (!rows[0]) return null
    const used = rows[0].used_in || []
    used.push(usage)
    const patchR = await fetch(`${sb.url}/rest/v1/asset_library?id=eq.${assetId}`, {
      method: 'PATCH',
      headers: { ...sb.headers, Prefer: 'return=representation' },
      body: JSON.stringify({ used_in: used }),
    })
    if (!patchR.ok) return null
    const patched = await patchR.json()
    return patched[0] || null
  } catch (e) {
    console.warn(`asset-library: Postgres mark-used error: ${e.message}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Manifest I/O
// ---------------------------------------------------------------------------

async function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 1, schema_version: 1, updated_at: new Date().toISOString(), assets: [] }
  }
  const raw = await readFile(MANIFEST_PATH, 'utf8')
  return JSON.parse(raw)
}

async function writeManifest(manifest) {
  manifest.updated_at = new Date().toISOString()
  await mkdir(dirname(MANIFEST_PATH), { recursive: true })
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search assets by geo + subject tags + type. Hits Supabase first; falls
 * back to the local manifest if the cloud is unavailable.
 *
 * @param {object} opts
 * @param {string[]} [opts.geo]
 * @param {string[]} [opts.subject]
 * @param {string}   [opts.type]
 * @param {string}   [opts.source]
 * @param {string}   [opts.approval]
 * @param {number}   [opts.limit]
 * @param {boolean}  [opts.unusedOnly]
 */
export async function search(opts = {}) {
  const { geo = [], subject = [], type, source, approval, limit = 20, unusedOnly = false } = opts

  // Cloud-first
  const cloud = await searchSupabase({ geo, subject, type, source, approval, limit, unusedOnly })
  if (cloud) return cloud

  // Fallback: local manifest
  const manifest = await readManifest()
  let results = manifest.assets

  if (type) results = results.filter(a => a.type === type)
  if (source) results = results.filter(a => a.source === source)
  if (approval) results = results.filter(a => (a.approval || 'approved') === approval)

  const geoLower = geo.map(g => g.toLowerCase())
  const subjLower = subject.map(s => s.toLowerCase())

  if (geoLower.length) {
    results = results.filter(a =>
      (a.geo_tags || []).some(t => geoLower.includes(t.toLowerCase()))
    )
  }
  if (subjLower.length) {
    results = results.filter(a =>
      (a.subject_tags || []).some(t => subjLower.includes(t.toLowerCase()))
    )
  }

  if (unusedOnly) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    results = results.filter(a => {
      if (!a.last_used_at) return true
      return new Date(a.last_used_at).getTime() < cutoff
    })
  }

  results.sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())
  return results.slice(0, limit)
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

/**
 * Register a new asset. Dual-writes to Supabase (Postgres + Storage) and
 * the local cache. Local cache stays even if Supabase is unavailable so
 * builds keep working offline. Returns the new asset record.
 */
export async function register(filePath, meta) {
  if (!existsSync(filePath)) {
    throw new Error(`register: file does not exist: ${filePath}`)
  }
  if (!meta.type) throw new Error('register: type is required')
  if (!meta.source) throw new Error('register: source is required')

  // De-dup check by (source, source_id). Uses a precise lookup — NOT a capped
  // recency-ordered search — so a re-ingest reliably finds the existing row no
  // matter how many assets share the source, and returns it untouched. This is
  // what prevents the merge-duplicates upsert from overwriting curated fields
  // (approval, geo_tags, subject_tags, surface_tags, notes) on re-ingest.
  if (meta.source_id) {
    const dup = await findBySourceId(meta.source, meta.source_id)
    if (dup) return dup // existing row — preserve curation, do not re-insert
    if (dup === false) {
      // Cloud unavailable — fall back to the local manifest
      const manifest = await readManifest()
      const existing = manifest.assets.find(a =>
        a.source === meta.source && a.source_id === meta.source_id
      )
      if (existing) return existing
    }
    // dup === null → genuinely new asset, fall through to insert
  }

  // Compute target path inside public/asset-library/<type>s/<source>/
  const ext = extname(filePath) || '.jpg'
  const id = randomUUID()
  const typeFolder = meta.type === 'photo' ? 'photos'
    : meta.type === 'video' ? 'videos'
    : meta.type === 'audio' ? 'audio'
    : meta.type === 'render' ? 'videos/renders'
    : 'misc'
  const sourceFolder = meta.type === 'render' ? '' : `/${meta.source.replace('generated-', 'generated/')}`
  const targetDir = resolve(ASSETS_ROOT, typeFolder + sourceFolder)
  await mkdir(targetDir, { recursive: true })
  const targetName = `${id}${ext}`
  const targetPath = resolve(targetDir, targetName)

  // Copy into local cache if not already inside ASSETS_ROOT
  const isInside = filePath.startsWith(ASSETS_ROOT)
  if (!isInside) {
    await copyFile(filePath, targetPath)
  }
  const finalPath = isInside ? filePath : targetPath
  const relPath = relative(ROOT, finalPath)

  const fileStat = await stat(finalPath)

  // Storage object path mirrors the local cache layout
  const storageObjectPath = relative(ASSETS_ROOT, finalPath).replace(/\\/g, '/')

  // Upload to Supabase Storage in parallel with the row insert
  const [storageResult, _row] = await Promise.all([
    uploadToStorage(finalPath, storageObjectPath),
    Promise.resolve(null), // row insert happens after we have the file_url
  ])

  const fileUrl = storageResult?.publicUrl || meta.file_url || null

  const asset = {
    id,
    type: meta.type,
    source: meta.source,
    source_id: meta.source_id || null,
    license: meta.license || meta.source,
    license_metadata: meta.license_metadata || {},
    creator: meta.creator || null,
    creator_url: meta.creator_url || null,
    storage_bucket: STORAGE_BUCKET,
    storage_object_path: storageObjectPath,
    file_url: fileUrl,
    file_path: relPath, // legacy local-cache path; kept for offline use
    file_size_bytes: fileStat.size,
    geo_tags: parseList(meta.geo) || [],
    subject_tags: parseList(meta.subject) || [],
    surface_tags: parseList(meta.surface_tags) || [],
    search_query: meta.search_query || null,
    width: meta.width || null,
    height: meta.height || null,
    duration_sec: meta.duration_sec || null,
    registered_at: new Date().toISOString(),
    last_used_at: null,
    used_in: [],
    approval: meta.approval || 'approved',
    notes: meta.notes || null,
  }

  // Insert into Supabase (cloud truth) — strip the local-only field `file_path`
  // since the Postgres schema doesn't have that column.
  const { file_path: _localOnlyPath, ...cloudPayload } = asset
  const cloudRow = await insertRow(cloudPayload)
  // Re-attach file_path so the local cache still tracks where the cached copy lives
  if (cloudRow) cloudRow.file_path = asset.file_path

  // Always also append to local manifest (cache + offline fallback)
  const manifest = await readManifest()
  // Avoid local dup if cloud upsert returned the canonical row
  const dupIdx = manifest.assets.findIndex(a =>
    a.source === asset.source && a.source_id != null && a.source_id === asset.source_id
  )
  const finalAsset = cloudRow || asset
  if (dupIdx >= 0) {
    manifest.assets[dupIdx] = finalAsset
  } else {
    manifest.assets.push(finalAsset)
  }
  await writeManifest(manifest)

  return finalAsset
}

function parseList(v) {
  if (!v) return null
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
  return String(v).split(',').map(x => x.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Mark used
// ---------------------------------------------------------------------------

/**
 * Record that an asset was used in a render. Updates Supabase first, then
 * the local manifest. Caller can pass either a UUID id or a (source, source_id)
 * lookup pair. last_used_at is updated by the Postgres trigger.
 */
export async function markUsed(assetId, usage) {
  const usageRecord = {
    render_path: usage.render_path,
    scene_id: usage.scene_id || null,
    render_type: usage.render_type || 'other',
    used_at: new Date().toISOString(),
  }

  // Cloud first
  const cloudAsset = await appendUsageSupabase(assetId, usageRecord)

  // Always also update the local manifest (cache + offline fallback)
  try {
    const manifest = await readManifest()
    const asset = manifest.assets.find(a => a.id === assetId)
    if (asset) {
      if (!asset.used_in) asset.used_in = []
      asset.used_in.push(usageRecord)
      asset.last_used_at = new Date().toISOString()
      await writeManifest(manifest)
    }
  } catch (e) {
    console.warn(`asset-library: local manifest mark-used error: ${e.message}`)
  }

  if (cloudAsset) return cloudAsset
  // If cloud unavailable, return local copy
  const manifest = await readManifest()
  return manifest.assets.find(a => a.id === assetId) || null
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function stats() {
  const manifest = await readManifest()
  const byType = {}
  const bySource = {}
  const byLicense = {}
  let totalUsages = 0
  let totalCost = 0

  for (const a of manifest.assets) {
    byType[a.type] = (byType[a.type] || 0) + 1
    bySource[a.source] = (bySource[a.source] || 0) + 1
    byLicense[a.license || 'unknown'] = (byLicense[a.license || 'unknown'] || 0) + 1
    totalUsages += (a.used_in || []).length
    if (a.license_metadata?.license_cost_usd) {
      totalCost += Number(a.license_metadata.license_cost_usd) || 0
    }
  }

  return {
    total_assets: manifest.assets.length,
    by_type: byType,
    by_source: bySource,
    by_license: byLicense,
    total_usages: totalUsages,
    total_license_cost_usd: Number(totalCost.toFixed(2)),
    last_updated: manifest.updated_at,
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  // Very small arg parser: positional + --flags + --flag=value
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) {
        out[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
          out[a.slice(2)] = next
          i++
        } else {
          out[a.slice(2)] = true
        }
      }
    } else {
      out._.push(a)
    }
  }
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0) {
    console.error('Usage: asset-library.mjs <search|register|mark-used|stats|list> [args]')
    console.error('See file header for full CLI examples.')
    process.exit(1)
  }
  const cmd = argv[0]
  const args = parseArgs(argv.slice(1))

  if (cmd === 'search') {
    const results = await search({
      geo: parseList(args.geo) || [],
      subject: parseList(args.tags || args.subject) || [],
      type: args.type,
      source: args.source,
      approval: args.approval,
      limit: args.limit ? parseInt(args.limit, 10) : 20,
      unusedOnly: !!args['unused-only'],
    })
    console.log(JSON.stringify(results, null, 2))
  }
  else if (cmd === 'register') {
    const file = args._[0]
    if (!file) { console.error('register: file path required'); process.exit(1) }
    const asset = await register(file, {
      type: args.type,
      source: args.source,
      source_id: args['source-id'],
      license: args.license,
      license_metadata: args['license-id']
        ? { license_id: args['license-id'], license_cost_usd: args['license-cost'] }
        : undefined,
      creator: args.creator,
      creator_url: args['creator-url'],
      file_url: args['file-url'],
      geo: args.geo,
      subject: args.subject,
      search_query: args['search-query'],
      width: args.width ? parseInt(args.width, 10) : undefined,
      height: args.height ? parseInt(args.height, 10) : undefined,
      duration_sec: args.duration ? parseFloat(args.duration) : undefined,
      approval: args.approval,
      notes: args.notes,
    })
    console.log(JSON.stringify(asset, null, 2))
  }
  else if (cmd === 'mark-used') {
    const id = args._[0]
    if (!id) { console.error('mark-used: asset id required'); process.exit(1) }
    const asset = await markUsed(id, {
      render_path: args.render,
      scene_id: args.scene,
      render_type: args['render-type'],
    })
    console.log(JSON.stringify(asset, null, 2))
  }
  else if (cmd === 'stats') {
    console.log(JSON.stringify(await stats(), null, 2))
  }
  else if (cmd === 'list') {
    const results = await search({
      type: args.type,
      source: args.source,
      limit: args.recent ? parseInt(args.recent, 10) : 20,
    })
    for (const a of results) {
      console.log(`${a.id}  ${a.type.padEnd(6)} ${(a.source || '').padEnd(20)} ${(a.geo_tags || []).join(',').padEnd(30)} ${a.file_path}`)
    }
  }
  else {
    console.error(`Unknown command: ${cmd}`)
    process.exit(1)
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch(err => { console.error(err); process.exit(1) })
