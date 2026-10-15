/**
 * Browser Eve realtime voice. Mints a short-lived xAI client secret so the
 * panel can open a WebSocket without seeing XAI_API_KEY. SIP stays in
 * voice-sip.ts and is not used here.
 */
import { xaiFetch } from './client'
import {
  GROK_REALTIME_MODEL,
  GROK_REALTIME_VOICE,
} from './realtime-browser'

export {
  GROK_REALTIME_MODEL,
  GROK_REALTIME_SAMPLE_RATE,
  GROK_REALTIME_VOICE,
  grokRealtimeSessionVoice,
  grokRealtimeSubprotocol,
  grokRealtimeWebSocketUrl,
  isGrokEveVoice,
} from './realtime-browser'

export const GROK_CLIENT_SECRET_MAX_SECONDS = 300

export type GrokRealtimeClientSecret = {
  value: string
  expiresAt: string | null
  model: typeof GROK_REALTIME_MODEL
  voice: typeof GROK_REALTIME_VOICE
}

function readSecretValue(body: unknown): { value: string; expiresAt: string | null } | null {
  if (!body || typeof body !== 'object') return null
  const row = body as Record<string, unknown>
  const nested = row.client_secret
  const fromNested =
    nested && typeof nested === 'object' ? (nested as Record<string, unknown>).value : null
  const value =
    (typeof row.value === 'string' && row.value) ||
    (typeof fromNested === 'string' && fromNested) ||
    (typeof row.client_secret === 'string' && row.client_secret) ||
    ''
  if (!value.trim()) return null
  const expires =
    (typeof row.expires_at === 'string' && row.expires_at) ||
    (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>).expires_at === 'string'
      ? ((nested as Record<string, unknown>).expires_at as string)
      : null)
  return { value: value.trim(), expiresAt: expires }
}

/** Server-only. The returned secret is safe to hand to the browser for one session. */
export async function mintGrokRealtimeClientSecret(
  expiresSeconds = GROK_CLIENT_SECRET_MAX_SECONDS,
): Promise<GrokRealtimeClientSecret> {
  const seconds = Math.min(Math.max(30, Math.floor(expiresSeconds)), GROK_CLIENT_SECRET_MAX_SECONDS)
  const res = await xaiFetch('/realtime/client_secrets', {
    method: 'POST',
    body: JSON.stringify({ expires_after: { seconds } }),
  })
  const body = (await res.json()) as unknown
  const secret = readSecretValue(body)
  if (!secret) {
    throw new Error('xAI realtime client secret missing')
  }
  return {
    value: secret.value,
    expiresAt: secret.expiresAt,
    model: GROK_REALTIME_MODEL,
    voice: GROK_REALTIME_VOICE,
  }
}
