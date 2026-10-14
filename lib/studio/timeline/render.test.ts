import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cueTexts, stillTimes } from '../motion/cues'
import type { DrawnText } from '../motion/render'
import { buildCaptions } from '../voice/captions'
import type { SpokenWord } from '../voice/types'
import { REPO_ROOT } from '../qa/thresholds'
import { endcardStartSeconds, planFilm, type FilmPlan } from './plan'
import { assertNotPublic, boundNumbers, checkoutRoots, proveTechniques, realPathOf, textsFromProbes, visibleSpans, builderOf } from './render'
import { studioFfmpeg } from './ffmpeg'
import { parseBrief, parseTimeline } from './validate'
import { shiftWords } from './voice'

const read = (p: string) => JSON.parse(readFileSync(join(REPO_ROOT, p), 'utf8'))

function sampleFilm(): FilmPlan {
  const b = parseBrief(read('lib/studio/timeline/fixtures/bend-mos.brief.json'))
  const t = parseTimeline(read('lib/studio/timeline/fixtures/bend-mos.timeline.json'))
  if (!b.ok || !t.ok) throw new Error('fixture invalid')
  const words = shiftWords(read('lib/studio/timeline/fixtures/bend-mos.words.json').words as SpokenWord[], 0.25)
  const captions = buildCaptions(words, { display: t.value.voice?.display, endLimitSeconds: endcardStartSeconds(t.value) })
  const footage: Record<string, { path: string; width: number; height: number; duration: number }> = {}
  for (const f of [...t.value.beats.map((x) => x.footage), t.value.cta?.footage]) if (f) footage[f.src] = { path: '/c.mp4', width: 1080, height: 1920, duration: 24 }
  return planFilm({ brief: b.value, timeline: t.value, voice: { words, captions }, footage, scored: true })
}

/** What a page that drew every planned text would report at each probe. */
function fakeProbes(film: FilmPlan, drop?: (cue: string) => boolean): Array<{ t: number; texts: DrawnText[] }> {
  const times = new Set<number>(stillTimes(film.plan).map((s) => s.t))
  for (const p of film.techniques) for (const proof of p.proofs) times.add(proof.t)
  return [...times].map((t) => ({
    t,
    texts: film.plan.cues
      .filter((c) => c.kind !== 'caption' || (t >= c.start && t < c.end))
      .filter((c) => !drop?.(c.id))
      .flatMap((c) =>
        [...cueTexts(c), ...(c.kind === 'meter' ? [...c.thresholds.map(String), '4 mo', '6 mo', `${Math.round(c.domainMax)} mo`] : [])]
          .filter(Boolean)
          .map((text) => ({ cue: c.id, text, x: 120, y: 400, w: 600, h: 100, opacity: 1 })),
      ),
  }))
}

describe('visibleSpans', () => {
  const film = sampleFilm()
  it('reads when a card is readable from the same curves the page applies', () => {
    const [span] = visibleSpans(film, 'hook-number-card')
    expect(span.start).toBeGreaterThan(0.1)
    expect(span.start).toBeLessThan(0.4)
    // The exit fade crosses half opacity a little before the card's end.
    expect(span.end).toBeGreaterThanOrEqual(3)
    expect(span.end).toBeLessThanOrEqual(3.3)
  })
})

describe('textsFromProbes', () => {
  const film = sampleFilm()
  it('records every drawn text with its cue kind and time, captions on their words', () => {
    const { texts, missing } = textsFromProbes(film, fakeProbes(film))
    expect(missing).toEqual([])
    expect(texts.find((t) => t.text === '3.5' && t.kind === 'card')?.start).toBeLessThan(0.4)
    expect(texts.filter((t) => t.kind === 'caption').length).toBe(film.plan.cues.filter((c) => c.kind === 'caption').length)
    expect(texts.find((t) => t.kind === 'cta')?.text).toBe("Send this to whoever you're house hunting with.")
    const call = texts.find((t) => t.text === 'Call now')!
    expect(call).toMatchObject({ kind: 'endcard', start: 13.45, end: 15.25 })
  })

  it('names a cue the page never drew', () => {
    const { missing } = textsFromProbes(film, fakeProbes(film, (id) => id === 'plan-text'))
    expect(missing).toEqual([expect.stringMatching(/^plan-text \(text\) drew no text/)])
  })
})

describe('boundNumbers', () => {
  const film = sampleFilm()
  it('binds each authored row to the boxes its cues drew, and leaves measured brief rows unbound', () => {
    const probes = fakeProbes(film).map((p) => ({
      ...p,
      // Give each drawn text its own box, so the binding is visible.
      texts: p.texts.map((d, i) => ({ ...d, y: 100 + i * 50 })),
    }))
    const { texts, cues } = textsFromProbes(film, probes)
    expect(cues).toHaveLength(texts.length)
    const bound = boundNumbers(film.numbers, texts, cues)
    expect(bound.ok).toBe(true)
    const row = (s: string) => bound.rows.find((r) => r.onScreen === s)!
    expect(row('3.5').boxes).toBeUndefined()
    expect(row('4').boxes).toHaveLength(1)
    expect(row('4 mo').boxes).toHaveLength(1)
    expect(row('As of Oct 13, 2026').boxes).toHaveLength(2)
    expect(bound.rows.every((r) => !('cues' in r))).toBe(true)
  })

  it('keeps a threshold row no card draws unbound (it covers nothing), and does not call it missing', () => {
    const { texts, cues } = textsFromProbes(film, fakeProbes(film))
    const r = boundNumbers([{ onScreen: '7', source: 's', window: 'none: a fixed threshold', geography: 'g', definition: 'd', cues: [] }], texts, cues)
    expect(r.ok).toBe(true)
    expect(r.rows).toEqual([{ onScreen: '7', source: 's', window: 'none: a fixed threshold', geography: 'g', definition: 'd' }])
  })

  it('reports an authored figure its cue never drew', () => {
    const { texts, cues } = textsFromProbes(film, fakeProbes(film))
    const r = boundNumbers([{ onScreen: '12 mo', source: 's', window: 'none', geography: 'g', definition: 'd', cues: ['supply-meter'] }], texts, cues)
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['"12 mo" (supply-meter)'])
  })
})

describe('proveTechniques', () => {
  const film = sampleFilm()
  it('records a technique only when its proof was on the page', () => {
    const ran = proveTechniques(film.techniques, fakeProbes(film), { scored: true, loopRan: true })
    expect(ran.every((r) => r.ran)).toBe(true)
    const missingHook = proveTechniques(film.techniques, fakeProbes(film, (id) => id === 'hook-number'), { scored: true, loopRan: true })
    const dollar = missingHook.find((r) => r.name === 'dollar_first_hook')!
    expect(dollar.ran).toBe(false)
    expect(dollar.why).toMatch(/not drawn: "3.5" \(hook-number\) at 1s/)
    const silent = proveTechniques(film.techniques, fakeProbes(film), { scored: false, loopRan: false })
    expect(silent.find((r) => r.name === 'composed_score')?.ran).toBe(false)
    expect(silent.find((r) => r.name === 'loop_seam_edit')?.ran).toBe(false)
  })
})

describe('assertNotPublic', () => {
  it('refuses any render path under public/, and allows out/', () => {
    expect(() => assertNotPublic(join(REPO_ROOT, 'public', 'v5_library', 'x'))).toThrow(/under a public\/ folder/)
    expect(() => assertNotPublic(join(REPO_ROOT, 'public'))).toThrow(/under a public\/ folder/)
    expect(() => assertNotPublic(join(REPO_ROOT, 'out', 'studio', 'x'))).not.toThrow()
    expect(() => assertNotPublic('/tmp/elsewhere')).not.toThrow()
  })

  it('refuses a public segment anywhere under the repo, in any case, through .. and symlinks, and under the main checkout', () => {
    // review finding: the guard compared one case-sensitive prefix of an unresolved path
    expect(() => assertNotPublic(join(REPO_ROOT, 'Public', 'x'))).toThrow(/public/)
    expect(() => assertNotPublic(join(REPO_ROOT, 'out', 'studio', 'public', 'x'))).toThrow(/public/)
    expect(() => assertNotPublic(join(REPO_ROOT, 'out', '..', 'public', 'x'))).toThrow(/public/)
    const tmp = mkdtempSync(join(tmpdir(), 'rr-guard-'))
    try {
      symlinkSync(join(REPO_ROOT, 'public'), join(tmp, 'link'))
      expect(() => assertNotPublic(join(tmp, 'link', 'new-folder', 'film'))).toThrow(/public/)
      expect(() => assertNotPublic(join(tmp, 'public', 'x'), [realPathOf(REPO_ROOT)])).not.toThrow()
      expect(() => assertNotPublic(join(tmp, 'public', 'x'), [realPathOf(tmp)])).toThrow(/public/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
    const roots = checkoutRoots()
    expect(roots[0]).toBe(realPathOf(REPO_ROOT))
    expect(roots.length).toBeGreaterThanOrEqual(1)
  })
})

describe('studioFfmpeg', () => {
  it('is the check\'s own resolver: FFMPEG_PATH (which must exist), then the system build', async () => {
    const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv
    expect(await studioFfmpeg(env({ FFMPEG_PATH: '/opt/ff/ffmpeg' }), (p) => p.startsWith('/opt/ff/') || p.startsWith('/usr/bin/'))).toBe('/opt/ff/ffmpeg')
    expect(await studioFfmpeg(env({}), (p) => p.startsWith('/usr/bin/'))).toBe('/usr/bin/ffmpeg')
    await expect(studioFfmpeg(env({ FFMPEG_PATH: '/gone/ffmpeg' }), (p) => p.startsWith('/usr/bin/'))).rejects.toThrow(/does not exist/)
  })
})

describe('builderOf (F11)', () => {
  it('takes the builder from STUDIO_BUILDER in the environment, else claude; there is no CLI flag', async () => {
    expect(builderOf({ STUDIO_BUILDER: 'grok-desk' })).toBe('grok-desk')
    expect(builderOf({ STUDIO_BUILDER: '  ' })).toBe('claude')
    expect(builderOf({})).toBe('claude')
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('scripts/studio-render.ts', 'utf8')).not.toContain('--built-by')
  })
})
