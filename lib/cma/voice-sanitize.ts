/**
 * Punctuation sanitizer for LLM text that reaches client prose.
 *
 * CLAUDE.md §2 hard-fails em-dashes, en-dashes, and semicolons in anything a
 * client reads, and `buildCma` gates the prose it authors — so an unsanitized
 * model dash does not merely look off-brand, it THROWS and kills the build.
 * That is exactly what happened to cma-16923-torrance in the 2026-07-30
 * corpus rebuild: the adversarial audit wrote "...cannot support the
 * recommendation—broker must rebuild the comp set", contract.ts folded that
 * summary into a review-check detail, build.ts joined it into
 * pricing.reviewReason, pricing.ts pushed it into notes, and the brand-voice
 * gate failed the document on a single em-dash the model chose.
 *
 * judge.ts had carried its own copy of this since the judge output has always
 * been sanitized; audit.ts never was. Shared here so the two cannot drift —
 * any new LLM surface that reaches client prose should call this too.
 */
export function sanitizeClientProse(s: string): string {
  return s
    // A numeric range reads as "to", not a comma: "$640k—$700k" -> "$640k to $700k".
    .replace(/(\d)\s*[—–]\s*(\$?\d)/g, '$1 to $2')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/;\s*/g, '. ')
    .trim()
}
