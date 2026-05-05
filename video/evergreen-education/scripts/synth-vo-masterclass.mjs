#!/usr/bin/env node
/**
 * synth-vo-masterclass.mjs
 *
 * Same provider chain + sentence segmentation as synth-vo.mjs, but reads from
 * data/masterclass.json and writes outputs under out/masterclass/ + public/masterclass/.
 *
 * Run: node video/evergreen-education/scripts/synth-vo-masterclass.mjs [--provider=grok|elevenlabs|openai|skip]
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
const DATA = resolve(ROOT, 'data', 'masterclass.json')
const OUT_DIR = resolve(ROOT, 'out', 'masterclass')
const SEG_DIR = resolve(OUT_DIR, 'segments')
const PUB_DIR = resolve(ROOT, 'public', 'masterclass')

const EL_VOICE = 'qSeXEcewz7tA0Q0qk9fH'
const EL_HOST = 'https://api.elevenlabs.io'
const GROK_HOST = 'https://api.x.ai'
const GROK_VOICE = 'eve'
const OPENAI_HOST = 'https://api.openai.com'

async function elSynth(text, previousText) {
  const res = await fetch(`${EL_HOST}/v1/text-to-speech/${EL_VOICE}/with-timestamps`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
      ...(previousText ? { previous_text: previousText } : {}),
    }),
  })
  if (!res.ok) throw new Error(`elevenlabs ${res.status}`)
  const json = await res.json()
  return { audioBuffer: Buffer.from(json.audio_base64, 'base64'), alignment: json.alignment, nativeWords: false }
}

function elAlignmentToWords(alignment, offsetSec) {
  const chars = alignment.characters
  const starts = alignment.character_start_times_seconds
  const ends = alignment.character_end_times_seconds
  const words = []
  let buf = '', bufStart = null, bufEnd = null
  const flush = () => {
    if (buf.trim()) words.push({ text: buf.trim(), startSec: bufStart + offsetSec, endSec: bufEnd + offsetSec })
    buf = ''; bufStart = null; bufEnd = null
  }
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (/\s/.test(ch)) flush()
    else { if (bufStart === null) bufStart = starts[i]; bufEnd = ends[i]; buf += ch }
  }
  flush()
  return words
}

async function grokTts(text) {
  const res = await fetch(`${GROK_HOST}/v1/tts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: GROK_VOICE, language: 'en', output_format: { codec: 'mp3', sample_rate: 44100, bit_rate: 128000 } }),
  })
  if (!res.ok) throw new Error(`grok tts ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

async function grokStt(audioBuffer, attempt = 1) {
  const fd = new FormData()
  fd.append('language', 'en')
  fd.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
  const res = await fetch(`${GROK_HOST}/v1/stt`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` }, body: fd })
  if (!res.ok) {
    if ((res.status === 500 || res.status === 502 || res.status === 503) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      return grokStt(audioBuffer, attempt + 1)
    }
    throw new Error(`grok stt ${res.status}`)
  }
  return await res.json()
}

async function grokSynth(text) {
  const audioBuffer = await grokTts(text)
  const stt = await grokStt(audioBuffer)
  return { audioBuffer, nativeWords: true, words: (stt.words || []).map((w) => ({ text: w.text, startSec: w.start, endSec: w.end })) }
}

async function openaiSynth(text) {
  const r = await fetch(`${OPENAI_HOST}/v1/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'alloy', input: text, response_format: 'mp3' }),
  })
  if (!r.ok) throw new Error(`openai tts ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const audioBuffer = Buffer.from(await r.arrayBuffer())
  const fd = new FormData()
  fd.append('model', 'whisper-1')
  fd.append('response_format', 'verbose_json')
  fd.append('timestamp_granularities[]', 'word')
  fd.append('language', 'en')
  fd.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
  const w = await fetch(`${OPENAI_HOST}/v1/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd })
  if (!w.ok) throw new Error(`whisper ${w.status}`)
  const stt = await w.json()
  return { audioBuffer, nativeWords: true, words: (stt.words || []).map((x) => ({ text: x.word, startSec: x.start, endSec: x.end })) }
}

/**
 * v3 segmentation per Matt 2026-05-04: WHOLE SENTENCES ONLY.
 * No comma soft-breaks, no max-word cap. Long sentences wrap inside the pill
 * (CaptionBand auto-fits font size). Sentence boundary = . ! ? only.
 */
function buildCaptionSentences(allWords) {
  const HARD_END = /[.!?]$/
  const phrases = []
  let cur = []
  const flush = () => {
    if (!cur.length) return
    phrases.push({
      text: cur.map((x) => x.text).join(' '),
      startSec: cur[0].startSec,
      endSec: cur[cur.length - 1].endSec,
      words: cur,
    })
    cur = []
  }
  for (const w of allWords) {
    cur.push(w)
    const t = w.text.replace(/["()\[\]]/g, '').trim()
    if (HARD_END.test(t) && !t.endsWith('...')) flush()
  }
  if (cur.length) flush()
  // Extend sentence end through breath gap to next sentence (no flicker)
  for (let i = 0; i < phrases.length - 1; i++) {
    const gap = phrases[i + 1].startSec - phrases[i].endSec
    if (gap > 0 && gap < 1.5) phrases[i].endSec = phrases[i + 1].startSec - 0.05
  }
  return phrases
}

async function mp3Duration(p) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', p])
  return parseFloat(stdout.trim())
}

async function concatMp3(segments, outPath, tempoScale = 1.0) {
  const listFile = `${outPath}.list`
  await writeFile(listFile, segments.map((s) => `file '${s.replaceAll("'", "'\\''")}'`).join('\n'))
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile]
  if (Math.abs(tempoScale - 1.0) > 0.001) args.push('-filter:a', `atempo=${tempoScale}`)
  args.push('-c:a', 'libmp3lame', '-q:a', '2', '-ar', '44100', '-ac', '2', outPath)
  await exec('ffmpeg', args)
  await rm(listFile, { force: true })
}

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

async function main() {
  const provider = pickProvider()
  console.log(`Provider: ${provider}`)
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(SEG_DIR, { recursive: true })
  await mkdir(PUB_DIR, { recursive: true })

  if (provider === 'skip') {
    await writeFile(resolve(OUT_DIR, 'captionWords.json'), '[]')
    await writeFile(resolve(OUT_DIR, 'captionSentences.json'), '[]')
    await writeFile(resolve(OUT_DIR, 'alignment.json'), JSON.stringify({ skipped: true }, null, 2))
    return
  }

  const synth = provider === 'elevenlabs' ? elSynth : provider === 'grok' ? grokSynth : openaiSynth
  const config = JSON.parse(await readFile(DATA, 'utf8'))
  const segments = config.script.segments
  const targetSec = config.lengthTarget?.targetSec ?? 135
  const maxSec = config.lengthTarget?.maxSec ?? 150

  console.log(`Synthesizing ${segments.length} chapters via ${provider} (target ${targetSec}s, max ${maxSec}s, NO speedup)...\n`)

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
    if (r.nativeWords) segWords = r.words.map((w) => ({ text: w.text, startSec: w.startSec + cumOffset, endSec: w.endSec + cumOffset }))
    else segWords = elAlignmentToWords(r.alignment, cumOffset)
    allWords.push(...segWords)
    segMeta.push({ id: s.id, text: s.text, startSec: cumOffset, endSec: cumOffset + dur, duration: dur, wordCount: segWords.length })
    console.log(`${dur.toFixed(2)}s, ${segWords.length} words`)
    cumOffset += dur
    prevText = s.text
  }

  const rawTotal = segMeta.reduce((s, m) => s + m.duration, 0)
  // Per Matt 2026-05-04: NO speedup for the masterclass. Pacing is the deliverable.
  // If raw total exceeds maxSec, we warn but ship — no atempo compression.
  let tempoScale = 1.0
  if (rawTotal > maxSec) {
    console.warn(`\n⚠ raw VO ${rawTotal.toFixed(2)}s exceeds max ${maxSec}s. Shipping at native pace anyway — trim script if you want it shorter.`)
  } else {
    console.log(`\nNative pace (no atempo): ${rawTotal.toFixed(2)}s — within [${0}, ${maxSec}]s budget.`)
  }

  const finalMp3Pub = resolve(PUB_DIR, 'voiceover.mp3')
  const finalMp3Out = resolve(OUT_DIR, 'voiceover.mp3')
  await concatMp3(segPaths, finalMp3Pub, tempoScale)
  await copyFile(finalMp3Pub, finalMp3Out)
  const finalDur = await mp3Duration(finalMp3Pub)
  console.log(`✓ voiceover.mp3: ${finalDur.toFixed(2)}s (tempoScale ${tempoScale.toFixed(3)})`)

  if (tempoScale !== 1.0) {
    for (const w of allWords) { w.startSec /= tempoScale; w.endSec /= tempoScale }
    for (const m of segMeta) { m.startSec /= tempoScale; m.endSec /= tempoScale; m.duration /= tempoScale }
  }

  await writeFile(resolve(OUT_DIR, 'captionWords.json'), JSON.stringify(allWords, null, 2))
  await writeFile(resolve(OUT_DIR, 'captionSentences.json'), JSON.stringify(buildCaptionSentences(allWords), null, 2))
  await writeFile(resolve(OUT_DIR, 'alignment.json'), JSON.stringify({
    provider,
    voice: provider === 'elevenlabs' ? `Victoria (${EL_VOICE})` : provider === 'grok' ? `Grok TTS (${GROK_VOICE})` : 'OpenAI gpt-4o-mini-tts (alloy)',
    rawTotalDurationSec: rawTotal,
    tempoScale,
    totalDurationSec: finalDur,
    segments: segMeta,
    words: allWords,
  }, null, 2))
  console.log(`✓ alignment + captions written (${allWords.length} words)`)
}

main().catch((err) => { console.error(err); process.exit(1) })
