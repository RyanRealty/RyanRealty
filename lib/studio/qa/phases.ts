/**
 * lib/studio/qa/phases.ts - when each video:check rule can first be decided.
 *
 * Matt, 2026-10-14: "I expect you to know the rules before you build a video."
 * Rules refuse before render; video:check is proof, not discovery. So every
 * check is one of:
 *
 *  - preflight: its rule can be decided from the brief, the timeline, the voice
 *    words and the planned layout. lib/studio/timeline/preflight.ts runs the
 *    SAME evaluator (lib/studio/qa/evaluate.ts and friends) on a planned
 *    manifest and refuses the film before a frame is rendered, and before the
 *    paid voice when the script alone decides it. video:check runs it again on
 *    the real manifest as the backstop.
 *  - file-only: it can only be measured in the MP4 (hashes, the encode,
 *    freezes, loudness, SSIM, OCR, the review).
 *
 * A preflight check may also have a file-only half (check 7 measures loudness
 * from the file; its voiceover half is preflight). `preflight` says what runs
 * before render and at which step, `fileOnly` what only the file can show.
 *
 * lib/studio/qa/phases.test.ts fails when a check is unclassified;
 * lib/studio/timeline/preflight.test.ts fails when a preflight check is not
 * refused by each step its row names, on a brief or timeline that breaks it.
 */

/** The steps of `studio:render` that refuse before the full render (STUDIO_ONE_FACTORY.md). */
export const PREFLIGHT_STEPS = {
  text: 'b: the script and every authored string, before voice synthesis',
  plan: 'c: the planned manifest, after synthesis and planning, before any frame',
  layout: 'd: the layout probe (one read-back per card and caption, no frames encoded), before the render',
} as const
export type PreflightStep = keyof typeof PREFLIGHT_STEPS

export type CheckPhase =
  | { id: number; name: string; phase: 'preflight'; steps: PreflightStep[]; preflight: string; fileOnly?: string }
  | { id: number; name: string; phase: 'file-only'; fileOnly: string }

export const CHECK_PHASES: readonly CheckPhase[] = [
  { id: 1, name: 'Provenance', phase: 'file-only', fileOnly: 'the MP4 and brief hashes against the manifest' },
  { id: 2, name: 'Format', phase: 'file-only', fileOnly: 'size, frame rate, codec, pixel format and duration from ffprobe' },
  { id: 3, name: 'Length', phase: 'preflight', steps: ['plan'], preflight: "the planned length against the type's min_s, max_s, hard_max_s" },
  { id: 4, name: 'Hook', phase: 'preflight', steps: ['plan'], preflight: 'hook beat first; a card, cta or label text by hook_max_s', fileOnly: 'the frame at hook_max_s is not blank' },
  { id: 5, name: 'Holds', phase: 'preflight', steps: ['plan'], preflight: 'every planned beat holds min_hold_s', fileOnly: 'every detected shot holds min_hold_s' },
  { id: 6, name: 'Motion', phase: 'file-only', fileOnly: 'no frozen stretch of 1.2 s (freezedetect)' },
  { id: 7, name: 'Sound', phase: 'preflight', steps: ['text', 'plan'], preflight: 'a voiceover when the type or brief asks for one', fileOnly: 'loudness and true peak, an audio stream' },
  { id: 8, name: 'Captions', phase: 'preflight', steps: ['text', 'plan'], preflight: 'captions built from the voice words: four words, 0.4 s, in sync, every word, the words said' },
  { id: 9, name: 'Numbers', phase: 'preflight', steps: ['text', 'plan', 'layout'], preflight: 'every figure on a card, a caption or said (number, ratio, fraction or dozen words too) is a whole-token numbers row in the same unit; authored and threshold rows bound to their own boxes' },
  { id: 10, name: 'Copy', phase: 'preflight', steps: ['text', 'plan'], preflight: 'dashes, banned phrases, fair housing, addresses and names in any case, verdict words (a side near an edge word) against months of supply' },
  { id: 11, name: 'Safe area', phase: 'preflight', steps: ['layout'], preflight: 'every drawn box inside x 960 and y 1640, from the layout probe' },
  { id: 12, name: 'End card', phase: 'preflight', steps: ['plan'], preflight: 'present when required; its beat, order, word pops and call hold', fileOnly: 'SSIM against the golden still; where the pixels show the card start' },
  { id: 13, name: 'Loop', phase: 'preflight', steps: ['plan'], preflight: 'a loop when the type requires one', fileOnly: 'SSIM of the last frame against frame 0' },
  { id: 14, name: 'Review', phase: 'file-only', fileOnly: 'a separate reviewer signed this file (--final only)' },
  { id: 15, name: 'Techniques ran', phase: 'preflight', steps: ['text', 'plan'], preflight: 'brief techniques ready in the registry, set up by the plan, hook, scene and type each covered, at least one approved signature (approved by Matt, with its reel)', fileOnly: 'the page drew each technique\'s proof' },
  { id: 16, name: 'Not a repeat', phase: 'preflight', steps: ['text', 'plan'], preflight: 'a slug that names the film; hook device and scene set against every earlier film of the type in the ledger, except this film\'s previous version' },
  { id: 17, name: 'Pixels', phase: 'file-only', fileOnly: 'the render gate and OCR read the claimed texts back off the MP4' },
]

export const PREFLIGHT_CHECK_IDS: readonly number[] = CHECK_PHASES.filter((c) => c.phase === 'preflight').map((c) => c.id)

export function checkPhase(id: number): CheckPhase | undefined {
  return CHECK_PHASES.find((c) => c.id === id)
}

export function checkName(id: number): string {
  return checkPhase(id)?.name ?? `check ${id}`
}
