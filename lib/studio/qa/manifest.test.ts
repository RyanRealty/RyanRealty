import { describe, expect, it } from 'vitest'
import { formatManifestIssues, parseManifest, parseManifestJson, safeSlug } from './manifest'

function validManifestJson(): Record<string, unknown> {
  return {
    factory: 'lib/studio',
    manifestVersion: 2,
    video: { file: 'final.mp4', sha256: 'A'.repeat(64), width: 1080, height: 1920, fps: 30, duration: 27.5 },
    videoType: 'buyer_ad',
    techniques: ['eased_number_reveal'],
    beats: [
      { id: 'hook', role: 'hook', start: 0, end: 3.1 },
      { id: 'body', role: 'body', start: 3.1, end: 24.45 },
      { id: 'end', role: 'endcard', start: 24.45, end: 27.5 },
    ],
    texts: [{ text: '63% cut their price', start: 0.2, end: 3.1, box: { x: 90, y: 400, w: 860, h: 220 }, kind: 'card' }],
    numbers: [{ onScreen: '63%', source: 'Supabase', window: '2026-07-01..2026-09-30', geography: 'Bend', definition: 'share of listings with a cut' }],
    voice: { engine: 'elevenlabs', model: 'eleven_v3', voiceId: 'abc', words: [{ word: 'Okay,', start: 0.12, end: 0.41 }] },
    captions: [{ text: 'OKAY', start: 0.12, end: 0.71, words: [0] }],
    audio: { lufs: -14.0, truePeakDb: -1.7, silent: false },
    endcard: { start: 24.45, quality: 24.45, local: 24.85, service: 25.25, call: 25.7, out: 27.5 },
    loop: { seconds: 0.3 },
    builtBy: 'claude',
    briefSha256: 'B'.repeat(64),
    slug: 'bend-go-in-with-a-plan',
    creative: { feel: 'satisfying', constraint: 'one figure per beat', lineage: 'Swiss typographic posters', one_sentence: 'One number, read on a ruler.' },
  }
}

const paths = (raw: unknown, opts = {}) => {
  const r = parseManifest(raw, opts)
  return r.ok ? [] : r.errors.map((e) => `${e.code}:${e.path}`)
}

describe('parseManifest', () => {
  it('accepts the contract example and lowercases the hash', () => {
    const r = parseManifest(validManifestJson())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.manifest.video.sha256).toBe('a'.repeat(64))
      expect(r.manifest.beats).toHaveLength(3)
      expect(r.manifest.voice?.words[0].word).toBe('Okay,')
    }
  })

  it('accepts null voice, null endcard, null loop and a silent audio block', () => {
    const m = { ...validManifestJson(), voice: null, endcard: null, loop: null, audio: { lufs: null, truePeakDb: null, silent: true }, captions: [] }
    expect(parseManifest(m).ok).toBe(true)
  })

  it('accepts builtBy and briefTechniques, and lowercases the brief hash', () => {
    const r = parseManifest({ ...validManifestJson(), builtBy: 'claude', briefTechniques: ['a'] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.manifest.builtBy).toBe('claude')
      expect(r.manifest.briefTechniques).toEqual(['a'])
      expect(r.manifest.briefSha256).toBe('b'.repeat(64))
      expect(r.manifest.slug).toBe('bend-go-in-with-a-plan')
    }
  })

  it('requires builtBy, the brief hash and a clean slug', () => {
    const m = validManifestJson() as any
    delete m.builtBy
    delete m.briefSha256
    m.slug = '../Public'
    expect(paths(m)).toEqual(expect.arrayContaining(['missing:builtBy', 'missing:briefSha256', 'range:slug']))
    expect(paths({ ...validManifestJson(), briefSha256: 'abc' })).toContain('range:briefSha256')
  })

  it('reads an authored row\'s boxes and refuses an empty list', () => {
    const m = validManifestJson() as any
    m.numbers.push({ onScreen: '4 mo', source: 's', window: 'none: x', geography: 'g', definition: 'd', boxes: [{ x: 1, y: 2, w: 3, h: 4 }] })
    const r = parseManifest(m)
    expect(r.ok && r.manifest.numbers[1].boxes).toEqual([{ x: 1, y: 2, w: 3, h: 4 }])
    m.numbers[1].boxes = []
    expect(paths(m)).toContain('range:numbers[1].boxes')
    m.numbers[1].boxes = [{ x: 1 }]
    expect(paths(m)).toContain('missing:numbers[1].boxes[0].y')
  })

  it('rejects a root that is not an object', () => {
    expect(paths(null)).toEqual(['not_object:'])
    expect(paths([])).toEqual(['not_object:'])
    expect(paths('x')).toEqual(['not_object:'])
  })

  it('names every missing top level key', () => {
    const r = parseManifest({})
    expect(r.ok).toBe(false)
    if (!r.ok) {
      const missing = r.errors.filter((e) => e.code === 'missing').map((e) => e.path)
      for (const k of ['factory', 'manifestVersion', 'video', 'videoType', 'techniques', 'beats', 'texts', 'numbers', 'voice', 'captions', 'audio', 'endcard', 'loop']) {
        expect(missing).toContain(k)
      }
    }
  })

  it('rejects wrong types with the path of the bad field', () => {
    const m = validManifestJson() as any
    m.video.width = '1080'
    m.beats[1].start = 'x'
    m.texts[0].box.h = null
    m.audio.silent = 'no'
    expect(paths(m)).toEqual(expect.arrayContaining(['type:video.width', 'type:beats[1].start', 'type:texts[0].box.h', 'type:audio.silent']))
  })

  it('rejects an unknown manifest version, a short hash and an unknown role or kind', () => {
    const m = validManifestJson() as any
    m.manifestVersion = 1
    m.video.sha256 = 'abc'
    m.beats[0].role = 'intermission'
    m.texts[0].kind = 'sticker'
    expect(paths(m)).toEqual(expect.arrayContaining(['range:manifestVersion', 'range:video.sha256', 'enum:beats[0].role', 'enum:texts[0].kind']))
  })

  it('rejects beats that run backwards, overlap their order, or are empty', () => {
    const a = validManifestJson() as any
    a.beats[0].end = 0
    expect(paths(a)).toContain('range:beats[0].end')
    const b = validManifestJson() as any
    b.beats = [b.beats[2], b.beats[0]]
    expect(paths(b)).toContain('order:beats[1].role')
    const c = validManifestJson() as any
    c.beats = []
    expect(paths(c)).toContain('range:beats')
  })

  it('rejects unknown keys unless told to allow them', () => {
    const m = { ...validManifestJson(), endCard: {} }
    expect(paths(m)).toContain('unknown_key:endCard')
    expect(paths(m, { allowUnknownKeys: true })).toEqual([])
    const n = validManifestJson() as any
    n.video.codec = 'h264'
    expect(paths(n)).toContain('unknown_key:video.codec')
  })

  it('requires voice, endcard and loop keys to be present even when null is allowed', () => {
    const m = validManifestJson() as any
    delete m.voice
    delete m.endcard
    delete m.loop
    expect(paths(m)).toEqual(expect.arrayContaining(['missing:voice', 'missing:endcard', 'missing:loop']))
  })

  it('keeps a numbers row with absent trace fields so check 9 can name them', () => {
    const m = validManifestJson() as any
    m.numbers = [{ onScreen: '63%' }]
    const r = parseManifest(m)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.manifest.numbers[0].source).toBeUndefined()
    m.numbers = [{ onScreen: '' }]
    expect(paths(m)).toContain('range:numbers[0].onScreen')
  })

  it('checks caption indices, voice words and the endcard times', () => {
    const m = validManifestJson() as any
    m.captions[0].words = [0.5]
    m.voice.words = []
    m.endcard.call = 'late'
    expect(paths(m)).toEqual(expect.arrayContaining(['type:captions[0].words[0]', 'range:voice.words', 'type:endcard.call']))
  })

  it('rejects a loop with no seconds and a non-finite number', () => {
    const m = validManifestJson() as any
    m.loop = { seconds: 0 }
    m.video.duration = Number.NaN
    expect(paths(m)).toEqual(expect.arrayContaining(['range:loop.seconds', 'type:video.duration']))
  })
})

describe('parseManifestJson', () => {
  it('reports a syntax error as a json issue', () => {
    const r = parseManifestJson('{ nope')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].code).toBe('json')
  })

  it('parses valid text', () => {
    expect(parseManifestJson(JSON.stringify(validManifestJson())).ok).toBe(true)
  })
})

describe('safeSlug', () => {
  it('keeps a to z, 0 to 9 and single dashes, and never returns a path', () => {
    expect(safeSlug('Bend: go in with a plan')).toBe('bend-go-in-with-a-plan')
    expect(safeSlug('../../public/x')).toBe('public-x')
    expect(safeSlug('..')).toBe('film')
    expect(safeSlug('a'.repeat(80))).toHaveLength(60)
    expect(safeSlug(`${'a'.repeat(59)}-b`)).toBe('a'.repeat(59))
  })
})

describe('formatManifestIssues', () => {
  it('joins issues with their paths and caps the list', () => {
    const issues = Array.from({ length: 10 }, (_, i) => ({ code: 'type' as const, path: `a${i}`, message: `bad ${i}` }))
    const text = formatManifestIssues(issues, 3)
    expect(text).toContain('a0: bad 0')
    expect(text).toContain('and 7 more')
  })
})
