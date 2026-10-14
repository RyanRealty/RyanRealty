import { describe, expect, it } from 'vitest'
import { MIN_CARD_SECONDS } from '../motion/cues'
import { REVEAL_SECONDS } from '../motion/reveal'
import {
  CARD_CUT_MARGIN_SECONDS,
  DOLLAR_FIRST_BY_SECONDS,
  HookError,
  QUESTION_READ_SECONDS,
  dollarFirstWindow,
  findSpoken,
  questionTurnWindows,
  sendInviteWindow,
} from './hooks'
import type { SpokenWord } from '../voice/types'

const said = (text: string, from = 0, step = 0.3): SpokenWord[] =>
  text.split(' ').map((word, i) => ({ word, start: from + i * step, end: from + i * step + step * 0.8 }))

describe('dollar_first_hook', () => {
  it('puts the figure fully on screen by 1.0 s and holds it to the cut', () => {
    const w = dollarFirstWindow({ start: 0, end: 3.75 })
    expect(w.start).toBe(0.1)
    expect(w.onScreenBy).toBeCloseTo(0.1 + REVEAL_SECONDS, 3)
    expect(w.onScreenBy).toBeLessThanOrEqual(DOLLAR_FIRST_BY_SECONDS)
    expect(w.end).toBe(3.75 - CARD_CUT_MARGIN_SECONDS)
  })

  it('refuses a hook that starts too late for the figure to land by 1.0 s', () => {
    expect(() => dollarFirstWindow({ start: 0.6, end: 4 })).toThrow(HookError)
    expect(() => dollarFirstWindow({ start: 0.6, end: 4 })).toThrow(/by 1s/)
  })

  it('refuses a hook too short to hold the number 2.5 s', () => {
    expect(() => dollarFirstWindow({ start: 0, end: 2.5 })).toThrow(/at least 2.5s/)
  })
})

describe('question_secret_hook', () => {
  it('lands the question first and the turn after it has been read, both held 2.5 s', () => {
    const w = questionTurnWindows({ start: 0, end: 4.4 }, 'Shopping in Bend this fall?')
    expect(w.question.start).toBe(0.1)
    expect(w.turn.start).toBeCloseTo(0.1 + 0.4 + QUESTION_READ_SECONDS, 3)
    expect(w.question.end).toBe(w.turn.end)
    expect(w.question.end - w.question.start).toBeGreaterThanOrEqual(MIN_CARD_SECONDS)
    expect(w.turn.end - w.turn.start).toBeGreaterThanOrEqual(MIN_CARD_SECONDS)
  })

  it('waits for the voice to finish the question when it says it', () => {
    const words = said('Shopping in Bend this fall? Here is the turn', 0.3, 0.35)
    const w = questionTurnWindows({ start: 0, end: 6 }, 'Shopping in Bend this fall?', words)
    // "fall?" is word 4 and ends at 0.3 + 4 * 0.35 + 0.28.
    expect(w.turn.start).toBeCloseTo(0.3 + 4 * 0.35 + 0.28 + 0.1, 3)
  })

  it('refuses a card that is not a question, and a hook too short for the turn to hold', () => {
    expect(() => questionTurnWindows({ start: 0, end: 5 }, 'Shopping in Bend this fall')).toThrow(/must be a question/)
    expect(() => questionTurnWindows({ start: 0, end: 3.5 }, 'Shopping in Bend?')).toThrow(/the turn lands/)
  })
})

describe('send_invite_hook', () => {
  const line = "Send this to whoever you're house hunting with."
  const words = said("Honestly? Buyers have leverage this fall. Send this to whoever you're house hunting with.", 7.5)

  it('places the share card before the end card and finds the line in the voice', () => {
    const w = sendInviteWindow({ start: 9.9, end: 13.2, text: line }, 13.2, words)
    expect(w.start).toBeGreaterThan(9.9)
    expect(w.end).toBeLessThanOrEqual(13.2)
    expect(w.end - w.start).toBeGreaterThanOrEqual(MIN_CARD_SECONDS)
    expect(words[w.spoken.first].word).toBe('Send')
    expect(words[w.spoken.last].word).toBe('with.')
  })

  it('refuses a card on the end card, a line that is not a share, and a line nobody says', () => {
    expect(() => sendInviteWindow({ start: 9.9, end: 13.5, text: line }, 13.2, words)).toThrow(/never on it/)
    expect(() => sendInviteWindow({ start: 9.9, end: 13.2, text: 'Call us today.' }, 13.2, words)).toThrow(/send or share/)
    expect(() => sendInviteWindow({ start: 9.9, end: 13.2, text: 'Share this with a friend.' }, 13.2, words)).toThrow(/never says/)
    expect(() => sendInviteWindow({ start: 9.9, end: 11.5, text: line }, 13.2, words)).toThrow(/needs 2.5s/)
  })
})

describe('findSpoken', () => {
  it('matches a line ignoring case, punctuation and curly quotes', () => {
    const words = said('So... send THIS to whoever you’re house hunting with!')
    expect(findSpoken("Send this to whoever you're house hunting with.", words)).toEqual({ first: 1, last: 8 })
    expect(findSpoken('house hunting alone', words)).toBeNull()
    expect(findSpoken('', words)).toBeNull()
  })
})
