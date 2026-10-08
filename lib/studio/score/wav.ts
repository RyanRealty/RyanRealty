/**
 * lib/studio/score/wav.ts — the file the muxer takes.
 *
 * 16-bit PCM stereo WAV at SAMPLE_RATE. Quantising to 16 bits correlates the
 * rounding error with a quiet reverb tail (it sounds like grain), so the
 * conversion adds TPDF dither, seeded so the same score still gives the same
 * bytes. Digital silence is the one exception: a sample that is exactly zero
 * stays exactly zero, because the score promises a first sample and a last 480
 * samples of true zero, and dither would turn them into noise at -90 dBFS.
 */
import { rngFor } from './rng'
import { SAMPLE_RATE } from './types'

const HEADER_BYTES = 44

/** 16-bit PCM stereo WAV with TPDF dither (seeded), RIFF header correct. */
export function encodeWav(left: Float32Array, right: Float32Array, seed: string): Buffer {
  if (left.length !== right.length) {
    throw new RangeError(`encodeWav: channels differ in length (${left.length} vs ${right.length})`)
  }
  const frames = left.length
  const dataBytes = frames * 4
  const out = Buffer.alloc(HEADER_BYTES + dataBytes)
  out.write('RIFF', 0, 'ascii')
  out.writeUInt32LE(36 + dataBytes, 4)
  out.write('WAVE', 8, 'ascii')
  out.write('fmt ', 12, 'ascii')
  out.writeUInt32LE(16, 16) // fmt chunk size
  out.writeUInt16LE(1, 20) // PCM
  out.writeUInt16LE(2, 22) // channels
  out.writeUInt32LE(SAMPLE_RATE, 24)
  out.writeUInt32LE(SAMPLE_RATE * 4, 28) // byte rate
  out.writeUInt16LE(4, 32) // block align
  out.writeUInt16LE(16, 34) // bits per sample
  out.write('data', 36, 'ascii')
  out.writeUInt32LE(dataBytes, 40)

  const rand = rngFor(seed, 'dither')
  let offset = HEADER_BYTES
  for (let i = 0; i < frames; i++) {
    for (const channel of [left, right]) {
      const x = channel[i]
      let q = 0
      if (x !== 0) {
        // Triangular noise of +-1 LSB: the difference of two uniform draws.
        const dither = rand() - rand()
        q = Math.round(x * 32767 + dither)
        if (q > 32767) q = 32767
        else if (q < -32768) q = -32768
      }
      out.writeInt16LE(q, offset)
      offset += 2
    }
  }
  return out
}
