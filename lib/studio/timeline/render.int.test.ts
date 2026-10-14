/**
 * The timeline renderer end to end, against real Chromium and real ffmpeg,
 * with no network and no paid API.
 *
 * A 1920x1080 clip is synthesized (ffmpeg testsrc2, so the plate must cover and
 * crop it to 9:16), the voice is a stub that returns a fixture alignment and a
 * synthesized tone, and the film runs the question + secret hook, burned-in
 * captions, the composed score, the locked end card and the loop seam. The
 * finished MP4 then goes through video:check, which must pass checks 1 to 13
 * on the file itself.
 *
 * Skips loudly without Chromium or ffmpeg, like the other media int tests.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchMotionChrome, motionChromePath } from '../motion/endcard-render'
import { checkVideo } from '../qa/check'
import { parseManifestJson } from '../qa/manifest'
import { resolveBinary } from '../qa/measure'
import type { CharacterAlignment, Synthesis } from '../voice'
import { renderTimelineFilm } from './render'
import type { VoiceProvider } from './voice'

const ffmpeg = resolveBinary('ffmpeg')
const hasMedia = spawnSync(ffmpeg, ['-version']).status === 0 && spawnSync(resolveBinary('ffprobe'), ['-version']).status === 0
const hasChrome = existsSync(motionChromePath())
if (!hasMedia || !hasChrome) console.warn('[timeline render.int] ffmpeg, ffprobe or Chromium not found: skipping.')

const SCRIPT = '[warm] Buying in Bend this fall? Here is what most buyers miss.'

/** Word times on the voice's own clock: the question by 1.3 s, the turn after it. */
const WORDS: Array<[string, number, number]> = [
  ['Buying', 0.05, 0.32],
  ['in', 0.36, 0.44],
  ['Bend', 0.48, 0.74],
  ['this', 0.78, 0.94],
  ['fall?', 0.98, 1.3],
  ['Here', 1.62, 1.8],
  ['is', 1.84, 1.92],
  ['what', 1.96, 2.14],
  ['most', 2.18, 2.42],
  ['buyers', 2.46, 2.8],
  ['miss.', 2.84, 3.2],
]

/** A character alignment for SCRIPT that says exactly WORDS (the tag and spaces get the gap times). */
function alignment(): CharacterAlignment {
  const characters: string[] = []
  const starts: number[] = []
  const ends: number[] = []
  let cursor = 0
  let w = 0
  let i = 0
  while (i < SCRIPT.length) {
    const rest = SCRIPT.slice(i)
    const word = WORDS[w]
    if (word && rest.startsWith(word[0])) {
      const [text, s, e] = word
      for (let k = 0; k < text.length; k++) {
        characters.push(text[k])
        starts.push(s + ((e - s) * k) / text.length)
        ends.push(s + ((e - s) * (k + 1)) / text.length)
      }
      cursor = e
      i += text.length
      w++
    } else {
      characters.push(SCRIPT[i])
      starts.push(cursor)
      ends.push(cursor)
      i++
    }
  }
  return { characters, characterStartTimesSeconds: starts, characterEndTimesSeconds: ends }
}

/** 16-bit mono PCM at 48 kHz: a soft voiced tone during each word, silence between. */
function tonePcm(): Buffer {
  const rate = 48000
  const n = Math.round(3.5 * rate)
  const out = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    const on = WORDS.some(([, s, e]) => t >= s && t < e)
    const v = on ? 0.3 * Math.sin(2 * Math.PI * 220 * t) + 0.1 * Math.sin(2 * Math.PI * 440 * t) : 0
    out.writeInt16LE(Math.round(v * 32767), i * 2)
  }
  return out
}

const stubVoice: VoiceProvider = async (request) => {
  const synthesis: Synthesis = {
    engine: 'elevenlabs',
    model: request.model,
    voiceId: request.voiceId,
    text: request.text,
    voiceSettings: null,
    outputFormat: 'pcm_48000',
    audio: tonePcm(),
    alignment: alignment(),
    normalizedAlignment: null,
    requestId: null,
    refusedFormats: [],
  }
  return synthesis
}

let dir = ''
let clip = ''

describe.skipIf(!hasMedia || !hasChrome)('studio:render, a 7.5 s film with no network and no paid API', () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rr-timeline-int-'))
    clip = join(dir, 'clip.mp4')
    const r = spawnSync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30:d=6',
      '-f', 'lavfi', '-i', 'sine=frequency=1000:d=6',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', clip,
    ])
    if (r.status !== 0) throw new Error(`could not synthesize the clip: ${r.stderr}`)
  })

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('renders through lib/studio and passes video:check checks 1 to 13 on the file', async () => {
    const brief = {
      video_type: 'story_teaser',
      title: 'Timeline int film',
      techniques: ['question_secret_hook', 'tiktok_caption_burn', 'loop_seam_edit', 'composed_score'],
      numbers: [],
      spec_rules: { loopable: true, voiceover: { engine: 'elevenlabs_v3', script: SCRIPT } },
    }
    const timeline = {
      fps: 30,
      score: 'calm',
      voice: { script: SCRIPT, voice: 'ellen', start: 0.3 },
      beats: [
        {
          id: 'hook',
          role: 'hook',
          start: 0,
          end: 4.4,
          footage: { src: 'clip.mp4', in: 0.5 },
          cards: [
            { kind: 'question', text: 'Buying in Bend this fall?' },
            { kind: 'turn', text: 'Here is what most buyers miss.' },
          ],
        },
        { id: 'end', role: 'endcard', start: 4.4, end: 7.45 },
      ],
    }
    const outDir = join(dir, 'film')
    const result = await renderTimelineFilm(
      { brief, timeline, baseDir: dir, outDir, cacheDir: join(dir, 'cache'), builtBy: 'int-test', voiceId: 'stub-voice' },
      { ffmpeg, voiceProvider: stubVoice, launchBrowser: launchMotionChrome },
    )

    // The plate covered and cropped the 16:9 clip at one scale, and said so.
    expect(result.plate[0].crop).toMatchObject({ scaledHeight: 1920, axis: 'x', upscaled: true })
    expect(result.plate.at(-1)?.kind).toBe('opening')

    // Every technique the brief names ran, proven off the page.
    expect(result.techniques.filter((t) => !t.ran)).toEqual([])
    expect(result.manifest.techniques).toEqual(expect.arrayContaining(brief.techniques))

    // The manifest on disk is the one the check reads, and it parses clean.
    const parsed = parseManifestJson(readFileSync(result.manifestPath, 'utf8'))
    expect(parsed.ok).toBe(true)
    expect(result.manifest.captions.length).toBeGreaterThan(1)
    expect(result.manifest.voice?.words.map((w) => w.word)).toEqual(WORDS.map(([w]) => w))
    expect(result.manifest.voice?.words[0].start).toBeCloseTo(0.35, 3)

    const report = await checkVideo({
      mp4Path: result.mp4Path,
      manifestPath: result.manifestPath,
      briefPath: result.briefPath,
      ledgerPath: join(dir, 'ledger.jsonl'),
    })
    writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2))
    const failing = report.checks.filter((c) => c.id <= 13 && !c.pass).map((c) => `${c.id} ${c.name}: ${c.detail}`)
    expect(failing).toEqual([])
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) expect(report.checks.find((c) => c.id === id)?.pass, `check ${id}`).toBe(true)
    expect(report.checks.find((c) => c.id === 15)?.pass).toBe(false) // no scene device in this tiny film: check 15 says so
  }, 300_000)
})
