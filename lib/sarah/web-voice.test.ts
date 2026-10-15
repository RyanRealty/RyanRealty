/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeWS {
  static OPEN = 1
  static last: FakeWS | null = null
  readyState = 0
  sent: string[] = []
  listeners = new Map<string, Array<(ev?: { data?: string }) => void>>()
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeWS.last = this
    queueMicrotask(() => {
      this.readyState = FakeWS.OPEN
      this.emit('open')
    })
  }
  addEventListener(type: string, fn: (ev?: { data?: string }) => void) {
    const list = this.listeners.get(type) ?? []
    list.push(fn)
    this.listeners.set(type, list)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 3
    this.emit('close')
  }
  emit(type: string, ev?: { data?: string }) {
    for (const fn of this.listeners.get(type) ?? []) fn(ev)
  }
}

class FakeBufferSource {
  buffer: { duration: number } | null = null
  started = false
  connect() {}
  start() {
    this.started = true
  }
}

class FakeAudioContext {
  currentTime = 0
  sampleRate: number
  processor: { onaudioprocess: ((ev: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null } | null =
    null
  constructor({ sampleRate }: { sampleRate: number }) {
    this.sampleRate = sampleRate
  }
  resume() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} }
  }
  createGain() {
    return { gain: { value: 0 }, connect() {}, disconnect() {} }
  }
  createScriptProcessor() {
    this.processor = { onaudioprocess: null }
    return {
      get onaudioprocess() {
        return this._on ?? null
      },
      set onaudioprocess(fn) {
        this._on = fn
      },
      _on: null as ((ev: { inputBuffer: { getChannelData: () => Float32Array } }) => void) | null,
      connect() {},
      disconnect() {},
    }
  }
  createBuffer(_ch: number, length: number, _rate: number) {
    return { duration: length / this.sampleRate, copyToChannel() {} }
  }
  createBufferSource() {
    return new FakeBufferSource()
  }
  get destination() {
    return {}
  }
}

const getUserMedia = vi.fn(async () => ({
  getTracks: () => [{ stop: vi.fn() }],
}))

describe('Sarah Eve browser voice', () => {
  beforeEach(() => {
    FakeWS.last = null
    vi.stubGlobal('WebSocket', FakeWS)
    vi.stubGlobal('AudioContext', FakeAudioContext)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    getUserMedia.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for the mic, opens Eve, sends audio both ways', async () => {
    const { primeSarahMicrophone, startSarahVoiceSession } = await import('./web-voice')
    const stream = await primeSarahMicrophone()
    expect(getUserMedia).toHaveBeenCalled()
    const statuses: string[] = []
    const handle = await startSarahVoiceSession({
      secret: 'tok_1',
      brokerFirstName: 'Matt',
      stream: stream as unknown as MediaStream,
      onStatus: (s) => statuses.push(s),
      onError: () => {},
    })
    await Promise.resolve()
    await Promise.resolve()
    const ws = FakeWS.last
    expect(ws).not.toBeNull()
    expect(ws?.url).toContain('wss://api.x.ai/v1/realtime')
    expect(ws?.protocols).toEqual(['xai-client-secret.tok_1'])
    expect(ws?.sent[0]).toMatch(/session\.update/)
    expect(ws?.sent[0]).toMatch(/"voice":"eve"/)
    expect(statuses).toContain('connecting')
    expect(statuses).toContain('listening')

    const pcm = new Int16Array([0, 1000, -1000])
    const bytes = new Uint8Array(pcm.buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0)
    ws?.emit('message', {
      data: JSON.stringify({ type: 'response.output_audio.delta', delta: btoa(binary) }),
    })
    expect(statuses).toContain('speaking')
    handle.stop()
  })
})
