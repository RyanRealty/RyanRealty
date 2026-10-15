/**
 * Browser-safe Eve realtime constants. No API key. The panel WebSocket
 * URL and subprotocol live here so lib/sarah never names api.x.ai.
 */
import { SARAH_VOICE_ID } from '@/lib/sarah/persona'

const XAI_HTTP = 'https://api.x.ai/v1'

export const GROK_REALTIME_MODEL = 'grok-voice-latest'
export const GROK_REALTIME_VOICE = SARAH_VOICE_ID
export const GROK_REALTIME_SAMPLE_RATE = 24_000

export function grokRealtimeWebSocketUrl(): string {
  const http = XAI_HTTP.replace(/\/$/, '')
  const ws = http.startsWith('https://') ? `wss://${http.slice('https://'.length)}` : http
  return `${ws}/realtime?model=${encodeURIComponent(GROK_REALTIME_MODEL)}`
}

export function grokRealtimeSubprotocol(secret: string): string {
  return `xai-client-secret.${secret}`
}
