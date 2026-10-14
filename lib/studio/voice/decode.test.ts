import { describe, expect, it, vi } from 'vitest'
import { encodeWav } from '../score'
import { decodeVoiceAudio, f32leStereoToAudio, parseWav, pcm16MonoToStereo } from './decode'

function pcm16(samples: number[]): Buffer {
  const out = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => out.writeInt16LE(s, i * 2))
  return out
}

describe('pcm16MonoToStereo', () => {
  it('reads signed 16-bit little-endian and centres the voice', () => {
    const { left, right } = pcm16MonoToStereo(pcm16([0, 16384, -16384, 32767, -32768]))
    expect(Array.from(left)).toEqual([0, 0.5, -0.5, 32767 / 32768, -1])
    expect(Array.from(right)).toEqual(Array.from(left))
    expect(right).not.toBe(left)
  })

  it('ignores a trailing odd byte', () => {
    expect(pcm16MonoToStereo(Buffer.from([0, 64, 9])).left).toHaveLength(1)
  })
})

describe('parseWav', () => {
  it('round-trips the score package WAV (16-bit stereo, 48 kHz)', () => {
    const left = Float32Array.from([0, 0.25, -0.25, 0.5])
    const right = Float32Array.from([0, -0.5, 0.125, 0.75])
    const parsed = parseWav(encodeWav(left, right, 'x'))!
    expect(parsed.sampleRate).toBe(48000)
    expect(parsed.channels).toBe(2)
    expect(parsed.left).toHaveLength(4)
    for (let i = 1; i < 4; i++) {
      expect(parsed.left[i]).toBeCloseTo(left[i], 3)
      expect(parsed.right[i]).toBeCloseTo(right[i], 3)
    }
  })

  function wavHeader(opts: { tag: number; channels: number; rate: number; bits: number; dataBytes: number; declared?: number }): Buffer {
    const h = Buffer.alloc(44)
    h.write('RIFF', 0, 'ascii')
    h.writeUInt32LE(36 + opts.dataBytes, 4)
    h.write('WAVE', 8, 'ascii')
    h.write('fmt ', 12, 'ascii')
    h.writeUInt32LE(16, 16)
    h.writeUInt16LE(opts.tag, 20)
    h.writeUInt16LE(opts.channels, 22)
    h.writeUInt32LE(opts.rate, 24)
    h.writeUInt32LE((opts.rate * opts.channels * opts.bits) / 8, 28)
    h.writeUInt16LE((opts.channels * opts.bits) / 8, 32)
    h.writeUInt16LE(opts.bits, 34)
    h.write('data', 36, 'ascii')
    h.writeUInt32LE(opts.declared ?? opts.dataBytes, 40)
    return h
  }

  it('reads mono 16-bit as dual mono', () => {
    const wav = Buffer.concat([wavHeader({ tag: 1, channels: 1, rate: 48000, bits: 16, dataBytes: 6 }), pcm16([100, -100, 200])])
    const parsed = parseWav(wav)!
    expect(parsed.channels).toBe(1)
    expect(Array.from(parsed.right)).toEqual(Array.from(parsed.left))
    expect(parsed.left[0]).toBeCloseTo(100 / 32768, 9)
  })

  it('reads 32-bit float', () => {
    const data = Buffer.alloc(8)
    data.writeFloatLE(0.5, 0)
    data.writeFloatLE(-0.25, 4)
    const parsed = parseWav(Buffer.concat([wavHeader({ tag: 3, channels: 1, rate: 48000, bits: 32, dataBytes: 8 }), data]))!
    expect(Array.from(parsed.left)).toEqual([0.5, -0.25])
  })

  it('reads a streamed header whose data size runs past the end of the file', () => {
    const wav = Buffer.concat([wavHeader({ tag: 1, channels: 1, rate: 48000, bits: 16, dataBytes: 4, declared: 0xffffffff }), pcm16([1, 2])])
    expect(parseWav(wav)!.left).toHaveLength(2)
  })

  it('returns null for what it cannot read', () => {
    expect(parseWav(Buffer.from('not a wav at all, just some text that is long enough to try'))).toBeNull()
    expect(parseWav(Buffer.concat([wavHeader({ tag: 1, channels: 1, rate: 48000, bits: 24, dataBytes: 3 }), Buffer.alloc(3)]))).toBeNull()
    expect(parseWav(Buffer.concat([wavHeader({ tag: 1, channels: 6, rate: 48000, bits: 16, dataBytes: 12 }), Buffer.alloc(12)]))).toBeNull()
    expect(parseWav(Buffer.alloc(10))).toBeNull()
  })
})

describe('decodeVoiceAudio', () => {
  it('decodes pcm_48000 itself, with no ffmpeg', async () => {
    const audio = await decodeVoiceAudio(pcm16([0, 16384]), 'pcm_48000')
    expect(Array.from(audio.left)).toEqual([0, 0.5])
  })

  it('decodes a 48 kHz WAV itself', async () => {
    const wav = encodeWav(Float32Array.from([0, 0.5]), Float32Array.from([0, 0.5]), 'x')
    const audio = await decodeVoiceAudio(wav, 'wav_48000')
    expect(audio.left[1]).toBeCloseTo(0.5, 3)
  })

  it('hands an MP3 to ffmpeg as 48 kHz stereo float and reads what comes back', async () => {
    const out = Buffer.alloc(16)
    out.writeFloatLE(0.5, 0)
    out.writeFloatLE(-0.5, 4)
    out.writeFloatLE(0.25, 8)
    out.writeFloatLE(-0.25, 12)
    const runFfmpeg = vi.fn(async () => out)
    const bytes = Buffer.from('mp3 bytes')
    const audio = await decodeVoiceAudio(bytes, 'mp3_44100_128', { runFfmpeg })
    expect(runFfmpeg).toHaveBeenCalledTimes(1)
    const [args, input] = runFfmpeg.mock.calls[0] as unknown as [string[], Buffer]
    expect(input).toBe(bytes)
    expect(args).toEqual(expect.arrayContaining(['-i', 'pipe:0', '-f', 'f32le', '-ac', '2', '-ar', '48000', 'pipe:1']))
    expect(Array.from(audio.left)).toEqual([0.5, 0.25])
    expect(Array.from(audio.right)).toEqual([-0.5, -0.25])
  })

  it('tells ffmpeg the layout of raw PCM at another rate', async () => {
    const runFfmpeg = vi.fn(async () => Buffer.alloc(8))
    await decodeVoiceAudio(pcm16([1, 2]), 'pcm_24000', { runFfmpeg })
    const [args] = runFfmpeg.mock.calls[0] as unknown as [string[]]
    expect(args.join(' ')).toContain('-f s16le -ar 24000 -ac 1 -i pipe:0')
  })

  it('says it needs ffmpeg rather than guessing at a codec', async () => {
    await expect(decodeVoiceAudio(Buffer.from('x'), 'mp3_44100_128')).rejects.toThrow(/needs ffmpeg/)
  })

  it('f32leStereoToAudio drops a partial frame', () => {
    expect(f32leStereoToAudio(Buffer.alloc(12)).left).toHaveLength(1)
  })
})
