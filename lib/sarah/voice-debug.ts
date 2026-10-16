/**
 * Voice-loop stage log. Console plus a server debug route so an iPhone
 * session can be read after the fact. Never logs audio bytes or tokens.
 */
export const SARAH_VOICE_DEBUG_PATH = '/api/sarah/voice-debug'
export const SARAH_VOICE_DEBUG_WINDOW = '__sarahVoiceDebug'

export type SarahVoiceStage = {
  t: number
  stage: string
  detail?: Record<string, unknown>
}

const RING_MAX = 80

function sanitizeDetail(detail?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!detail) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(detail)) {
    if (/secret|token|audio|key|authorization/i.test(key)) continue
    if (typeof value === 'string') out[key] = value.slice(0, 240)
    else if (typeof value === 'number' || typeof value === 'boolean' || value == null) out[key] = value
    else out[key] = String(value).slice(0, 120)
  }
  return out
}

function ring(): SarahVoiceStage[] {
  if (typeof window === 'undefined') return []
  const bag = window as unknown as Record<string, SarahVoiceStage[]>
  if (!Array.isArray(bag[SARAH_VOICE_DEBUG_WINDOW])) bag[SARAH_VOICE_DEBUG_WINDOW] = []
  return bag[SARAH_VOICE_DEBUG_WINDOW]
}

export function readSarahVoiceDebug(): SarahVoiceStage[] {
  return ring().slice()
}

export function logSarahVoiceStage(stage: string, detail?: Record<string, unknown>): SarahVoiceStage {
  const row: SarahVoiceStage = { t: Date.now(), stage, detail: sanitizeDetail(detail) }
  if (typeof console !== 'undefined') console.info('[sarahVoice]', row)
  if (typeof window !== 'undefined') {
    const list = ring()
    list.push(row)
    if (list.length > RING_MAX) list.splice(0, list.length - RING_MAX)
    const body = JSON.stringify(row)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(SARAH_VOICE_DEBUG_PATH, body)
      } else {
        void fetch(SARAH_VOICE_DEBUG_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => undefined)
      }
    } catch {
      /* debug only */
    }
  }
  return row
}
