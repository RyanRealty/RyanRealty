/**
 * Browser Eve realtime session. Uses an ephemeral client secret in the
 * WebSocket subprotocol. No API key on the client.
 */
import {
  GROK_REALTIME_SAMPLE_RATE,
  grokRealtimeSessionVoice,
  grokRealtimeSubprotocol,
  grokRealtimeWebSocketUrl,
} from '@/lib/grok/realtime-browser'
import { buildSarahSystemPrompt, sarahGreeting } from './persona'
import { WEB_VOICE_NOTICE_EN, WEB_VOICE_TALK_EN } from './scripts'
import { createSarahVoicePlayback } from './voice-playback'
import { SARAH_MIC_CONSTRAINTS, type SarahArmedMic } from './web-voice-arm'

export type SarahVoiceStatus = 'idle' | 'asking' | 'connecting' | 'listening' | 'speaking' | 'error'

export type SarahVoiceHandle = {
  stop: () => void
  underruns: () => number
}

const MAX_MS = 5 * 60_000

function pcm16ToBase64(buffer: Int16Array): string {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export async function startSarahVoiceSession(opts: {
  secret: string
  brokerFirstName: string
  armed?: SarahArmedMic
  onStatus: (status: SarahVoiceStatus) => void
  onError: (message: string) => void
  onTranscript?: (from: 'sarah' | 'visitor', text: string) => void
}): Promise<SarahVoiceHandle> {
  opts.onStatus('connecting')
  const stream = opts.armed
    ? await opts.armed.streamPromise
    : await navigator.mediaDevices.getUserMedia(SARAH_MIC_CONSTRAINTS)
  const ws = new WebSocket(grokRealtimeWebSocketUrl(), [grokRealtimeSubprotocol(opts.secret)])
  const audioCtx = opts.armed?.captureCtx ?? new AudioContext({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  const source = audioCtx.createMediaStreamSource(stream)
  const processor = audioCtx.createScriptProcessor(2048, 1, 1)
  const mute = audioCtx.createGain()
  mute.gain.value = 0
  const playCtx = opts.armed?.playCtx ?? new AudioContext({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  if (playCtx.state === 'suspended') void playCtx.resume()
  const publishUnderruns = (count: number) => {
    if (typeof window === 'undefined') return
    Object.assign(window, { __sarahVoiceUnderruns: count })
  }
  const playback = createSarahVoicePlayback(playCtx, {
    onUnderrun: publishUnderruns,
  })
  publishUnderruns(0)
  let stopped = false
  let playing = false
  let ignoreAudio = false

  const bargeIn = () => {
    playback.bargeIn()
    playing = false
    ignoreAudio = true
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'response.cancel' }))
    }
    opts.onStatus('listening')
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
    void audioCtx.close()
    void playCtx.close()
    opts.onStatus('idle')
  }

  const timer = window.setTimeout(stop, MAX_MS)

  ws.addEventListener('open', () => {
    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          ...grokRealtimeSessionVoice(),
          instructions: `${buildSarahSystemPrompt({
            channel: 'web',
            brokerFirstName: opts.brokerFirstName,
          })}\n${WEB_VOICE_TALK_EN} ${WEB_VOICE_NOTICE_EN}`,
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
  })

  processor.onaudioprocess = (ev) => {
    if (stopped || ws.readyState !== WebSocket.OPEN) return
    const input = ev.inputBuffer.getChannelData(0)
    const pcm = floatTo16(input)
    ws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pcm16ToBase64(pcm),
      }),
    )
  }
  source.connect(processor)
  processor.connect(mute)
  mute.connect(audioCtx.destination)

  ws.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return
    let event: { type?: string; delta?: string; transcript?: string }
    try {
      event = JSON.parse(ev.data) as { type?: string; delta?: string; transcript?: string }
    } catch {
      return
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      bargeIn()
      return
    }
    if (event.type === 'response.created') {
      ignoreAudio = false
    }
    if (event.type === 'response.output_audio.delta' && event.delta) {
      if (ignoreAudio) return
      playing = true
      opts.onStatus('speaking')
      playback.pushBase64Pcm16(event.delta)
    }
    if ((event.type === 'response.done' || event.type === 'response.cancelled') && playing) {
      playing = false
      opts.onStatus('listening')
    }
    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      opts.onTranscript?.('visitor', event.transcript)
    }
    if (event.type === 'response.output_audio_transcript.done' && event.transcript) {
      opts.onTranscript?.('sarah', event.transcript)
    }
  })

  ws.addEventListener('error', () => {
    opts.onError("I couldn't start voice just now. You can keep typing.")
    window.clearTimeout(timer)
    stop()
    opts.onStatus('error')
  })
  ws.addEventListener('close', () => {
    window.clearTimeout(timer)
    if (!stopped) stop()
  })

  return { stop, underruns: () => playback.underruns() }
}
