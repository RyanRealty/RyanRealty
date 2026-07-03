/**
 * strip-js-comments.mjs — blank out JS/TS line + block comments while preserving
 * string/template literals and line/column positions.
 *
 * Why the newsletter gates need this: a static gate that greps a source file for
 * a required token (e.g. `dedupe_key`, `List-Unsubscribe`) will trivially PASS if
 * that token merely appears in a DOC COMMENT — even after the real code is
 * deleted. That makes the gate theater. Every newsletter gate runs its inputs
 * through this first, so the checks see CODE only. (Caught 2026-07-03: removing
 * the real `dedupe_key:` from a track route left the gate green because a nearby
 * comment still said "dedupe_key".)
 *
 * Comment chars become spaces (newlines kept) so the source stays line-addressable.
 * String and template literals pass through untouched. Pure.
 */
export function stripJsComments(source) {
  let out = ''
  let i = 0
  const n = source.length
  let inLine = false
  let inBlock = false
  let inStr = null // the quote char when inside a string/template
  while (i < n) {
    const ch = source[i]
    const next = i + 1 < n ? source[i + 1] : ''
    if (inLine) {
      if (ch === '\n') {
        inLine = false
        out += ch
      } else out += ' '
      i++
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        out += '  '
        i += 2
      } else {
        out += ch === '\n' ? '\n' : ' '
        i++
      }
      continue
    }
    if (inStr) {
      out += ch
      if (ch === '\\') {
        out += next
        i += 2
        continue
      }
      if (ch === inStr) inStr = null
      i++
      continue
    }
    if (ch === '/' && next === '/') {
      inLine = true
      out += '  '
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      out += '  '
      i += 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      out += ch
      i++
      continue
    }
    out += ch
    i++
  }
  return out
}
