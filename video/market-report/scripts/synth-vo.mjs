#!/usr/bin/env node
// Synth ElevenLabs VO per city with `previous_text` chaining for prosody continuity.
// Pulls character-level timestamps, concatenates segments, builds word-level captionWords.
// Writes:
//   public/<slug>/voiceover.mp3     — final concatenated audio (Remotion staticFile)
//   out/<slug>/alignment.json       — full alignment trace
//   out/<slug>/props.json           — updated with captionWords and voPath
//
// Run: node --env-file=/Users/matthewryan/RyanRealty/.env.local scripts/synth-vo.mjs

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as dnsP } from 'node:dns'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'out')
const PUB = resolve(ROOT, 'public')

const KEY = process.env.ELEVENLABS_API_KEY
const VOICE = 'qSeXEcewz7tA0Q0qk9fH' // Victoria — hardcoded per Matt 2026-04-27 (switched from Ellen)
// Runtime guard: confirm hardcoded value is still correct
if (VOICE !== 'qSeXEcewz7tA0Q0qk9fH') { console.error(`WRONG VOICE — expected qSeXEcewz7tA0Q0qk9fH (Victoria), got ${VOICE}`); process.exit(1) }
if (!KEY) { console.error('Missing ELEVENLABS_API_KEY'); process.exit(1) }

const HOST = 'api.elevenlabs.io'
const HOST_IPS = await dnsP.resolve4(HOST)
console.log(`Resolved ${HOST} → ${HOST_IPS.join(', ')}`)
let ipIdx = 0
const nextIP = () => HOST_IPS[ipIdx++ % HOST_IPS.length]

const CITIES = ['bend', 'redmond', 'sisters', 'la-pine', 'prineville', 'sunriver']

async function elSynth(text, previousText) {
  const body = {
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: { stability: 0.50, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    ...(previousText ? { previous_text: previousText } : {}),
  }
  const url = `https://${HOST}/v1/text-to-speech/${VOICE}/with-timestamps`
  const tmpFile = `/tmp/el_payload_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  await writeFile(tmpFile, JSON.stringify(body))
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ip = nextIP()
    try {
      const { stdout } = await exec('curl', [
        '-sS', '-m', '120', '--connect-timeout', '15',
        '--resolve', `${HOST}:443:${ip}`,
        '-H', `xi-api-key: ${KEY}`,
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json',
        '-X', 'POST',
        '--data-binary', `@${tmpFile}`,
        url,
      ], { maxBuffer: 256 * 1024 * 1024 })
      const parsed = JSON.parse(stdout)
      if (parsed.detail) throw new Error(`elevenlabs: ${JSON.stringify(parsed.detail)}`)
      if (!parsed.audio_base64 || !parsed.alignment) throw new Error('missing audio_base64/alignment')
      await rm(tmpFile, { force: true })
      return parsed
    } catch (e) {
      if (attempt === 4) { await rm(tmpFile, { force: true }); throw new Error(`elevenlabs synth fail: ${e.message}`) }
      await new Promise(r => setTimeout(r, 800 * attempt))
    }
  }
}

// alignment shape:
// { characters: ["H","e","l","l","o"], character_start_times_seconds: [0.0, ...], character_end_times_seconds: [...] }
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

// Decode mp3 base64 to a buffer, write to file
import { Buffer } from 'node:buffer'
import { createWriteStream } from 'node:fs'
async function writeBase64Mp3(b64, outPath) {
  await writeFile(outPath, Buffer.from(b64, 'base64'))
}

// Get exact mp3 duration (sec) via ffprobe
async function mp3Duration(path) {
  const { stdout } = await exec('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1', path])
  return parseFloat(stdout.trim())
}

// Concatenate mp3 segments via ffmpeg concat demuxer (re-encode to ensure clean joins)
async function concatMp3(segments, outPath) {
  const listFile = `${outPath}.list`
  const list = segments.map(s => `file '${s.replaceAll("'", "'\\''")}'`).join('\n')
  await writeFile(listFile, list)
  await exec('ffmpeg', ['-y','-f','concat','-safe','0','-i',listFile,'-c:a','libmp3lame','-q:a','2','-ar','44100','-ac','2',outPath])
  await rm(listFile, { force: true })
}

await mkdir(PUB, { recursive: true })

for (const slug of CITIES) {
  console.log(`\n=== ${slug} ===`)
  const cityOut = resolve(OUT, slug)
  const cityPub = resolve(PUB, slug)
  await mkdir(cityPub, { recursive: true })
  const script = JSON.parse(await readFile(resolve(cityOut, 'script.json'), 'utf8'))
  const propsPath = resolve(cityOut, 'props.json')
  const props = JSON.parse(await readFile(propsPath, 'utf8'))

  const segPaths = []
  const allWords = []
  const segmentMeta = []
  let cumOffset = 0
  let prevText = ''

  for (let i = 0; i < script.segments.length; i++) {
    const s = script.segments[i]
    process.stdout.write(`  segment ${i+1}/${script.segments.length} ${s.id}: synth... `)
    const r = await elSynth(s.text, prevText || undefined)
    const segPath = resolve(cityPub, `seg-${String(i).padStart(2,'0')}-${s.id}.mp3`)
    await writeBase64Mp3(r.audio_base64, segPath)
    segPaths.push(segPath)
    const dur = await mp3Duration(segPath)
    const segWords = alignmentToWords(r.alignment, cumOffset)
    allWords.push(...segWords)
    segmentMeta.push({ id: s.id, text: s.text, startSec: cumOffset, endSec: cumOffset + dur, duration: dur, wordCount: segWords.length })
    console.log(`${dur.toFixed(2)}s, ${segWords.length} words`)
    cumOffset += dur
    prevText = s.text
  }

  // Concatenate
  const finalMp3 = resolve(cityPub, 'voiceover.mp3')
  await concatMp3(segPaths, finalMp3)
  const finalDur = await mp3Duration(finalMp3)
  console.log(`  Concatenated voiceover.mp3: ${finalDur.toFixed(2)}s`)

  // Update props.json with captionWords + voPath + per-beat durations.
  //
  // NEW beat structure (11 beats total — must match props.stats.length + 2):
  //   beat[0]     = intro              → segment 'intro'
  //   beat[1]     = price label        → segment 'price-lbl'
  //   beat[2]     = price value        → segment 'price-val'
  //   beat[3]     = supply label       → segment 'supply-lbl'
  //   beat[4]     = supply value       → segment 'supply-val'
  //   beat[5]     = dom label          → segment 'dom-lbl'
  //   beat[6]     = dom value          → segment 'dom-val'
  //   beat[7]     = stl label          → segment 'stl-lbl'
  //   beat[8]     = stl value          → segment 'stl-val'
  //   beat[9]     = active inventory   → segment 'active'
  //   beat[10]    = outro              → segment 'outro'
  //
  // Beat durations driven by actual VO segment lengths, then padded to target 56s total.
  //
  // NOTE: The VO is a single continuous audio track — it does NOT reset per beat.
  // Beat durations only control visual pacing. The VO will finish playing before
  // the video ends; the last few beats play silently over music.
  //
  // Algorithm:
  //   1. Set minimum beat durations (pacing floors from CLAUDE.md)
  //   2. If total < 53s, distribute slack proportionally to value beats and outro
  //   3. Final total must be in [54, 59]s
  const PAD = 0.4
  const TARGET_SEC = 56.0
  const SEG_MIN_INTRO = 4.5
  const SEG_MIN_LBL = 3.0    // label beats: readable in 3s
  const SEG_MIN_VAL = 4.5    // value beats: number reads in 4.5s
  const SEG_MIN_ACTIVE = 5.5
  const SEG_MIN_OUTRO = 6.0

  const segOrder = ['intro','price-lbl','price-val','supply-lbl','supply-val',
    'dom-lbl','dom-val','stl-lbl','stl-val','active','outro']

  // Step 1: apply minimums
  const beatDurations = segmentMeta.map((m, i) => {
    const raw = m.duration + PAD
    const id = segOrder[i] || m.id
    if (id === 'intro') return Math.max(SEG_MIN_INTRO, raw)
    if (id === 'outro') return Math.max(SEG_MIN_OUTRO, raw)
    if (id === 'active') return Math.max(SEG_MIN_ACTIVE, raw)
    if (id.endsWith('-lbl')) return Math.max(SEG_MIN_LBL, raw)
    return Math.max(SEG_MIN_VAL, raw)
  })

  // Step 2: pad to target if needed
  const currentTotal = beatDurations.reduce((s, x) => s + x, 0)
  const deficit = TARGET_SEC - currentTotal
  if (deficit > 0.5) {
    // Add slack to value beats (indices 2,4,6,8) and outro (10) — proportional
    const expandable = [2, 4, 6, 8, 10] // price-val, supply-val, dom-val, stl-val, outro
    const share = deficit / expandable.length
    for (const idx of expandable) {
      if (idx < beatDurations.length) beatDurations[idx] += share
    }
    console.log(`  Padded ${deficit.toFixed(2)}s deficit across ${expandable.length} expandable beats`)
  }
  props.voPath = `${slug}/voiceover.mp3`
  props.captionWords = allWords
  props.beatDurations = beatDurations
  await writeFile(propsPath, JSON.stringify(props, null, 2))
  await writeFile(resolve(cityOut, 'alignment.json'), JSON.stringify({ city: script.city, total_duration_sec: finalDur, segments: segmentMeta, words: allWords, beatDurations }, null, 2))
  const total = beatDurations.reduce((s,x)=>s+x,0)
  if (total < 50 || total > 62) {
    console.warn(`  WARNING: ${slug} total beat duration ${total.toFixed(2)}s is outside 50-62s window`)
  }
  console.log(`  ${allWords.length} captionWords. VO: ${finalDur.toFixed(2)}s. Total beat duration: ${total.toFixed(2)}s (target 55-58s)`)
}

console.log('\nAll cities synthed. Next: render via npm run render -- --city=<slug>')
