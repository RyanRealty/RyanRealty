/**
 * Browser-safe Eve realtime constants. No API key. The panel WebSocket
 * URL and subprotocol live here so lib/sarah never names api.x.ai.
 */
import { SARAH_VOICE_ID } from '@/lib/sarah/persona'

const XAI_HTTP = 'https://api.x.ai/v1'

export const GROK_REALTIME_MODEL = 'grok-voice-latest'
export const GROK_REALTIME_VOICE = SARAH_VOICE_ID
export const GROK_REALTIME_SAMPLE_RATE = 24_000
export const GROK_REALTIME_PCM = {
  type: 'audio/pcm',
  rate: GROK_REALTIME_SAMPLE_RATE,
} as const
export const GROK_REALTIME_TRANSCRIBE = 'grok-transcribe'

/** xAI session.created default is Ara (`xai_ara`) unless voice is on the URL. */
export function grokRealtimeWebSocketUrl(): string {
  const http = XAI_HTTP.replace(/\/$/, '')
  const ws = http.startsWith('https://') ? `wss://${http.slice('https://'.length)}` : http
  return `${ws}/realtime?model=${encodeURIComponent(GROK_REALTIME_MODEL)}&voice=${encodeURIComponent(GROK_REALTIME_VOICE)}`
}

/**
 * Voice config xAI actually applies. Top-level `session.voice` is ignored on
 * session.update; `audio.output.voice` is echoed as `eve`. The URL query is
 * what session.created reports (`human_eve`). Docs and the phone line still
 * send the lowercase TTS id `eve`.
 */
export function grokRealtimeSessionVoice(): {
  voice: typeof GROK_REALTIME_VOICE
  audio: {
    input: {
      format: typeof GROK_REALTIME_PCM
      transcription: { model: typeof GROK_REALTIME_TRANSCRIBE }
    }
    output: {
      voice: typeof GROK_REALTIME_VOICE
      format: typeof GROK_REALTIME_PCM
    }
  }
} {
  return {
    voice: GROK_REALTIME_VOICE,
    audio: {
      input: {
        format: GROK_REALTIME_PCM,
        transcription: { model: GROK_REALTIME_TRANSCRIBE },
      },
      output: {
        voice: GROK_REALTIME_VOICE,
        format: GROK_REALTIME_PCM,
      },
    },
  }
}

export function isGrokEveVoice(id: string | null | undefined): boolean {
  const v = String(id || '').toLowerCase()
  return v === 'eve' || v === 'human_eve' || v === 'xai_eve'
}

export function grokRealtimeSubprotocol(secret: string): string {
  return `xai-client-secret.${secret}`
}
