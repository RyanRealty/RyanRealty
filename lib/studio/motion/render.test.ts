import { describe, expect, it } from 'vitest'
import { MOTION_ENCODE_ARGS, overlayGraph, parseProbe } from './render'

describe('parseProbe', () => {
  it("reads duration and frame size from ffmpeg's banner", () => {
    const banner = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'plate.mp4':
  Duration: 00:00:24.04, start: 0.000000, bitrate: 7004 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1080x1920 [SAR 1:1 DAR 9:16], 6998 kb/s, 24 fps, 24 tbr, 12288 tbn (default)`
    expect(parseProbe(banner)).toEqual({ duration: 24.04, width: 1080, height: 1920 })
  })

  it('returns null rather than guessing', () => {
    expect(parseProbe('plate.mp4: Invalid data found when processing input')).toBeNull()
  })
})

describe('overlayGraph', () => {
  const graph = overlayGraph(1080, 1920, 30)

  it('converts the overlay to bt709 limited range before the blend', () => {
    expect(graph).toContain('scale=in_range=pc:out_color_matrix=bt709:out_range=tv')
  })

  it('never lets the overlay cut the footage short', () => {
    expect(graph).toContain('eof_action=pass')
    expect(graph).not.toContain('shortest')
  })

  it('fills the frame from the footage at the film rate', () => {
    expect(graph).toContain('[1:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase')
    expect(graph).toContain('crop=1080:1920')
  })
})

describe('encode', () => {
  it('tags bt709 limited range, keeps the delivery ladder, and never adds audio', () => {
    const args = MOTION_ENCODE_ARGS.join(' ')
    for (const flag of ['-colorspace bt709', '-color_primaries bt709', '-color_trc bt709', '-color_range tv', '-pix_fmt yuv420p', '-maxrate 8M', '-an', '+faststart']) {
      expect(args).toContain(flag)
    }
  })
})
