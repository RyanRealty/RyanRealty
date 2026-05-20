#!/usr/bin/env node
/**
 * synth-vo-long.mjs
 *
 * Synthesizes ONE continuous ElevenLabs voiceover for the YouTube long-form
 * market report (~1500 words, ~10-11 minutes), derives chapter boundaries from
 * word-level alignment, and writes the results back into props.json.
 *
 * Mirror of video/market-report/scripts/synth-vo.mjs adapted for long-form:
 *   - Longer script (~1500 words vs ~250 words for short-form)
 *   - 10 chapters (vs 7 beats for short-form)
 *   - Duration gate: 480-720s (8-12 min) instead of 30-60s
 *   - Auto-registers the audio in the asset library
 *
 * Victoria settings (canonical — NEVER change without updating CLAUDE.md):
 *   Voice:      qSeXEcewz7tA0Q0qk9fH (Victoria)
 *   Model:      eleven_turbo_v2_5
 *   Stability:  0.40
 *   Similarity: 0.80
 *   Style:      0.50
 *   Boost:      true
 *
 * Usage:
 *   node --env-file=/Users/matthewryan/RyanRealty/.env.local \
 *     scripts/synth-vo-long.mjs --city bend [--period 2026-04]
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as dnsP } from 'node:dns'
import { Buffer } from 'node:buffer'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'out/yt-long')
const PUB = resolve(ROOT, 'video/market-report-yt-long/public')

// Canonical values from lib/voice/alignment.ts (locked 2026-05-07).
// Keep in sync — see video_production_skills/elevenlabs_voice/SKILL.md.
const VICTORIA_VOICE_ID = 'qSeXEcewz7tA0Q0qk9fH'
const VICTORIA_MODEL_ID = 'eleven_turbo_v2_5'
const VICTORIA_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true }
// Victoria — locked per Matt 2026-04-27. Never change without CLAUDE.md update.
const VOICE = VICTORIA_VOICE_ID
const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) { console.error('Missing ELEVENLABS_API_KEY'); process.exit(1) }

// ─── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1)
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i]
      else out[a.slice(2)] = true
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const slug = args.city
if (!slug) {
  console.error('Usage: synth-vo-long.mjs --city <slug> [--period YYYY-MM]')
  process.exit(1)
}

// ─── ElevenLabs helpers (mirrors short-form synth-vo.mjs) ─────────────────────

const HOST = 'api.elevenlabs.io'
const HOST_IPS = await dnsP.resolve4(HOST)
console.log(`Resolved ${HOST} → ${HOST_IPS.join(', ')}`)
let ipIdx = 0
const nextIP = () => HOST_IPS[ipIdx++ % HOST_IPS.length]

/**
 * POST fullText to ElevenLabs /with-timestamps in ONE call.
 * Returns { audio_base64, alignment } — alignment is character-level.
 * Retries up to 4 times with IP rotation. Long-form needs 180s timeout.
 */
async function elSynth(fullText) {
  const body = {
    text: fullText,
    model_id: VICTORIA_MODEL_ID,
    voice_settings: VICTORIA_SETTINGS,
  }
  const url = `https://${HOST}/v1/text-to-speech/${VOICE}/with-timestamps`
  const tmpFile = `/tmp/el_yt_long_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  await writeFile(tmpFile, JSON.stringify(body))

  for (let attempt = 1; attempt <= 4; attempt++) {
    const ip = nextIP()
    try {
      // -m 300 timeout: long-form scripts can take 2-3 min to synthesize
      const { stdout } = await exec('curl', [
        '-sS', '-m', '300', '--connect-timeout', '20',
        '--resolve', `${HOST}:443:${ip}`,
        '-H', `xi-api-key: ${KEY}`,
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json',
        '-X', 'POST',
        '--data-binary', `@${tmpFile}`,
        url,
      ], { maxBuffer: 512 * 1024 * 1024 })
      const parsed = JSON.parse(stdout)
      if (parsed.detail) throw new Error(`elevenlabs: ${JSON.stringify(parsed.detail)}`)
      if (!parsed.audio_base64 || !parsed.alignment) throw new Error('missing audio_base64/alignment')
      await rm(tmpFile, { force: true })
      return parsed
    } catch (e) {
      if (attempt === 4) { await rm(tmpFile, { force: true }); throw new Error(`elevenlabs synth fail: ${e.message}`) }
      const delay = 1200 * attempt
      console.warn(`  Attempt ${attempt} failed (${e.message}), retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

/**
 * Collapse char-level alignment → word-level CaptionWord objects.
 * Strips trailing punctuation from word.text so captions render clean.
 */
function alignmentToWords(alignment) {
  const chars = alignment.characters
  const starts = alignment.character_start_times_seconds
  const ends = alignment.character_end_times_seconds
  const words = []
  let buf = ''; let bufStart = null; let bufEnd = null
  const flush = () => {
    if (buf.trim()) words.push({ text: buf.trim(), startSec: bufStart, endSec: bufEnd })
    buf = ''; bufStart = null; bufEnd = null
  }
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (/\s/.test(ch)) { flush() } else {
      if (bufStart === null) bufStart = starts[i]
      bufEnd = ends[i]
      buf += ch
    }
  }
  flush()
  return words
}

function countWords(sentence) {
  return sentence.trim().split(/\s+/).filter(Boolean).length
}

async function mp3Duration(path) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path])
  return parseFloat(stdout.trim())
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const cityOut = resolve(OUT, slug)
const cityPub = resolve(PUB, slug)
await mkdir(cityPub, { recursive: true })

const script = JSON.parse(await readFile(resolve(cityOut, 'script.json'), 'utf8'))
const propsPath = resolve(cityOut, 'props.json')
const props = JSON.parse(await readFile(propsPath, 'utf8'))

console.log(`\n=== ${slug} YouTube long-form VO ===`)
console.log(`  Script: ${script.fullText.length} chars, ${script.beatSentences.length} chapters`)
process.stdout.write(`  Synthing in ONE continuous call (may take 2-3 min for long-form)... `)

const r = await elSynth(script.fullText)
const finalMp3 = resolve(cityPub, 'voiceover.mp3')
await writeFile(finalMp3, Buffer.from(r.audio_base64, 'base64'))
const finalDur = await mp3Duration(finalMp3)
const words = alignmentToWords(r.alignment)
console.log(`${finalDur.toFixed(2)}s, ${words.length} words`)

// Duration gate (8-12 min per skill spec §2)
const MIN_DUR = 480; const MAX_DUR = 720
if (finalDur < MIN_DUR) console.warn(`  WARNING: ${finalDur.toFixed(1)}s < 8:00 minimum — consider expanding the script`)
if (finalDur > MAX_DUR) console.warn(`  WARNING: ${finalDur.toFixed(1)}s > 12:00 maximum — consider trimming`)

// Auto-register in asset library
try {
  const { register } = await import('../lib/asset-library.mjs')
  await register(finalMp3, {
    type: 'audio',
    source: 'elevenlabs',
    source_id: `elevenlabs:yt-long:${slug}:${new Date().toISOString().slice(0, 10)}`,
    license: 'owned',
    license_metadata: { voice_id: VOICE, model: 'eleven_turbo_v2_5', text_chars: script.fullText.length, word_count: words.length, format: 'youtube-long-form' },
    creator: 'Victoria (ElevenLabs)',
    geo: [slug, 'central-oregon'],
    subject: ['voiceover', 'market-report', 'youtube-long-form'],
    search_query: `${script.city} YouTube long-form market report VO`,
    duration_sec: finalDur,
    approval: 'approved',
    notes: `YouTube long-form VO for ${script.city} market report. Generated ${new Date().toISOString()}.`,
  })
} catch (e) {
  console.warn(`  asset-library register failed (non-fatal): ${e.message}`)
}

// ─── Chapter boundary derivation from cumulative word counts ────────────────
// Mirrors short-form synth-vo.mjs: each chapter's start time = the word
// timestamp of the first word of that chapter's sentence block.

const chapterStartSecs = []
let cumWordIdx = 0
for (let i = 0; i < script.beatSentences.length; i++) {
  if (cumWordIdx >= words.length) {
    chapterStartSecs.push(chapterStartSecs[chapterStartSecs.length - 1] + 60)
  } else {
    chapterStartSecs.push(words[cumWordIdx].startSec)
  }
  cumWordIdx += countWords(script.beatSentences[i].sentence)
}

const VO_TAIL_PAD = 1.0 // slightly longer tail for long-form outro
const totalDuration = finalDur + VO_TAIL_PAD
const chapterDurations = []
for (let i = 0; i < chapterStartSecs.length; i++) {
  const start = chapterStartSecs[i]
  const end = i + 1 < chapterStartSecs.length ? chapterStartSecs[i + 1] : totalDuration
  chapterDurations.push(Math.max(30, end - start)) // floor 30s per chapter
}

const total = chapterDurations.reduce((s, x) => s + x, 0)
console.log(`  Chapter durations (s):`, chapterDurations.map(d => d.toFixed(1)).join(', '))
console.log(`  Total: ${total.toFixed(1)}s = ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`)

// Update props with real VO timing
props.voPath = `${slug}/voiceover.mp3`
props.captionWords = words
props.chapterDurations = chapterDurations

await writeFile(propsPath, JSON.stringify(props, null, 2))
await writeFile(resolve(cityOut, 'alignment.json'), JSON.stringify({
  city: script.city,
  format: 'youtube-long-form',
  total_duration_sec: finalDur,
  fullText: script.fullText,
  words,
  chapterStartSecs,
  chapterDurations,
  beatSentences: script.beatSentences,
}, null, 2))

console.log(`  ${words.length} captionWords written to props.json`)
console.log(`\nNext: node scripts/render-youtube-long.mjs --city ${slug} --period ${args.period || ''}`)
