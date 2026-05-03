#!/usr/bin/env node
/**
 * synth-vo.mjs
 *
 * Synthesizes the 4-pillars VO with ElevenLabs Victoria using locked settings,
 * `previous_text` chaining for prosody continuity, and `/v1/text-to-speech/.../with-timestamps`
 * for word-level alignment data that drives the kinetic CaptionBand.
 *
 * Outputs:
 *   public/4-pillars/voiceover.mp3       — concatenated final VO (Remotion staticFile)
 *   out/4-pillars/alignment.json         — word-level timestamps + segment meta
 *   out/4-pillars/captionWords.json      — array<{text, startSec, endSec}> (passed to comp props)
 *   out/4-pillars/segments/seg-NN-*.mp3  — per-segment audio for debugging
 *   out/4-pillars/pronunciation-notes.md — manually-edited notes after listen-back
 *
 * Adapted from video/market-report/scripts/synth-vo.mjs.
 *
 * Required env: ELEVENLABS_API_KEY (Matt's key — not present in cloud agent).
 *
 * Run: node video/evergreen-education/scripts/synth-vo.mjs
 *      node video/evergreen-education/scripts/synth-vo.mjs --skip  # write empty stub (cloud demo render only)
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA = resolve(ROOT, 'data', '4-pillars.json')
const OUT_DIR = resolve(ROOT, 'out', '4-pillars')
const SEG_DIR = resolve(OUT_DIR, 'segments')
const PUB_DIR = resolve(ROOT, 'public', '4-pillars')

const VOICE = 'qSeXEcewz7tA0Q0qk9fH' // Victoria — locked per CLAUDE.md
const HOST = 'api.elevenlabs.io'
const URL = `https://${HOST}`

if (process.argv.includes('--skip')) {
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(resolve(OUT_DIR, 'captionWords.json'), JSON.stringify([], null, 2))
  await writeFile(resolve(OUT_DIR, 'alignment.json'), JSON.stringify({ skipped: true, reason: 'cloud agent has no ELEVENLABS_API_KEY; matt to run locally' }, null, 2))
  console.log('✓ wrote empty stub captionWords + alignment (skip mode)')
  process.exit(0)
}

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) {
  console.error(`
ELEVENLABS_API_KEY missing.

This cloud agent doesn't have the key. Matt: run this script LOCALLY where
your .env.local has ELEVENLABS_API_KEY, then re-render:

    node video/evergreen-education/scripts/synth-vo.mjs
    npm run render --prefix video/evergreen-education

To stub out for a render WITHOUT VO + captions (visual-only demo):

    node video/evergreen-education/scripts/synth-vo.mjs --skip
`)
  process.exit(1)
}

async function elSynth(text, previousText) {
  const body = {
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: { stability: 0.50, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    ...(previousText ? { previous_text: previousText } : {}),
  }
  const res = await fetch(`${URL}/v1/text-to-speech/${VOICE}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`elevenlabs ${res.status}: ${text.slice(0, 400)}`)
  }
  return await res.json()
}

function alignmentToWords(alignment, offsetSec) {
  const chars = alignment.characters
  const starts = alignment.character_start_times_seconds
  const ends = alignment.character_end_times_seconds
  const words = []
  let buf = ''
  let bufStart = null
  let bufEnd = null
  const flush = () => {
    if (buf.trim()) {
      words.push({ text: buf.trim(), startSec: bufStart + offsetSec, endSec: bufEnd + offsetSec })
    }
    buf = ''; bufStart = null; bufEnd = null
  }
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (/\s/.test(ch)) {
      flush()
    } else {
      if (bufStart === null) bufStart = starts[i]
      bufEnd = ends[i]
      buf += ch
    }
  }
  flush()
  return words
}

async function mp3Duration(path) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path])
  return parseFloat(stdout.trim())
}

async function concatMp3(segments, outPath) {
  const listFile = `${outPath}.list`
  const list = segments.map((s) => `file '${s.replaceAll("'", "'\\''")}'`).join('\n')
  await writeFile(listFile, list)
  await exec('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'libmp3lame', '-q:a', '2', '-ar', '44100', '-ac', '2', outPath])
  await rm(listFile, { force: true })
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(SEG_DIR, { recursive: true })
  await mkdir(PUB_DIR, { recursive: true })

  const config = JSON.parse(await readFile(DATA, 'utf8'))
  const segments = config.script.segments

  console.log(`Synthesizing ${segments.length} segments with Victoria (${VOICE})...\n`)

  const segPaths = []
  const allWords = []
  const segMeta = []
  let cumOffset = 0
  let prevText = ''

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    process.stdout.write(`  ${String(i + 1).padStart(2)}/${segments.length} ${s.id}: synth... `)
    const r = await elSynth(s.text, prevText || undefined)
    const segPath = resolve(SEG_DIR, `seg-${String(i).padStart(2, '0')}-${s.id}.mp3`)
    await writeFile(segPath, Buffer.from(r.audio_base64, 'base64'))
    segPaths.push(segPath)
    const dur = await mp3Duration(segPath)
    const segWords = alignmentToWords(r.alignment, cumOffset)
    allWords.push(...segWords)
    segMeta.push({ id: s.id, text: s.text, startSec: cumOffset, endSec: cumOffset + dur, duration: dur, wordCount: segWords.length })
    console.log(`${dur.toFixed(2)}s, ${segWords.length} words`)
    cumOffset += dur
    prevText = s.text
  }

  const finalMp3 = resolve(PUB_DIR, 'voiceover.mp3')
  await concatMp3(segPaths, finalMp3)
  const finalDur = await mp3Duration(finalMp3)
  console.log(`\n✓ Concatenated voiceover.mp3: ${finalDur.toFixed(2)}s`)

  await writeFile(resolve(OUT_DIR, 'captionWords.json'), JSON.stringify(allWords, null, 2))
  await writeFile(resolve(OUT_DIR, 'alignment.json'), JSON.stringify({
    voice: VOICE,
    voiceName: 'Victoria',
    model: 'eleven_turbo_v2_5',
    settings: { stability: 0.50, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    chained: true,
    totalDurationSec: finalDur,
    segments: segMeta,
    words: allWords,
  }, null, 2))

  console.log(`✓ wrote alignment.json + captionWords.json (${allWords.length} words)`)
  console.log(`\nNext: node scripts/render.mjs`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
