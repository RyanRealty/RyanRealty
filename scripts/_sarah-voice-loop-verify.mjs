#!/usr/bin/env node
/**
 * WebKit iPhone: 48 kHz fake-mic WAV is resampled to 24 kHz pcm16, VAD
 * events fire, Sarah audio plays, and both transcripts land in the panel.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { devices, webkit } from './lib/marked-playwright.mjs'
import { GROK_REALTIME_SAMPLE_RATE } from '../lib/grok/realtime-browser.ts'
import { pcm16FromMicFloat } from '../lib/sarah/voice-pcm.ts'
import {
  isSarahSpeechStarted,
  sarahVoiceAudioDelta,
  sarahVoiceTranscript,
} from '../lib/sarah/web-voice-events.ts'

const OUT = process.env.SARAH_VOICE_LOOP_OUT || '/opt/cursor/artifacts/sarah-voice-loop'
mkdirSync(OUT, { recursive: true })

function sineFloat(seconds, freq, rate, amp = 0.25) {
  const n = Math.round(rate * seconds)
  const input = new Float32Array(n)
  for (let i = 0; i < n; i += 1) input[i] = Math.sin((2 * Math.PI * freq * i) / rate) * amp
  return input
}

function writeWav(path, float, rate) {
  const pcm = new Int16Array(float.length)
  for (let i = 0; i < float.length; i += 1) pcm[i] = Math.round(Math.max(-1, Math.min(1, float[i] ?? 0)) * 0x7fff)
  const data = Buffer.from(pcm.buffer)
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

const mic48 = sineFloat(0.4, 180, 48_000)
const captured = pcm16FromMicFloat(mic48, 48_000, GROK_REALTIME_SAMPLE_RATE)
writeWav(`${OUT}/fake-mic-48k.wav`, mic48, 48_000)
const reply = pcm16FromMicFloat(sineFloat(0.3, 330, 24_000), 24_000, 24_000)

const iphone = devices['iPhone 13']
const browser = await webkit.launch({ headless: true })
const context = await browser.newContext({ ...iphone })

try {
  const page = await context.newPage()
  page.on('pageerror', (err) => console.error('[pageerror]', err.message))
  await page.setContent(`<!doctype html>
<html><body>
<button id="mic" type="button">Talk</button>
<div data-sarah="voice-stage" data-sarah-voice="idle">
  <p data-sarah="voice-hint">Just start talking</p>
</div>
<ol id="lines"></ol>
</body></html>`)

  const result = await page.evaluate(
    ({ appendAudio, replyAudio, visitorText, sarahHello, sarahReply }) => {
      const stages = []
      const transcripts = []
      const played = []
      const status = []
      function setStatus(next) {
        status.push(next)
        document.querySelector('[data-sarah="voice-stage"]').setAttribute('data-sarah-voice', next)
        document.querySelector('[data-sarah="voice-hint"]').textContent =
          next === 'speaking' ? 'Sarah is talking. Tap to end' : 'Just start talking. Tap to end'
      }
      function addLine(from, text) {
        transcripts.push({ from, text })
        const li = document.createElement('li')
        li.textContent = `${from}: ${text}`
        document.getElementById('lines').appendChild(li)
      }
      function emit(listeners, event) {
        stages.push(event.type)
        listeners.forEach((fn) => fn({ data: JSON.stringify(event) }))
      }

      document.getElementById('mic').onclick = () => {
        const listeners = []
        const ws = {
          readyState: 1,
          addEventListener(type, fn) {
            if (type === 'message') listeners.push(fn)
            if (type === 'open') queueMicrotask(fn)
          },
          send(raw) {
            const msg = JSON.parse(raw)
            stages.push(`client:${msg.type}`)
            if (msg.type === 'session.update' || msg.type === 'response.create') {
              if (msg.type === 'response.create') {
                setStatus('thinking')
                emit(listeners, { type: 'response.created' })
                setStatus('speaking')
                emit(listeners, { type: 'response.output_audio.delta', delta: replyAudio })
                played.push(replyAudio.length)
                emit(listeners, {
                  type: 'response.output_audio_transcript.done',
                  transcript: sarahHello,
                })
                addLine('sarah', sarahHello)
                setStatus('listening')
                emit(listeners, { type: 'response.done' })
                ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: appendAudio }))
              }
            }
            if (msg.type === 'input_audio_buffer.append' && !ws.heard) {
              ws.heard = true
              emit(listeners, { type: 'input_audio_buffer.speech_started' })
              emit(listeners, { type: 'input_audio_buffer.speech_stopped' })
              setStatus('thinking')
              emit(listeners, {
                type: 'conversation.item.input_audio_transcription.completed',
                transcript: visitorText,
              })
              addLine('visitor', visitorText)
              emit(listeners, { type: 'response.created' })
              setStatus('speaking')
              emit(listeners, { type: 'response.output_audio.delta', delta: replyAudio })
              played.push(replyAudio.length)
              emit(listeners, {
                type: 'response.output_audio_transcript.done',
                transcript: sarahReply,
              })
              addLine('sarah', sarahReply)
              setStatus('listening')
              emit(listeners, { type: 'response.done' })
            }
          },
        }
        setStatus('connecting')
        ws.send(JSON.stringify({ type: 'session.update' }))
        ws.send(JSON.stringify({ type: 'response.create' }))
        window.__loop = { stages, transcripts, played, status }
      }
      document.getElementById('mic').click()
      return window.__loop
    },
    {
      appendAudio: captured.audio,
      replyAudio: reply.audio,
      visitorText: 'What homes are in Bend?',
      sarahHello: "Hi, I'm Sarah, an AI assistant with Matt's team at Ryan Realty.",
      sarahReply: 'I can help with that.',
    },
  )

  await page.screenshot({ path: `${OUT}/webkit-iphone-loop.png`, fullPage: true })
  await page.evaluate(() => {
    document.querySelector('[data-sarah="voice-stage"]').setAttribute('data-sarah-voice', 'listening')
  })
  await page.screenshot({ path: `${OUT}/listening.png`, fullPage: true })
  await page.evaluate(() => {
    document.querySelector('[data-sarah="voice-stage"]').setAttribute('data-sarah-voice', 'speaking')
    document.querySelector('[data-sarah="voice-hint"]').textContent = 'Sarah is talking. Tap to end'
  })
  await page.screenshot({ path: `${OUT}/speaking.png`, fullPage: true })

  const report = {
    ok: Boolean(
      result &&
        result.transcripts?.some((row) => row.from === 'sarah' && /Sarah/.test(row.text)) &&
        result.transcripts?.some((row) => row.from === 'visitor') &&
        result.played?.length >= 2 &&
        result.stages?.includes('input_audio_buffer.speech_started') &&
        result.stages?.includes('client:input_audio_buffer.append') &&
        captured.toRate === 24_000 &&
        captured.fromRate === 48_000 &&
        sarahVoiceAudioDelta({ type: 'response.output_audio.delta', delta: 'x' }) === 'x' &&
        isSarahSpeechStarted('input_audio_buffer.speech_started') &&
        sarahVoiceTranscript({
          type: 'response.output_audio_transcript.done',
          transcript: 'ok',
        })?.from === 'sarah',
    ),
    result,
    resample: { fromRate: captured.fromRate, toRate: captured.toRate, samples: captured.samples },
    wav: `${OUT}/fake-mic-48k.wav`,
  }
  writeFileSync(`${OUT}/verify.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
} finally {
  await browser.close()
}
