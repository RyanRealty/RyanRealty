/**
 * Browser Eve realtime session. Uses an ephemeral client secret in the
 * WebSocket subprotocol. No API key on the client.
 *
 * iOS: capture is resampled from the AudioContext rate (often 48 kHz) to
 * 24 kHz pcm16 before append. Playback uses the same AudioContext that was
 * resumed in the tap, routed through an HTMLAudioElement so the silent
 * switch does not mute Eve.
 */
import {
  GROK_REALTIME_SAMPLE_RATE,
  grokRealtimeSessionVoice,
  grokRealtimeSubprotocol,
  grokRealtimeWebSocketUrl,
} from '@/lib/grok/realtime-browser'
import { buildSarahSystemPrompt, sarahGreeting } from './persona'
import { WEB_VOICE_NOTICE_EN, WEB_VOICE_TALK_EN } from './scripts'
import { logSarahVoiceStage } from './voice-debug'
import { createSarahVoicePlayback } from './voice-playback'
import { pcm16FromMicFloat } from './voice-pcm'
import {
  isSarahResponseCreated,
  isSarahResponseFinished,
  isSarahSpeechStarted,
  isSarahSpeechStopped,
  sarahVoiceAudioDelta,
  sarahVoiceTranscript,
  type SarahVoiceServerEvent,
} from './web-voice-events'
import { SARAH_MIC_CONSTRAINTS, type SarahArmedMic } from './web-voice-arm'

export type SarahVoiceStatus =
  | 'idle'
  | 'asking'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'

export type SarahVoiceHandle = {
  stop: () => void
  setMuted: (muted: boolean) => void
  speakExact: (text: string) => void
  underruns: () => number
}

export type SarahVoiceTranscriptMeta = { interim?: boolean }

const MAX_MS = 5 * 60_000

export async function startSarahVoiceSession(opts: {
  secret: string
  brokerFirstName: string
  armed?: SarahArmedMic
  onStatus: (status: SarahVoiceStatus) => void
  onError: (message: string) => void
  onTranscript?: (from: 'sarah' | 'visitor', text: string, meta?: SarahVoiceTranscriptMeta) => void
}): Promise<SarahVoiceHandle> {
  opts.onStatus('connecting')
  logSarahVoiceStage('session.start')
  const stream = opts.armed
    ? await opts.armed.streamPromise
    : await navigator.mediaDevices.getUserMedia(SARAH_MIC_CONSTRAINTS)
  logSarahVoiceStage('gum.ready', { tracks: stream.getTracks().length })
  const ws = new WebSocket(grokRealtimeWebSocketUrl(), [grokRealtimeSubprotocol(opts.secret)])
  const audioCtx = opts.armed?.captureCtx ?? new AudioContext({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  const source = audioCtx.createMediaStreamSource(stream)
  const processor = audioCtx.createScriptProcessor(2048, 1, 1)
  const mute = audioCtx.createGain()
  mute.gain.value = 0
  const playCtx = opts.armed?.playCtx ?? audioCtx
  if (playCtx.state === 'suspended') void playCtx.resume()
  const playDest = opts.armed?.playDest ?? playCtx.destination
  const publishUnderruns = (count: number) => {
    if (typeof window === 'undefined') return
    Object.assign(window, { __sarahVoiceUnderruns: count })
  }
  const playback = createSarahVoicePlayback(playCtx, {
    destination: playDest,
    onUnderrun: publishUnderruns,
  })
  publishUnderruns(0)
  if (opts.armed?.speaker) void opts.armed.speaker.play().catch(() => undefined)
  let stopped = false
  let playing = false
  let ignoreAudio = false
  let inputMuted = false
  let appends = 0
  const captureRate = audioCtx.sampleRate || GROK_REALTIME_SAMPLE_RATE
  logSarahVoiceStage('ctx.ready', {
    captureRate,
    playRate: playCtx.sampleRate,
    sameCtx: audioCtx === playCtx,
    playDest: playDest === playCtx.destination ? 'destination' : 'media-stream',
  })

  const bargeIn = () => {
    playback.bargeIn()
    playing = false
    ignoreAudio = true
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'response.cancel' }))
    }
    opts.onStatus('listening')
    logSarahVoiceStage('barge-in')
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    playback.stop()
    try {
      ws.close()
    } catch {
      /* already closed */
    }
    processor.disconnect()
    mute.disconnect()
    source.disconnect()
    stream.getTracks().forEach((t) => t.stop())
    if (!opts.armed) {
      void audioCtx.close()
      if (playCtx !== audioCtx) void playCtx.close()
    }
    opts.onStatus('idle')
    logSarahVoiceStage('session.stop', { appends, underruns: playback.underruns() })
  }

  const setMuted = (muted: boolean) => {
    inputMuted = muted
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !muted
    })
    logSarahVoiceStage(muted ? 'mic.muted' : 'mic.live')
  }

  const timer = window.setTimeout(stop, MAX_MS)

  ws.addEventListener('open', () => {
    const instructions = `${buildSarahSystemPrompt({
      channel: 'web',
      brokerFirstName: opts.brokerFirstName,
    })}\n${WEB_VOICE_TALK_EN} ${WEB_VOICE_NOTICE_EN}`
    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          ...grokRealtimeSessionVoice(),
          instructions,
          turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true },
        },
      }),
    )
    ws.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          instructions: `Greet the visitor with exactly: "${sarahGreeting('web', opts.brokerFirstName)}"`,
        },
      }),
    )
    opts.onStatus('listening')
    logSarahVoiceStage('ws.open', { sampleRate: GROK_REALTIME_SAMPLE_RATE, vad: 'server_vad' })
  })

  processor.onaudioprocess = (ev) => {
    if (stopped || inputMuted || ws.readyState !== WebSocket.OPEN) return
    const input = ev.inputBuffer.getChannelData(0)
    const pcm = pcm16FromMicFloat(input, captureRate, GROK_REALTIME_SAMPLE_RATE)
    ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm.audio }))
    appends += 1
    if (appends <= 3 || appends % 40 === 0) {
      logSarahVoiceStage('append', {
        n: appends,
        fromRate: pcm.fromRate,
        toRate: pcm.toRate,
        samples: pcm.samples,
      })
    }
  }
  source.connect(processor)
  processor.connect(mute)
  mute.connect(audioCtx.destination)

  ws.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return
    let event: SarahVoiceServerEvent
    try {
      event = JSON.parse(ev.data) as SarahVoiceServerEvent
    } catch {
      return
    }
    if (event.type === 'error') {
      logSarahVoiceStage('ws.error', { type: event.type })
      return
    }
    if (isSarahSpeechStarted(event.type)) {
      logSarahVoiceStage('speech_started')
      bargeIn()
      return
    }
    if (isSarahSpeechStopped(event.type)) {
      opts.onStatus('thinking')
      logSarahVoiceStage('speech_stopped')
      return
    }
    if (isSarahResponseCreated(event.type)) {
      ignoreAudio = false
      opts.onStatus('thinking')
      logSarahVoiceStage('response.created')
    }
    const delta = sarahVoiceAudioDelta(event)
    if (delta) {
      if (ignoreAudio) return
      playing = true
      opts.onStatus('speaking')
      playback.pushBase64Pcm16(delta)
      logSarahVoiceStage('audio.delta', { bytes: delta.length })
    }
    if (isSarahResponseFinished(event.type) && playing) {
      playing = false
      opts.onStatus('listening')
      logSarahVoiceStage(event.type ?? 'response.done')
    }
    const line = sarahVoiceTranscript(event)
    if (line) {
      opts.onTranscript?.(line.from, line.text, { interim: line.interim })
      logSarahVoiceStage(`transcript.${line.from}`, { interim: line.interim, chars: line.text.length })
    }
  })

  ws.addEventListener('error', () => {
    logSarahVoiceStage('ws.socket-error')
    opts.onError("I couldn't start voice just now. You can keep typing.")
    window.clearTimeout(timer)
    stop()
    opts.onStatus('error')
  })
  ws.addEventListener('close', () => {
    window.clearTimeout(timer)
    if (!stopped) stop()
  })

  const speakExact = (text: string) => {
    if (stopped || ws.readyState !== WebSocket.OPEN) return
    const safe = text.replace(/"/g, "'").slice(0, 400)
    try {
      ws.send(JSON.stringify({ type: 'response.cancel' }))
    } catch {
      /* ignore */
    }
    ws.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          instructions: `Say exactly this, then stop. Property criteria only. No neighborhood character: "${safe}"`,
        },
      }),
    )
  }

  return { stop, setMuted, speakExact, underruns: () => playback.underruns() }
}
