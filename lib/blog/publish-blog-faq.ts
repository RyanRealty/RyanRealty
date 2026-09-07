/**
 * publishBlogFaq — read the Questions section of a blog post body into
 * FAQPage structured data.
 *
 * AEO convention (2026-09-07 brief pack): a guide that answers the questions
 * people ask assistants ends with `<h2>Questions</h2>` followed by pairs of
 * `<h3>question</h3><p>answer</p>`. The visible page is the source of truth;
 * this reads exactly that markup so the schema can never say something the
 * reader cannot see. A post without the section publishes no FAQPage.
 *
 * Pure. Input is the stored body HTML; output is the FaqPageInput shape that
 * lib/site/json-ld.ts already knows how to render, or null.
 */
import type { FaqPageInput } from '@/lib/site/json-ld'

const QUESTIONS_H2 = /<h2[^>]*>\s*Questions\s*<\/h2>/i
const NEXT_H2 = /<h2[^>]*>/i
const PAIR = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

export type BlogFaqItem = { question: string; answer: string }

/** The question/answer pairs under the post's Questions heading, in page order. */
export function extractBlogFaq(html: string | null | undefined): BlogFaqItem[] {
  if (!html) return []
  const start = html.search(QUESTIONS_H2)
  if (start < 0) return []
  const afterHeading = start + (html.slice(start).match(QUESTIONS_H2)?.[0].length ?? 0)
  const rest = html.slice(afterHeading)
  const end = rest.search(NEXT_H2)
  const section = end < 0 ? rest : rest.slice(0, end)
  const items: BlogFaqItem[] = []
  for (const m of section.matchAll(PAIR)) {
    const question = plainText(m[1])
    const answer = plainText(m[2])
    if (question && answer) items.push({ question, answer })
  }
  return items
}

/** FAQPage input for MetadataBlock, or null when the post has no Questions section. */
export function publishBlogFaq(html: string | null | undefined): FaqPageInput | null {
  const items = extractBlogFaq(html)
  if (items.length === 0) return null
  return { type: 'faqPage', items }
}
