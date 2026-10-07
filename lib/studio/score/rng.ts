/**
 * lib/studio/score/rng.ts — chance, with the dice loaded.
 *
 * A score has to be the same score every time it is asked for: the same draft
 * id must give a byte-identical WAV so a re-render never changes the sound
 * under a picture Matt already approved. So there is no Math.random and no
 * clock anywhere in this module. Every "random" choice (the key, a voicing, a
 * detune, the hammer noise on a felt note, the dither) draws from a PRNG seeded
 * by an FNV-1a hash of the seed string plus a label, so the streams are
 * independent of each other and adding a draw to one never shifts another.
 */

/** 32-bit FNV-1a of a string's UTF-16 code units. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** mulberry32: a tiny, fast 32-bit PRNG. Returns a function giving floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** An independent stream for one purpose ('key', 'voicing', 'dither'), derived from the film's seed. */
export function rngFor(seed: string, label: string): () => number {
  return mulberry32(fnv1a(`${seed}\u0000${label}`))
}
