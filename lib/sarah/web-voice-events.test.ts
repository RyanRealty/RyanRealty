import { describe, expect, it } from 'vitest'
import {
  isSarahResponseCreated,
  isSarahResponseFinished,
  isSarahSpeechStarted,
  isSarahSpeechStopped,
  sarahVoiceAudioDelta,
  sarahVoiceTranscript,
} from './web-voice-events'

describe('Sarah voice server events', () => {
  it('reads both audio delta names', () => {
    expect(sarahVoiceAudioDelta({ type: 'response.output_audio.delta', delta: 'aaa' })).toBe('aaa')
    expect(sarahVoiceAudioDelta({ type: 'response.audio.delta', delta: 'bbb' })).toBe('bbb')
    expect(sarahVoiceAudioDelta({ type: 'response.created', delta: 'ccc' })).toBeNull()
  })

  it('maps visitor and Sarah transcripts, including live updates', () => {
    expect(
      sarahVoiceTranscript({
        type: 'conversation.item.input_audio_transcription.updated',
        transcript: 'hello',
      }),
    ).toEqual({ from: 'visitor', text: 'hello', interim: true })
    expect(
      sarahVoiceTranscript({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'hello there',
      }),
    ).toEqual({ from: 'visitor', text: 'hello there', interim: false })
    expect(
      sarahVoiceTranscript({
        type: 'response.output_audio_transcript.done',
        transcript: 'Hi, I am Sarah',
      }),
    ).toEqual({ from: 'sarah', text: 'Hi, I am Sarah', interim: false })
  })

  it('flags VAD and response turns', () => {
    expect(isSarahSpeechStarted('input_audio_buffer.speech_started')).toBe(true)
    expect(isSarahSpeechStopped('input_audio_buffer.speech_stopped')).toBe(true)
    expect(isSarahResponseCreated('response.created')).toBe(true)
    expect(isSarahResponseFinished('response.done')).toBe(true)
    expect(isSarahResponseFinished('response.cancelled')).toBe(true)
  })
})
