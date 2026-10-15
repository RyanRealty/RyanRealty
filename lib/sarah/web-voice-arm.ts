/**
 * iOS Safari/Chrome only show the mic prompt if getUserMedia and AudioContext
 * start in the same tap, before any await or fetch. Playback also has to
 * unlock the iOS audio session in that tap or the silent switch mutes Eve.
 */
import { GROK_REALTIME_SAMPLE_RATE } from '@/lib/grok/realtime-browser'
import { logSarahVoiceStage } from './voice-debug'

export const WEB_VOICE_PERMISSION_EN = 'I need microphone permission to talk. You can keep typing.'
export const WEB_VOICE_START_FAIL_EN = "I couldn't start voice just now. You can keep typing."
export const SARAH_MIC_PERMISSIONS_POLICY = 'microphone=(self)'

/** Tiny silent WAV so iOS treats this as an audio session, not Web Audio only. */
export const SARAH_VOICE_UNLOCK_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

export const SARAH_MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
}

export type SarahArmedMic = {
  streamPromise: Promise<MediaStream>
  captureCtx: AudioContext
  playCtx: AudioContext
  speaker: HTMLAudioElement
  playDest: AudioNode
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

function unlockSarahSpeaker(ctx: AudioContext): { speaker: HTMLAudioElement; playDest: AudioNode } {
  const dest =
    typeof ctx.createMediaStreamDestination === 'function' ? ctx.createMediaStreamDestination() : null
  const speaker = document.createElement('audio')
  speaker.setAttribute('playsinline', 'true')
  speaker.setAttribute('webkit-playsinline', 'true')
  speaker.autoplay = true
  speaker.preload = 'auto'
  if (dest) speaker.srcObject = dest.stream
  else speaker.src = SARAH_VOICE_UNLOCK_WAV
  void Promise.resolve(speaker.play()).catch(() => undefined)
  const ping = document.createElement('audio')
  ping.setAttribute('playsinline', 'true')
  ping.src = SARAH_VOICE_UNLOCK_WAV
  void Promise.resolve(ping.play()).catch(() => undefined)
  return { speaker, playDest: dest ?? ctx.destination }
}

export function armSarahMicOnTap(): SarahArmedMic {
  const streamPromise = navigator.mediaDevices.getUserMedia(SARAH_MIC_CONSTRAINTS)
  const ctx = realtimeAudioContext()
  const { speaker, playDest } = unlockSarahSpeaker(ctx)
  logSarahVoiceStage('tap.arm', { captureRate: ctx.sampleRate, state: ctx.state })
  return { streamPromise, captureCtx: ctx, playCtx: ctx, speaker, playDest }
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
  try {
    armed.speaker.pause()
    armed.speaker.srcObject = null
    armed.speaker.remove()
  } catch {
    /* already released */
  }
  void armed.captureCtx.close()
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
  logSarahVoiceStage('error', { name: err instanceof Error ? err.name : 'Error' })
}

export function takeVoiceErrorSlot(state: { posted: boolean }): boolean {
  if (state.posted) return false
  state.posted = true
  return true
}

export function beginSarahVoiceFromMicTap():
  | { ok: true; armed: SarahArmedMic }
  | { ok: false; message: string } {
  try {
    return { ok: true, armed: armSarahMicOnTap() }
  } catch (err) {
    logSarahVoiceError(err)
    return { ok: false, message: sarahVoiceErrorMessage(err) }
  }
}
