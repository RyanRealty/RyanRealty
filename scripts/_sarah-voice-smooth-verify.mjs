#!/usr/bin/env node
/**
 * Record a gapless Eve playback sample and count underruns.
 * Local: synthetic 24 kHz chunks through the scheduler.
 * Live: pass a URL to also check Permissions-Policy.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { GROK_REALTIME_SAMPLE_RATE } from '../lib/grok/realtime-browser.ts'
import {
  SARAH_VOICE_LEAD_SEC,
  createSarahVoicePlayback,
  decodeBase64Pcm16,
} from '../lib/sarah/voice-playback.ts'

const OUT = process.env.SARAH_VOICE_SMOOTH_OUT || '/opt/cursor/artifacts/sarah-voice-smooth'
const TARGET = process.argv[2] || ''
mkdirSync(OUT, { recursive: true })

function sineChunk(seconds, freq = 220, amp = 0.2) {
  const n = Math.round(GROK_REALTIME_SAMPLE_RATE * seconds)
  const pcm = new Int16Array(n)
  for (let i = 0; i < n; i += 1) {
    pcm[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / GROK_REALTIME_SAMPLE_RATE) * amp * 0x7fff)
  }
  const bytes = new Uint8Array(pcm.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0)
  return { b64: Buffer.from(bytes).toString('base64'), pcm }
}

function writeWav(path, pcm, rate) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(path, Buffer.concat([header, data]))
}

const chunks = [sineChunk(0.08), sineChunk(0.08), sineChunk(0.08), sineChunk(0.12)]
const starts = []
const ctx = {
  sampleRate: GROK_REALTIME_SAMPLE_RATE,
  currentTime: 0,
  destination: {},
  createBuffer(_c, length, sampleRate) {
    return {
      length,
      duration: length / sampleRate,
      sampleRate,
      copyToChannel() {},
    }
  },
  createBufferSource() {
    return {
      buffer: null,
      connect() {},
      disconnect() {},
      start(when = 0) {
        starts.push({ at: when, duration: this.buffer?.duration ?? 0 })
      },
      stop() {},
    }
  },
}

const play = createSarahVoicePlayback(ctx)
const pcmParts = []
for (const chunk of chunks) {
  play.pushBase64Pcm16(chunk.b64)
  pcmParts.push(decodeBase64Pcm16(chunk.b64))
  ctx.currentTime = Math.max(0, (starts.at(-1)?.at ?? 0) - SARAH_VOICE_LEAD_SEC / 2)
}

const gaps = starts.slice(1).map((row, i) => row.at - ((starts[i]?.at ?? 0) + (starts[i]?.duration ?? 0)))
const pcm = new Float32Array(pcmParts.reduce((n, p) => n + p.length, 0))
let off = 0
for (const part of pcmParts) {
  pcm.set(part, off)
  off += part.length
}
const wavPcm = new Int16Array(pcm.length)
for (let i = 0; i < pcm.length; i += 1) wavPcm[i] = Math.round(Math.max(-1, Math.min(1, pcm[i] ?? 0)) * 0x7fff)
writeWav(`${OUT}/eve-gapless.wav`, wavPcm, GROK_REALTIME_SAMPLE_RATE)

const header = TARGET
  ? await fetch(TARGET, { redirect: 'follow' }).then(
      (r) => r.headers.get('permissions-policy') || r.headers.get('Permissions-Policy') || '',
    )
  : ''

const report = {
  ok: play.underruns() === 0 && gaps.every((g) => Math.abs(g) < 1e-9) && starts[0]?.at === SARAH_VOICE_LEAD_SEC,
  underruns: play.underruns(),
  chunks: starts.length,
  leadSec: SARAH_VOICE_LEAD_SEC,
  sampleRate: GROK_REALTIME_SAMPLE_RATE,
  gaps,
  wav: `${OUT}/eve-gapless.wav`,
  permissionsPolicy: header || null,
  target: TARGET || null,
}
writeFileSync(`${OUT}/verify.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exit(1)
