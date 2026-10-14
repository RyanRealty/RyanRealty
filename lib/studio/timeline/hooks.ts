/**
 * lib/studio/timeline/hooks.ts: the hook devices and the share line, as code.
 *
 * Three ryan-studio techniques live here (techniques/registry.json):
 *
 *  - dollar_first_hook (hook): the film opens on a sourced figure, fully on
 *    screen by 1.0 s. The hook beat's first card is a number card bound to a
 *    brief.numbers row; it starts at 0.1 s and its eased reveal (12 frames)
 *    lands at 0.5 s, well inside the 1.0 s the recipe asks for and the 1.5 s a
 *    buyer ad allows (video_types.json hook_max_s).
 *  - question_secret_hook (hook): a question card, then the turn. The question
 *    lands first and holds through the hook; the turn lands under it once the
 *    question has been read (or spoken, when the voice says it), and both stay
 *    up at least 2.5 s (RULEBOOK 2b).
 *  - send_invite_hook (cta): a share line ("Send this to whoever you're house
 *    hunting with.") on its own card before the end card, never on it, and said
 *    by the voice so the captions carry it too.
 *
 * Pure: plain data in, cue timings out, every rule a thrown HookError naming the
 * fix. The planner (plan.ts) calls these; the renderer proves each ran from
 * what the page actually drew (render.ts) before it is written to the manifest.
 */
import { REVEAL_SECONDS } from '../motion/reveal'
import { ENTER_SECONDS, MIN_CARD_SECONDS } from '../motion/cues'
import type { SpokenWord } from '../voice/types'

/** When a hook's first card starts. Fully in by this plus its entrance. */
export const HOOK_LEAD_SECONDS = 0.1
/** dollar_first_hook: the figure is fully on screen by this (the recipe's 1.0 s). */
export const DOLLAR_FIRST_BY_SECONDS = 1.0
/** question_secret_hook: the question is read for at least this long before the turn lands. */
export const QUESTION_READ_SECONDS = 1.2
/** A card after the hook enters this long after its beat's cut: the picture lands, then the words. */
export const CARD_LEAD_SECONDS = 0.15
/** A card leaves this long before its beat's cut, so it never straddles a change of picture. */
export const CARD_CUT_MARGIN_SECONDS = 0.05
/** Where each stacked card sits, px from the top at 1080 x 1920: above the caption band (y 1160). */
export const CARD_TOPS = [300, 640] as const

export class HookError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HookError'
  }
}

export type Window = { start: number; end: number }

const r3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * dollar_first_hook. The number card's window in a hook beat, or a HookError
 * when the beat cannot hold the figure the way the recipe asks.
 */
export function dollarFirstWindow(beat: Window): Window & { onScreenBy: number } {
  const start = r3(beat.start + HOOK_LEAD_SECONDS)
  const onScreenBy = r3(start + REVEAL_SECONDS)
  const end = r3(beat.end - CARD_CUT_MARGIN_SECONDS)
  if (onScreenBy > DOLLAR_FIRST_BY_SECONDS + 1e-9) {
    throw new HookError(`dollar_first_hook: the figure lands at ${onScreenBy}s; it must be fully on screen by ${DOLLAR_FIRST_BY_SECONDS}s (start the hook beat at 0)`)
  }
  if (end - start < MIN_CARD_SECONDS - 1e-9) {
    throw new HookError(`dollar_first_hook: the figure holds ${r3(end - start)}s; every number holds at least ${MIN_CARD_SECONDS}s (lengthen the hook beat)`)
  }
  return { start, end, onScreenBy }
}

function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Where a line is spoken in the voice: the first word index of a run of spoken
 * words that says exactly `line` (case, punctuation and tags ignored), or -1.
 */
export function findSpoken(line: string, words: readonly SpokenWord[]): { first: number; last: number } | null {
  const want = normalise(line)
  if (want.length === 0) return null
  const said = words.map((w) => normalise(w.word).join(' '))
  for (let i = 0; i + want.length <= said.length; i++) {
    let ok = true
    for (let k = 0; k < want.length; k++) {
      if (said[i + k] !== want[k]) {
        ok = false
        break
      }
    }
    if (ok) return { first: i, last: i + want.length - 1 }
  }
  return null
}

/**
 * question_secret_hook. The question card holds the whole hook; the turn lands
 * after the question has been read, or after the voice has said it when it
 * does, and holds to the cut. Both hold at least MIN_CARD_SECONDS.
 */
export function questionTurnWindows(
  beat: Window,
  question: string,
  words: readonly SpokenWord[] = [],
): { question: Window; turn: Window } {
  if (!question.trim().endsWith('?')) throw new HookError('question_secret_hook: the question card must be a question (end it with "?")')
  const qStart = r3(beat.start + HOOK_LEAD_SECONDS)
  const end = r3(beat.end - CARD_CUT_MARGIN_SECONDS)
  const spoken = findSpoken(question, words)
  const afterRead = qStart + ENTER_SECONDS + QUESTION_READ_SECONDS
  const afterSaid = spoken ? words[spoken.last].end + 0.1 : 0
  const turnStart = r3(Math.max(afterRead, afterSaid))
  if (end - qStart < MIN_CARD_SECONDS - 1e-9) {
    throw new HookError(`question_secret_hook: the question holds ${r3(end - qStart)}s; lengthen the hook beat to at least ${r3(MIN_CARD_SECONDS + HOOK_LEAD_SECONDS + CARD_CUT_MARGIN_SECONDS)}s`)
  }
  if (end - turnStart < MIN_CARD_SECONDS - 1e-9) {
    throw new HookError(
      `question_secret_hook: the turn lands at ${turnStart}s and holds ${r3(end - turnStart)}s; it needs ${MIN_CARD_SECONDS}s (end the hook beat at ${r3(turnStart + MIN_CARD_SECONDS + CARD_CUT_MARGIN_SECONDS)}s or later)`,
    )
  }
  return { question: { start: qStart, end }, turn: { start: turnStart, end } }
}

/**
 * send_invite_hook. The share card's window, and where the voice says the line.
 * The card is its own beat before the end card and the line must be spoken, so
 * the captions show it too (the recipe: "in caption/VO").
 */
export function sendInviteWindow(
  cta: Window & { text: string },
  endcardStart: number | null,
  words: readonly SpokenWord[],
): Window & { spoken: { first: number; last: number } } {
  if (!/\b(send|share)\b/i.test(cta.text)) throw new HookError('send_invite_hook: the line must ask the viewer to send or share the film')
  if (endcardStart !== null && cta.end > endcardStart + 1e-6) {
    throw new HookError(`send_invite_hook: the share card runs to ${cta.end}s, into the end card at ${endcardStart}s; it goes before the end card, never on it`)
  }
  const start = r3(cta.start + CARD_LEAD_SECONDS)
  const end = r3(cta.end - CARD_CUT_MARGIN_SECONDS)
  if (end - start < MIN_CARD_SECONDS - 1e-9) {
    throw new HookError(`send_invite_hook: the share card holds ${r3(end - start)}s; it needs ${MIN_CARD_SECONDS}s`)
  }
  const spoken = findSpoken(cta.text, words)
  if (!spoken) throw new HookError(`send_invite_hook: the voice never says "${cta.text}"; put the line in voice.script so the captions carry it`)
  return { start, end, spoken }
}
