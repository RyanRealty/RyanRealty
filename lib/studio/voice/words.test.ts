import { describe, expect, it } from 'vitest'
import { alignmentToWords } from './words'
import type { CharacterAlignment } from './types'

/** An alignment for `text` where character i spans [i*step, (i+1)*step), contiguous like the engine's. */
function align(text: string, step = 0.05): CharacterAlignment {
  const characters = Array.from(text)
  return {
    characters,
    characterStartTimesSeconds: characters.map((_, i) => i * step),
    characterEndTimesSeconds: characters.map((_, i) => (i + 1) * step),
  }
}

/** The alignment ElevenLabs eleven_v3 returned for "[warm] Okay, so... here's the thing." (live smoke, 2026-10-13, voice Ellen, pcm_48000). */
const SMOKE_TAGGED: CharacterAlignment = {
  characters: Array.from("[warm] Okay, so... here's the thing."),
  characterStartTimesSeconds: [
    0, 0.04, 0.08, 0.107, 0.133, 0.16, 0.24, 0.256, 0.272, 0.288, 0.304, 0.32, 0.48, 0.56, 0.64, 0.72, 0.853, 0.987, 1.12, 1.152,
    1.184, 1.216, 1.248, 1.28, 1.36, 1.44, 1.46, 1.48, 1.5, 1.52, 1.56, 1.6, 1.64, 1.68, 1.72, 1.76,
  ],
  characterEndTimesSeconds: [
    0.04, 0.08, 0.107, 0.133, 0.16, 0.24, 0.256, 0.272, 0.288, 0.304, 0.32, 0.48, 0.56, 0.64, 0.72, 0.853, 0.987, 1.12, 1.152, 1.184,
    1.216, 1.248, 1.28, 1.36, 1.44, 1.46, 1.48, 1.5, 1.52, 1.56, 1.6, 1.64, 1.68, 1.72, 1.76, 1.92,
  ],
}

/** The same engine and voice for the plain line "Okay, so... here's the thing." */
const SMOKE_PLAIN: CharacterAlignment = {
  characters: Array.from("Okay, so... here's the thing."),
  characterStartTimesSeconds: [
    0, 0.1, 0.2, 0.3, 0.4, 0.56, 0.667, 0.773, 0.88, 1.067, 1.253, 1.44, 1.488, 1.536, 1.584, 1.632, 1.68, 1.72, 1.76, 1.8, 1.84, 1.88,
    1.92, 1.973, 2.027, 2.08, 2.133, 2.187, 2.24,
  ],
  characterEndTimesSeconds: [
    0.1, 0.2, 0.3, 0.4, 0.56, 0.667, 0.773, 0.88, 1.067, 1.253, 1.44, 1.488, 1.536, 1.584, 1.632, 1.68, 1.72, 1.76, 1.8, 1.84, 1.88, 1.92,
    1.973, 2.027, 2.08, 2.133, 2.187, 2.24, 2.4,
  ],
}

describe('alignmentToWords', () => {
  it('reads the real v3 alignment of a tagged line: the tag and the ellipsis are not words', () => {
    expect(alignmentToWords(SMOKE_TAGGED)).toEqual([
      { word: 'Okay,', start: 0.256, end: 0.32 },
      { word: 'so', start: 0.56, end: 0.72 },
      { word: "here's", start: 1.152, end: 1.44 },
      { word: 'the', start: 1.46, end: 1.52 },
      { word: 'thing.', start: 1.56, end: 1.76 },
    ])
  })

  it('reads the real v3 alignment of the plain line, ending a word at its last letter not its trailing punctuation', () => {
    const words = alignmentToWords(SMOKE_PLAIN)
    expect(words.map((w) => w.word)).toEqual(['Okay,', 'so', "here's", 'the', 'thing.'])
    // "thing." : the period carries the 0.16 s of trailing silence (2.24 to 2.4); the word ends with the g.
    expect(words[4]).toEqual({ word: 'thing.', start: 1.973, end: 2.24 })
    // "Okay," : the comma carries 0.4 to 0.56.
    expect(words[0]).toEqual({ word: 'Okay,', start: 0, end: 0.4 })
  })

  it('keeps punctuation attached and the original case', () => {
    const words = alignmentToWords(align('Hello, Bend! Is it $5.50? "Yes."'))
    expect(words.map((w) => w.word)).toEqual(['Hello,', 'Bend!', 'Is', 'it', '$5.50?', '"Yes."'])
  })

  it('drops every audio tag, and a tag does not glue two words together', () => {
    const words = alignmentToWords(align('[warm, conversational tone]Okay[short pause]then [laughs] fine.'))
    expect(words.map((w) => w.word)).toEqual(['Okay', 'then', 'fine.'])
  })

  it('drops ellipses of any kind, and an ellipsis ends the word before it', () => {
    expect(alignmentToWords(align('wait...what')).map((w) => w.word)).toEqual(['wait', 'what'])
    expect(alignmentToWords(align('so\u2026 yes')).map((w) => w.word)).toEqual(['so', 'yes'])
    expect(alignmentToWords(align('hmm.. okay')).map((w) => w.word)).toEqual(['hmm', 'okay'])
    expect(alignmentToWords(align('...hello')).map((w) => w.word)).toEqual(['hello'])
  })

  it('keeps a single period (a sentence end, a decimal, an abbreviation)', () => {
    expect(alignmentToWords(align('It is 3.5 percent. Fine.')).map((w) => w.word)).toEqual(['It', 'is', '3.5', 'percent.', 'Fine.'])
  })

  it('keeps a hyphenated number or word as one word', () => {
    expect(alignmentToWords(align('sixty-three percent')).map((w) => w.word)).toEqual(['sixty-three', 'percent'])
  })

  it('drops a token with no letter or digit in it', () => {
    expect(alignmentToWords(align('yes - no ? maybe')).map((w) => w.word)).toEqual(['yes', 'no', 'maybe'])
  })

  it('drops an unterminated bracket but never the speech after it', () => {
    expect(alignmentToWords(align('[oops hello there')).map((w) => w.word)).toEqual(['oops', 'hello', 'there'])
  })

  it('times a word from its first letter to its last, not from its quote marks or punctuation', () => {
    const [word] = alignmentToWords(align('("Hi!")', 0.1))
    // ( " H i ! " ) at 0.1 s each: H is index 2 (0.2), i is index 3 (ends 0.4).
    expect(word).toEqual({ word: '("Hi!")', start: 0.2, end: 0.4 })
  })

  it('shares one entry that holds two code points between them', () => {
    const words = alignmentToWords({ characters: ['ok', 'ay'], characterStartTimesSeconds: [0, 0.2], characterEndTimesSeconds: [0.2, 0.4] })
    expect(words).toEqual([{ word: 'okay', start: 0, end: 0.4 }])
  })

  it('keeps starts from going backwards and a word from running into the next', () => {
    const alignment: CharacterAlignment = {
      characters: ['a', ' ', 'b', ' ', 'c'],
      characterStartTimesSeconds: [0.5, 0.6, 0.4, 0.7, 0.8],
      characterEndTimesSeconds: [0.75, 0.62, 0.9, 0.72, 0.9],
    }
    const words = alignmentToWords(alignment)
    expect(words.map((w) => w.start)).toEqual([0.5, 0.5, 0.8])
    for (let i = 0; i + 1 < words.length; i++) expect(words[i].end).toBeLessThanOrEqual(words[i + 1].start)
    for (const w of words) expect(w.end).toBeGreaterThanOrEqual(w.start)
  })

  it('returns no words for an alignment with none', () => {
    expect(alignmentToWords(align(''))).toEqual([])
    expect(alignmentToWords(align('[warm] ... '))).toEqual([])
  })

  it('refuses arrays of different lengths and non-finite times', () => {
    expect(() => alignmentToWords({ characters: ['a', 'b'], characterStartTimesSeconds: [0], characterEndTimesSeconds: [1, 2] })).toThrow(RangeError)
    expect(() => alignmentToWords({ characters: ['a'], characterStartTimesSeconds: [Number.NaN], characterEndTimesSeconds: [1] })).toThrow(RangeError)
  })
})
