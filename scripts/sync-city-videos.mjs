#!/usr/bin/env node
/**
 * sync-city-videos — the optimized city/neighborhood hero-video pipeline.
 *
 * Pulls a curated Drive clip per geo (via the GOOGLE_SERVICE_ACCOUNT_* creds,
 * reusing lib/drive-ingest.mjs), runs it through the SAME visual grade + web
 * encode as the homepage hero, and writes it to public/videos/<scope>/<slug>.mp4
 * + a poster still. Tagging is driven by the config's `geo_tags` (set from the
 * Drive folder name, e.g. a clip in the "redmond" folder → ['redmond']).
 *
 * Config: data/city-hero-videos.json
 *   { "videos": [ { "scope":"cities", "slug":"redmond", "driveFileId":"...",
 *                   "geo_tags":["redmond"], "label":"...", "note":"...",
 *                   "startSec":0, "durationSec":14 }, ... ] }
 *
 * Run (local; needs ffmpeg + the service-account env):
 *   node --env-file=.env.local scripts/sync-city-videos.mjs            # process all
 *   node --env-file=.env.local scripts/sync-city-videos.mjs --only redmond
 *   node --env-file=.env.local scripts/sync-city-videos.mjs --dry-run  # list sizes only
 *
 * Output manifest: data/city-hero-videos.resolved.json  (slug -> {video,poster,geo_tags,source})
 * The city/neighborhood pages read that to pass `videoSrc`/`posterSrc` to <KbHero>.
 *
 * NOTE: source clips must be CLEAN B-roll. The snowdrift "Area Guide" clips are
 * finished marketing videos with text/voiceover overlays — not ideal as a silent
 * looping hero. Only point this at raw drone B-roll (or accept the overlays).
 */
import { downloadFile, getFileMeta } from '../lib/drive-ingest.mjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FF = process.env.FFMPEG_PATH || `${process.env.HOME}/.local/bin/ffmpeg`
const CONFIG = resolve(ROOT, 'data/city-hero-videos.json')

// Same grade as the homepage hero (lib/video-embed regrade): contrast +10%,
// saturation +16%, gamma 0.96, mild unsharp; capped at 1280px wide.
const GRADE = "scale='min(1280,iw)':-2,eq=contrast=1.10:saturation=1.16:gamma=0.96,unsharp=5:5:0.5:5:5:0.0"

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry-run')
  const onlyIdx = args.indexOf('--only')
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null

  if (!existsSync(CONFIG)) {
    console.error(`Missing ${CONFIG}. Create it with the city→Drive clip mapping.`)
    process.exit(1)
  }
  const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
  const out = {}
  const failures = []

  for (const item of cfg.videos || []) {
    if (only && item.slug !== only) continue
    if (!item.driveFileId) {
      console.log(`SKIP ${item.slug}: no driveFileId yet (${item.note || 'awaiting clean B-roll'})`)
      continue
    }
    try {
    const scope = item.scope || 'cities'
    const relMp4 = `videos/${scope}/${item.slug}.mp4`
    const relJpg = `videos/${scope}/${item.slug}.jpg`
    const dest = resolve(ROOT, 'public', relMp4)
    const poster = resolve(ROOT, 'public', relJpg)
    console.log(`\n== ${item.slug} (${scope}) <- drive:${item.driveFileId}${item.note ? '  [' + item.note + ']' : ''}`)

    if (dry) {
      const m = await getFileMeta(item.driveFileId)
      console.log(`   ${m.name}  ${(Number(m.size) / 1e6).toFixed(0)}MB  ${m.videoMediaMetadata ? m.videoMediaMetadata.width + 'x' + m.videoMediaMetadata.height : ''}`)
      continue
    }

    mkdirSync(dirname(dest), { recursive: true })
    const tmp = resolve(tmpdir(), `cityvid-${item.slug}.src`)
    await downloadFile(item.driveFileId, tmp)
    const start = item.startSec != null ? String(item.startSec) : '0'
    const dur = item.durationSec != null ? String(item.durationSec) : '14'
    execFileSync(FF, ['-y', '-ss', start, '-i', tmp, '-t', dur, '-an', '-vf', GRADE,
      '-c:v', 'libx264', '-crf', '25', '-maxrate', '2M', '-bufsize', '4M', '-preset', 'slow',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest], { stdio: 'inherit' })
    execFileSync(FF, ['-y', '-ss', '2', '-i', dest, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'inherit' })
    const mb = (statSync(dest).size / 1e6).toFixed(1)
    console.log(`   -> public/${relMp4} (${mb}MB) + poster public/${relJpg}`)
    out[item.slug] = {
      scope,
      video: `/${relMp4}`,
      poster: `/${relJpg}`,
      geo_tags: item.geo_tags || [item.slug],
      source: `drive:${item.driveFileId}`,
      label: item.label || null,
    }
    } catch (e) {
      console.error(`FAIL ${item.slug}: ${String((e && e.message) || e).split('\n')[0]}`)
      failures.push(item.slug)
    }
  }

  if (failures.length) console.log(`\n${failures.length} failed: ${failures.join(', ')}`)

  if (!dry && Object.keys(out).length) {
    const manifest = resolve(ROOT, 'data/city-hero-videos.resolved.json')
    const prev = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {}
    writeFileSync(manifest, JSON.stringify({ ...prev, ...out }, null, 2) + '\n')
    console.log(`\nWrote ${Object.keys(out).length} entries -> data/city-hero-videos.resolved.json`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
