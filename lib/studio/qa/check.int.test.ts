/**
 * The measured output check against real ffmpeg and real files.
 *
 * A tiny 1080x1920 30 fps film is synthesized (testsrc2 for motion, a cream end
 * card with a moving block, the first frame repeated at the tail so the loop
 * closes, and a sine tone calibrated to -14 LUFS) together with a matching
 * manifest. Variants prove each failure is seen in the file, not the paperwork:
 * a deliberately frozen stretch, a loud mix, a tampered hash, a wrong golden
 * still, a file that is not video at all.
 *
 * Needs ffmpeg and ffprobe. Skips loudly without them, like the other media
 * int tests; `test:int` is where it must pass.
 */
import { createHash } from 'node:crypto'
import { execFile, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_ONLY_APPROVAL } from './fixtures/test-approval'
import { checkVideo, type CheckReport } from './check'
import { findFont, writeContactSheet } from './contact'
import { createMeasure, resolveBinary, runBinary } from './measure'
import { createPixelProbe, type PixelProbe } from './pixels'
import { loadVideoTypes, typeRulesFor } from './thresholds'

const execFileAsync = promisify(execFile)
const ffmpeg = resolveBinary('ffmpeg')
const ffprobe = resolveBinary('ffprobe')
const hasMedia = spawnSync(ffmpeg, ['-version']).status === 0 && spawnSync(ffprobe, ['-version']).status === 0
if (!hasMedia) console.warn('[check.int] ffmpeg or ffprobe not found: skipping. Set FFMPEG_PATH and FFPROBE_PATH.')

const measure = createMeasure()
/**
 * Checks 1 to 16 are about the file's measurements; the synthetic film draws
 * no type, so check 17 reads back what the manifest claims through this stand
 * in. The real OCR runs once, below, and in the CLI tests.
 */
const honestPixels = (mp4: string): PixelProbe => ({
  async missingTooling() { return null },
  async gate() { return { fails: [], info: {}, samples: [] } },
  async readBox(_p, t, box) {
    const m = JSON.parse(readFileSync(mp4.replace(/\.mp4$/, '.manifest.json'), 'utf8')) as { texts: Array<{ text: string; start: number; end: number; box: { x: number; y: number } }> }
    return m.texts.find((x) => x.box.x === box.x && x.box.y === box.y && t >= x.start && t <= x.end)?.text ?? ''
  },
})
const TYPE = 'story_teaser'
const TECHNIQUES = ['dollar_first_hook', 'subframe_motion_blur', 'eased_number_reveal']
/** A test-only registry: subframe_motion_blur stands in as an approved signature scene. Never the committed file. */
const REGISTRY = {
  techniques: {
    dollar_first_hook: { category: 'hook', status: 'ready', tier: 'base' },
    subframe_motion_blur: { category: 'scene', status: 'approved', tier: 'signature', ...TEST_ONLY_APPROVAL },
    eased_number_reveal: { category: 'type', status: 'ready', tier: 'base' },
  },
}

let dir = ''
let good = ''
let frozen = ''
let loud = ''
let notVideo = ''
let golden = ''
let registry = ''
let ledger = ''

async function ff(args: string[]): Promise<void> {
  const r = await runBinary(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args])
  if (r.code !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`)
}

/** The film: 6 s of testsrc2 (optionally the last 3 s frozen), a 2.7 s end card, a 0.3 s tail of frame 0. */
async function synth(out: string, wav: string, freezeFromThree: boolean): Promise<void> {
  const inputs: string[] = ['-f', 'lavfi', '-i', `testsrc2=s=1080x1920:r=30:d=${freezeFromThree ? 3 : 6}`]
  let next = 1
  let aChain = '[a0]null[a]'
  if (freezeFromThree) {
    inputs.push('-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=30:d=0.034')
    aChain = `[${next}:v]setsar=1,format=yuv420p,loop=loop=89:size=1:start=0,setpts=N/30/TB[fz];[a0][fz]concat=n=2:v=1:a=0[a]`
    next++
  }
  const cream = next++
  const navy = next++
  const audio = next++
  inputs.push('-f', 'lavfi', '-i', 'color=c=0xfaf8f4:s=1080x1920:r=30:d=2.7', '-f', 'lavfi', '-i', 'color=c=0x102742:s=500x500:r=30:d=2.7', '-i', wav)
  const graph = [
    '[0:v]setsar=1,format=yuv420p,split[a0][a1]',
    aChain,
    '[a1]trim=end_frame=1,setpts=PTS-STARTPTS,loop=loop=8:size=1:start=0,setpts=N/30/TB,setsar=1[tail]',
    `[${cream}:v][${navy}:v]overlay=x='mod(t*600\\,580)':y=700:shortest=1,setsar=1,format=yuv420p[ec]`,
    '[a][ec][tail]concat=n=3:v=1:a=0[v]',
  ].join(';')
  await ff([
    ...inputs, '-filter_complex', graph, '-map', '[v]', '-map', `${audio}:a`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-t', '9', out,
  ])
}

function manifestFor(mp4: string, sha256: string): Record<string, unknown> {
  return {
    factory: 'lib/studio',
    manifestVersion: 2,
    video: { file: 'final.mp4', sha256, width: 1080, height: 1920, fps: 30, duration: 9 },
    videoType: TYPE,
    techniques: TECHNIQUES,
    beats: [
      { id: 'hook', role: 'hook', start: 0, end: 3 },
      { id: 'payoff', role: 'payoff', start: 3, end: 6 },
      { id: 'end', role: 'endcard', start: 6, end: 9 },
    ],
    texts: [
      { text: 'Bend homes', start: 0.2, end: 3, box: { x: 90, y: 400, w: 860, h: 220 }, kind: 'card' },
      { text: 'BEND HOMES', start: 0.3, end: 1.0, box: { x: 90, y: 1300, w: 860, h: 120 }, kind: 'caption' },
      { text: 'Call now 541.703.3095', start: 7.25, end: 9, box: { x: 205, y: 1130, w: 660, h: 260 }, kind: 'endcard' },
    ],
    numbers: [],
    voice: { engine: 'elevenlabs', model: 'eleven_v3', voiceId: 'v1', words: [{ word: 'Bend', start: 0.3, end: 0.6 }, { word: 'homes', start: 0.6, end: 1.0 }] },
    captions: [{ text: 'BEND HOMES', start: 0.3, end: 1.0, words: [0, 1] }],
    audio: { lufs: -14, truePeakDb: -11, silent: false },
    endcard: { start: 6, quality: 6, local: 6.4, service: 6.8, call: 7.25, out: 9 },
    loop: { seconds: 0.3 },
    builtBy: 'claude',
    briefSha256: '0'.repeat(64),
    slug: 'synthetic-teaser',
    creative: { feel: 'satisfying', constraint: 'one figure per beat', lineage: 'Swiss typographic posters', one_sentence: 'One number, read on a ruler.' },
  }
}

/** The film's brief and manifest beside it, the manifest bound to the brief's bytes. */
async function writeManifest(mp4: string, mutate?: (m: Record<string, any>) => void): Promise<void> {
  const brief = JSON.stringify({ video_type: TYPE, title: 'Synthetic teaser', techniques: TECHNIQUES })
  writeFileSync(mp4.replace(/\.mp4$/, '.brief.json'), brief)
  const m = manifestFor(mp4, createHash('sha256').update(readFileSync(mp4)).digest('hex'))
  m.briefSha256 = createHash('sha256').update(brief).digest('hex')
  mutate?.(m)
  writeFileSync(mp4.replace(/\.mp4$/, '.manifest.json'), JSON.stringify(m))
}

function pngSize(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

const run = (mp4: string, over: Partial<Parameters<typeof checkVideo>[0]> = {}): Promise<CheckReport> =>
  checkVideo({ mp4Path: mp4, ...over }, { measure, pixels: honestPixels(mp4), testPaths: { golden, registryPath: registry, ledgerPath: ledger, ...(over.golden ? { golden: over.golden } : {}) } })

const get = (r: CheckReport, id: number) => r.checks.find((c) => c.id === id)!
const failing = (r: CheckReport) => r.checks.filter((c) => !c.pass).map((c) => `${c.id} ${c.name}: ${c.detail}`)

describe.skipIf(!hasMedia)('video:check against real files', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'rr-check-int-'))
    registry = join(dir, 'registry.json')
    ledger = join(dir, 'film-ledger.jsonl')
    writeFileSync(registry, JSON.stringify(REGISTRY))
    writeFileSync(ledger, '')

    // Calibrate the tone to -14 LUFS with the same wrapper the check uses.
    const probeWav = join(dir, 'probe.wav')
    await ff(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:d=9', '-af', 'volume=0.25', '-c:a', 'pcm_s16le', probeWav])
    const base = (await measure.loudness(probeWav)).integratedLufs!
    const wav = join(dir, 'tone.wav')
    await ff(['-i', probeWav, '-af', `volume=${(-14 - base).toFixed(2)}dB`, '-c:a', 'pcm_s16le', wav])

    good = join(dir, 'good.mp4')
    frozen = join(dir, 'frozen.mp4')
    loud = join(dir, 'loud.mp4')
    notVideo = join(dir, 'notvideo.mp4')
    await synth(good, wav, false)
    await synth(frozen, wav, true)
    await ff(['-i', good, '-af', 'volume=12dB', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', loud])
    writeFileSync(notVideo, Buffer.from('this is not a video file '.repeat(40)))

    golden = join(dir, 'golden.png')
    writeFileSync(golden, await measure.frameAt(good, 7.25 + 0.5))
    await writeManifest(good)
    await writeManifest(frozen)
    await writeManifest(loud)
    await writeManifest(notVideo)
  }, 120_000)

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  describe('measurement wrappers', () => {
    it('probes the film', async () => {
      const p = await measure.probe(good)
      expect(p).toMatchObject({ width: 1080, height: 1920, fps: 30, codec: 'h264', pixFmt: 'yuv420p', hasAudio: true })
      expect(p.duration).toBeCloseTo(9, 1)
    })

    it('measures loudness near -14 LUFS with a true peak well under -1', async () => {
      const l = await measure.loudness(good)
      expect(l.integratedLufs).toBeGreaterThan(-15)
      expect(l.integratedLufs).toBeLessThan(-13)
      expect(l.truePeakDb).toBeLessThan(-1)
    })

    it('sees a deliberately frozen stretch and not in the live film', async () => {
      expect(await measure.freezes(good, { seconds: 1.2 })).toEqual([])
      const f = await measure.freezes(frozen, { seconds: 1.2 })
      expect(f).toHaveLength(1)
      expect(f[0].start).toBeCloseTo(3, 1)
      expect(f[0].duration).toBeGreaterThan(2.5)
    })

    it('finds the cut into the end card and the cut back to frame 0', async () => {
      const cuts = await measure.sceneCuts(good)
      expect(cuts.some((t) => Math.abs(t - 6) < 0.1)).toBe(true)
      expect(cuts.some((t) => Math.abs(t - 8.7) < 0.1)).toBe(true)
    })

    it('returns real PNG frames, scores identical frames 1 and different frames low, and spots a blank one', async () => {
      const a = await measure.frameAt(good, 2)
      const b = await measure.frameAt(good, 7.5)
      expect(pngSize(a)).toEqual({ width: 1080, height: 1920 })
      // The very last frame is readable, not just one before it.
      expect(pngSize(await measure.frameAt(good, 9 - 1 / 30))).toEqual({ width: 1080, height: 1920 })
      expect(await measure.ssim(a, a)).toBeCloseTo(1, 5)
      expect(await measure.ssim(a, b)).toBeLessThan(0.7)
      expect((await measure.lumaStats(a)).variance).toBeGreaterThan(100)
      const blank = join(dir, 'blank.png')
      await ff(['-f', 'lavfi', '-i', 'color=c=0xfaf8f4:s=1080x1920', '-frames:v', '1', blank])
      expect((await measure.lumaStats(readFileSync(blank))).variance).toBeLessThan(1)
    })

    it('hashes a file the same way node does', async () => {
      expect(await measure.sha256(good)).toBe(createHash('sha256').update(readFileSync(good)).digest('hex'))
    })

    it('throws on a file ffprobe cannot read', async () => {
      await expect(measure.probe(notVideo)).rejects.toThrow()
    })
  })

  describe('checkVideo on the good film', () => {
    it('passes every check', async () => {
      const r = await run(good)
      expect(failing(r)).toEqual([])
      expect(r.pass).toBe(true)
      expect(get(r, 2).measured).toMatchObject({ width: 1080, height: 1920, codec: 'h264', pixFmt: 'yuv420p' })
      expect(get(r, 7).measured).toMatchObject({ integratedLufs: expect.any(Number) })
      expect(get(r, 12).measured).toMatchObject({ ssim: expect.any(Number) })
      expect((get(r, 12).measured as any).ssim).toBeGreaterThanOrEqual(0.92)
      expect((get(r, 13).measured as any).ssim).toBeGreaterThanOrEqual(0.85)
      expect(get(r, 5).measured).toMatchObject({ shots: 1 })
      expect(get(r, 12).measured).toMatchObject({ startFromPixels: 6 })
    }, 60_000)

    it('passes --final with a review by someone else, and records the film in the ledger', async () => {
      const sha = await measure.sha256(good)
      writeFileSync(join(dir, 'good.review.json'), JSON.stringify({ sha256: sha, reviewer: 'grok', watched: true, listened: true, verdict: 'ship' }))
      const r = await run(good, { final: true })
      expect(failing(r)).toEqual([])
      expect(r.ledger?.appended).toBe(true)
      expect(readFileSync(ledger, 'utf8')).toContain(sha)
    }, 60_000)
  })

  describe('checkVideo on bad films', () => {
    it('fails Motion for the frozen stretch and names where it starts', async () => {
      const r = await run(frozen)
      expect(get(r, 6).pass).toBe(false)
      expect(get(r, 6).detail).toMatch(/frozen from 3(\.\d+)?s/)
      expect(r.pass).toBe(false)
    }, 60_000)

    it('fails Sound for a mix pushed over -13 LUFS', async () => {
      const r = await run(loud)
      expect(get(r, 7).pass).toBe(false)
      expect(get(r, 7).detail).toMatch(/outside -15 to -13|true peak/)
    }, 60_000)

    it('fails Provenance when the manifest hash is not the file', async () => {
      await writeManifest(good, (m) => { m.video.sha256 = 'b'.repeat(64) })
      const r = await run(good)
      expect(get(r, 1).pass).toBe(false)
      expect(get(r, 1).detail).toContain('differs from the manifest')
      await writeManifest(good)
    }, 60_000)

    it('fails Format when the manifest claims a different duration', async () => {
      await writeManifest(good, (m) => { m.video.duration = 9.5 })
      const r = await run(good)
      expect(get(r, 2).pass).toBe(false)
      await writeManifest(good)
    }, 60_000)

    it('fails the End card against a golden still of something else, and with no golden at all', async () => {
      const wrong = join(dir, 'wrong.png')
      await ff(['-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=30:d=1', '-ss', '0.5', '-frames:v', '1', wrong])
      const bad = await run(good, { golden: wrong })
      expect(get(bad, 12).pass).toBe(false)
      expect(get(bad, 12).detail).toMatch(/SSIM \d\.\d+, under 0\.92/)
      const none = await run(good, { golden: join(dir, 'nope.png') })
      expect(get(none, 12).detail).toContain('no golden still at')
    }, 60_000)

    it('fails the End card when the golden is a different size, rather than guessing', async () => {
      const small = join(dir, 'small.png')
      await ff(['-f', 'lavfi', '-i', 'testsrc2=s=540x960:r=30:d=1', '-frames:v', '1', small])
      const r = await run(good, { golden: small })
      expect(get(r, 12).pass).toBe(false)
      expect(get(r, 12).detail).toContain('cannot be measured')
    }, 60_000)

    it('fails everything measurable on a file that is not a video', async () => {
      const r = await run(notVideo)
      expect(r.pass).toBe(false)
      for (const id of [2, 3, 4, 5, 6, 12, 13]) expect(get(r, id).pass, `check ${id}`).toBe(false)
    }, 60_000)

    it('fails the End card and keeps the shots honest when the manifest claims the card started early', async () => {
      await writeManifest(good, (m) => {
        m.beats = [{ id: 'hook', role: 'hook', start: 0, end: 3 }, { id: 'end', role: 'endcard', start: 3, end: 9 }]
        m.endcard = { start: 3, quality: 6, local: 6.4, service: 6.8, call: 7.25, out: 9 }
      })
      const r = await run(good)
      expect(get(r, 12).detail).toMatch(/the pixels show it from 6(\.0+)?s/)
      await writeManifest(good)
    }, 60_000)

    it('fails Provenance when the brief was edited after the render', async () => {
      await writeManifest(good)
      writeFileSync(good.replace(/\.mp4$/, '.brief.json'), JSON.stringify({ video_type: TYPE, title: 'Synthetic teaser', techniques: TECHNIQUES, length_reason: 'edited' }))
      const r = await run(good)
      expect(get(r, 1).detail).toContain('the brief changed after the render')
      await writeManifest(good)
    }, 60_000)

    it('fails with no manifest beside the file', async () => {
      const orphan = join(dir, 'orphan.mp4')
      writeFileSync(orphan, readFileSync(good))
      const r = await run(orphan)
      expect(get(r, 1).pass).toBe(false)
      expect(get(r, 1).detail).toContain('does not exist')
    }, 60_000)
  })

  describe('check 17 on the real pixels', () => {
    // Tesseract spends over a minute on each testsrc2 frame, so the OCR here runs on
    // plain films: the gate on a short one, the claimed boxes on a blank one.
    it('runs the render gate and hands back its OCR samples', async () => {
      const probe = createPixelProbe()
      const missing = await probe.missingTooling()
      if (missing) {
        expect(missing).toContain('brew install tesseract')
        return
      }
      const plain = join(dir, 'plain.mp4')
      await ff(['-f', 'lavfi', '-i', 'color=c=0xfaf8f4:s=1080x1920:r=30:d=3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', plain])
      const run = await probe.gate(plain, { videoType: TYPE, silent: true, voStart: null, voEnd: null })
      expect(run.fails.join('\n')).toMatch(/LENGTH/)
      expect(run.samples.map((x) => x.t)).toEqual([0, 0.5, 1, 1.5, 2, 2.5])
    }, 240_000)

    it('reads the claimed boxes off the film and fails it: a film that draws none of the texts its manifest claims', async () => {
      const real = createPixelProbe()
      const missing = await real.missingTooling()
      const probe: PixelProbe = { ...real, gate: async () => ({ fails: [], info: {}, samples: [] }) }
      // Plain cream with the good film's manifest: every claimed text is absent from the pixels.
      const blankFilm = join(dir, 'blank-film.mp4')
      await ff(['-f', 'lavfi', '-i', 'color=c=0xfaf8f4:s=1080x1920:r=30:d=9', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', blankFilm])
      await writeManifest(blankFilm)
      const r = await checkVideo({ mp4Path: blankFilm }, { measure, pixels: probe, testPaths: { golden, registryPath: registry, ledgerPath: ledger } })
      const c17 = get(r, 17)
      expect(c17.pass).toBe(false)
      if (missing) expect(c17.detail).toContain('brew install tesseract')
      else expect(c17.detail).toContain('the pixels do not show card "Bend homes"')
    }, 240_000)
  })

  describe('contact sheet', () => {
    it('writes a 4 column grid of the contract frames, labelled when a font exists', async () => {
      const manifest = JSON.parse(readFileSync(good.replace(/\.mp4$/, '.manifest.json'), 'utf8'))
      const rules = typeRulesFor(TYPE, loadVideoTypes())!
      const out = join(dir, 'good.contact.png')
      const sheet = await writeContactSheet({ mp4Path: good, manifest, hookMaxS: rules.hook_max_s, outPath: out, measure })
      expect(existsSync(out)).toBe(true)
      expect(sheet.frames.length).toBeGreaterThanOrEqual(8)
      const rows = Math.ceil(sheet.frames.length / 4)
      expect(pngSize(readFileSync(out))).toEqual({ width: 4 * 270 + 5 * 6, height: rows * 480 + (rows + 1) * 6 })
      if (findFont()) expect(sheet.labelled).toBe(true)
      else expect(sheet.note).toContain('no font')
      const times = sheet.frames.map((f) => f.t)
      expect(times[0]).toBe(0)
      expect(times.some((t) => Math.abs(t - rules.hook_max_s) < 0.01)).toBe(true)
      expect(times.some((t) => Math.abs(t - 7.75) < 0.01)).toBe(true)
    }, 60_000)
  })

  describe('npm run video:check', () => {
    const tsx = resolve(process.cwd(), 'node_modules/.bin/tsx')
    // The CLI's check 17 runs with tesseract pointed at nothing: it must FAIL with the
    // install line (never pass), quickly, so these tests prove the rest of the run.
    const cli = (mp4: string, ...extra: string[]) =>
      execFileAsync(tsx, ['scripts/video-check.ts', mp4, '--golden', golden, '--registry', registry, '--ledger', join(dir, 'cli-ledger.jsonl'), ...extra], {
        cwd: process.cwd(),
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, TESSERACT_PATH: join(dir, 'no-tesseract-here') },
      })
        .then((r) => ({ code: 0, out: r.stdout }))
        .catch((e: { code?: number; stdout?: string }) => ({ code: e.code ?? 1, out: e.stdout ?? '' }))

    it('runs every check on the real film, writes the report and the contact sheet, and fails only the pixels and the test approval (no OCR here: it fails, never passes)', async () => {
      const r = await cli(good)
      expect(r.code).toBe(1)
      expect(r.out).toContain('Provenance')
      const report = JSON.parse(readFileSync(join(dir, 'good.check.json'), 'utf8')) as CheckReport
      // A registry passed on the command line approves only with "matt" (F1): its
      // test-only approval does not hold there, so check 15 fails with the floor.
      expect(failing(report).map((x) => x.split(':')[0])).toEqual(['15 Techniques ran', '17 Pixels'])
      expect(report.checks.find((c) => c.id === 15)?.detail).toContain('at least one approved signature technique')
      expect(report.checks.find((c) => c.id === 17)?.detail).toContain('tesseract is not installed')
      expect(report.overrides).toEqual({ golden, ledgerPath: join(dir, 'cli-ledger.jsonl'), registryPath: registry })
      expect(r.out).toContain('overrides used (draft run only)')
      expect(existsSync(join(dir, 'good.contact.png'))).toBe(true)
    }, 120_000)

    it('exits 1 on the frozen film and says which check failed', async () => {
      const r = await cli(frozen)
      expect(r.code).toBe(1)
      expect(r.out).toMatch(/6\s+Motion\s+FAIL/)
      expect(JSON.parse(readFileSync(join(dir, 'frozen.check.json'), 'utf8')).pass).toBe(false)
    }, 120_000)

    it('exits 2 for bad usage, including an override with --final', async () => {
      expect((await cli(join(dir, 'missing.mp4'))).code).toBe(2)
      expect((await cli(good, '--final')).code).toBe(2)
    }, 30_000)
  })
})
