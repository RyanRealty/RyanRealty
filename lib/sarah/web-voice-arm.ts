/**
 * iOS Safari/Chrome only show the mic prompt if getUserMedia and AudioContext
 * start in the same tap, before any await or fetch.
 */
import { GROK_REALTIME_SAMPLE_RATE } from '@/lib/grok/realtime-browser'

export const WEB_VOICE_PERMISSION_EN = 'I need microphone permission to talk. You can keep typing.'
export const WEB_VOICE_START_FAIL_EN = "I couldn't start voice just now. You can keep typing."
export const SARAH_MIC_PERMISSIONS_POLICY = 'microphone=(self)'

export const SARAH_MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
}

export type SarahArmedMic = {
  streamPromise: Promise<MediaStream>
  captureCtx: AudioContext
  playCtx: AudioContext
}

function realtimeAudioContext(): AudioContext {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error('AudioContext unavailable')
  const ctx = new Ctor({ sampleRate: GROK_REALTIME_SAMPLE_RATE })
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function armSarahMicOnTap(): SarahArmedMic {
  const streamPromise = navigator.mediaDevices.getUserMedia(SARAH_MIC_CONSTRAINTS)
  return { streamPromise, captureCtx: realtimeAudioContext(), playCtx: realtimeAudioContext() }
}

export async function continueSarahVoiceAfterArm<T>(
  armed: SarahArmedMic,
  mintToken: () => Promise<T>,
): Promise<{ armed: SarahArmedMic; token: T }> {
  const token = await mintToken()
  return { armed, token }
}

export function releaseSarahArmedMic(armed: SarahArmedMic): void {
  void armed.streamPromise
    .then((stream) => stream.getTracks().forEach((t) => t.stop()))
    .catch(() => undefined)
  void armed.captureCtx.close()
  void armed.playCtx.close()
}

export function isNotAllowedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  return (err as { name?: string }).name === 'NotAllowedError'
}

export function sarahVoiceErrorMessage(err: unknown): string {
  return isNotAllowedError(err) ? WEB_VOICE_PERMISSION_EN : WEB_VOICE_START_FAIL_EN
}

export function logSarahVoiceError(err: unknown): void {
  if (isNotAllowedError(err)) return
  console.error('[sarahVoice]', err)
}

export function takeVoiceErrorSlot(state: { posted: boolean }): boolean {
  if (state.posted) return false
  state.posted = true
  return true
}
