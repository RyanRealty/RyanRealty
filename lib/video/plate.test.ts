import { describe, expect, it } from 'vitest'
import { PlateError, buildPlate, coverCrop, plateGraph, segmentFrames, type PlateSegment } from './plate'

const clip = (over: Partial<Extract<PlateSegment, { kind: 'footage' }>> = {}): PlateSegment => ({
  kind: 'footage',
  path: '/clips/river.mp4',
  source: { width: 1080, height: 1920 },
  sourceDuration: 28,
  in: 0.5,
  seconds: 3.75,
  move: 'hold',
  label: 'hook',
  ...over,
})

describe('coverCrop: one scale for both axes, never a stretch', () => {
  it('passes a 9:16 clip straight through', () => {
    expect(coverCrop({ width: 1080, height: 1920 })).toEqual({ scale: 1, scaledWidth: 1080, scaledHeight: 1920, x: 0, y: 0, axis: 'none', upscaled: false })
  })

  it('scales a 4K landscape clip to cover the height and centres the crop across', () => {
    const c = coverCrop({ width: 3840, height: 2160 })
    expect(c.scale).toBeCloseTo(1920 / 2160, 6)
    expect(c.scaledHeight).toBe(1920)
    expect(c.scaledWidth).toBe(3414)
    // The aspect is kept to within the even-pixel rounding.
    expect(Math.abs(c.scaledWidth / c.scaledHeight - 3840 / 2160)).toBeLessThan(0.002)
    expect(c.x).toBe(1166)
    expect(c.x % 2).toBe(0)
    expect(c.y).toBe(0)
    expect(c.axis).toBe('x')
    expect(c.upscaled).toBe(false)
  })

  it('scales a tall clip to cover the width and records the crop down', () => {
    const c = coverCrop({ width: 1440, height: 3200 })
    expect(c.scaledWidth).toBe(1080)
    expect(c.scaledHeight).toBe(2400)
    expect(c.y).toBe(240)
    expect(c.axis).toBe('y')
  })

  it('flags an upscale', () => {
    const c = coverCrop({ width: 720, height: 1280 })
    expect(c.scale).toBe(1.5)
    expect(c.upscaled).toBe(true)
  })

  it('refuses a clip with no size', () => {
    expect(() => coverCrop({ width: 0, height: 1920 })).toThrow(PlateError)
  })
})

describe('plateGraph', () => {
  it('cuts each beat to its frames at 30 fps, strips nothing it does not read, and concatenates', () => {
    const g = plateGraph([clip(), clip({ path: '/clips/mill.mp4', in: 0.4, seconds: 3.4, label: 'body' }), { kind: 'paper', seconds: 2.5, label: 'cta' }])
    expect(g.frames).toBe(113 + 102 + 75)
    expect(g.inputs).toEqual(['-ss', '0.500', '-t', '4.767', '-i', '/clips/river.mp4', '-ss', '0.400', '-t', '4.400', '-i', '/clips/mill.mp4'])
    expect(g.graph).toContain('[0:v]fps=30,scale=1080:1920:flags=lanczos,crop=1080:1920:0:0,setsar=1,format=yuv420p,trim=end_frame=113,setpts=PTS-STARTPTS[p0]')
    expect(g.graph).toContain('color=c=0xfaf8f4:s=1080x1920:r=30')
    expect(g.graph).toContain('scale=out_color_matrix=bt709:out_range=tv')
    expect(g.graph).toMatch(/\[p0\]\[p1\]\[p2\]concat=n=3:v=1:a=0,format=yuv420p\[v\]$/)
    expect(g.records.map((r) => [r.label, r.start, r.frames])).toEqual([
      ['hook', 0, 113],
      ['body', 113 / 30, 102].map((v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)),
      ['cta', Math.round((215 / 30) * 1e6) / 1e6, 75],
    ])
    expect(g.records[0].crop).toMatchObject({ scale: 1, axis: 'none' })
  })

  it('holds the plate\'s own first frame for the loop seam, made the same way as frame 0', () => {
    const g = plateGraph([clip(), { kind: 'opening', seconds: 3.1, label: 'endcard' }])
    // The first clip is opened twice at the same seek; the second copy is cut to one frame and looped.
    expect(g.inputs.filter((a) => a === '/clips/river.mp4')).toHaveLength(2)
    expect(g.graph).toContain('trim=end_frame=1,setpts=PTS-STARTPTS[o1]')
    expect(g.graph).toContain('[o1]loop=loop=92:size=1:start=0,setpts=N/30/TB,setsar=1[p1]')
    expect(g.frames).toBe(113 + 93)
  })

  it('pans only when the crop window has room, on pan.ts\'s half cosine', () => {
    const wide = plateGraph([clip({ source: { width: 3840, height: 2160 }, move: 'pan' })])
    expect(wide.graph).toContain("crop=1080:1920:'(iw-1080)*(0.5-0.5*cos(PI*min(t\\,3.767)/3.767))':0")
    expect(wide.records[0].move).toBe('pan')
    const portrait = plateGraph([clip({ move: 'pan' })])
    expect(portrait.records[0].move).toBe('hold')
  })

  it('refuses a trim past the clip, an upscale past the limit, and an empty plate', () => {
    expect(() => plateGraph([clip({ in: 26, seconds: 3 })])).toThrow(/runs past the clip/)
    expect(() => plateGraph([clip({ source: { width: 360, height: 640 } })])).toThrow(/over the 2x limit/)
    expect(() => plateGraph([])).toThrow(/at least one segment/)
    expect(() => plateGraph([{ kind: 'opening', seconds: 1 }])).toThrow(/cannot open on its own opening/)
  })

  it('counts frames by rounding to the nearest frame', () => {
    expect(segmentFrames(3.75)).toBe(113)
    expect(segmentFrames(3.4)).toBe(102)
  })
})

describe('buildPlate', () => {
  it('runs ffmpeg once with the graph and the exact frame count, and reports its failure', async () => {
    const calls: string[][] = []
    const ok = await buildPlate({
      ffmpeg: 'ffmpeg',
      segments: [clip()],
      outPath: '/out/plate.mp4',
      run: async (args) => {
        calls.push(args)
        return { code: 0, stderr: '' }
      },
    })
    expect(ok.frames).toBe(113)
    expect(calls[0]).toEqual(expect.arrayContaining(['-frames:v', '113', '-an', '-map', '[v]', '/out/plate.mp4']))
    await expect(
      buildPlate({ ffmpeg: 'ffmpeg', segments: [clip()], outPath: '/out/plate.mp4', run: async () => ({ code: 1, stderr: 'boom' }) }),
    ).rejects.toThrow(/could not build the plate: boom/)
  })
})
