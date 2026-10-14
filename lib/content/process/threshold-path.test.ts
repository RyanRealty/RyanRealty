import { describe, expect, it } from 'vitest'
import { compareResolved, compareValue, effectiveFor, resolveThreshold, type ThresholdData } from './threshold-path'

const data: ThresholdData = {
  qa: { audio: { lufsMin: -15, truePeakMaxDb: -1 }, caps: { boards: 3 }, extra_banned_phrases: ['top team'], word: 'x' },
  videoTypes: {
    defaults: { min_hold_s: 2.5, max_s: 30, requires_end_card: true, label: 'x' },
    types: { story_teaser: { max_s: 15 }, brand_film: { max_s: 90 }, buyer_ad: { requires_persona: true } },
    banned_phrases: ['nestled', 'vibrant'],
    fair_housing_flags: ['families'],
  },
}

describe('resolveThreshold', () => {
  it('reads a dot path into the QA data', () => {
    expect(resolveThreshold({ source: 'qa', path: 'audio.lufsMin', tighterIs: 'higher' }, data)).toEqual({ value: -15 })
    expect(resolveThreshold({ source: 'qa', path: 'caps.boards', tighterIs: 'lower' }, data)).toEqual({ value: 3 })
    expect(resolveThreshold({ source: 'qa', path: 'extra_banned_phrases', tighterIs: 'higher' }, data)).toEqual({ value: ['top team'] })
  })

  it('reads defaults.K with the value of every type that sets its own', () => {
    expect(resolveThreshold({ source: 'video_types', path: 'defaults.max_s', tighterIs: 'lower' }, data)).toEqual({ value: 30, perType: { story_teaser: 15, brand_film: 90 } })
    expect(resolveThreshold({ source: 'video_types', path: 'defaults.min_hold_s', tighterIs: 'higher' }, data)).toEqual({ value: 2.5 })
  })

  it('reads types.T.K merged over the defaults, and the two lists', () => {
    expect(resolveThreshold({ source: 'video_types', path: 'types.story_teaser.max_s', tighterIs: 'lower' }, data)).toEqual({ value: 15 })
    expect(resolveThreshold({ source: 'video_types', path: 'types.story_teaser.min_hold_s', tighterIs: 'higher' }, data)).toEqual({ value: 2.5 })
    expect(resolveThreshold({ source: 'video_types', path: 'types.buyer_ad.requires_persona', tighterIs: 'higher' }, data)).toEqual({ value: true })
    expect(resolveThreshold({ source: 'video_types', path: 'banned_phrases', tighterIs: 'higher' }, data)).toEqual({ value: ['nestled', 'vibrant'] })
  })

  it('throws when a path leads nowhere or to something that is not a number, a boolean or a list', () => {
    for (const spec of [
      { source: 'qa', path: 'audio.nothing' },
      { source: 'qa', path: 'word' },
      { source: 'video_types', path: 'defaults.label' },
      { source: 'video_types', path: 'defaults.nope' },
      { source: 'video_types', path: 'types.made_up.max_s' },
      { source: 'video_types', path: 'whatever' },
    ] as const) {
      expect(() => resolveThreshold({ ...spec, tighterIs: 'lower' }, data), spec.path).toThrow(/threshold/)
    }
  })

  it('gives each type its effective value', () => {
    const r = resolveThreshold({ source: 'video_types', path: 'defaults.max_s', tighterIs: 'lower' }, data)
    expect(effectiveFor(r, 'story_teaser')).toBe(15)
    expect(effectiveFor(r, 'listing')).toBe(30)
  })
})

describe('compareValue', () => {
  it('a lower number is tighter when lower is tighter, and looser when higher is', () => {
    expect(compareValue(30, 25, 'lower')).toBe('tighter')
    expect(compareValue(30, 35, 'lower')).toBe('looser')
    expect(compareValue(2.5, 3, 'higher')).toBe('tighter')
    expect(compareValue(2.5, 2, 'higher')).toBe('looser')
    expect(compareValue(2.5, 2.5, 'higher')).toBe('same')
  })

  it('reads a boolean as 0 or 1', () => {
    expect(compareValue(true, false, 'higher')).toBe('looser')
    expect(compareValue(false, true, 'higher')).toBe('tighter')
  })

  it('compares a list as a set: more is tighter, any item gone is looser', () => {
    expect(compareValue(['a', 'b'], ['a', 'b', 'c'], 'higher')).toBe('tighter')
    expect(compareValue(['a', 'b'], ['a'], 'higher')).toBe('looser')
    expect(compareValue(['a', 'b'], ['b', 'c'], 'higher')).toBe('looser')
    expect(compareValue(['a', 'b'], ['b', 'a'], 'higher')).toBe('same')
  })

  it('a reading that is gone or changed kind is looser: nothing passes by default', () => {
    expect(compareValue(3, undefined, 'lower')).toBe('looser')
    expect(compareValue(3, ['a'], 'lower')).toBe('looser')
    expect(compareValue(['a'], 3, 'higher')).toBe('looser')
  })
})

describe('compareResolved', () => {
  const baseline = { value: 30, perType: { story_teaser: 15, brand_film: 90 } }

  it('finds nothing when nothing moved', () => {
    expect(compareResolved(baseline, baseline, 'lower', ['listing', 'story_teaser', 'brand_film'])).toEqual([])
  })

  it('names a loosened default', () => {
    const out = compareResolved(baseline, { ...baseline, value: 35 }, 'lower', ['listing', 'story_teaser', 'brand_film'])
    expect(out.map((o) => [o.where, o.comparison])).toEqual([['value', 'looser'], ['type listing', 'looser']])
  })

  it('names a type that loosened its own number, and one that tightened', () => {
    const out = compareResolved(baseline, { value: 30, perType: { story_teaser: 20, brand_film: 60 } }, 'lower', ['story_teaser', 'brand_film'])
    expect(out.map((o) => [o.where, o.comparison])).toEqual([['type story_teaser', 'looser'], ['type brand_film', 'tighter']])
  })

  it('holds a new type to the default, so a looser new type is named', () => {
    const out = compareResolved(baseline, { value: 30, perType: { ...baseline.perType, podcast: 120 } }, 'lower', ['story_teaser', 'brand_film', 'podcast'])
    expect(out.map((o) => [o.where, o.comparison])).toEqual([['type podcast', 'looser']])
  })

  it('a type that no longer exists is not a loosening', () => {
    expect(compareResolved(baseline, { value: 30, perType: { story_teaser: 15 } }, 'lower', ['story_teaser'])).toEqual([])
  })

  it('a threshold that no longer resolves is looser', () => {
    expect(compareResolved(baseline, null, 'lower', []).map((o) => o.comparison)).toEqual(['looser'])
  })
})
