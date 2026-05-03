#!/usr/bin/env node
/**
 * synth-vo.mjs
 *
 * Synthesizes the 4-pillars VO with a tiered fallback chain so the build can
 * still produce VO + captions when the preferred provider's key is missing.
 *
 * Provider priority (best quality first):
 *   1. ElevenLabs Victoria  — ELEVENLABS_API_KEY
 *      - Locked settings per CLAUDE.md (eleven_turbo_v2_5, stability 0.50,
 *        similarity 0.75, style 0.35), previous_text chained.
 *      - /v1/text-to-speech/.../with-timestamps returns native char-level alignment.
 *   2. Grok TTS (xAI)        — XAI_API_KEY
 *      - POST /v1/tts with voice_id 'eve' (default warm female), mp3 output.
 *      - Word timestamps via second pass: POST /v1/stt on the rendered audio.
 *   3. OpenAI TTS            — OPENAI_API_KEY
 *      - POST /v1/audio/speech (gpt-4o-mini-tts, voice 'alloy'), mp3 output.
 *      - Word timestamps via Whisper: POST /v1/audio/transcriptions
 *        with timestamp_granularities[]=word.
 *   4. --skip                — write empty caption stubs; cloud render goes silent.
 *
 * Override: --provider=elevenlabs | grok | openai | skip
 *
 * Outputs (regardless of provider):
 *   public/4-pillars/voiceover.mp3       — concatenated final VO
 *   out/4-pillars/voiceover.mp3          — duplicate copy at out/ for inspection
 *   out/4-pillars/alignment.json         — provider + word-level timestamps + segment meta
 *   out/4-pillars/captionWords.json      — array<{text, startSec, endSec}>
 *   out/4-pillars/segments/seg-NN-*.mp3  — per-segment audio
 *
 * Run: node video/evergreen-education/scripts/synth-vo.mjs
 *      node video/evergreen-education/scripts/synth-vo.mjs --provider=grok
 *      node video/evergreen-education/scripts/synth-vo.mjs --skip
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
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

// ---------- ElevenLabs (preferred) ----------
const EL_VOICE = 'qSeXEcewz7tA0Q0qk9fH' // Victoria, locked per CLAUDE.md
const EL_HOST = 'https://api.elevenlabs.io'

async function elSynth(text, previousText) {
  const body = {
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: { stability: 0.50, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    ...(previousText ? { previous_text: previousText } : {}),
  }
  const res = await fetch(`${EL_HOST}/v1/text-to-speech/${EL_VOICE}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 400)}`)
  const json = await res.json()
  return {
    audioBuffer: Buffer.from(json.audio_base64, 'base64'),
    alignment: json.alignment, // {characters, character_start_times_seconds, character_end_times_seconds}
    nativeWords: false,
  }
}

function elAlignmentToWords(alignment, offsetSec) {
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
    if (/\s/.test(ch)) flush()
    else {
      if (bufStart === null) bufStart = starts[i]
      bufEnd = ends[i]
      buf += ch
    }
  }
  flush()
  return words
}

// ---------- Grok TTS + STT (xAI fallback) ----------
const GROK_HOST = 'https://api.x.ai'
const GROK_VOICE = 'eve' // warm female default per docs.x.ai

async function grokTts(text) {
  const res = await fetch(`${GROK_HOST}/v1/tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice_id: GROK_VOICE,
      language: 'en',
      output_format: { codec: 'mp3', sample_rate: 44100, bit_rate: 128000 },
    }),
  })
  if (!res.ok) throw new Error(`grok tts ${res.status}: ${(await res.text()).slice(0, 400)}`)
  return Buffer.from(await res.arrayBuffer())
}

async function grokStt(audioBuffer) {
  // multipart/form-data via FormData (Node 18+)
  const fd = new FormData()
  fd.append('language', 'en')
  fd.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3') // file MUST be last per docs
  const res = await fetch(`${GROK_HOST}/v1/stt`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.XAI_API_KEY}` },
    body: fd,
  })
  if (!res.ok) throw new Error(`grok stt ${res.status}: ${(await res.text()).slice(0, 400)}`)
  return await res.json() // { text, duration, words: [{text, start, end}] }
}

async function grokSynth(text /*, previousText (unsupported) */) {
  const audioBuffer = await grokTts(text)
  const stt = await grokStt(audioBuffer)
  return {
    audioBuffer,
    nativeWords: true,
    words: (stt.words || []).map((w) => ({ text: w.text, startSec: w.start, endSec: w.end })),
  }
}

// ---------- OpenAI TTS + Whisper (final fallback) ----------
const OPENAI_HOST = 'https://api.openai.com'

async function openaiTts(text) {
  const res = await fetch(`${OPENAI_HOST}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: text,
      response_format: 'mp3',
    }),
  })
  if (!res.ok) throw new Error(`openai tts ${res.status}: ${(await res.text()).slice(0, 400)}`)
  return Buffer.from(await res.arrayBuffer())
}

async function openaiWhisperWords(audioBuffer) {
  const fd = new FormData()
  fd.append('model', 'whisper-1')
  fd.append('response_format', 'verbose_json')
  fd.append('timestamp_granularities[]', 'word')
  fd.append('language', 'en')
  fd.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
  const res = await fetch(`${OPENAI_HOST}/v1/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  })
  if (!res.ok) throw new Error(`whisper ${res.status}: ${(await res.text()).slice(0, 400)}`)
  return await res.json() // { text, words: [{word, start, end}] }
}

async function openaiSynth(text /*, previousText (unsupported) */) {
  const audioBuffer = await openaiTts(text)
  const whisper = await openaiWhisperWords(audioBuffer)
  return {
    audioBuffer,
    nativeWords: true,
    words: (whisper.words || []).map((w) => ({ text: w.word, startSec: w.start, endSec: w.end })),
  }
}

// ---------- ffmpeg helpers ----------
async function mp3Duration(path) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path])
  return parseFloat(stdout.trim())
}

async function concatMp3(segments, outPath, tempoScale = 1.0) {
  const listFile = `${outPath}.list`
  const list = segments.map((s) => `file '${s.replaceAll("'", "'\\''")}'`).join('\n')
  await writeFile(listFile, list)
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile]
  if (Math.abs(tempoScale - 1.0) > 0.001) {
    args.push('-filter:a', `atempo=${tempoScale}`)
  }
  args.push('-c:a', 'libmp3lame', '-q:a', '2', '-ar', '44100', '-ac', '2', outPath)
  await exec('ffmpeg', args)
  await rm(listFile, { force: true })
}

// ---------- provider selection ----------
function arg(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`))
  return a ? a.split('=')[1] : null
}

function pickProvider() {
  const explicit = arg('provider')
  if (explicit) return explicit

  if (process.argv.includes('--skip')) return 'skip'

  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs'
  if (process.env.XAI_API_KEY) return 'grok'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'skip'
}

async function writeSkipStub() {
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(resolve(OUT_DIR, 'captionWords.json'), JSON.stringify([], null, 2))
  await writeFile(resolve(OUT_DIR, 'alignment.json'), JSON.stringify({
    skipped: true,
    reason: 'no TTS provider key available; render goes silent',
  }, null, 2))
  console.log('✓ wrote empty stub captionWords + alignment (skip mode)')
}

// ---------- main ----------
async function main() {
  const provider = pickProvider()
  console.log(`Provider: ${provider}`)

  if (provider === 'skip') {
    await writeSkipStub()
    return
  }

  const synth =
    provider === 'elevenlabs' ? elSynth :
    provider === 'grok' ? grokSynth :
    provider === 'openai' ? openaiSynth :
    null
  if (!synth) {
    console.error(`Unknown provider: ${provider}. Use elevenlabs | grok | openai | skip.`)
    process.exit(1)
  }

  // Sanity-check the matching key is present
  const required =
    provider === 'elevenlabs' ? 'ELEVENLABS_API_KEY' :
    provider === 'grok' ? 'XAI_API_KEY' :
    provider === 'openai' ? 'OPENAI_API_KEY' :
    null
  if (required && !process.env[required]) {
    console.error(`${required} missing for provider=${provider}`)
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(SEG_DIR, { recursive: true })
  await mkdir(PUB_DIR, { recursive: true })

  const config = JSON.parse(await readFile(DATA, 'utf8'))
  const segments = config.script.segments

  console.log(`Synthesizing ${segments.length} segments via ${provider}...\n`)

  const segPaths = []
  const allWords = []
  const segMeta = []
  let cumOffset = 0
  let prevText = ''

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    process.stdout.write(`  ${String(i + 1).padStart(2)}/${segments.length} ${s.id}: synth... `)
    const r = await synth(s.text, prevText || undefined)
    const segPath = resolve(SEG_DIR, `seg-${String(i).padStart(2, '0')}-${s.id}.mp3`)
    await writeFile(segPath, r.audioBuffer)
    segPaths.push(segPath)
    const dur = await mp3Duration(segPath)

    let segWords
    if (r.nativeWords) {
      segWords = r.words.map((w) => ({ text: w.text, startSec: w.startSec + cumOffset, endSec: w.endSec + cumOffset }))
    } else {
      segWords = elAlignmentToWords(r.alignment, cumOffset)
    }
    allWords.push(...segWords)
    segMeta.push({ id: s.id, text: s.text, startSec: cumOffset, endSec: cumOffset + dur, duration: dur, wordCount: segWords.length })
    console.log(`${dur.toFixed(2)}s, ${segWords.length} words`)
    cumOffset += dur
    prevText = s.text
  }

  // Auto-fit to evergreen 60s ceiling. If the concatenated raw VO would exceed
  // 60s, scale via atempo (preserves pitch) so the final concat lands ≤ 60s.
  // We compute against the sum of segment durations BEFORE concat.
  const rawTotal = segMeta.reduce((s, m) => s + m.duration, 0)
  const TARGET_SEC = 58.5 // leave headroom under 60s ceiling
  let tempoScale = 1.0
  if (rawTotal > TARGET_SEC) {
    tempoScale = rawTotal / TARGET_SEC
    // Cap at 1.5x — beyond that voice sounds rushed. If we need more, the
    // script must be trimmed, not the audio sped up.
    if (tempoScale > 1.5) {
      console.warn(`\n⚠ raw VO ${rawTotal.toFixed(2)}s would need ${tempoScale.toFixed(2)}x speedup to hit ${TARGET_SEC}s. Capping at 1.5x — final will be over budget. Trim the script for a clean fit.`)
      tempoScale = 1.5
    } else {
      console.log(`\nApplying atempo=${tempoScale.toFixed(3)} to compress ${rawTotal.toFixed(2)}s → ~${TARGET_SEC}s`)
    }
  }

  const finalMp3Pub = resolve(PUB_DIR, 'voiceover.mp3')
  const finalMp3Out = resolve(OUT_DIR, 'voiceover.mp3')
  await concatMp3(segPaths, finalMp3Pub, tempoScale)
  await copyFile(finalMp3Pub, finalMp3Out)
  const finalDur = await mp3Duration(finalMp3Pub)
  console.log(`✓ Concatenated voiceover.mp3: ${finalDur.toFixed(2)}s (tempoScale ${tempoScale.toFixed(3)})`)

  // Adjust word timestamps to match the post-tempo timeline
  if (tempoScale !== 1.0) {
    for (const w of allWords) {
      w.startSec = w.startSec / tempoScale
      w.endSec = w.endSec / tempoScale
    }
    for (const m of segMeta) {
      m.startSec = m.startSec / tempoScale
      m.endSec = m.endSec / tempoScale
      m.duration = m.duration / tempoScale
    }
  }

  const meta = {
    provider,
    voice:
      provider === 'elevenlabs' ? `Victoria (${EL_VOICE})` :
      provider === 'grok' ? `Grok TTS (${GROK_VOICE})` :
      provider === 'openai' ? 'OpenAI TTS (alloy, gpt-4o-mini-tts)' :
      'unknown',
    chained: provider === 'elevenlabs',
    rawTotalDurationSec: rawTotal,
    tempoScale,
    totalDurationSec: finalDur,
    segments: segMeta,
    words: allWords,
  }
  await writeFile(resolve(OUT_DIR, 'captionWords.json'), JSON.stringify(allWords, null, 2))
  await writeFile(resolve(OUT_DIR, 'alignment.json'), JSON.stringify(meta, null, 2))

  console.log(`✓ wrote alignment.json + captionWords.json (${allWords.length} words, ${provider})`)
  console.log(`\nNext: node scripts/render.mjs`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
