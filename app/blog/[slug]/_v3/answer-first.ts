/**
 * answer-first.ts: the answer block a guide opens with, lifted out of the body
 * so it sits under the dek and ABOVE "The numbers in this guide" (AIV #1,
 * 2026-10-08). On a phone the rail renders before the prose, so an answer left
 * in the body would land under the rail; answer engines and readers both want
 * the answer first.
 *
 * Markup convention, opt-in per post: the body STARTS with
 *   <div class="v3-blog-answer" data-figures-as-of="YYYY-MM-DD"> ... </div>
 * The block is plain server-rendered paragraphs. Its markup is passed through
 * verbatim, never rewritten. data-figures-as-of is optional; when present the
 * byline prints "Figures as of <day>". A body without the block is untouched.
 */

const ANSWER_RE = /^\s*<div\s+class="v3-blog-answer"([^>]*)>([\s\S]*?)<\/div>\s*/i
const AS_OF_RE = /\bdata-figures-as-of="(\d{4}-\d{2}-\d{2})"/i

export type AnswerFirst = {
  /** The block's inner HTML, verbatim, or null when the body has no answer block. */
  answerHtml: string | null
  /** YYYY-MM-DD civil day the block's figures are as of, or null. */
  figuresAsOf: string | null
  /** The body with the block removed (the whole body when there is none). */
  body: string
}

export function extractAnswerFirst(html: string): AnswerFirst {
  const match = html.match(ANSWER_RE)
  if (!match) return { answerHtml: null, figuresAsOf: null, body: html }
  const inner = match[2].trim()
  return {
    answerHtml: inner || null,
    figuresAsOf: match[1].match(AS_OF_RE)?.[1] ?? null,
    body: html.slice(match[0].length),
  }
}
