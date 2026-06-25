/**
 * tag-rewrite — the pure array-rewrite logic behind tag rename / merge / strip.
 *
 * Tags live on crm_people.tags (text[]). The taxonomy row in crm_tags carries
 * only the canonical key + label; the literal key string is duplicated across
 * potentially thousands of people. So a rename ('foo' -> 'bar'), a merge
 * (fold 'foo' into 'bar'), and a delete-with-strip ('foo' -> remove) all reduce
 * to ONE operation: rewrite a single person's tags array.
 *
 * These functions are PURE and exported so the rewrite is unit-tested without a
 * DB. The server action (app/actions/crm-tags.ts) reads each affected person's
 * tags in chunks, runs rewriteTagsArray, and writes back only when the result
 * actually differs (changed === true) — no needless write for a person whose
 * array was unaffected.
 *
 * Invariants the rewrite guarantees:
 *   - Order is preserved (first-seen wins) so the array stays human-readable.
 *   - The result is de-duplicated. Merging 'foo' into an array that already has
 *     'bar' collapses to a single 'bar' (the #1 reason merge needs a real
 *     rewrite, not a string swap).
 *   - A compliance/protected key is never the SOURCE of a destructive rewrite —
 *     that refusal lives in the action, but mapping 'from' onto a protected
 *     'into' is still a legal MERGE TARGET, so the rewrite itself stays neutral.
 */

/**
 * Rewrite one person's tags: every occurrence of `from` becomes `into`
 * (case-sensitive match on the literal stored value), the array is de-duplicated
 * preserving first-seen order, and `changed` reports whether the result differs
 * from the input. `from` must be non-empty; `into` may equal `from` (a no-op).
 *
 * This is the engine for both rename and merge:
 *   - rename: from = old key, into = new key.
 *   - merge:  from = source key, into = destination key (which may already be
 *     present on the person — the dedupe handles the collision).
 */
export function rewriteTagsArray(
  tags: readonly string[] | null | undefined,
  from: string,
  into: string,
): { tags: string[]; changed: boolean } {
  const input = Array.isArray(tags) ? tags : []
  if (!from) return { tags: [...input], changed: false }

  const seen = new Set<string>()
  const out: string[] = []
  for (const t of input) {
    const next = t === from ? into : t
    if (next === '' || next === null || next === undefined) continue
    if (seen.has(next)) continue
    seen.add(next)
    out.push(next)
  }

  const changed = out.length !== input.length || out.some((t, i) => t !== input[i])
  return { tags: out, changed }
}

/**
 * Strip a tag from one person's array (delete-with-strip). Removes every
 * occurrence of `key`, de-duplicates the remainder preserving order, and reports
 * whether anything changed. Used by deleteTagAction when the caller opts to also
 * pull the tag off people (vs. leaving the dangling string on historical rows).
 */
export function stripTagFromArray(
  tags: readonly string[] | null | undefined,
  key: string,
): { tags: string[]; changed: boolean } {
  const input = Array.isArray(tags) ? tags : []
  if (!key) return { tags: [...input], changed: false }

  const seen = new Set<string>()
  const out: string[] = []
  for (const t of input) {
    if (t === key) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }

  const changed = out.length !== input.length || out.some((t, i) => t !== input[i])
  return { tags: out, changed }
}
