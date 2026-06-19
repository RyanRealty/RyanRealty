#!/usr/bin/env node
/**
 * Google Drive → Asset Library ingestion.
 *
 * Reads files from a Google Drive folder (or a list of file IDs), downloads
 * each into the local cache, and registers each into the asset library
 * (Supabase Postgres + Storage). Used to bring Matt's existing photos and
 * videos out of Drive and into the queryable asset library so future
 * builds can find them.
 *
 * Auth: uses the existing GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL +
 * GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (same credentials used elsewhere
 * in the platform). Service account must have read access to the folder.
 *
 * CLI usage:
 *   node lib/drive-ingest.mjs --folder <folder-id> [--type photo|video|both] \
 *     [--geo "bend,smith-rock"] [--source curated] [--approval approved] \
 *     [--max 100]
 *
 *   # Or by individual file ID(s):
 *   node lib/drive-ingest.mjs --file <file-id> [--type ...] [--geo ...]
 *
 *   # List a folder without ingesting (dry run):
 *   node lib/drive-ingest.mjs --folder <folder-id> --dry-run
 *
 * Programmatic usage:
 *   import { ingestFolder, ingestFile, listFolder } from './lib/drive-ingest.mjs'
 *
 * Folder ID extraction: if Matt pastes a Drive URL like
 *   https://drive.google.com/drive/folders/1abc_XYZ?usp=sharing
 *   https://drive.google.com/drive/u/0/folders/1abc_XYZ
 * the script extracts the ID automatically.
 */

import { writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const TMP = resolve(tmpdir(), 'rr-drive-ingest')

// ---------------------------------------------------------------------------
// JWT auth — sign a service-account JWT and exchange for an access token
// ---------------------------------------------------------------------------

let _accessToken = null
let _accessTokenExpires = 0

async function getAccessToken() {
  if (_accessToken && Date.now() < _accessTokenExpires - 60_000) return _accessToken
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
  let pkey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !pkey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  }
  // The private key may be wrapped in quotes and may have escaped \n
  pkey = pkey.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n')

  const { default: crypto } = await import('node:crypto')
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const b64url = (obj) => Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsigned = `${b64url(header)}.${b64url(claims)}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  const signature = signer.sign(pkey).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${unsigned}.${signature}`

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!r.ok) throw new Error(`Drive auth failed (${r.status}): ${await r.text()}`)
  const tok = await r.json()
  _accessToken = tok.access_token
  _accessTokenExpires = Date.now() + (tok.expires_in * 1000)
  return _accessToken
}

// ---------------------------------------------------------------------------
// Folder ID extraction
// ---------------------------------------------------------------------------

export function extractFolderId(input) {
  if (!input) return null
  // Already an ID
  if (/^[A-Za-z0-9_-]{20,}$/.test(input)) return input
  // URL parsing
  const m = input.match(/\/folders\/([A-Za-z0-9_-]+)/)
  if (m) return m[1]
  const m2 = input.match(/[?&]id=([A-Za-z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

export function extractFileId(input) {
  if (!input) return null
  if (/^[A-Za-z0-9_-]{20,}$/.test(input)) return input
  const m = input.match(/\/file\/d\/([A-Za-z0-9_-]+)/)
  if (m) return m[1]
  const m2 = input.match(/[?&]id=([A-Za-z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

// ---------------------------------------------------------------------------
// Drive API calls
// ---------------------------------------------------------------------------

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

// List all files in a folder (recursive). Returns array of { id, name, mimeType, size, ... }
export async function listFolder(folderId, opts = {}) {
  const { recursive = true, max = 1000 } = opts
  const token = await getAccessToken()
  const all = []
  const queue = [folderId]
  const seen = new Set()

  while (queue.length && all.length < max) {
    const fid = queue.shift()
    if (seen.has(fid)) continue
    seen.add(fid)

    let pageToken = null
    do {
      const params = new URLSearchParams({
        q: `'${fid}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,imageMediaMetadata,videoMediaMetadata,webViewLink,description)',
        pageSize: '100',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      })
      if (pageToken) params.set('pageToken', pageToken)
      const r = await fetch(`${DRIVE_BASE}/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) {
        throw new Error(`Drive list failed for ${fid} (${r.status}): ${await r.text()}`)
      }
      const data = await r.json()
      for (const f of data.files || []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (recursive) queue.push(f.id)
        } else {
          all.push(f)
          if (all.length >= max) break
        }
      }
      pageToken = data.nextPageToken
    } while (pageToken && all.length < max)
  }
  return all
}

// List the immediate CHILD FOLDERS of a Drive folder (not files, not recursive).
// Used to discover per-location subfolders (e.g. every "Area Guides/<Location>")
// so each can be ingested with its own geo tag.
export async function listSubfolders(folderId) {
  const token = await getAccessToken()
  const out = []
  let pageToken = null
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'nextPageToken,files(id,name)',
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const r = await fetch(`${DRIVE_BASE}/files?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error(`Drive subfolder list failed for ${folderId} (${r.status}): ${await r.text()}`)
    const data = await r.json()
    for (const f of data.files || []) out.push(f)
    pageToken = data.nextPageToken
  } while (pageToken)
  return out
}

// Download one file by ID to a local path
export async function downloadFile(fileId, destPath) {
  const token = await getAccessToken()
  const r = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    throw new Error(`Drive download failed for ${fileId} (${r.status}): ${await r.text()}`)
  }
  await mkdir(dirname(destPath), { recursive: true })
  const buf = Buffer.from(await r.arrayBuffer())
  await writeFile(destPath, buf)
  return destPath
}

// Get metadata for a single file
export async function getFileMeta(fileId) {
  const token = await getAccessToken()
  const r = await fetch(
    `${DRIVE_BASE}/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,imageMediaMetadata,videoMediaMetadata,description&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!r.ok) throw new Error(`Drive meta failed for ${fileId} (${r.status})`)
  return r.json()
}

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v', '.avi'])
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.wav', '.aiff'])

function inferType(name, mimeType) {
  const ext = extname(name).toLowerCase()
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'photo'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
  }
  if (PHOTO_EXT.has(ext)) return 'photo'
  if (VIDEO_EXT.has(ext)) return 'video'
  if (AUDIO_EXT.has(ext)) return 'audio'
  return null
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

/**
 * Download a single Drive file and register it in the asset library.
 * @param {string} fileId
 * @param {object} meta - { type?, geo?, subject?, source?, approval?, license? }
 */
export async function ingestFile(fileId, meta = {}) {
  const { register } = await import('./asset-library.mjs')
  const driveMeta = await getFileMeta(fileId)
  const type = meta.type || inferType(driveMeta.name, driveMeta.mimeType)
  if (!type) {
    console.warn(`Skipping ${driveMeta.name}: cannot infer type from ${driveMeta.mimeType}`)
    return null
  }
  await mkdir(TMP, { recursive: true })
  const tmpPath = resolve(TMP, `${randomUUID()}${extname(driveMeta.name)}`)
  await downloadFile(fileId, tmpPath)

  // Pull dimensions / duration from Drive metadata if available
  const img = driveMeta.imageMediaMetadata || {}
  const vid = driveMeta.videoMediaMetadata || {}
  const width = img.width || vid.width || meta.width
  const height = img.height || vid.height || meta.height
  const duration_sec = vid.durationMillis ? Number(vid.durationMillis) / 1000 : meta.duration_sec

  const asset = await register(tmpPath, {
    type,
    source: meta.source || 'curated',
    source_id: `drive:${fileId}`,
    license: meta.license || 'owned',
    license_metadata: { drive_file_id: fileId, drive_name: driveMeta.name, drive_modified_time: driveMeta.modifiedTime },
    creator: meta.creator || null,
    creator_url: null,
    geo: meta.geo,
    subject: meta.subject,
    search_query: meta.search_query || `Drive ingest: ${driveMeta.name}`,
    width: width || null,
    height: height || null,
    duration_sec: duration_sec || null,
    approval: meta.approval || 'approved',
    notes: driveMeta.description || `Ingested from Google Drive (${driveMeta.name})`,
  })
  return asset
}

/**
 * Ingest every file in a Drive folder. Returns array of registered assets
 * (with null entries for files that couldn't be inferred).
 */
export async function ingestFolder(folderId, opts = {}) {
  const { recursive = true, max = 1000, type, geo, subject, source, approval, license, dryRun = false, onProgress } = opts
  const files = await listFolder(folderId, { recursive, max })
  console.log(`Drive folder ${folderId}: found ${files.length} files`)
  if (dryRun) {
    for (const f of files) {
      console.log(`  ${f.id}  ${(f.mimeType || '').padEnd(30)} ${f.name}`)
    }
    return files
  }

  const assets = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const fileType = type || inferType(f.name, f.mimeType)
    if (!fileType) {
      console.log(`  [${i + 1}/${files.length}] SKIP ${f.name} (cannot infer type)`)
      continue
    }
    try {
      const asset = await ingestFile(f.id, { type: fileType, geo, subject, source, approval, license })
      console.log(`  [${i + 1}/${files.length}] OK   ${asset.id}  ${f.name}`)
      assets.push(asset)
      if (onProgress) onProgress(i + 1, files.length, asset)
    } catch (e) {
      console.warn(`  [${i + 1}/${files.length}] FAIL ${f.name}: ${e.message}`)
    }
  }
  return assets
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1)
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) { out[a.slice(2)] = argv[++i] }
      else { out[a.slice(2)] = true }
    } else {
      out._.push(a)
    }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.folder && !args.file) {
    console.error('Usage:')
    console.error('  drive-ingest.mjs --folder <folder-id-or-url> [opts]')
    console.error('  drive-ingest.mjs --file <file-id-or-url> [opts]')
    console.error('  Options: --type photo|video|audio  --geo "bend,smith-rock"')
    console.error('           --subject "mountain,snow"  --source curated|listing-photos')
    console.error('           --approval approved|intake  --license owned|mls')
    console.error('           --dry-run  --max <N>')
    process.exit(1)
  }

  if (args.folder) {
    const fid = extractFolderId(args.folder)
    if (!fid) { console.error('Could not extract folder ID from', args.folder); process.exit(1) }
    const assets = await ingestFolder(fid, {
      type: args.type,
      geo: args.geo,
      subject: args.subject,
      source: args.source,
      approval: args.approval,
      license: args.license,
      max: args.max ? parseInt(args.max, 10) : 1000,
      dryRun: !!args['dry-run'],
    })
    console.log(`Done. Ingested ${assets.length} assets.`)
  } else if (args.file) {
    const fileId = extractFileId(args.file)
    if (!fileId) { console.error('Could not extract file ID from', args.file); process.exit(1) }
    const asset = await ingestFile(fileId, {
      type: args.type,
      geo: args.geo,
      subject: args.subject,
      source: args.source,
      approval: args.approval,
      license: args.license,
    })
    console.log(JSON.stringify(asset, null, 2))
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main().catch(err => { console.error(err); process.exit(1) })
