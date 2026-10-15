/**
 * xAI realtime server events for the web voice loop.
 */
export type SarahVoiceServerEvent = {
  type?: string
  delta?: string
  transcript?: string
  error?: unknown
}

export type SarahVoiceTranscript = {
  from: 'sarah' | 'visitor'
  text: string
  interim: boolean
}

export function sarahVoiceAudioDelta(event: SarahVoiceServerEvent): string | null {
  if (!event.delta) return null
  if (event.type === 'response.output_audio.delta' || event.type === 'response.audio.delta') {
    return event.delta
  }
  return null
}

export function sarahVoiceTranscript(event: SarahVoiceServerEvent): SarahVoiceTranscript | null {
  const type = event.type ?? ''
  const text = typeof event.transcript === 'string' ? event.transcript.trim() : ''
  if (!text) return null
  if (/input_audio_transcription\.(completed|updated)$/.test(type)) {
    return { from: 'visitor', text, interim: type.endsWith('.updated') }
  }
  if (/output_audio_transcript\.(delta|done)$|audio_transcript\.(delta|done)$/.test(type)) {
    return { from: 'sarah', text, interim: type.endsWith('.delta') }
  }
  return null
}

export function isSarahSpeechStarted(type: string | undefined): boolean {
  return type === 'input_audio_buffer.speech_started'
}

export function isSarahSpeechStopped(type: string | undefined): boolean {
  return type === 'input_audio_buffer.speech_stopped'
}

export function isSarahResponseCreated(type: string | undefined): boolean {
  return type === 'response.created'
}

export function isSarahResponseFinished(type: string | undefined): boolean {
  return type === 'response.done' || type === 'response.cancelled'
}
