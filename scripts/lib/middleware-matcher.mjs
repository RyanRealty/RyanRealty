/**
 * The string entries of middleware.ts's `config.matcher` array, in order.
 *
 * ci:tracking-policy pins that '/_next/image' is its own matcher entry
 * (TRACK-3). The first version of that check was a regex that also required
 * the entry to be the LAST one in the array, so PR #391 adding
 * '/housing-market/reports/monthly/:month' after it turned the gate red on a
 * middleware that was still correct. Reading the entries makes the position
 * irrelevant: what matters is that the path is an entry of its own, not a word
 * inside the first pattern's negative lookahead, and not a commented-out line.
 *
 * A small scanner rather than one regex: it skips line and block comments and
 * reads quoted strings with their escapes, so a ']' in a comment or pattern
 * cannot end the array early.
 */
export function middlewareMatcherEntries(src) {
  const start = /\bmatcher\s*:\s*\[/.exec(src)
  if (!start) return []
  const entries = []
  let i = start.index + start[0].length
  while (i < src.length) {
    const ch = src[i]
    if (ch === ']') return entries
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i)
      i = nl === -1 ? src.length : nl + 1
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      let value = ''
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\' && j + 1 < src.length) {
          value += src[j] + src[j + 1]
          j += 2
          continue
        }
        value += src[j]
        j += 1
      }
      entries.push(value)
      i = j + 1
      continue
    }
    i += 1
  }
  return entries
}

/** True when `path` is one of the matcher's own entries. */
export function middlewareMatcherNames(src, path) {
  return middlewareMatcherEntries(src).includes(path)
}
