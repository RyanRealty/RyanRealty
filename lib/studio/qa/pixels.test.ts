import { describe, expect, it } from 'vitest'
import type { Manifest } from './manifest'
import { PHONE_TOKENS, PIXEL_GATE_WRAPPER, RENDER_GATE_PATH, boxClaims, captionsWithoutBoxes, claimConfirmed, figureKey, figureShaped, gateFindings, listedFigures, pixelGateArgs, unlistedFigures } from './pixels'

const box = { x: 90, y: 400, w: 860, h: 220 }
const texts: Manifest['texts'] = [
  { text: '3.5', start: 0.2, end: 3, box, kind: 'card' },
  { text: 'has 3.5 months', start: 1.2, end: 2.4, box: { x: 200, y: 1213, w: 600, h: 92 }, kind: 'caption' },
  { text: 'Quality', start: 12.2, end: 15.25, box: { x: 131, y: 899, w: 279, h: 72 }, kind: 'endcard' },
]
const captions: Manifest['captions'] = [{ text: 'has 3.5 months', start: 1.2, end: 2.4, words: [0, 1, 2] }]

describe('gateFindings', () => {
  const rules = { requires_loop: true, requires_end_card: true }
  it('leaves the 15 to 30 s LENGTH to check 3 and keeps everything else', () => {
    const r = gateFindings(['LENGTH: runs 40.00s; must be 15-30 s.', 'HOOK: no on-screen hook text'], { loop: { seconds: 0.3 }, endcard: null }, rules)
    expect(r.kept).toEqual(['HOOK: no on-screen hook text'])
    expect(r.dropped[0]).toContain('check 3')
  })

  it('drops LOOP and END CARD only for a type that requires neither and a manifest that has neither', () => {
    const fails = ['LOOP: last frame hard-jumps', 'END CARD: last 4 s is missing Quality']
    expect(gateFindings(fails, { loop: null, endcard: null }, { requires_loop: false, requires_end_card: false }).kept).toEqual([])
    expect(gateFindings(fails, { loop: null, endcard: null }, rules).kept).toEqual(fails)
    expect(gateFindings(fails, { loop: { seconds: 0.3 }, endcard: null }, { requires_loop: false, requires_end_card: true }).kept).toEqual(fails)
  })
})

describe('pixelGateArgs', () => {
  const base = { videoType: 'market_update', silent: false, voStart: null, voEnd: null }
  it('hands the render gate the brief\'s ceiling as --max-s, and nothing when none is given', () => {
    expect(pixelGateArgs('f.mp4', base)).toEqual([PIXEL_GATE_WRAPPER, RENDER_GATE_PATH, 'f.mp4', '--type', 'market_update'])
    expect(pixelGateArgs('f.mp4', { ...base, maxS: null })).not.toContain('--max-s')
    const args = pixelGateArgs('f.mp4', { ...base, maxS: 40 })
    expect(args.slice(args.indexOf('--max-s'), args.indexOf('--max-s') + 2)).toEqual(['--max-s', '40'])
  })
  it('spells no ceiling (a Matt length override) the way the gate reads it', () => {
    const args = pixelGateArgs('f.mp4', { ...base, maxS: Infinity })
    expect(args[args.indexOf('--max-s') + 1]).toBe('inf')
  })
  it('keeps the other options', () => {
    const args = pixelGateArgs('f.mp4', { videoType: 'buyer_ad', silent: true, voStart: 0.5, voEnd: 20.25, maxS: 30 })
    expect(args).toEqual([PIXEL_GATE_WRAPPER, RENDER_GATE_PATH, 'f.mp4', '--type', 'buyer_ad', '--silent', '--max-s', '30', '--vo-start', '0.500', '--vo-end', '20.250'])
  })
})

describe('boxClaims and captionsWithoutBoxes', () => {
  it('reads every claimed text but the locked end card, at the middle of its time, in its own mode', () => {
    expect(boxClaims({ texts })).toEqual([
      { text: '3.5', kind: 'card', t: 1.6, box, mode: 'card' },
      { text: 'has 3.5 months', kind: 'caption', t: 1.8, box: texts[1].box, mode: 'caption' },
    ])
  })

  it('reports a caption with no drawn box', () => {
    expect(captionsWithoutBoxes({ texts, captions })).toEqual([])
    expect(captionsWithoutBoxes({ texts: [texts[0]], captions })).toEqual(['has 3.5 months'])
  })
})

describe('claimConfirmed', () => {
  it('needs every figure and at least half the longer words', () => {
    expect(claimConfirmed('HAS 3.5 MONTHS', 'has 3.5 months')).toBe(true)
    expect(claimConfirmed('HAS 35 MONTHS', 'has 3.5 months')).toBe(true)
    expect(claimConfirmed('HAS 3.9 MONTHS', 'has 3.5 months')).toBe(false)
    expect(claimConfirmed('', '3.5')).toBe(false)
    expect(claimConfirmed('SoBend', 'So Bend')).toBe(true)
  })
})

describe('unlistedFigures', () => {
  const listed = listedFigures({ texts, captions })

  it('flags a figure-shaped token read in two samples running that the manifest does not list', () => {
    const samples = [{ t: 4, text: 'prices $612K' }, { t: 4.5, text: 'prices $612K' }]
    expect(unlistedFigures(samples, listed, null)).toEqual(['"$612K" at 4s and 4.5s'])
  })

  it('does not flag noise read once, a short bare number, or the phone', () => {
    const samples = [
      { t: 0.5, text: '3.0 38, #4' }, { t: 1, text: '3.9 x' }, { t: 1.5, text: '3.0 12' }, { t: 2, text: '12 88%' },
      { t: 2.5, text: '541.703.309' }, { t: 3, text: '541.703.3' },
    ]
    expect(unlistedFigures(samples, listed, null)).toEqual([])
  })

  it('skips the samples from the end card on', () => {
    const samples = [{ t: 12.5, text: '$612K' }, { t: 13, text: '$612K' }]
    expect(unlistedFigures(samples, listed, 12.2)).toEqual([])
    expect(unlistedFigures(samples, listed, null)).toHaveLength(1)
  })

  it('treats only an exact figure as listed, never a near one (F8)', () => {
    // review finding: with "4 mo" and "3.5" listed, "45%" and "$350K" read twice running were ignored
    const short = listedFigures({ texts: [{ text: '4 mo', start: 0, end: 1, box: { x: 0, y: 0, w: 1, h: 1 }, kind: 'card' }, { text: '3.5', start: 0, end: 1, box: { x: 0, y: 0, w: 1, h: 1 }, kind: 'card' }], captions: [] })
    const twice = (text: string) => [{ t: 4, text }, { t: 4.5, text }]
    expect(unlistedFigures(twice('45%'), short, null)).toEqual(['"45%" at 4s and 4.5s'])
    expect(unlistedFigures(twice('$350K'), short, null)).toEqual(['"$350K" at 4s and 4.5s'])
    expect(unlistedFigures(twice('3.5 MONTHS'), short, null)).toEqual([])
  })

  it("skips only the phone's own tokens, not figures that share its digits (F8)", () => {
    // review finding: "$417K", "$170K" and "$703K" were skipped as phone fragments
    const twice = (text: string) => [{ t: 4, text }, { t: 4.5, text }]
    for (const fig of ['$417K', '$170K', '$703K']) expect(unlistedFigures(twice(fig), listed, null), fig).toHaveLength(1)
    for (const part of ['541-703', '703.3095', '(541)', '541 703 3095']) expect(unlistedFigures(twice(part), listed, null), part).toEqual([])
    expect([...PHONE_TOKENS]).toContain('5417033095')
  })

  it('needs consecutive samples, 0.5 s apart', () => {
    expect(unlistedFigures([{ t: 4, text: '$612K' }, { t: 5, text: '$612K' }], listed, null)).toEqual([])
  })
})

describe('figureShaped and figureKey', () => {
  it('reads a figure as figure-shaped only with $, %, a decimal or three digits', () => {
    expect(figureShaped('$4')).toBe(true)
    expect(figureShaped('4%')).toBe(true)
    expect(figureShaped('3.5')).toBe(true)
    expect(figureShaped('612')).toBe(true)
    expect(figureShaped('38')).toBe(false)
  })

  it('keys a figure by its prefix, digits, magnitude and percent, its unit word aside', () => {
    expect(figureKey('3.5 mo')).toBe('3.5')
    expect(figureKey('$475K')).toBe('$475k')
    expect(figureKey('12%')).toBe('12%')
  })
})
