/**
 * lib/agent/assets.ts — the R2.6 fetch ladder + R2.7 property-shoot ingest.
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md Amendment. Three independently
 * useful pieces:
 *   - classifyLink / downloadUrl / extractZip: the "how do I get bytes out of
 *     whatever link a photographer sent" ladder (Edge-case ledger B).
 *   - fetchTwilioMedia: R2.8, a broker texting photos directly into the same
 *     ingest path.
 *   - ingestShoot: R2.7, hash -> dedupe -> EXIF -> GPS-outlier check ->
 *     upload -> batched vision grade -> asset_library row, for a batch of
 *     files regardless of where they came from (Gmail attachment, a
 *     downloaded link, an extracted zip entry, or Twilio MMS).
 *
 * Zip handling shells out to the system `unzip` binary via child_process
 * (Matt directive for this rung: the `unzipper` npm package is NOT installed
 * — do not add it to package.json). `exifr` is likewise not installed yet;
 * see lib/agent/exif.ts for how that dependency is handled.
 */

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { createAnthropic, CLASSIFIER_MODEL } from '@/lib/ai/anthropic'
import { haversineMeters } from '@/lib/map-polygon'
import { slugify } from '@/lib/slug'
import { readExif } from '@/lib/agent/exif'
import {
  ensureShootsBucket,
  uploadShootAsset,
  findAssetBySourceId,
  upsertAssetLibraryRow,
  resolveListingLatLng,
  PROPERTY_SHOOTS_BUCKET,
  type AssetLibraryInsertRow,
} from '@/lib/data/agent/asset-registry'
import type { AgentContext } from '@/lib/agent/types'

const execFileAsync = promisify(execFile)

// ── link classification (R2.6) ──────────────────────────────────────────────

export type LinkClassification =
  | { kind: 'direct-file'; url: string }
  | { kind: 'dropbox'; url: string }
  | { kind: 'wetransfer'; url: string }
  | { kind: 'manual'; url: string; platform: string; instruction: string }
  | { kind: 'other'; url: string }

const DIRECT_FILE_EXT_RE = /\.(jpe?g|png|webp|heic|heif|tiff?|bmp|gif|mp4|mov|m4v|webm|zip)$/i

/** Gallery platforms with no direct-download API — v1 honest fallback
 *  (Edge-case ledger B: "gallery portals require manual export"). */
const GALLERY_HOSTS: Array<{ match: RegExp; platform: string }> = [
  { match: /(^|\.)aryeo\.com$/i, platform: 'Aryeo' },
  { match: /(^|\.)hdphotohub\.com$/i, platform: 'HDPhotoHub' },
  { match: /(^|\.)rela\.to$/i, platform: 'Rela' },
  { match: /(^|\.)tourfactory\.com$/i, platform: 'TourFactory' },
  { match: /(^|\.)spiro\.media$/i, platform: 'Spiro' },
]

function safeUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function rewriteDropboxUrl(url: string, parsed: URL): string {
  const u = new URL(parsed.toString())
  u.searchParams.set('dl', '1')
  return u.toString()
}

/**
 * Classifies a link found in an email body / MMS / broker paste so the fetch
 * ladder knows what to do with it. Never throws — a malformed URL resolves
 * to `{ kind: 'other' }` rather than blowing up the caller.
 */
export function classifyLink(url: string): LinkClassification {
  const parsed = safeUrl(url)
  if (!parsed) return { kind: 'other', url }
  const host = parsed.hostname

  if (/(^|\.)dropbox\.com$/i.test(host)) {
    return { kind: 'dropbox', url: rewriteDropboxUrl(url, parsed) }
  }

  if (/(^|\.)(wetransfer\.com|we\.tl)$/i.test(host)) {
    return { kind: 'wetransfer', url }
  }

  const gallery = GALLERY_HOSTS.find((g) => g.match.test(host))
  if (gallery) {
    return {
      kind: 'manual',
      url,
      platform: gallery.platform,
      instruction: `${gallery.platform} galleries don't expose a direct download link. Ask the sender to tap "Download All" on the gallery and forward the resulting file or zip link.`,
    }
  }

  if (DIRECT_FILE_EXT_RE.test(parsed.pathname)) {
    return { kind: 'direct-file', url }
  }

  return { kind: 'other', url }
}

// ── download (R2.6) ──────────────────────────────────────────────────────────

export interface DownloadOk {
  ok: true
  buffer: Buffer
  contentType: string
  filename?: string
}
export interface DownloadFail {
  ok: false
  error: string
  isHtml?: boolean
}
export type DownloadResult = DownloadOk | DownloadFail

const DEFAULT_MAX_BYTES = 500 * 1024 * 1024

function filenameFromContentDisposition(header: string | null): string | undefined {
  if (!header) return undefined
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return m?.[1] ? decodeURIComponent(m[1]) : undefined
}

function filenameFromUrl(url: string): string | undefined {
  const parsed = safeUrl(url)
  if (!parsed) return undefined
  const base = parsed.pathname.split('/').filter(Boolean).pop()
  return base || undefined
}

/**
 * Fetches a URL with a byte-size guard (per-file cap, default 500 MB per the
 * R2.6 spec) and an honest-failure path for expired/placeholder links that
 * resolve to an HTML page instead of a file (Edge-case ledger B8).
 */
export async function downloadUrl(url: string, maxBytes: number = DEFAULT_MAX_BYTES): Promise<DownloadResult> {
  let res: Response
  try {
    res = await fetch(url, { redirect: 'follow' })
  } catch (err) {
    return { ok: false, error: `fetch failed: ${err instanceof Error ? err.message : String(err)}` }
  }
  if (!res.ok || !res.body) {
    return { ok: false, error: `fetch returned HTTP ${res.status}` }
  }

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const contentLength = Number(res.headers.get('content-length') ?? '0')
  if (contentLength > 0 && contentLength > maxBytes) {
    return { ok: false, error: `file is ${contentLength} bytes, over the ${maxBytes} byte cap` }
  }

  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  if (buffer.byteLength > maxBytes) {
    return { ok: false, error: `downloaded ${buffer.byteLength} bytes, over the ${maxBytes} byte cap` }
  }

  if (contentType.toLowerCase().includes('text/html')) {
    return {
      ok: false,
      error: 'link returned an HTML page, not a file — likely expired, a login wall, or a "gallery coming soon" placeholder',
      isHtml: true,
    }
  }

  const filename = filenameFromContentDisposition(res.headers.get('content-disposition')) ?? filenameFromUrl(url)
  return { ok: true, buffer, contentType, filename }
}

// ── zip extraction (system `unzip`, no `unzipper` dependency) ───────────────

export interface ExtractedFile {
  name: string
  path: string
}

/**
 * Extracts a zip buffer via the system `unzip` binary. Writes to a scratch
 * dir under TMPDIR (falls back to the OS default, then `/tmp`), extracts,
 * and returns every regular file found (recursively, skipping macOS junk).
 */
export async function extractZip(buffer: Buffer, destDir?: string): Promise<ExtractedFile[]> {
  const scratchRoot = process.env.TMPDIR?.trim() || tmpdir() || '/tmp'
  const workDir = destDir ?? (await mkdtemp(path.join(scratchRoot, 'rr-shoot-')))
  const zipPath = path.join(workDir, 'archive.zip')
  await writeFile(zipPath, buffer)

  try {
    await execFileAsync('unzip', ['-o', '-qq', zipPath, '-d', workDir])
  } catch (err) {
    throw new Error(`extractZip: unzip failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const out: ExtractedFile[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '__MACOSX' || entry.name === '.DS_Store') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && full !== zipPath) {
        out.push({ name: entry.name, path: full })
      }
    }
  }
  await walk(workDir)
  return out
}

// ── Twilio MMS media (R2.8) ──────────────────────────────────────────────────

export interface TwilioMediaResult {
  buffer: Buffer
  contentType: string
}

/**
 * R2.8 — MMS-in as an asset source. Twilio media URLs require HTTP basic
 * auth and expire, so this fetches immediately on discovery rather than
 * waiting until ingest time.
 */
export async function fetchTwilioMedia(mediaUrl: string): Promise<TwilioMediaResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!sid || !token) throw new Error('fetchTwilioMedia: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not configured')
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) throw new Error(`fetchTwilioMedia: HTTP ${res.status} ${res.statusText}`)
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType }
}

// ── mime <-> extension (shared by ingestShoot + the fetch_assets tool) ─────

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/tiff': '.tiff',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
}

function extFromMime(mime: string, fallbackName: string): string {
  const norm = mime.toLowerCase()
  if (MIME_TO_EXT[norm]) return MIME_TO_EXT[norm]
  const fromName = path.extname(fallbackName)
  return fromName || ''
}

/** Zip entries don't carry Content-Type headers — resolve mime from the
 *  extracted filename's extension instead. Exported for the fetch_assets tool. */
export function mimeFromExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return EXT_TO_MIME[ext] ?? 'application/octet-stream'
}

// ── vision grading (part of R2.7 ingest — "codified as part of ingest") ────

interface VisionGradeResult {
  grade: 'A' | 'B' | 'C' | 'D' | null
  caption?: string
  scene?: string
  watermark?: boolean
}

const VISION_BATCH_SIZE = 8
const VISION_MAX_BYTES = 3.5 * 1024 * 1024
const SUPPORTED_ANTHROPIC_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function toAnthropicMediaType(mime: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  const norm = mime.toLowerCase()
  return SUPPORTED_ANTHROPIC_IMAGE_MIME.has(norm) ? (norm as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') : null
}

function extractJsonArray(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  return JSON.parse(cleaned)
}

/**
 * Batched vision grading, ~8 images per call per the rung spec. Images over
 * VISION_MAX_BYTES or in a mime type Claude's vision input doesn't accept
 * are shipped with `grade: null` (skipped, not failed) rather than blocking
 * the rest of the batch. Any model-call failure — no API key, network,
 * malformed JSON — degrades every image in that batch to `grade: null` so
 * ingest never blocks on grading (Edge-case ledger D2: "impossible by
 * construction" that a photo lands ungraded is about the STEP existing, not
 * a guarantee every call succeeds).
 */
async function gradeImagesBatch(
  images: Array<{ index: number; buffer: Buffer; mime: string }>,
): Promise<Map<number, VisionGradeResult>> {
  const results = new Map<number, VisionGradeResult>()
  const gradeable = images.filter((img) => img.buffer.byteLength <= VISION_MAX_BYTES && toAnthropicMediaType(img.mime))
  for (const img of images) {
    if (!gradeable.includes(img)) results.set(img.index, { grade: null })
  }
  if (!gradeable.length) return results

  let anthropic: Anthropic
  try {
    anthropic = createAnthropic()
  } catch (err) {
    console.error('[gradeImagesBatch] Anthropic not configured, shipping ungraded:', err instanceof Error ? err.message : err)
    for (const img of gradeable) results.set(img.index, { grade: null })
    return results
  }

  const content: Anthropic.Messages.ContentBlockParam[] = gradeable.map((img) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: toAnthropicMediaType(img.mime)!, data: img.buffer.toString('base64') },
  }))
  content.push({
    type: 'text',
    text:
      `Grade each of the ${gradeable.length} listing photos above, in the same order, for real-estate marketing use. ` +
      `Return ONLY a JSON array (no prose, no markdown fence), one object per photo in order: ` +
      `[{"grade":"A|B|C|D","caption":"one-sentence description of what's shown","scene":"exterior|kitchen|living-room|bedroom|bathroom|aerial|other","watermark":true|false}]. ` +
      `A = hero-worthy (sharp, well-lit, well-composed). B = usable. C = weak (dark, cluttered, awkward angle). D = unusable (blurry, blocked, irrelevant). ` +
      `watermark = true only if a visible photographer/studio watermark or logo is stamped on the image.`,
  })

  try {
    const resp = await anthropic.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 1536,
      messages: [{ role: 'user', content }],
    })
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
    const parsed = extractJsonArray(textBlock)
    if (!Array.isArray(parsed)) throw new Error('vision grade response was not a JSON array')

    gradeable.forEach((img, i) => {
      const entry = parsed[i] as Record<string, unknown> | undefined
      if (!entry || typeof entry !== 'object') {
        results.set(img.index, { grade: null })
        return
      }
      const grade = typeof entry.grade === 'string' && ['A', 'B', 'C', 'D'].includes(entry.grade) ? (entry.grade as 'A' | 'B' | 'C' | 'D') : null
      results.set(img.index, {
        grade,
        caption: typeof entry.caption === 'string' ? entry.caption.slice(0, 500) : undefined,
        scene: typeof entry.scene === 'string' ? entry.scene.slice(0, 60) : undefined,
        watermark: typeof entry.watermark === 'boolean' ? entry.watermark : undefined,
      })
    })
  } catch (err) {
    console.error('[gradeImagesBatch] vision grading call failed, shipping ungraded:', err instanceof Error ? err.message : err)
    for (const img of gradeable) results.set(img.index, { grade: null })
  }

  return results
}

// ── ingestShoot (R2.7) ───────────────────────────────────────────────────────

export interface ShootFileInput {
  name: string
  buffer?: Buffer
  path?: string
  mime: string
}

export interface IngestShootParams {
  propertyLabel: string
  files: ShootFileInput[]
  propertyLatLng?: { lat: number; lng: number }
  /** §0 provenance carried into `notes`, e.g.
   *  "gmail:paul@ryan-realty.com message 18d2f..." or "link:https://...". */
  sourceLabel?: string
}

export interface IngestShootSummary {
  ingested: number
  skipped: number
  outliers: string[]
  gradeCounts: Record<string, number>
}

/** R2.7 GPS-outlier threshold — photographers batch-deliver, so a GPS tag
 *  far from the subject property flags a probable wrong-property photo. */
const GPS_OUTLIER_METERS = 150

async function readShootFileBytes(file: ShootFileInput): Promise<Buffer> {
  if (file.buffer) return file.buffer
  if (file.path) return readFile(file.path)
  throw new Error(`ingestShoot: file "${file.name}" has neither buffer nor path`)
}

/**
 * R2.7 — property-shoot ingestion. For every image: sha256 dedupe key, EXIF
 * (capture date + GPS), GPS-vs-property distance flagging (>150 m ->
 * outlier), upload to `property-shoots/<slug>/<sha><ext>`, batched vision
 * grading, then one asset_library row (source='property-shoot',
 * source_id=sha, approval='intake' — pre-review, per Edge-case ledger D2/D
 * generally: nothing here auto-approves a broker-delivered shoot for
 * production use). Videos are hashed/deduped/uploaded/registered without
 * EXIF or vision grading (neither applies). Anything else is skipped.
 *
 * Never throws on a single file's failure — one bad file is recorded as
 * skipped and the rest of the batch proceeds, matching the "a photographer
 * batch-delivers 30 photos, one is corrupt" reality this is built for.
 */
export async function ingestShoot(ctx: AgentContext, params: IngestShootParams): Promise<IngestShootSummary> {
  const slug = slugify(params.propertyLabel)
  const summary: IngestShootSummary = { ingested: 0, skipped: 0, outliers: [], gradeCounts: {} }

  const propertyLatLng = params.propertyLatLng ?? (await resolveListingLatLng(params.propertyLabel).catch(() => null))

  await ensureShootsBucket()

  interface Prepared {
    file: ShootFileInput
    bytes: Buffer
    sha: string
    kind: 'photo' | 'video'
    exif: { capturedAt?: string; lat?: number; lng?: number }
    outlier: boolean
  }

  const prepared: Prepared[] = []

  for (const file of params.files) {
    let bytes: Buffer
    try {
      bytes = await readShootFileBytes(file)
    } catch (err) {
      console.error('[ingestShoot] could not read file', file.name, err instanceof Error ? err.message : err)
      summary.skipped++
      continue
    }

    const mime = file.mime || 'application/octet-stream'
    const kind: 'photo' | 'video' | null = mime.startsWith('image/') ? 'photo' : mime.startsWith('video/') ? 'video' : null
    if (!kind) {
      summary.skipped++
      continue
    }

    const sha = createHash('sha256').update(bytes).digest('hex')

    const existing = await findAssetBySourceId('property-shoot', sha)
    if (existing) {
      summary.skipped++
      continue
    }

    const exif = kind === 'photo' ? await readExif(bytes) : {}
    let outlier = false
    if (propertyLatLng && typeof exif.lat === 'number' && typeof exif.lng === 'number') {
      outlier = haversineMeters({ lat: exif.lat, lng: exif.lng }, propertyLatLng) > GPS_OUTLIER_METERS
    }
    if (outlier) summary.outliers.push(file.name)

    prepared.push({ file, bytes, sha, kind, exif, outlier })
  }

  // Batch vision-grade every photo (videos skip grading entirely).
  const photoIndexes = prepared.map((p, i) => (p.kind === 'photo' ? i : -1)).filter((i) => i >= 0)
  const gradeByIndex = new Map<number, VisionGradeResult>()
  for (let i = 0; i < photoIndexes.length; i += VISION_BATCH_SIZE) {
    const batchIndexes = photoIndexes.slice(i, i + VISION_BATCH_SIZE)
    const batch = batchIndexes.map((idx) => ({ index: idx, buffer: prepared[idx].bytes, mime: prepared[idx].file.mime }))
    const graded = await gradeImagesBatch(batch)
    for (const [idx, result] of graded) gradeByIndex.set(idx, result)
  }

  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i]
    const grade: VisionGradeResult = p.kind === 'photo' ? gradeByIndex.get(i) ?? { grade: null } : { grade: null }
    const ext = extFromMime(p.file.mime, p.file.name)
    const objectPath = `${slug}/${p.sha}${ext}`

    const uploaded = await uploadShootAsset(objectPath, p.bytes, p.file.mime)
    if (!uploaded.ok) {
      console.error('[ingestShoot] upload failed', p.file.name, uploaded.error)
      summary.skipped++
      continue
    }

    const noteParts: string[] = []
    if (p.exif.capturedAt) noteParts.push(`Captured ${p.exif.capturedAt}`)
    if (typeof p.exif.lat === 'number' && typeof p.exif.lng === 'number') {
      noteParts.push(`GPS ${p.exif.lat.toFixed(5)},${p.exif.lng.toFixed(5)}`)
      if (propertyLatLng) {
        const meters = Math.round(haversineMeters({ lat: p.exif.lat, lng: p.exif.lng }, propertyLatLng))
        noteParts.push(`${meters}m from listing coordinates${p.outlier ? ' — OUTLIER, verify property match before use' : ''}`)
      }
    }
    if (grade.caption) noteParts.push(`Vision caption: ${grade.caption}`)
    if (grade.scene) noteParts.push(`Scene: ${grade.scene}`)
    if (grade.watermark) noteParts.push('Watermark detected in image — flag for broker review before external use')
    if (params.sourceLabel) noteParts.push(`Source: ${params.sourceLabel}`)
    noteParts.push(`Property: ${params.propertyLabel}`)
    noteParts.push(`Ingested by broker ${ctx.brokerDisplayName} <${ctx.brokerEmail}>`)

    const row: AssetLibraryInsertRow = {
      type: p.kind,
      source: 'property-shoot',
      source_id: p.sha,
      license: 'owned',
      storage_bucket: PROPERTY_SHOOTS_BUCKET,
      storage_object_path: objectPath,
      file_size_bytes: p.bytes.byteLength,
      geo_tags: [slug],
      subject_tags: grade.scene ? [grade.scene] : [],
      search_query: params.propertyLabel,
      approval: 'intake',
      notes: noteParts.join(' · '),
      vision_grade: grade.grade,
    }

    const inserted = await upsertAssetLibraryRow(row)
    if (!inserted.ok) {
      console.error('[ingestShoot] asset_library upsert failed', p.file.name, inserted.error)
      summary.skipped++
      continue
    }

    summary.ingested++
    const key = grade.grade ?? 'ungraded'
    summary.gradeCounts[key] = (summary.gradeCounts[key] ?? 0) + 1
  }

  return summary
}
