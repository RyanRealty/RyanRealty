/**
 * Bounded retry for a GitHub API JSON body. The Lighthouse (and other
 * use-build) flake is `unexpected end of JSON input` when `gh api
 * .../artifacts` returns empty or truncated text and the next step parses it.
 */
export function parseValidJson(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'not-string' }
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch (err) {
    const reason = err instanceof SyntaxError ? err.message : 'invalid'
    return { ok: false, reason }
  }
}

/**
 * Call `read(attempt)` until the reply is valid JSON, or `tries` is spent.
 * `read` may be sync or async. Does not sleep — the caller spaces attempts.
 */
export async function retryUntilValidJson(read, { tries = 12 } = {}) {
  const max = Number.isInteger(tries) && tries > 0 ? tries : 12
  let last = { ok: false, reason: 'no-attempt' }
  for (let i = 1; i <= max; i++) {
    last = parseValidJson(await read(i))
    if (last.ok) return { ...last, tries: i }
  }
  return { ...last, tries: max }
}

if (process.argv.includes('--stdin')) {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const parsed = parseValidJson(Buffer.concat(chunks).toString('utf8'))
  process.exit(parsed.ok ? 0 : 1)
}
