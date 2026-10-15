import { describe, expect, it } from 'vitest'
import { grokRealtimeSubprotocol, grokRealtimeWebSocketUrl, GROK_REALTIME_VOICE } from './realtime-browser'

describe('Grok browser realtime helpers', () => {
  it('builds the Eve websocket URL from the grok client base', () => {
    expect(GROK_REALTIME_VOICE).toBe('eve')
    expect(grokRealtimeWebSocketUrl()).toMatch(/^wss:\/\/api\.x\.ai\/v1\/realtime\?model=grok-voice-latest$/)
    expect(grokRealtimeSubprotocol('tok_1')).toBe('xai-client-secret.tok_1')
  })
})
