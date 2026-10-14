import { describe, expect, it } from 'vitest'
import {
  lumaStatsFromGray,
  parseEbur128,
  parseFps,
  parseFreezedetect,
  parseProbe,
  parseSceneCuts,
  parseSsim,
  creamFractionsFromRgb,
  isCream,
  resolveBinary,
  resolvePython,
  resolveTesseract,
  runBinary,
  studioBinaries,
} from './measure'

// Captured from ffmpeg 6.1.1 on 2026-10-13.
/** A test environment: Next's types make NODE_ENV required on ProcessEnv. */
const env = (vars: Record<string, string>): NodeJS.ProcessEnv => vars as unknown as NodeJS.ProcessEnv

const EBUR_LOG = `[Parsed_ebur128_0 @ 0x56279e26c000] t: 6.99998    TARGET:-23 LUFS    M: -21.8 S: -21.8     I: -21.8 LUFS       LRA:   0.0 LU  FTPK: -17.8 dBFS  TPK: -16.1 dBFS
[out#0/null @ 0x56279e1a59c0] video:0kB audio:658kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: unknown
size=N/A time=00:00:07.00 bitrate=N/A speed=85.9x
[Parsed_ebur128_0 @ 0x56279e26c000] Summary:

  Integrated loudness:
    I:         -14.2 LUFS
    Threshold: -31.8 LUFS

  Loudness range:
    LRA:         0.0 LU
    Threshold: -41.8 LUFS
    LRA low:   -21.8 LUFS
    LRA high:  -21.8 LUFS

  True peak:
    Peak:      -1.7 dBFS
`

const FREEZE_MID = `[freezedetect @ 0x55c43bc05080] lavfi.freezedetect.freeze_start: 3
[freezedetect @ 0x55c43bc05080] lavfi.freezedetect.freeze_duration: 2
[freezedetect @ 0x55c43bc05080] lavfi.freezedetect.freeze_end: 5
`

const SHOWINFO = `[Parsed_showinfo_1 @ 0x561d2d212400] config in time_base: 1/15360, frame_rate: 30/1
[Parsed_showinfo_1 @ 0x561d2d212400] config out time_base: 0/0, frame_rate: 0/0
[Parsed_showinfo_1 @ 0x561d2d212400] n:   0 pts:  77312 pts_time:5.03333 duration:    512 duration_time:0.0333333 fmt:yuv420p cl:left sar:1/1 s:1080x1920 i:P iskey:0 type:P checksum:92088E77 plane_checksum:[1 2 3] mean:[128 128 128] stdev:[1.0 2.0 3.0]
[Parsed_showinfo_1 @ 0x561d2d212400] n:   1 pts: 240000 pts_time:15.625 duration:    512 duration_time:0.0333333 fmt:yuv420p
`

describe('studioBinaries (one resolver for the film and its check)', () => {
  it('takes FFMPEG_PATH and FFPROBE_PATH when they exist', () => {
    expect(studioBinaries(env({ FFMPEG_PATH: '/opt/ff/ffmpeg', FFPROBE_PATH: ' /opt/ff/ffprobe ' }), () => true)).toEqual({ ffmpeg: '/opt/ff/ffmpeg', ffprobe: '/opt/ff/ffprobe' })
    expect(resolveBinary('ffprobe', env({ FFMPEG_PATH: '/opt/ff/ffmpeg', FFPROBE_PATH: '/opt/ff/ffprobe' }), () => true)).toBe('/opt/ff/ffprobe')
  })

  it('fails when FFMPEG_PATH or FFPROBE_PATH is set but missing, never falling back', () => {
    expect(() => studioBinaries(env({ FFMPEG_PATH: '/nope/ffmpeg' }), (p) => p.startsWith('/usr/bin/'))).toThrow(/FFMPEG_PATH is set to \/nope\/ffmpeg/)
    expect(() => studioBinaries(env({ FFPROBE_PATH: '/nope/ffprobe' }), (p) => p.startsWith('/usr/bin/'))).toThrow(/FFPROBE_PATH/)
  })

  it('takes ffprobe from beside the resolved ffmpeg, so both are one build', () => {
    expect(studioBinaries(env({ FFMPEG_PATH: '/opt/ff/ffmpeg' }), (p) => p.startsWith('/opt/ff/') || p.startsWith('/usr/bin/'))).toEqual({ ffmpeg: '/opt/ff/ffmpeg', ffprobe: '/opt/ff/ffprobe' })
    expect(() => studioBinaries(env({ FFMPEG_PATH: '/opt/ff/ffmpeg' }), (p) => p === '/opt/ff/ffmpeg' || p === '/usr/bin/ffprobe')).toThrow(/no ffprobe beside \/opt\/ff\/ffmpeg/)
  })

  it('looks in /usr/bin, then Homebrew, then /usr/local/bin, then PATH', () => {
    expect(studioBinaries(env({}), (p) => p.startsWith('/usr/bin/'))).toEqual({ ffmpeg: '/usr/bin/ffmpeg', ffprobe: '/usr/bin/ffprobe' })
    expect(studioBinaries(env({}), (p) => p.startsWith('/opt/homebrew/bin/')).ffmpeg).toBe('/opt/homebrew/bin/ffmpeg')
    expect(studioBinaries(env({ PATH: '/a:/b' }), (p) => p.startsWith('/b/')).ffprobe).toBe('/b/ffprobe')
    expect(() => studioBinaries(env({ PATH: '/a' }), () => false)).toThrow(/ffmpeg was not found/)
  })

  it('finds tesseract and python3 the same way, or reports them missing', () => {
    expect(resolveTesseract(env({}), (p) => p === '/usr/bin/tesseract')).toBe('/usr/bin/tesseract')
    expect(resolveTesseract(env({ TESSERACT_PATH: '/x/tesseract' }), () => false)).toBeNull()
    expect(resolveTesseract(env({ PATH: '/a' }), () => false)).toBeNull()
    expect(resolvePython(env({ PATH: '/a' }), (p) => p === '/a/python3')).toBe('/a/python3')
  })
})

describe('runBinary timeouts', () => {
  it('stops a child and everything it spawned when the time runs out', async () => {
    const started = Date.now()
    const r = await runBinary('sh', ['-c', 'sleep 30 & sleep 30; echo never'], { timeoutMs: 300, group: true })
    expect(Date.now() - started).toBeLessThan(5000)
    expect(r.code).not.toBe(0)
    expect(r.stdout.toString()).toBe('')
  })
})

describe('creamFractionsFromRgb (where the end card is, from the pixels)', () => {
  it('reads cream as cream and footage as not', () => {
    expect(isCream(250, 248, 244)).toBe(true)
    expect(isCream(226, 224, 220)).toBe(true)
    expect(isCream(16, 39, 66)).toBe(false)
    expect(isCream(250, 200, 150)).toBe(false)
  })

  it('gives each frame its share of cream pixels, timed from the start', () => {
    const frameA = [250, 248, 244, 250, 248, 244, 16, 39, 66, 16, 39, 66]
    const frameB = Array(4).fill([250, 248, 244]).flat()
    const raw = new Uint8Array([...frameA, ...frameB, 1, 2])
    expect(creamFractionsFromRgb(raw, 2, 2, 12.2, 30)).toEqual([{ t: 12.2, fraction: 0.5 }, { t: 12.233, fraction: 1 }])
  })
})

describe('parseFps', () => {
  it('reads fractions and plain numbers', () => {
    expect(parseFps('30/1')).toBe(30)
    expect(parseFps('30000/1001')).toBeCloseTo(29.97, 2)
    expect(parseFps('25')).toBe(25)
  })

  it('rejects unusable values', () => {
    expect(parseFps('0/0')).toBeNull()
    expect(parseFps('abc')).toBeNull()
    expect(parseFps(undefined)).toBeNull()
  })
})

describe('parseProbe', () => {
  const base = {
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, pix_fmt: 'yuv420p', avg_frame_rate: '30/1', r_frame_rate: '30/1', duration: '27.466667' },
      { codec_type: 'audio', codec_name: 'aac' },
    ],
    format: { duration: '27.500000' },
  }

  it('reads the video stream and flags audio', () => {
    const p = parseProbe(JSON.stringify(base))
    expect(p).toMatchObject({ width: 1080, height: 1920, fps: 30, codec: 'h264', pixFmt: 'yuv420p', duration: 27.5, videoDuration: 27.466667, hasAudio: true })
  })

  it('reports no audio and falls back to the container duration', () => {
    const p = parseProbe(JSON.stringify({ streams: [{ ...base.streams[0], duration: undefined }], format: base.format }))
    expect(p.hasAudio).toBe(false)
    expect(p.videoDuration).toBe(27.5)
  })

  it('reads the frame count the container records, so a short encode is caught', () => {
    expect(parseProbe(JSON.stringify({ streams: [{ ...base.streams[0], nb_frames: '459' }], format: base.format })).frames).toBe(459)
    expect(parseProbe(JSON.stringify(base)).frames).toBeNull()
  })

  it('uses r_frame_rate when avg is zero', () => {
    const v = { ...base.streams[0], avg_frame_rate: '0/0' }
    expect(parseProbe(JSON.stringify({ streams: [v], format: base.format })).fps).toBe(30)
  })

  it('throws when there is no video, no duration or bad JSON', () => {
    expect(() => parseProbe(JSON.stringify({ streams: [{ codec_type: 'audio' }], format: base.format }))).toThrow(/no video stream/)
    expect(() => parseProbe(JSON.stringify({ streams: [base.streams[0]], format: {} }))).toThrow(/no duration/)
    expect(() => parseProbe('not json')).toThrow(/not JSON/)
  })
})

describe('parseEbur128', () => {
  it('reads the summary, not the running lines above it', () => {
    expect(parseEbur128(EBUR_LOG)).toEqual({ integratedLufs: -14.2, truePeakDb: -1.7 })
  })

  it('maps silence (-inf) to null', () => {
    const silent = EBUR_LOG.replace('-14.2 LUFS', '-70.0 LUFS').replace('-1.7 dBFS', '-inf dBFS')
    expect(parseEbur128(silent)).toEqual({ integratedLufs: -70, truePeakDb: null })
    expect(parseEbur128(EBUR_LOG.replace('-14.2', '-inf'))).toMatchObject({ integratedLufs: null })
  })

  it('returns a null true peak when the summary has none', () => {
    const noPeak = EBUR_LOG.slice(0, EBUR_LOG.indexOf('  True peak:'))
    expect(parseEbur128(noPeak).truePeakDb).toBeNull()
  })

  it('throws when there is no summary', () => {
    expect(() => parseEbur128('Stream map: nothing')).toThrow(/no summary/)
  })
})

describe('parseFreezedetect', () => {
  it('reads a freeze with a start, duration and end', () => {
    expect(parseFreezedetect(FREEZE_MID, 8)).toEqual([{ start: 3, end: 5, duration: 2 }])
  })

  it('closes a freeze that runs to the end of the file (start with no end)', () => {
    const open = '[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 4\n'
    expect(parseFreezedetect(open, 7)).toEqual([{ start: 4, end: 7, duration: 3 }])
  })

  it('reads several freezes and ignores other lines', () => {
    const log = `noise\n${FREEZE_MID}[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 10.5\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 1.25\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 11.75\n`
    expect(parseFreezedetect(log, 20)).toEqual([
      { start: 3, end: 5, duration: 2 },
      { start: 10.5, end: 11.75, duration: 1.25 },
    ])
  })

  it('returns nothing for a clean file', () => {
    expect(parseFreezedetect('frame= 10 fps=0', 5)).toEqual([])
  })
})

describe('parseSceneCuts', () => {
  it('collects pts_time from showinfo frame lines and skips config lines', () => {
    expect(parseSceneCuts(SHOWINFO)).toEqual([5.03333, 15.625])
  })

  it('drops a cut at time zero and duplicates', () => {
    const log = '[Parsed_showinfo_1 @ 0x1] n: 0 pts: 0 pts_time:0 fmt:yuv420p\n[Parsed_showinfo_1 @ 0x1] n: 1 pts: 1 pts_time:2.5 x\n[Parsed_showinfo_1 @ 0x1] n: 2 pts: 1 pts_time:2.5 x\n'
    expect(parseSceneCuts(log)).toEqual([2.5])
  })

  it('returns nothing when no frame was selected', () => {
    expect(parseSceneCuts('[Parsed_showinfo_1 @ 0x1] config in time_base: 1/15360, frame_rate: 30/1')).toEqual([])
  })
})

describe('parseSsim', () => {
  it('reads the All score', () => {
    const log = '[Parsed_ssim_0 @ 0x563f2a267100] SSIM R:0.383665 (2.101832) G:0.338100 (1.792074) B:0.257739 (1.294435) All:0.326501 (1.716633)'
    expect(parseSsim(log)).toBeCloseTo(0.326501, 6)
  })

  it('reads a perfect match whose dB is inf', () => {
    expect(parseSsim('SSIM Y:1.000000 (inf) U:1.000000 (inf) V:1.000000 (inf) All:1.000000 (inf)')).toBe(1)
  })

  it('uses the last score when there are several', () => {
    expect(parseSsim('SSIM All:0.5 (3)\nSSIM All:0.9 (10)')).toBe(0.9)
  })

  it('throws on a size mismatch or no score', () => {
    expect(() => parseSsim('Input link parameters (size 100x100) do not match')).toThrow(/differ in size/)
    expect(() => parseSsim('nothing here')).toThrow(/no SSIM/)
    expect(() => parseSsim('SSIM All:nan (nan)')).toThrow(/not a number/)
  })
})

describe('lumaStatsFromGray', () => {
  it('gives zero variance for a flat frame', () => {
    expect(lumaStatsFromGray(new Uint8Array(100).fill(200))).toEqual({ mean: 200, variance: 0 })
  })

  it('measures spread', () => {
    const s = lumaStatsFromGray(new Uint8Array([0, 255]))
    expect(s.mean).toBe(127.5)
    expect(s.variance).toBeCloseTo(16256.25, 2)
  })

  it('throws on no pixels', () => {
    expect(() => lumaStatsFromGray(new Uint8Array(0))).toThrow()
  })
})
