/**
 * lib/studio/score/voices.ts — the four instruments that are not the pad.
 *
 *  felt  a soft mallet on a felt string: a sine with a quieter second and third
 *        harmonic that die faster, a few milliseconds of attack, an exponential
 *        decay, and a trace of low-passed hammer noise so it is struck, not
 *        generated. Cards arriving, the measured pulse, and the chart's months.
 *  tick  a tuned mallet tick in octave 6: a fundamental and two inharmonic
 *        partials (2.76x and 5.4x, the free-bar ratios) that die faster. Figures
 *        landing.
 *  bell  two-operator FM at ratio 3.5, the index decaying over 0.35 s while the
 *        amplitude rings for seconds. The closer lockup, once.
 *  sub   a sine on the tonic and the fifth in octave 2 to 3, soft: the low warm
 *        dyad under the bell.
 *
 * Each voice ADDS into a stereo buffer (so notes overlap) and into a mono
 * reverb send. Decays run by multiplying an envelope each sample, and the felt's
 * partials come from one rotating phasor, so a 20 s film's worth of notes is
 * cheap. Levels are set by the caller against the pad's measured loudness; the
 * reference levels at the bottom give each voice a known unit to scale from.
 */
import { TWO_PI, midiToHz, panGains } from './dsp'
import { SAMPLE_RATE } from './types'

export type StereoBuf = { left: Float32Array; right: Float32Array }
/** Where a note goes: a dry stereo bus, and a mono send into the reverb. */
export type NoteTarget = { bus: StereoBuf; send: Float32Array }

type Common = {
  /** First sample the note sounds on. */
  start: number
  /** Linear gain on the unit-level voice. */
  gain: number
  /** -1 to 1, constant power. */
  pan: number
  /** Linear gain into the reverb send. */
  send: number
}

export type FeltOptions = Common & {
  midi: number
  /** Decay time constant of the fundamental, seconds (0.6 to 1.2 for a ringing note, shorter for a datum). */
  tau: number
  /** Attack, seconds (4 to 8 ms). */
  attack: number
  /** Seeded source for the hammer noise. */
  rand: () => number
}

/** Hammer noise sits at -30 dB under the fundamental; the low-passed noise has about 0.23 of its input's RMS. */
const HAMMER_GAIN = Math.pow(10, -30 / 20) / 0.23
const HAMMER_DECAY = 0.012
const HAMMER_CUTOFF = 2500

/** A felt-mallet note. Fundamental, plus the 2nd and 3rd harmonics at -12 and -20 dB that decay faster. */
export function addFelt(target: NoteTarget, o: FeltOptions): void {
  const { left, right } = target.bus
  const total = left.length
  if (o.start >= total || o.start < 0) return
  const length = Math.min(total - o.start, Math.ceil(o.tau * 7.5 * SAMPLE_RATE))
  const w = (TWO_PI * midiToHz(o.midi)) / SAMPLE_RATE
  const cd = Math.cos(w)
  const sd = Math.sin(w)
  let c = 1
  let s = 0
  const r1 = Math.exp(-1 / (o.tau * SAMPLE_RATE))
  const r2 = Math.exp(-1 / (o.tau * 0.5 * SAMPLE_RATE))
  const r3 = Math.exp(-1 / (o.tau * 0.3 * SAMPLE_RATE))
  let e1 = 1
  let e2 = 1
  let e3 = 1
  const [gl, gr] = panGains(o.pan)
  const attackLength = Math.max(1, Math.round(o.attack * SAMPLE_RATE))
  const hammerLength = Math.min(length, Math.round(0.08 * SAMPLE_RATE))
  const hammerSmooth = 1 - Math.exp((-TWO_PI * HAMMER_CUTOFF) / SAMPLE_RATE)
  const hammerDecay = Math.exp(-1 / (HAMMER_DECAY * SAMPLE_RATE))
  let hammerState = 0
  let hammerEnv = HAMMER_GAIN
  const second = Math.pow(10, -12 / 20)
  const third = Math.pow(10, -20 / 20)
  for (let i = 0; i < length; i++) {
    // sin(2x) and sin(3x) straight from sin(x) and cos(x): one phasor drives all three partials.
    const sin2 = 2 * s * c
    const sin3 = s * (3 - 4 * s * s)
    let v = s * e1 + second * sin2 * e2 + third * sin3 * e3
    if (i < hammerLength) {
      hammerState += hammerSmooth * (o.rand() * 2 - 1 - hammerState)
      v += hammerState * hammerEnv
      hammerEnv *= hammerDecay
    }
    if (i < attackLength) v *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attackLength)
    v *= o.gain
    const index = o.start + i
    left[index] += v * gl
    right[index] += v * gr
    target.send[index] += v * o.send
    const nc = c * cd - s * sd
    s = s * cd + c * sd
    c = nc
    e1 *= r1
    e2 *= r2
    e3 *= r3
  }
}

export type TickOptions = Common & {
  midi: number
  /** Decay of the fundamental, seconds (10 to 20 ms). */
  tau: number
  rand: () => number
}

/** A tuned mallet tick: fundamental, free-bar partials at 2.76x and 5.4x dying faster, a half-millisecond felt transient. */
export function addTick(target: NoteTarget, o: TickOptions): void {
  const { left, right } = target.bus
  const total = left.length
  if (o.start >= total || o.start < 0) return
  const length = Math.min(total - o.start, Math.ceil(o.tau * 9 * SAMPLE_RATE))
  const f = midiToHz(o.midi)
  const partials = [
    { w: (TWO_PI * f) / SAMPLE_RATE, amp: 1, decay: Math.exp(-1 / (o.tau * SAMPLE_RATE)) },
    { w: (TWO_PI * f * 2.76) / SAMPLE_RATE, amp: 0.22, decay: Math.exp(-1 / (o.tau * 0.4 * SAMPLE_RATE)) },
    { w: (TWO_PI * f * 5.4) / SAMPLE_RATE, amp: 0.06, decay: Math.exp(-1 / (o.tau * 0.15 * SAMPLE_RATE)) },
  ]
  const [gl, gr] = panGains(o.pan)
  const onset = Math.max(1, Math.round(0.0003 * SAMPLE_RATE))
  const smooth = 1 - Math.exp((-TWO_PI * 4000) / SAMPLE_RATE)
  const transientDecay = Math.exp(-1 / (0.0005 * SAMPLE_RATE))
  let transientState = 0
  let transientEnv = 0.3 / 0.45
  const env = [1, 1, 1]
  for (let i = 0; i < length; i++) {
    let v = 0
    for (let p = 0; p < 3; p++) {
      v += partials[p].amp * Math.sin(partials[p].w * i) * env[p]
      env[p] *= partials[p].decay
    }
    if (transientEnv > 1e-4) {
      transientState += smooth * (o.rand() * 2 - 1 - transientState)
      v += transientState * transientEnv
      transientEnv *= transientDecay
    }
    if (i < onset) v *= i / onset
    v *= o.gain
    const index = o.start + i
    left[index] += v * gl
    right[index] += v * gr
    target.send[index] += v * o.send
  }
}

export type BellOptions = Common & { midi: number }

/** The lockup bell: FM at ratio 3.5, index about 2 decaying over 0.35 s, amplitude tau 1.5 s, with a short second partial. */
export function addBell(target: NoteTarget, o: BellOptions): void {
  const { left, right } = target.bus
  const total = left.length
  if (o.start >= total || o.start < 0) return
  const tau = 1.5
  const length = Math.min(total - o.start, Math.ceil(tau * 7 * SAMPLE_RATE))
  const w = (TWO_PI * midiToHz(o.midi)) / SAMPLE_RATE
  const rAmp = Math.exp(-1 / (tau * SAMPLE_RATE))
  const rMod = Math.exp(-1 / (0.35 * SAMPLE_RATE))
  const rSecond = Math.exp(-1 / (tau * 0.35 * SAMPLE_RATE))
  let eAmp = 1
  let eMod = 2
  let eSecond = 0.15
  const [gl, gr] = panGains(o.pan)
  const attackLength = Math.round(0.003 * SAMPLE_RATE)
  for (let i = 0; i < length; i++) {
    let v = Math.sin(w * i + Math.sin(3.5 * w * i) * eMod) * eAmp + Math.sin(2 * w * i) * eSecond
    if (i < attackLength) v *= i / attackLength
    v *= o.gain
    const index = o.start + i
    left[index] += v * gl
    right[index] += v * gr
    target.send[index] += v * o.send
    eAmp *= rAmp
    eMod *= rMod
    eSecond *= rSecond
  }
}

export type SubOptions = Common & { midi: number }

/** A soft sine on the tonic with the fifth above it and a trace of the octave, so a phone speaker still hears it. */
export function addSub(target: NoteTarget, o: SubOptions): void {
  const { left, right } = target.bus
  const total = left.length
  if (o.start >= total || o.start < 0) return
  const tau = 1.5
  const length = Math.min(total - o.start, Math.ceil(tau * 6 * SAMPLE_RATE))
  const f = midiToHz(o.midi)
  const wTonic = (TWO_PI * f) / SAMPLE_RATE
  const wFifth = (TWO_PI * f * 1.5) / SAMPLE_RATE
  const r = Math.exp(-1 / (tau * SAMPLE_RATE))
  const rFifth = Math.exp(-1 / (tau * 0.8 * SAMPLE_RATE))
  let e = 1
  let eFifth = 0.6
  const octave = Math.pow(10, -14 / 20)
  const [gl, gr] = panGains(o.pan)
  const attackLength = Math.round(0.025 * SAMPLE_RATE)
  for (let i = 0; i < length; i++) {
    let v = (Math.sin(wTonic * i) + octave * Math.sin(2 * wTonic * i)) * e + Math.sin(wFifth * i) * eFifth
    if (i < attackLength) v *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attackLength)
    v *= o.gain
    const index = o.start + i
    left[index] += v * gl
    right[index] += v * gr
    target.send[index] += v * o.send
    e *= r
    eFifth *= rFifth
  }
}

/** Mean-square power of a stereo span, averaged over both channels: sqrt gives the RMS the pad is measured in. */
export function stereoRms(buf: StereoBuf, from: number, to: number): number {
  const end = Math.min(to, buf.left.length)
  if (end <= from) return 0
  let sum = 0
  for (let i = from; i < end; i++) sum += buf.left[i] * buf.left[i] + buf.right[i] * buf.right[i]
  return Math.sqrt(sum / (2 * (end - from)))
}

export type VoiceReference = {
  /** RMS over the voice's first half second at unit gain. */
  rms: number
  /** Largest sample at unit gain. */
  peak: number
}

const references = new Map<string, VoiceReference>()

function measure(render: (target: NoteTarget) => void): VoiceReference {
  const frames = Math.round(0.5 * SAMPLE_RATE)
  const bus = { left: new Float32Array(frames), right: new Float32Array(frames) }
  render({ bus, send: new Float32Array(frames) })
  let peak = 0
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(bus.left[i]), Math.abs(bus.right[i]))
  return { rms: stereoRms(bus, 0, frames), peak }
}

/**
 * The unit each voice is scaled from. A felt note's loudness is "its first half
 * second's RMS", a tick's is its peak (it is over in 30 ms, so an RMS says
 * nothing about what the ear hears), a bell's and a sub's are their first half
 * second like a felt note. Measured once at A4 (tick: G6) and cached; the same
 * seeded noise every time, so the unit never moves.
 */
export function voiceReference(kind: 'felt' | 'tick' | 'bell' | 'sub'): VoiceReference {
  const cached = references.get(kind)
  if (cached) return cached
  const noise = () => {
    // A fixed little generator, so the reference is the same on every machine and every run.
    let a = 0x9e3779b9
    return () => {
      a = (Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0
      return a / 4294967296
    }
  }
  const unit = { start: 0, gain: 1, pan: 0, send: 0 }
  let ref: VoiceReference
  if (kind === 'felt') ref = measure((t) => addFelt(t, { ...unit, midi: 69, tau: 0.9, attack: 0.006, rand: noise() }))
  else if (kind === 'tick') ref = measure((t) => addTick(t, { ...unit, midi: 91, tau: 0.014, rand: noise() }))
  else if (kind === 'bell') ref = measure((t) => addBell(t, { ...unit, midi: 74 }))
  else ref = measure((t) => addSub(t, { ...unit, midi: 50 }))
  references.set(kind, ref)
  return ref
}
