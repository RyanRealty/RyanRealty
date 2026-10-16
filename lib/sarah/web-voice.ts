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
import { WEB_VOICE_NOTICE_EN } from './scripts'

export type SarahVoiceStatus = 'idle' | 'asking' | 'connecting' | 'listening' | 'speaking' | 'error'

export type SarahVoiceHandle = {
  stop: () => void
  speakExact: (text: string) => void
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
  onStatus: (status: SarahVoiceStatus) => void
  onError: (message: string) => void
  onTranscript?: (from: 'sarah' | 'visitor', text: string) => void
}): Promise<SarahVoiceHandle> {
  opts.onStatus('connecting')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  })
  const ws = new WebSocket(grokRealtimeWebSocketUrl(), [grokRealtimeSubprotocol(opts.secret)])
  const audioCtx = new AudioContext({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  const source = audioCtx.createMediaStreamSource(stream)
  const processor = audioCtx.createScriptProcessor(2048, 1, 1)
  const mute = audioCtx.createGain()
  mute.gain.value = 0
  const playCtx = new AudioContext({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  let stopped = false
  let playing = false

  const stop = () => {
    if (stopped) return
    stopped = true
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
          })}\nOn voice, keep turns short. ${WEB_VOICE_NOTICE_EN}`,
          turn_detection: { type: 'server_vad' },
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
    if (event.type === 'response.output_audio.delta' && event.delta) {
      playing = true
      opts.onStatus('speaking')
      const binary = atob(event.delta)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      const pcm = new Int16Array(bytes.buffer)
      const float = new Float32Array(pcm.length)
      for (let i = 0; i < pcm.length; i += 1) float[i] = (pcm[i] ?? 0) / 0x8000
      const buf = playCtx.createBuffer(1, float.length, GROK_REALTIME_SAMPLE_RATE)
      buf.copyToChannel(float, 0)
      const node = playCtx.createBufferSource()
      node.buffer = buf
      node.connect(playCtx.destination)
      node.start()
    }
    if (event.type === 'response.done' && playing) {
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

  return { stop, speakExact }
}
