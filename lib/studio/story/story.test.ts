import { describe, expect, it } from 'vitest'
import { grokApiKey, rawTicks } from '@/lib/grok/client'
import { resolutionFor, MAX_REFERENCE_IMAGES } from '@/lib/grok/video'
import { STORY_FRAME_DEFECTS, FRAME_DEFECTS } from '@/lib/grok/vision'
import { findBannedTokens } from '../craft'
import { planStory, VISITOR_ARC } from './arc'
import { BEATS, beatFits, getBeat } from './beats'
import { ERAS, getEra, judgeContextFor, labParamsFor } from './eras'
import { getStoryPiece, STORY_PIECES } from './pieces'
import { storyShotPrompts } from './shots'

const piece = getStoryPiece('winter-1982')!
const era = getEra('super8_1982')!

describe('visitor arc', () => {
  it('fills every role of the winter 1982 piece with a beat that fits the year and season', () => {
    const plan = planStory({ era, season: piece.season, beats: piece.beats, omit: piece.omit })
    // Matt 2026-09-23: no phone, no call, no price; the sign is in the yard when she points.
    const roles = plan.shots.map((s) => s.role)
    for (const gone of ['phone', 'call', 'break', 'sign']) expect(roles, gone).not.toContain(gone)
    expect(roles.slice(-2)).toEqual(['stay', 'end'])
    for (const shot of plan.shots) {
      if (shot.kind !== 'generated') continue
      expect(shot.beat, shot.role).not.toBeNull()
      expect(beatFits(shot.beat!, 1982, 'winter'), shot.role).toBe(true)
    }
    expect(plan.shots.at(-1)?.kind).toBe('end_card')
  })

  it('keeps one dog: every beat with the companion gets its reference, and the piece has one', () => {
    expect(piece.companion?.ref).toMatch(/^asset:/)
    const plan = planStory({ era, season: piece.season, beats: piece.beats, omit: piece.omit })
    const withDog = plan.shots.filter((s) => s.beat?.companion).map((s) => s.role)
    expect(withDog).toEqual(expect.arrayContaining(['town', 'discover', 'stay']))
    for (const shot of plan.shots) {
      if (shot.beat && /labrador|dog/i.test(shot.beat.action) && shot.role !== 'hook') {
        expect(shot.beat.companion, shot.beat.id).toBe(true)
      }
    }
  })

  it('keeps the full-frame break for a phone beat that is not composited in the film', () => {
    const plan = planStory({
      era,
      season: piece.season,
      beats: { ...piece.beats, phone: 'phone-out', call: 'on-the-phone' },
    })
    expect(plan.shots).toHaveLength(VISITOR_ARC.length)
    expect(plan.shots.find((s) => s.role === 'break')?.kind).toBe('phone_ui')
  })

  it('keeps après for a winter piece and drops the optional slot where no beat fits (no summer après)', () => {
    expect(planStory({ era, season: 'winter', beats: piece.beats }).shots.some((s) => s.role === 'apres')).toBe(true)
    const arc = VISITOR_ARC.filter((slot) => ['hook', 'apres', 'end'].includes(slot.role))
    const summer = planStory({ era, season: 'summer', arc })
    expect(summer.shots.map((s) => s.role)).toEqual(['hook', 'end'])
    expect(summer.shots.map((s) => s.index)).toEqual([0, 1])
  })

  it('pins the Tower dinner to the years the Tower was a movie house on Wall Street', () => {
    const tower = BEATS.find((b) => b.id === 'supper-tower-window')!
    expect(tower.years[0]).toBe(1940)
    expect(tower.composite).toBe('marquee')
    expect(tower.refs.every((r) => r.startsWith('asset:') && !r.includes('PENDING'))).toBe(true)
  })

  it('moves only the sign still in the lab; every other composite shot still gets motion', () => {
    for (const beat of BEATS.filter((b) => b.composite)) {
      expect(beat.stillOnly === true, beat.id).toBe(beat.id === 'yard-sign-bungalow')
    }
  })

  it('refuses a pinned beat that cannot honestly appear in the era', () => {
    // Skiing opened on Bachelor Butte in 1958; a 1955 reel cannot ski there.
    expect(() => planStory({ era: ERAS.bw16mm_1955, season: 'winter', beats: { play: 'ski-toward-lens' } })).toThrow(
      /cannot appear/,
    )
  })

  it('refuses a pinned beat in the wrong role', () => {
    expect(() => planStory({ era, season: 'winter', beats: { play: 'car-wave' } })).toThrow(/hook beat/)
  })

  it('lands on a runtime in the platform sweet spot', () => {
    const plan = planStory({ era, season: piece.season, beats: piece.beats })
    expect(plan.totalSeconds).toBeGreaterThanOrEqual(30)
    expect(plan.totalSeconds).toBeLessThanOrEqual(45)
  })

  it('every place beat in the winter piece carries a real reference still', () => {
    const plan = planStory({ era, season: piece.season, beats: piece.beats })
    expect(plan.warnings.filter((w) => w.includes('reference test'))).toEqual([])
  })
})

describe('story prompts', () => {
  const prompts = (id: string) =>
    storyShotPrompts({ beat: getBeat(id)!, era, cast: piece.cast, sources: ['a reference'] })

  it('never carries booster tokens', () => {
    for (const beat of BEATS.filter((b) => beatFits(b, 1982, 'winter'))) {
      const p = storyShotPrompts({ beat, era, cast: piece.cast })
      expect(findBannedTokens(p.still), beat.id).toEqual([])
      expect(findBannedTokens(p.motion), beat.id).toEqual([])
    }
  })

  it('keeps downtown out of the mountain (era street cues only where a beat asks)', () => {
    // 2026-09-23: a shared street cue put brick storefronts under the ski run.
    expect(prompts('ski-toward-lens').still).not.toMatch(/storefront/i)
    expect(prompts('chairlift-selfie').still).not.toMatch(/storefront/i)
    expect(prompts('road-to-bachelor').still).not.toMatch(/storefront/i)
    expect(prompts('downtown-night-bike').still).toMatch(/storefront/i)
  })

  it('gives each person their own hair cues (no moustache on the woman)', () => {
    // 2026-09-23: a shared "full moustaches" cue put a moustache on her in two of three takes.
    for (const e of Object.values(ERAS)) {
      expect(e.period.hair.she, e.id).not.toMatch(/moustache|mustache|beard/i)
    }
    expect(prompts('car-wave').still).not.toMatch(/moustache/i)
  })

  it('dresses the cast from the piece, not from the era list', () => {
    const still = prompts('ski-toward-lens').still
    expect(still).toContain(piece.cast.A.wardrobe.ski!)
    expect(still).not.toMatch(/down vests, cable-knit turtlenecks/)
  })

  it('phrases vehicles conditionally so cars do not appear in every frame', () => {
    expect(prompts('car-wave').still).toMatch(/any car in frame is/)
  })

  it('states positives only: no "no text" style negatives that induce what they name', () => {
    for (const id of [
      'car-wave',
      'yard-sign-bungalow',
      'phone-out',
      'supper-tower-window',
      'phone-glow',
      'call-deadpan',
    ]) {
      expect(prompts(id).still, id).not.toMatch(/\bno (text|signage|lettering|logos)\b/i)
    }
  })

  it('never asks the generator for a zoom (zooms are exact in the film lab)', () => {
    for (const beat of BEATS.filter((b) => beatFits(b, 1982, 'winter'))) {
      expect(storyShotPrompts({ beat, era, cast: piece.cast }).motion, beat.id).toMatch(/no zoom/)
    }
  })
})

describe('era packs', () => {
  it('every era carries a complete lab contract', () => {
    for (const e of Object.values(ERAS)) {
      const lab = labParamsFor(e, 'night')
      expect(lab.exposure).toBe('night')
      expect(lab.fps).toBeGreaterThan(0)
      expect(lab.resolve).toBeGreaterThan(0)
      expect(lab.resolve).toBeLessThanOrEqual(1)
      expect(lab.gate.width / lab.gate.height).toBeCloseTo(4 / 3, 2)
    }
  })

  it('tells the judge the year and that the cast is intended', () => {
    const ctx = judgeContextFor(era)
    expect(ctx).toContain('1982')
    expect(ctx).toMatch(/cast/)
  })

  it('every piece names a real era', () => {
    for (const p of STORY_PIECES) expect(getEra(p.eraId), p.id).not.toBeNull()
  })
})

describe('grok surface for story films', () => {
  it('story frames drop person_present and add the period and identity defects', () => {
    expect(STORY_FRAME_DEFECTS).not.toContain('person_present')
    expect(STORY_FRAME_DEFECTS).toContain('anachronism')
    expect(STORY_FRAME_DEFECTS).toContain('cast_mismatch')
    expect(FRAME_DEFECTS).toContain('person_present')
  })

  it('caps reference-to-video at 720p and leaves image-to-video alone', () => {
    expect(resolutionFor('1080p', true)).toBe('720p')
    expect(resolutionFor(undefined, true)).toBe('720p')
    expect(resolutionFor('1080p', false)).toBe('1080p')
    expect(resolutionFor('480p', true)).toBe('480p')
    expect(MAX_REFERENCE_IMAGES).toBe(7)
  })
})

describe('fiscal controls', () => {
  it('bills a creative process to the creative key only when one exists', () => {
    const saved = { a: process.env.XAI_API_KEY, c: process.env.XAI_CREATIVE_API_KEY, b: process.env.GROK_BILLING }
    try {
      process.env.XAI_API_KEY = 'prod-key'
      process.env.XAI_CREATIVE_API_KEY = 'creative-key'
      process.env.GROK_BILLING = 'creative'
      expect(grokApiKey()).toBe('creative-key')
      delete process.env.GROK_BILLING
      expect(grokApiKey()).toBe('prod-key')
      process.env.GROK_BILLING = 'creative'
      delete process.env.XAI_CREATIVE_API_KEY
      expect(grokApiKey()).toBe('prod-key')
    } finally {
      for (const [k, v] of [
        ['XAI_API_KEY', saved.a],
        ['XAI_CREATIVE_API_KEY', saved.c],
        ['GROK_BILLING', saved.b],
      ] as const) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })

  it('keeps the raw tick count so the ledger reconciles to the invoice', () => {
    expect(rawTicks(400_000_000)).toBe(400_000_000)
    expect(rawTicks(undefined)).toBeNull()
    expect(rawTicks(Number.NaN)).toBeNull()
  })

  it('the cinema register is a complete, sprocketless pack with the tripod grammar available', () => {
    const cine = getEra('cine16_1978')!
    expect(cine.lab.stock).toBe('cine_pastel')
    expect(cine.lab.gate.sprockets).toBe('none')
    expect(cine.lab.startFlash).toBe(0)
  })
})
