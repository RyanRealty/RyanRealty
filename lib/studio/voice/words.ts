/**
 * lib/studio/voice/words.ts: the engine's characters to the words a listener hears.
 *
 * ElevenLabs times every character of the text we sent, markup included. A
 * caption must show what is SAID, so this reads the characters back into
 * words and drops what is not speech:
 *
 *  - audio tags in square brackets (`[warm]`, `[short pause]`): direction to
 *    the engine, not words;
 *  - ellipses (`...`, `..`, and the one-glyph ellipsis character): a pause marker. It also ends a
 *    word, so "wait...what" is two words;
 *  - whitespace, and any token with no letter or digit in it (a lone dash).
 *
 * Punctuation stays attached to its word ("Okay," "thing.") because a caption
 * reads it as written. Timing is the engine's: a word starts at its first
 * letter or digit and ends at its last one, so a trailing comma's time (which
 * can cover the breath after the word) never stretches the word, and the gap
 * to the next word stays honest for pause detection.
 *
 * Pure: no clock, no network, no randomness.
 */
import type { CharacterAlignment, SpokenWord } from './types'

const ALNUM = /[\p{L}\p{N}]/u
const WHITESPACE = /\s/u

type Cell = { ch: string; start: number; end: number }

/** The alignment as one cell per Unicode code point (an entry holding two code points shares its time between them). */
function toCells(alignment: CharacterAlignment): Cell[] {
  const { characters, characterStartTimesSeconds: starts, characterEndTimesSeconds: ends } = alignment
  if (starts.length !== characters.length || ends.length !== characters.length) {
    throw new RangeError(
      `alignmentToWords: ${characters.length} characters but ${starts.length} start times and ${ends.length} end times`,
    )
  }
  const cells: Cell[] = []
  for (let i = 0; i < characters.length; i++) {
    const start = starts[i]
    const end = ends[i]
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new RangeError(`alignmentToWords: character ${i} has a non-finite time`)
    }
    for (const ch of Array.from(characters[i])) cells.push({ ch, start, end })
  }
  return cells
}

/** True for each cell that is a separator: whitespace, an audio tag, an ellipsis. */
function separatorMask(cells: Cell[]): boolean[] {
  const mask = new Array<boolean>(cells.length).fill(false)
  let i = 0
  while (i < cells.length) {
    const ch = cells[i].ch
    if (ch === '[') {
      let close = -1
      for (let j = i + 1; j < cells.length; j++) {
        if (cells[j].ch === ']') {
          close = j
          break
        }
      }
      if (close === -1) {
        // An unterminated bracket: drop the bracket alone, never the speech after it.
        mask[i] = true
        i++
      } else {
        for (let j = i; j <= close; j++) mask[j] = true
        i = close + 1
      }
    } else if (ch === '\u2026') {
      mask[i] = true
      i++
    } else if (ch === '.') {
      let j = i
      while (j < cells.length && cells[j].ch === '.') j++
      if (j - i >= 2) for (let k = i; k < j; k++) mask[k] = true
      i = j
    } else {
      if (WHITESPACE.test(ch)) mask[i] = true
      i++
    }
  }
  return mask
}

/**
 * Word timings from a character alignment: `{ word, start, end }` in seconds
 * from the first sample of the audio, in spoken order. Starts never decrease,
 * `end >= start`, and a word never runs past the next word's start.
 */
export function alignmentToWords(alignment: CharacterAlignment): SpokenWord[] {
  const cells = toCells(alignment)
  const separator = separatorMask(cells)
  const words: SpokenWord[] = []
  let i = 0
  while (i < cells.length) {
    if (separator[i]) {
      i++
      continue
    }
    let j = i
    while (j < cells.length && !separator[j]) j++
    const token = cells.slice(i, j)
    i = j
    const firstAlnum = token.findIndex((c) => ALNUM.test(c.ch))
    if (firstAlnum === -1) continue
    let lastAlnum = token.length - 1
    while (!ALNUM.test(token[lastAlnum].ch)) lastAlnum--
    const start = token[firstAlnum].start
    const end = Math.max(start, token[lastAlnum].end)
    words.push({ word: token.map((c) => c.ch).join(''), start, end })
  }
  // The engine's times can wobble by a few milliseconds around a word edge: make them a clean sequence.
  for (let k = 1; k < words.length; k++) {
    if (words[k].start < words[k - 1].start) {
      words[k].start = words[k - 1].start
      words[k].end = Math.max(words[k].end, words[k].start)
    }
  }
  for (let k = 0; k + 1 < words.length; k++) {
    if (words[k].end > words[k + 1].start) words[k].end = Math.max(words[k].start, words[k + 1].start)
  }
  return words
}
