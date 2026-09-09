/**
 * Visitor-facing MLS public remarks.
 *
 * Spark sometimes inserts a blank line mid-sentence. Splitting on that
 * blank line leaves a truncated first paragraph. Join fragments that do
 * not end a sentence. Do not invent missing words.
 *
 * Founding case: 20556 Empire (MLS 220226741) — "…warm Northwest" then
 * "Conveniently located…" across `\r\n\r\n`.
 */

const SENTENCE_END = /[.!?…]["')\]]?\s*$/

export function publishListingRemarks(raw: string | null | undefined): string[] {
  const text = (raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return []

  const parts = text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0)

  const paragraphs: string[] = []
  for (const part of parts) {
    const previous = paragraphs[paragraphs.length - 1]
    if (previous && !SENTENCE_END.test(previous)) {
      paragraphs[paragraphs.length - 1] = `${previous} ${part}`
      continue
    }
    paragraphs.push(part)
  }
  return paragraphs
}
