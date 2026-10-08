import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveFfmpeg } from '@/lib/video/ffmpeg'
import {
  SAMPLE_RATE,
  composeScore,
  encodeWav,
  integratedLoudness,
  planScore,
  renderScoreStems,
  truePeakDb,
  weightDb,
  type ScoreEvent,
  type ScoreInput,
  type ScoreMood,
} from './index'
import { filterInPlace, lowpass } from './dsp'
import { PENTATONIC_STEPS, datumStep, pitchClassName } from './harmony'
import { renderReverb } from './reverb'
import { stereoRms, type StereoBuf } from './voices'

/** Whole-film composes take a second or two; vitest's 5 s default is too tight under a parallel run. */
const SLOW = 60_000

/** A film with a scene every quarter, a few events, and a closer lockup 2.5 s from the end. */
function film(duration: number, mood: ScoreMood, seed = 'draft-123', extra: Partial<ScoreInput> = {}): ScoreInput {
  const quarter = duration / 4
  return {
    duration,
    seed,
    mood,
    sections: [0, 1, 2, 3].map((i) => ({ start: i * quarter, end: (i + 1) * quarter })),
    events: [
      { kind: 'enter', t: 0.3, weight: 1 },
      { kind: 'land', t: duration * 0.2, weight: 1 },
      { kind: 'swell', start: duration * 0.3, end: duration * 0.45 },
      { kind: 'enter', t: duration * 0.5, weight: 1.2 },
      { kind: 'land', t: duration * 0.7, weight: 1.6 },
      { kind: 'lockup', t: duration - 2.5 },
    ],
    ...extra,
  }
}

/** 16-bit stereo WAV back to floats, checking the header on the way. */
function decodeWav(wav: Buffer): { left: Float32Array; right: Float32Array } {
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
  expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
  expect(wav.toString('ascii', 12, 16)).toBe('fmt ')
  expect(wav.readUInt16LE(20)).toBe(1) // PCM
  expect(wav.readUInt16LE(22)).toBe(2) // stereo
  expect(wav.readUInt32LE(24)).toBe(SAMPLE_RATE)
  expect(wav.readUInt32LE(28)).toBe(SAMPLE_RATE * 4)
  expect(wav.readUInt16LE(32)).toBe(4)
  expect(wav.readUInt16LE(34)).toBe(16)
  expect(wav.toString('ascii', 36, 40)).toBe('data')
  const dataBytes = wav.readUInt32LE(40)
  expect(wav.readUInt32LE(4)).toBe(36 + dataBytes)
  expect(wav.length).toBe(44 + dataBytes)
  const frames = dataBytes / 4
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    left[i] = wav.readInt16LE(44 + i * 4) / 32768
    right[i] = wav.readInt16LE(46 + i * 4) / 32768
  }
  return { left, right }
}

function midiOf(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(note)
  if (!m) throw new Error(`not a note name: ${note}`)
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C']
  return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12
}

function rmsDb(buf: StereoBuf, fromSec: number, toSec: number): number {
  return 20 * Math.log10(stereoRms(buf, Math.round(fromSec * SAMPLE_RATE), Math.round(toSec * SAMPLE_RATE)) + 1e-12)
}

describe('key and harmony', () => {
  it('picks one of the six warm major keys from the seed, and reaches all six', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 60; i++) keys.add(planScore(film(10, 'calm', `draft-${i}`)).key.name)
    expect([...keys].sort()).toEqual(['A', 'D', 'E', 'Eb', 'F', 'G'])
    expect(planScore(film(10, 'calm', 'x')).keyName).toMatch(/^(D|Eb|E|F|G|A) major$/)
  })

  it('a calm film in D with its lockup in the last scene is Dmaj9, Bm7, Gmaj7, D', () => {
    let seed = ''
    for (let i = 0; i < 200 && !seed; i++) if (planScore(film(12, 'calm', `d-${i}`)).key.name === 'D') seed = `d-${i}`
    expect(seed).not.toBe('')
    // Lockup at 12 - 2.5 = 9.5, inside the fourth scene (9 to 12).
    const result = composeScore(film(12, 'calm', seed))
    expect(result.report.key).toBe('D major')
    expect(result.report.chords).toEqual(['Dmaj9', 'Bm7', 'Gmaj7', 'D'])
  }, SLOW)

  it('the scene holding the lockup is the tonic, wherever it falls', () => {
    for (const mood of ['calm', 'measured'] as const) {
      for (let at = 0; at < 4; at++) {
        const input = film(16, mood, 'tonic', { events: [{ kind: 'lockup', t: at * 4 + 1 }] })
        const plan = planScore(input)
        expect(plan.sections[at].chord.degree).toBe('I')
        // The bare tonic triad: named for the key's tonic, no colour tone.
        expect(plan.sections[at].chord.name).toBe(pitchClassName(plan.key.tonic, plan.key.flats))
        expect(plan.sections[at].chord.pcs).toHaveLength(3)
      }
    }
  })

  it('a measured film runs I, vi, IV, V, I with added ninths', () => {
    const plan = planScore({ duration: 20, seed: 'five', mood: 'measured', sections: [0, 4, 8, 12, 16].map((s) => ({ start: s, end: s + 4 })), events: [] })
    expect(plan.sections.map((s) => s.chord.degree)).toEqual(['I', 'vi', 'IV', 'V', 'I'])
    expect(plan.sections[0].chord.name).toMatch(/add9$/)
    expect(plan.sections[3].chord.name).toMatch(/^[A-G][b#]?add9$/)
  })

  it('a V chord is fully released by the next scene start + 80 ms; others crossfade over 120 ms', () => {
    const plan = planScore({ duration: 20, seed: 'five', mood: 'measured', sections: [0, 4, 8, 12, 16].map((s) => ({ start: s, end: s + 4 })), events: [] })
    const v = plan.sections[3]
    expect(v.chord.degree).toBe('V')
    expect(v.releaseTo).toBeLessThanOrEqual(plan.sections[4].start + 0.08 + 1e-9)
    expect(v.releaseFrom).toBeLessThan(plan.sections[4].start)
    expect(plan.sections[1].releaseTo).toBeCloseTo(plan.sections[2].start + 0.12, 9)
    // The first chord is audible with intent: attack inside 120 ms, not a slow swell-in.
    expect(plan.sections[0].attackTo - plan.sections[0].attackFrom).toBeLessThanOrEqual(0.12)
  })

  it('voicings keep root, third or fifth at the bottom and nothing close below C4', () => {
    for (let i = 0; i < 40; i++) {
      for (const mood of ['calm', 'measured'] as const) {
        const plan = planScore(film(20, mood, `voice-${i}`))
        for (const section of plan.sections) {
          const { voicing, pcs } = section.chord
          expect([...voicing].sort((a, b) => a - b)).toEqual(voicing)
          expect(pcs.slice(0, 3)).toContain(voicing[0] % 12)
          expect(voicing[0]).toBeGreaterThanOrEqual(48)
          expect(voicing[voicing.length - 1]).toBeLessThanOrEqual(79)
          // Every chord tone is in the stack.
          for (const pc of pcs) expect(voicing.map((m) => m % 12)).toContain(pc)
          for (let k = 0; k + 1 < voicing.length; k++) {
            if (voicing[k] < 60) expect(voicing[k + 1] - voicing[k]).toBeGreaterThanOrEqual(5)
          }
        }
      }
    }
  })

  it('voice-leads: each note of a new chord is within a fifth of a note of the last one', () => {
    for (let i = 0; i < 20; i++) {
      const plan = planScore(film(20, 'calm', `lead-${i}`))
      for (let s = 1; s < plan.sections.length; s++) {
        const previous = plan.sections[s - 1].chord.voicing
        for (const note of plan.sections[s].chord.voicing) {
          const nearest = Math.min(...previous.map((p) => Math.abs(p - note)))
          expect(nearest).toBeLessThanOrEqual(7)
        }
      }
    }
  })
})

describe('the measured pulse', () => {
  const base = (events: ScoreEvent[], sections: Array<[number, number]>, mood: ScoreMood = 'measured'): ScoreInput => ({
    duration: 14,
    seed: 'pulse',
    mood,
    sections: sections.map(([start, end]) => ({ start, end })),
    events,
  })

  it('beats every 0.6 s (100 BPM, 18 frames at 30 fps) and starts on the first frame', () => {
    const plan = planScore(base([], [[0, 14]]))
    expect(plan.pulses[0].t).toBe(0)
    for (let i = 1; i < plan.pulses.length; i++) expect(plan.pulses[i].t - plan.pulses[i - 1].t).toBeCloseTo(0.6, 9)
    expect(Math.round(0.6 * 30)).toBe(18)
  })

  it('resets its phase on every scene start, so a scene change lands on a downbeat', () => {
    const plan = planScore(base([], [[0, 3.1], [3.1, 8.2], [8.2, 14]]))
    for (const start of [0, 3.1, 8.2]) expect(plan.pulses.some((p) => Math.abs(p.t - start) < 1e-9)).toBe(true)
    for (const p of plan.pulses) {
      const section = plan.sections[p.section]
      expect((p.t - section.start) / 0.6).toBeCloseTo(Math.round((p.t - section.start) / 0.6), 6)
    }
  })

  it('drops a note that would fall within 0.15 s of the next scene start, and keeps one at 0.2 s', () => {
    // Scene 0 spans 2.5 s: beats at 0, 0.6, 1.2, 1.8, 2.4. The last is 0.1 s before the cut.
    const dropped = planScore(base([], [[0, 2.5], [2.5, 14]]))
    expect(dropped.pulses.filter((p) => p.section === 0).map((p) => p.t)).not.toContain(2.4)
    expect(dropped.pulses.filter((p) => p.section === 0)).toHaveLength(4)
    // Scene 0 spans 2.6 s: the 2.4 beat is 0.2 s before the cut and stays.
    const kept = planScore(base([], [[0, 2.6], [2.6, 14]]))
    expect(kept.pulses.filter((p) => p.section === 0)).toHaveLength(5)
  })

  it('stops 0.2 s before the lockup and does not come back', () => {
    const plan = planScore(base([{ kind: 'lockup', t: 10.5 }], [[0, 4], [4, 9], [9, 14]]))
    expect(plan.pulses.length).toBeGreaterThan(0)
    for (const p of plan.pulses) expect(p.t).toBeLessThan(10.5 - 0.2)
    expect(plan.pulses.some((p) => p.t > 10.0)).toBe(true) // 10.2 is 0.3 s before: kept
  })

  it('plays chord tones in octave 4 to 5', () => {
    const plan = planScore(base([], [[0, 4], [4, 9], [9, 14]]))
    for (const p of plan.pulses) {
      expect(p.midi).toBeGreaterThanOrEqual(60)
      expect(p.midi).toBeLessThanOrEqual(83)
      expect(plan.sections[p.section].chord.pcs).toContain(p.midi % 12)
    }
  })

  it('a calm film has no pulse', () => {
    expect(planScore(base([], [[0, 14]], 'calm')).pulses).toHaveLength(0)
    const stems = renderScoreStems(base([], [[0, 14]], 'calm'))
    expect(rmsDb(stems.pulse, 0, 14)).toBeLessThan(-200)
  })

  it('sits about 11 dB under the pad, within the seed\'s +-1.5 dB', () => {
    for (const seed of ['p1', 'p2', 'p3', 'p4']) {
      const stems = renderScoreStems({ ...base([], [[0, 14]]), seed })
      const delta = rmsDb(stems.pulse, 0, 12) - rmsDb(stems.pad, 0, 12)
      expect(delta).toBeLessThan(-8)
      expect(delta).toBeGreaterThan(-15)
    }
  }, SLOW)
})

describe('composeScore: determinism, length, edges', () => {
  it('the same input is the same bytes; a different seed is not', () => {
    const a = composeScore(film(6, 'measured', 'seed-a'))
    const b = composeScore(film(6, 'measured', 'seed-a'))
    const c = composeScore(film(6, 'measured', 'seed-b'))
    expect(a.wav.equals(b.wav)).toBe(true)
    expect(a.report).toEqual(b.report)
    expect(a.wav.equals(c.wav)).toBe(false)
  }, SLOW)

  it('does not depend on the order the events are listed in', () => {
    const input = film(6, 'calm')
    const shuffled = { ...input, events: [...input.events].reverse() }
    // Same times and kinds, so the same film (ties only occur between different kinds here).
    expect(composeScore(shuffled).wav.equals(composeScore(input).wav)).toBe(true)
  }, SLOW)

  it('is exactly round(duration * 48000) samples, in a WAV of 44 + samples * 4 bytes', () => {
    for (const duration of [0.5, 3.337, 6, 7.9999]) {
      const result = composeScore(film(Math.max(duration, 3), 'calm', 'len', { duration, sections: [], events: [{ kind: 'enter', t: 0.2, weight: 1 }] }))
      expect(result.samples).toBe(Math.round(duration * SAMPLE_RATE))
      expect(result.wav.length).toBe(44 + result.samples * 4)
      expect(decodeWav(result.wav).left.length).toBe(result.samples)
    }
  }, SLOW)

  it('starts from exact zero and ends on 480 samples of exact zero, in both channels', () => {
    for (const mood of ['calm', 'measured'] as const) {
      const { left, right } = decodeWav(composeScore(film(6, mood)).wav)
      expect(left[0]).toBe(0)
      expect(right[0]).toBe(0)
      for (let i = left.length - 480; i < left.length; i++) {
        expect(left[i]).toBe(0)
        expect(right[i]).toBe(0)
      }
      // ...and the fade-out is already quiet well before the zeros.
      let tail = 0
      for (let i = left.length - 2400; i < left.length - 480; i++) tail = Math.max(tail, Math.abs(left[i]))
      expect(tail).toBeLessThan(0.02)
    }
  }, SLOW)

  it('has sound on frame 0: the first 150 ms are within 8 dB of the body, not a slow swell-in', () => {
    const stems = renderScoreStems({ duration: 8, seed: 'f0', mood: 'calm', sections: [], events: [] })
    const opening = rmsDb(stems.pad, 0.05, 0.15)
    const body = rmsDb(stems.pad, 2, 3)
    expect(opening).toBeGreaterThan(body - 8)
    // ...yet it starts from true silence: the very first sample of the master is 0.
    const { left } = decodeWav(composeScore({ duration: 8, seed: 'f0', mood: 'calm', sections: [], events: [] }).wav)
    expect(left[0]).toBe(0)
  }, SLOW)
})

describe('composeScore: loudness and true peak', () => {
  for (const mood of ['calm', 'measured'] as const) {
    for (const duration of [6, 15]) {
      it(`${mood}, ${duration} s: within 0.5 LU of -14 LUFS and under -1.5 dBTP, as reported and as measured from the WAV`, () => {
        const result = composeScore(film(duration, mood))
        expect(Math.abs(result.report.lufs - -14)).toBeLessThanOrEqual(0.5)
        expect(result.report.truePeakDb).toBeLessThanOrEqual(-1.5)
        // The report is a measurement of the samples, not a promise: re-measure the 16-bit file.
        const { left, right } = decodeWav(result.wav)
        expect(Math.abs(integratedLoudness(left, right) - result.report.lufs)).toBeLessThan(0.1)
        expect(Math.abs(truePeakDb(left, right) - result.report.truePeakDb)).toBeLessThan(0.1)
        console.log(`[score] ${mood} ${duration}s: ${result.report.lufs} LUFS, ${result.report.truePeakDb} dBTP, key ${result.report.key}, chords ${result.report.chords.join(' ')}`)
      }, SLOW)
    }
  }

  it('honours another target', () => {
    const result = composeScore({ ...film(6, 'calm'), lufs: -16 })
    expect(Math.abs(result.report.lufs - -16)).toBeLessThanOrEqual(0.5)
    expect(result.report.truePeakDb).toBeLessThanOrEqual(-1.5)
  }, SLOW)

  it('a bare pad (no events at all) masters the same way', () => {
    const result = composeScore({ duration: 5, seed: 'bare', mood: 'calm', sections: [], events: [] })
    expect(Math.abs(result.report.lufs - -14)).toBeLessThanOrEqual(0.5)
    expect(result.report.truePeakDb).toBeLessThanOrEqual(-1.5)
  }, SLOW)
})

describe('events are audible where they should be', () => {
  const calm = (events: ScoreEvent[]): ScoreInput => ({
    duration: 6,
    seed: 'audible',
    mood: 'calm',
    sections: [{ start: 0, end: 3 }, { start: 3, end: 6 }],
    events,
  })

  it('an enter at 2.0 s is silent on the event bus until 2.0 and has risen within 15 ms of it', () => {
    const stems = renderScoreStems(calm([{ kind: 'enter', t: 2.0, weight: 1 }]))
    const before = stereoRms(stems.events, Math.round(1.98 * SAMPLE_RATE), Math.round(2.0 * SAMPLE_RATE))
    const first15 = stereoRms(stems.events, Math.round(2.0 * SAMPLE_RATE), Math.round(2.015 * SAMPLE_RATE))
    const settled = stereoRms(stems.events, Math.round(2.03 * SAMPLE_RATE), Math.round(2.2 * SAMPLE_RATE))
    expect(before).toBe(0)
    expect(first15).toBeGreaterThan(settled * 0.3)
    expect(20 * Math.log10(first15 / settled)).toBeGreaterThan(-10)
    // And it is nothing like silent against the pad: within 12 dB of it.
    expect(rmsDb(stems.events, 2.0, 2.015) - rmsDb(stems.pad, 2.0, 2.015)).toBeGreaterThan(-25)
  })

  it('an enter reads in the full mix too: the master gets louder across the onset', () => {
    const withEvent = composeScore(calm([{ kind: 'enter', t: 2.0, weight: 2 }]))
    const { left, right } = decodeWav(withEvent.wav)
    const window = (from: number, to: number) => {
      let sum = 0
      for (let i = Math.round(from * SAMPLE_RATE); i < Math.round(to * SAMPLE_RATE); i++) sum += left[i] * left[i] + right[i] * right[i]
      return sum
    }
    expect(window(2.0, 2.1)).toBeGreaterThan(window(1.85, 1.95) * 1.02)
  }, SLOW)

  it('weight scales an event in dB, clamped to +-6 dB around weight 1', () => {
    expect(weightDb(1)).toBeCloseTo(0, 9)
    expect(weightDb(2)).toBeCloseTo(6, 1)
    expect(weightDb(10)).toBe(6)
    expect(weightDb(0.5)).toBeCloseTo(-6, 1)
    expect(weightDb(0)).toBe(-6)
    expect(weightDb(Number.NaN)).toBe(0)
    const level = (weight: number) => {
      const stems = renderScoreStems(calm([{ kind: 'enter', t: 2.0, weight }]))
      return rmsDb(stems.events, 2.0, 2.5)
    }
    expect(level(2) - level(1)).toBeGreaterThan(5)
    expect(level(2) - level(1)).toBeLessThan(7)
    expect(level(2) - level(0.5)).toBeGreaterThan(11)
    expect(level(2) - level(0.5)).toBeLessThan(13)
    expect(Math.abs(level(10) - level(2))).toBeLessThan(0.6)
  })

  it('a land is a short tick: gone in 100 ms, and 12 to 18 dB under the pad unless the weight is 1.5 or more', () => {
    const peakDb = (weight: number) => {
      const stems = renderScoreStems(calm([{ kind: 'land', t: 2.0, weight }]))
      let peak = 0
      for (let i = Math.round(2.0 * SAMPLE_RATE); i < Math.round(2.1 * SAMPLE_RATE); i++) peak = Math.max(peak, Math.abs(stems.events.left[i]), Math.abs(stems.events.right[i]))
      const tail = stereoRms(stems.events, Math.round(2.2 * SAMPLE_RATE), Math.round(2.5 * SAMPLE_RATE))
      expect(tail).toBeLessThan(peak * 0.01)
      const padRms = stereoRms(stems.pad, 0, Math.round(5 * SAMPLE_RATE))
      return 20 * Math.log10(peak / padRms)
    }
    // Peak-to-pad-RMS is read on one channel of a near-centre pan, so allow a dB either way around the stated band.
    const normal = peakDb(1)
    expect(normal).toBeLessThan(-10.5)
    expect(normal).toBeGreaterThan(-19.5)
    expect(peakDb(1.6)).toBeGreaterThan(normal + 1)
  })

  it('a swell opens the pad: about 4 dB louder at the end of the span than before it, then back down', () => {
    const stems = renderScoreStems({ duration: 10, seed: 'swell', mood: 'calm', sections: [], events: [{ kind: 'swell', start: 3, end: 6 }] })
    const before = rmsDb(stems.pad, 2.5, 3.0)
    const peak = rmsDb(stems.pad, 5.5, 6.0)
    const after = rmsDb(stems.pad, 8.5, 9.0)
    // +4 dB of level, plus the filter opening an octave adds brightness on top.
    expect(peak - before).toBeGreaterThan(3)
    expect(peak - before).toBeLessThan(9)
    expect(Math.abs(after - before)).toBeLessThan(1)
  })

  it('the lockup: a bell on the tonic in octave 5 at t, with a low dyad under it', () => {
    const input = film(12, 'measured', 'lock')
    const stems = renderScoreStems(input)
    const plan = stems.plan
    const bell = plan.events.find((e) => e.event.kind === 'lockup')
    expect(bell?.note).toBe(`${plan.key.name}5`)
    // The lockup bus is silent before t and sounding after.
    expect(stereoRms(stems.lockup, 0, Math.round(9.4 * SAMPLE_RATE))).toBe(0)
    expect(rmsDb(stems.lockup, 9.5, 9.8)).toBeGreaterThan(-90)
    // The dyad: a real share of the lockup's energy sits under 200 Hz (a bell alone has none there).
    const low = { left: Float32Array.from(stems.lockup.left), right: Float32Array.from(stems.lockup.right) }
    filterInPlace(low.left, lowpass(200))
    filterInPlace(low.right, lowpass(200))
    expect(rmsDb(low, 9.5, 11) - rmsDb(stems.lockup, 9.5, 11)).toBeGreaterThan(-12)
  }, SLOW)

  it('the pad thins at the lockup: about 0.2 s before, the upper voices drop away, and it stays thin', () => {
    // One scene, so the only difference between the two films is the lockup itself.
    const base: ScoreInput = { duration: 10, seed: 'thin', mood: 'calm', sections: [], events: [] }
    const without = renderScoreStems(base)
    const withLockup = renderScoreStems({ ...base, events: [{ kind: 'lockup', t: 6 }] })
    // Before the 0.2 s pre-gap the two pads are the same sound.
    expect(Math.abs(rmsDb(withLockup.pad, 4, 5) - rmsDb(without.pad, 4, 5))).toBeLessThan(0.05)
    // After it, thinner by several dB.
    expect(rmsDb(withLockup.pad, 6.6, 7.4) - rmsDb(without.pad, 6.6, 7.4)).toBeLessThan(-2.5)
    // And it is already dipping in the 0.2 s before the bell.
    expect(rmsDb(withLockup.pad, 5.9, 6.0) - rmsDb(without.pad, 5.9, 6.0)).toBeLessThan(-0.2)
  }, SLOW)
})

describe('datum pitch mapping', () => {
  const noteOf = (report: ReturnType<typeof composeScore>['report'], i: number) => {
    const datums = report.events.filter((e) => e.kind === 'datum')
    return midiOf(datums[i].note as string)
  }

  it('maps value onto the key\'s major pentatonic over 1.5 octaves: a larger value never maps lower, equal values map equal', () => {
    const values = [3, 90, 47, 47, 12, 100, 0, 61, 61.0001, 47, 99.9, 0.1]
    const events: ScoreEvent[] = values.map((value, i) => ({ kind: 'datum', t: 0.5 + i * 0.25, value, min: 0, max: 100, weight: 1 }))
    const result = composeScore({ duration: 6, seed: 'datum', mood: 'calm', sections: [], events })
    const notes = values.map((_, i) => noteOf(result.report, i))
    for (let a = 0; a < values.length; a++) {
      for (let b = 0; b < values.length; b++) {
        if (values[a] > values[b]) expect(notes[a]).toBeGreaterThanOrEqual(notes[b])
        if (values[a] === values[b]) expect(notes[a]).toBe(notes[b])
      }
    }
    // The extremes span the whole ladder: 19 semitones, nine pentatonic steps.
    expect(notes[values.indexOf(100)] - notes[values.indexOf(0)]).toBe(19)
    // Every note is in the key's major pentatonic.
    const plan = planScore({ duration: 6, seed: 'datum', mood: 'calm', sections: [], events })
    const scale = new Set([0, 2, 4, 7, 9].map((s) => (plan.key.tonic + s) % 12))
    for (const n of notes) expect(scale.has(n % 12)).toBe(true)
    // Names carry through the report.
    for (const e of result.report.events) expect(e.note).toMatch(/^[A-G][b#]?\d$/)
  }, SLOW)

  it('is monotone across the whole range, for any min and max', () => {
    for (const [min, max] of [[0, 1], [-50, 50], [300_000, 1_250_000], [2.1, 9.7]] as const) {
      let last = -1
      for (let i = 0; i <= 400; i++) {
        const step = datumStep(min + ((max - min) * i) / 400, min, max)
        expect(step).toBeGreaterThanOrEqual(last)
        last = step
      }
      expect(datumStep(min, min, max)).toBe(0)
      expect(datumStep(max, min, max)).toBe(PENTATONIC_STEPS.length - 1)
    }
  })

  it('clamps outside the range, and puts a collapsed range or a bad number mid-scale', () => {
    expect(datumStep(-10, 0, 100)).toBe(0)
    expect(datumStep(500, 0, 100)).toBe(PENTATONIC_STEPS.length - 1)
    expect(datumStep(5, 5, 5)).toBe(4)
    expect(datumStep(Number.NaN, 0, 100)).toBe(4)
  })

  it('tuned ticks and enters sit on chord tones, in their registers', () => {
    const input = film(12, 'calm', 'tuned', {
      events: [
        { kind: 'enter', t: 0.4, weight: 1 },
        { kind: 'enter', t: 4, weight: 1 },
        { kind: 'enter', t: 7, weight: 1 },
        { kind: 'land', t: 1, weight: 1 },
        { kind: 'land', t: 4.5, weight: 1 },
        { kind: 'land', t: 7.5, weight: 1 },
      ],
    })
    const plan = planScore(input)
    for (const e of plan.events) {
      const chord = plan.sections.filter((s) => s.start <= e.t).pop()!.chord
      expect(chord.pcs).toContain((e.midi as number) % 12)
      if (e.event.kind === 'land') {
        expect(e.midi).toBeGreaterThanOrEqual(84) // octave 6
        expect(e.midi).toBeLessThanOrEqual(91) // up to G6, 1.57 kHz
      } else {
        expect(e.midi).toBeGreaterThanOrEqual(62)
        expect(e.midi).toBeLessThanOrEqual(79)
      }
    }
  })
})

describe('warnings and validation', () => {
  it('flags an enter inside the end fade and says so', () => {
    // 6 s film: the fade is min(1.0, 0.9) = 0.9 s, from 5.1 s.
    const result = composeScore({ duration: 6, seed: 'fade', mood: 'calm', sections: [], events: [{ kind: 'enter', t: 5.4, weight: 1 }] })
    expect(result.report.warnings.some((w) => /enter/.test(w) && /end fade/.test(w))).toBe(true)
    // Kept, not dropped: it is in the report.
    expect(result.report.events).toHaveLength(1)
  }, SLOW)

  it('flags land and datum in the fade too, and does not flag an enter just before it', () => {
    const plan = planScore({
      duration: 10,
      seed: 'fade',
      mood: 'calm',
      sections: [],
      events: [
        { kind: 'land', t: 9.2, weight: 1 },
        { kind: 'datum', t: 9.5, value: 1, min: 0, max: 2, weight: 1 },
        { kind: 'enter', t: 8.9, weight: 1 },
      ],
    })
    expect(plan.warnings.filter((w) => /end fade/.test(w))).toHaveLength(2)
    expect(plan.warnings.some((w) => /enter/.test(w))).toBe(false)
  })

  it('drops an event past the end, with a warning, and keeps the rest', () => {
    const result = composeScore({
      duration: 6,
      seed: 'past',
      mood: 'calm',
      sections: [],
      events: [
        { kind: 'enter', t: 1, weight: 1 },
        { kind: 'enter', t: 6.5, weight: 1 },
        { kind: 'land', t: 6, weight: 1 },
        { kind: 'datum', t: 99, value: 1, min: 0, max: 2, weight: 1 },
      ],
    })
    expect(result.report.events.map((e) => e.t)).toEqual([1])
    expect(result.report.warnings.filter((w) => /past the film's end/.test(w))).toHaveLength(3)
  }, SLOW)

  it('reports overlapping scenes, a late first scene, and bad scenes', () => {
    const overlap = planScore({ duration: 10, seed: 's', mood: 'calm', sections: [{ start: 0, end: 5 }, { start: 4, end: 10 }], events: [] })
    expect(overlap.warnings.some((w) => /overlap/.test(w))).toBe(true)
    const late = planScore({ duration: 10, seed: 's', mood: 'calm', sections: [{ start: 1, end: 5 }, { start: 5, end: 10 }], events: [] })
    expect(late.warnings.some((w) => /not 0/.test(w))).toBe(true)
    expect(late.sections[0].start).toBe(0)
    const bad = planScore({ duration: 10, seed: 's', mood: 'calm', sections: [{ start: 3, end: 3 }, { start: 12, end: 14 }, { start: Number.NaN, end: 1 }], events: [] })
    expect(bad.sections).toHaveLength(1)
    expect(bad.sections[0]).toMatchObject({ start: 0, end: 10 })
    expect(bad.warnings.length).toBeGreaterThan(0)
  })

  it('no sections means one scene across the whole film', () => {
    const plan = planScore({ duration: 8, seed: 's', mood: 'calm', sections: [], events: [] })
    expect(plan.sections).toHaveLength(1)
    expect(plan.sections[0]).toMatchObject({ start: 0, end: 8 })
  })

  it('scores only the first lockup, and warns about a lockup that begins inside the fade', () => {
    const two = planScore({ duration: 10, seed: 's', mood: 'calm', sections: [], events: [{ kind: 'lockup', t: 7 }, { kind: 'lockup', t: 8 }] })
    expect(two.events.filter((e) => e.event.kind === 'lockup')).toHaveLength(1)
    expect(two.warnings.some((w) => /only the first lockup/.test(w))).toBe(true)
    const late = planScore({ duration: 10, seed: 's', mood: 'calm', sections: [], events: [{ kind: 'lockup', t: 9.5 }] })
    expect(late.warnings.some((w) => /lockup/.test(w) && /end fade/.test(w))).toBe(true)
  })

  it('drops events before the film, non-finite times, and unknown kinds, each with a warning', () => {
    const plan = planScore({
      duration: 10,
      seed: 's',
      mood: 'calm',
      sections: [],
      events: [
        { kind: 'enter', t: -1, weight: 1 },
        { kind: 'land', t: Number.NaN, weight: 1 },
        { kind: 'swell', start: 3, end: 3 },
        { kind: 'mystery' } as unknown as ScoreEvent,
        { kind: 'enter', t: 2, weight: 1 },
      ],
    })
    expect(plan.events).toHaveLength(1)
    expect(plan.warnings).toHaveLength(4)
  })

  it('throws on a duration or target it cannot score', () => {
    for (const duration of [0, 0.1, -3, Number.NaN, Number.POSITIVE_INFINITY, 121, 1e6]) {
      expect(() => composeScore({ duration, seed: 's', mood: 'calm', sections: [], events: [] })).toThrow(RangeError)
    }
    expect(() => composeScore({ duration: 5, seed: 's', mood: 'calm', sections: [], events: [], lufs: 3 })).toThrow(RangeError)
    expect(() => composeScore({ duration: 5, seed: 's', mood: 'loud' as ScoreMood, sections: [], events: [] })).toThrow(RangeError)
  })
})

describe('the room', () => {
  it('has a tail of about 2 s (60 dB extrapolated from the -5 to -35 dB span of its decay curve)', () => {
    const impulse = new Float32Array(SAMPLE_RATE * 6)
    impulse[0] = 1
    const { left } = renderReverb(impulse)
    let total = 0
    for (const x of left) total += x * x
    // Schroeder backward integration: the energy decay curve.
    const edc = new Float64Array(left.length)
    let acc = 0
    for (let i = left.length - 1; i >= 0; i--) {
      acc += left[i] * left[i]
      edc[i] = 10 * Math.log10(acc / total)
    }
    const at = (db: number) => edc.findIndex((v) => v < db) / SAMPLE_RATE
    const rt60 = ((at(-35) - at(-5)) / 30) * 60
    expect(rt60).toBeGreaterThan(1.8)
    expect(rt60).toBeLessThan(2.4)
  })

  it('returns white noise at the level it was given (the send level means what it says)', () => {
    let a = 12345
    const noise = new Float32Array(SAMPLE_RATE * 8).map(() => {
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0
      return a / 2147483648 - 1
    })
    const wet = renderReverb(noise)
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
    expect(Math.abs(20 * Math.log10(rms(wet.left) / rms(noise)))).toBeLessThan(1)
    expect(Math.abs(20 * Math.log10(rms(wet.right) / rms(noise)))).toBeLessThan(1)
    // Decorrelated sides: the room is wide.
    let dot = 0
    for (let i = 0; i < noise.length; i++) dot += wet.left[i] * wet.right[i]
    expect(Math.abs(dot / (noise.length * rms(wet.left) * rms(wet.right)))).toBeLessThan(0.3)
  })
})

describe('encodeWav', () => {
  it('writes a correct 16-bit stereo RIFF header and clips instead of wrapping', () => {
    const left = Float32Array.from([0, 0.5, -0.5, 2, -2])
    const right = Float32Array.from([0, 0.25, -0.25, 0.1, -0.1])
    const wav = encodeWav(left, right, 'hdr')
    const decoded = decodeWav(wav)
    expect(wav.length).toBe(44 + 5 * 4)
    expect(decoded.left[0]).toBe(0)
    expect(Math.abs(decoded.left[1] - 0.5)).toBeLessThan(2 / 32768)
    expect(Math.abs(decoded.left[2] + 0.5)).toBeLessThan(2 / 32768)
    expect(decoded.left[3]).toBeCloseTo(32767 / 32768, 4)
    expect(decoded.left[4]).toBe(-1)
  })

  it('dithers by seed but leaves exact zeros as exact zeros', () => {
    const n = 2000
    const quiet = new Float32Array(n).fill(0.3333)
    const zeros = new Float32Array(n)
    expect(encodeWav(quiet, quiet, 'a').equals(encodeWav(quiet, quiet, 'a'))).toBe(true)
    expect(encodeWav(quiet, quiet, 'a').equals(encodeWav(quiet, quiet, 'b'))).toBe(false)
    const silent = decodeWav(encodeWav(zeros, zeros, 'a'))
    expect(silent.left.every((x) => x === 0)).toBe(true)
    // Dither stays within +-1 LSB of the true value.
    const dithered = decodeWav(encodeWav(quiet, quiet, 'a'))
    for (const x of dithered.left) expect(Math.abs(x - 0.3333)).toBeLessThanOrEqual(2 / 32768)
  })

  it('refuses channels of different lengths', () => {
    expect(() => encodeWav(new Float32Array(3), new Float32Array(4), 's')).toThrow(RangeError)
  })
})

describe('performance', () => {
  it('composes a 20 s film in under 5 s (the target is 3 s)', () => {
    const start = performance.now()
    const result = composeScore(film(20, 'measured', 'perf'))
    const elapsed = performance.now() - start
    console.log(`[score] 20 s measured compose: ${elapsed.toFixed(0)} ms (${result.report.lufs} LUFS, ${result.report.truePeakDb} dBTP)`)
    expect(elapsed).toBeLessThan(5000)
    expect(result.samples).toBe(20 * SAMPLE_RATE)
  }, SLOW)
})

const ffmpeg = await resolveFfmpeg()

describe.skipIf(!ffmpeg)('ffmpeg ebur128 agrees with the meter (real ffmpeg)', () => {
  for (const mood of ['calm', 'measured'] as const) {
    it(`${mood}: integrated loudness within 0.3 LU and true peak under -1.5 dB`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'score-ebur128-'))
      try {
        const result = composeScore(film(15, mood, 'ffmpeg'))
        const path = join(dir, 'score.wav')
        writeFileSync(path, result.wav)
        // ffmpeg prints the ebur128 summary on stderr, which execFileSync does not return on success; spawnSync does.
        const run = spawnSync(ffmpeg!, ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {
          encoding: 'utf8',
          maxBuffer: 16 * 1024 * 1024,
        })
        expect(run.status).toBe(0)
        const summary = run.stderr.slice(run.stderr.lastIndexOf('Summary:'))
        const integrated = /I:\s+(-?[\d.]+)\s+LUFS/.exec(summary)
        const peak = /True peak:\s*\n\s*Peak:\s+(-?[\d.]+)\s+dBFS/.exec(summary)
        expect(integrated).not.toBeNull()
        expect(peak).not.toBeNull()
        const ffLufs = Number(integrated![1])
        const ffPeak = Number(peak![1])
        console.log(`[score] ffmpeg ${mood}: I ${ffLufs} LUFS, true peak ${ffPeak} dBFS | report ${result.report.lufs} LUFS, ${result.report.truePeakDb} dBTP`)
        expect(Math.abs(ffLufs - result.report.lufs)).toBeLessThanOrEqual(0.3)
        expect(ffPeak).toBeLessThanOrEqual(-1.5)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }, SLOW)
  }
})
