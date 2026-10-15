/**
 * Browser Eve realtime session. Uses an ephemeral client secret in the
 * WebSocket subprotocol. No API key on the client.
 *
 * getUserMedia must run on the click (primeSarahMicrophone) before any
 * await of a server action, or Chrome drops the user-gesture and the mic
 * never opens.
 */
import {
  GROK_REALTIME_SAMPLE_RATE,
  GROK_REALTIME_VOICE,
  grokRealtimeSubprotocol,
  grokRealtimeWebSocketUrl,
} from '@/lib/grok/realtime-browser'
import { buildSarahSystemPrompt } from './persona'
import { WEB_VOICE_NOTICE_EN } from './scripts'

export type SarahVoiceStatus = 'idle' | 'asking' | 'connecting' | 'listening' | 'speaking' | 'error'

export type SarahVoiceHandle = {
  stop: () => void
}

export const SARAH_MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  video: false,
}

const MAX_MS = 5 * 60_000
const AUDIO_DELTA_TYPES = new Set([
  'response.output_audio.delta',
  'response.audio.delta',
  'response.output_audio_delta',
])
const AUDIO_DONE_TYPES = new Set(['response.done', 'response.output_audio.done', 'response.audio.done'])

export async function primeSarahMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(SARAH_MIC_CONSTRAINTS)
}

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

function pcmFromBase64(delta: string): Int16Array | null {
  try {
    const binary = atob(delta)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    if (bytes.byteLength < 2) return null
    return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2))
  } catch {
    return null
  }
}

export async function startSarahVoiceSession(opts: {
  secret: string
  brokerFirstName: string
  stream?: MediaStream
  onStatus: (status: SarahVoiceStatus) => void
  onError: (message: string) => void
  onTranscript?: (from: 'sarah' | 'visitor', text: string) => void
}): Promise<SarahVoiceHandle> {
  opts.onStatus('connecting')
  const stream = opts.stream ?? (await primeSarahMicrophone())
  const audioCtx = new AudioContext({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  const playCtx = new AudioContext({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  const source = audioCtx.createMediaStreamSource(stream)
  const processor = audioCtx.createScriptProcessor(2048, 1, 1)
  const mute = audioCtx.createGain()
  mute.gain.value = 0
  const ws = new WebSocket(grokRealtimeWebSocketUrl(), [grokRealtimeSubprotocol(opts.secret)])
  let stopped = false
  let playing = false
  let nextPlayAt = 0
  let opened = false

  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      ws.close()
    } catch {
      /* already closed */
    }
    try {
      processor.disconnect()
      mute.disconnect()
      source.disconnect()
    } catch {
      /* already disconnected */
    }
    stream.getTracks().forEach((t) => t.stop())
    void audioCtx.close()
    void playCtx.close()
    opts.onStatus('idle')
  }

  const timer = window.setTimeout(stop, MAX_MS)

  const playPcm = (pcm: Int16Array) => {
    if (stopped || pcm.length === 0) return
    playing = true
    opts.onStatus('speaking')
    const float = new Float32Array(pcm.length)
    for (let i = 0; i < pcm.length; i += 1) float[i] = (pcm[i] ?? 0) / 0x8000
    const buf = playCtx.createBuffer(1, float.length, GROK_REALTIME_SAMPLE_RATE)
    buf.copyToChannel(float, 0)
    const node = playCtx.createBufferSource()
    node.buffer = buf
    node.connect(playCtx.destination)
    const startAt = Math.max(playCtx.currentTime, nextPlayAt)
    node.start(startAt)
    nextPlayAt = startAt + buf.duration
  }

  const onOpen = () => {
    if (opened || stopped) return
    opened = true
    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          voice: GROK_REALTIME_VOICE,
          instructions: `${buildSarahSystemPrompt({
            channel: 'web',
            brokerFirstName: opts.brokerFirstName,
          })}\nOn voice, keep turns short. ${WEB_VOICE_NOTICE_EN}`,
          turn_detection: { type: 'server_vad' },
          audio: { input: { transcription: { model: 'grok-transcribe' } } },
        },
      }),
    )
    source.connect(processor)
    processor.connect(mute)
    mute.connect(audioCtx.destination)
    opts.onStatus('listening')
  }
  ws.addEventListener('open', onOpen)

  processor.onaudioprocess = (ev) => {
    if (stopped || ws.readyState !== WebSocket.OPEN) return
    const input = ev.inputBuffer.getChannelData(0)
    ws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pcm16ToBase64(floatTo16(input)),
      }),
    )
  }

  ws.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return
    let event: { type?: string; delta?: string; transcript?: string; audio?: string }
    try {
      event = JSON.parse(ev.data) as { type?: string; delta?: string; transcript?: string; audio?: string }
    } catch {
      return
    }
    const type = event.type ?? ''
    if (type === 'error') {
      opts.onError("I couldn't start voice just now. You can keep typing.")
      window.clearTimeout(timer)
      stop()
      opts.onStatus('error')
      return
    }
    const delta = event.delta ?? event.audio
    if (AUDIO_DELTA_TYPES.has(type) && delta) {
      const pcm = pcmFromBase64(delta)
      if (pcm) playPcm(pcm)
    }
    if (AUDIO_DONE_TYPES.has(type) && playing) {
      playing = false
      opts.onStatus('listening')
    }
    if (type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      opts.onTranscript?.('visitor', event.transcript)
    }
    if (
      (type === 'response.output_audio_transcript.done' || type === 'response.audio_transcript.done') &&
      event.transcript
    ) {
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

  await Promise.all([audioCtx.resume(), playCtx.resume()])
  if (ws.readyState === WebSocket.OPEN) onOpen()

  return { stop }
}
