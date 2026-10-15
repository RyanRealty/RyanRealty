/**
 * lib/studio/voice/engine.ts: the Studio's ENFORCED default voice.
 *
 * Matt, 2026-10-14 (relayed by Chief of Staff, who speaks for him): Grok voice for all videos,
 * voice Eve (the receptionist's voice). ElevenLabs is opt-in only, by writing
 * `engine: 'elevenlabs'` on the timeline voice. lib/studio/voice/engine.test.ts (unit project,
 * runs in CI) fails if either default changes.
 */
import { GROK_TTS_DEFAULT_VOICE } from '../../grok/tts'
import type { VoiceEngine } from './types'

export const DEFAULT_VOICE_ENGINE: VoiceEngine = 'grok'
export const DEFAULT_GROK_VOICE = GROK_TTS_DEFAULT_VOICE

/** The engine a timeline voice uses: Grok unless ElevenLabs is written out. */
export function resolveVoiceEngine(engine: VoiceEngine | undefined): VoiceEngine {
  return engine === 'elevenlabs' ? 'elevenlabs' : DEFAULT_VOICE_ENGINE
}
