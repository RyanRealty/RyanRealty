/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startSarahVoiceSession } from './web-voice'

class FakeSocket {
  static last: FakeSocket | null = null
  static OPEN = 1
  static CLOSED = 3
  readyState = 1
  listeners: Record<string, Array<(ev?: unknown) => void>> = {
    open: [],
    message: [],
    error: [],
    close: [],
  }
  sent: unknown[] = []
  constructor() {
    FakeSocket.last = this
    queueMicrotask(() => this.listeners.open.forEach((fn) => fn()))
  }
  addEventListener(type: string, fn: (ev?: unknown) => void) {
    this.listeners[type].push(fn)
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw))
  }
  emit(event: unknown) {
    this.listeners.message.forEach((fn) => fn({ data: JSON.stringify(event) }))
  }
  close() {
    this.readyState = 3
  }
}

class FakeCtx {
  sampleRate = 48_000
  state: AudioContextState = 'running'
  currentTime = 0
  destination = {} as AudioNode
  processor: {
    onaudioprocess: ((ev: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null
    connect: () => void
    disconnect: () => void
  } = {
    onaudioprocess: null,
    connect() {},
    disconnect() {},
  }
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} }
  }
  createScriptProcessor() {
    return this.processor
  }
  createGain() {
    return { gain: { value: 0 }, connect() {}, disconnect() {} }
  }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return {
      length,
      duration: length / sampleRate,
      sampleRate,
      copyToChannel() {},
    } as unknown as AudioBuffer
  }
  createBufferSource() {
    return {
      buffer: null,
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    } as unknown as AudioBufferSourceNode
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Sarah voice loop', () => {
  it('resamples 48 kHz mic, greets, then plays the reply and both transcripts', async () => {
    const ctx = new FakeCtx()
    const speaker = {
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      remove: vi.fn(),
      srcObject: null,
    } as unknown as HTMLAudioElement
    vi.stubGlobal('WebSocket', FakeSocket)
    vi.stubGlobal('AudioContext', FakeCtx)
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn(() => true),
      mediaDevices: { getUserMedia: vi.fn() },
    })
    const statuses: string[] = []
    const lines: Array<{ from: string; text: string }> = []
    const handle = await startSarahVoiceSession({
      secret: 'tok',
      brokerFirstName: 'Matt',
      armed: {
        streamPromise: Promise.resolve({ getTracks: () => [{ stop() {} }] } as unknown as MediaStream),
        captureCtx: ctx as unknown as AudioContext,
        playCtx: ctx as unknown as AudioContext,
        speaker,
        playDest: ctx.destination,
      },
      onStatus: (status) => statuses.push(status),
      onError: () => undefined,
      onTranscript: (from, text) => lines.push({ from, text }),
    })
    await Promise.resolve()
    await Promise.resolve()
    const ws = FakeSocket.last
    expect(ws).toBeTruthy()
    expect(ws?.sent.some((row) => (row as { type?: string }).type === 'session.update')).toBe(true)
    expect(ws?.sent.some((row) => (row as { type?: string }).type === 'response.create')).toBe(true)
    ctx.processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(4800).fill(0.2) },
    })
    const append = ws?.sent.find((row) => (row as { type?: string }).type === 'input_audio_buffer.append') as
      | { audio?: string }
      | undefined
    expect(append?.audio?.length).toBeGreaterThan(20)

    ws?.emit({ type: 'response.created' })
    ws?.emit({ type: 'response.output_audio.delta', delta: append?.audio })
    ws?.emit({
      type: 'response.output_audio_transcript.done',
      transcript: "Hi, I'm Sarah, an AI assistant with Matt's team at Ryan Realty.",
    })
    ws?.emit({ type: 'response.done' })
    ws?.emit({ type: 'input_audio_buffer.speech_started' })
    ws?.emit({ type: 'input_audio_buffer.speech_stopped' })
    ws?.emit({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'What homes are in Bend?',
    })
    ws?.emit({ type: 'response.created' })
    ws?.emit({ type: 'response.output_audio.delta', delta: append?.audio })
    ws?.emit({ type: 'response.output_audio_transcript.done', transcript: 'I can help with that.' })
    ws?.emit({ type: 'response.done' })

    expect(statuses).toContain('listening')
    expect(statuses).toContain('thinking')
    expect(statuses).toContain('speaking')
    expect(lines).toEqual([
      { from: 'sarah', text: "Hi, I'm Sarah, an AI assistant with Matt's team at Ryan Realty." },
      { from: 'visitor', text: 'What homes are in Bend?' },
      { from: 'sarah', text: 'I can help with that.' },
    ])
    expect(handle.underruns()).toBe(0)
    handle.stop()
  })
})
