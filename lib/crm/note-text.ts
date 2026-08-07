/**
 * noteToText — render an imported CRM note body as readable plain text.
 *
 * Notes imported from the retired Follow Up Boss era carry raw HTML in
 * `crm_timeline.body` (`Notes:<br />`, `<p>`, `&amp;`, …). Both the legacy
 * workspace and the first v2 fold printed that markup literally — 41 visible
 * `<br />` tags on a single real person page (11784, measured 2026-08-07).
 *
 * Contract: this is a RENDERING transform, never a content edit. It converts
 * line-break markup to real newlines, unwraps remaining tags, and decodes the
 * five standard entities. It never drops a character of prose — a body with no
 * markup comes back byte-identical apart from trailing-whitespace trim.
 */

const BLOCK_BREAK = /<\s*(?:br\s*\/?|\/\s*p|\/\s*div|\/\s*li)\s*>/gi
const ANY_TAG = /<[^>]*>/g

/** Decode only the five predefined XML entities (plus numeric forms). */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    // & last: decoding it first would let "&amp;lt;" become "<"
    .replace(/&amp;/gi, '&')
}

export function noteToText(body: string | null | undefined): string {
  const raw = body ?? ''
  if (!raw) return ''
  // Fast path: no markup and no entities — return as-is (no content touched).
  if (!/[<&]/.test(raw)) return raw.trimEnd()

  return decodeEntities(raw.replace(BLOCK_BREAK, '\n').replace(ANY_TAG, ''))
    // collapse runs of blank lines the unwrapping can leave behind
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}
