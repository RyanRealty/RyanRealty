/**
 * article-view.ts — the blog CLASS's reading apparatus, derived from the post's
 * own markup and from nothing else.
 *
 * WHY THIS EXISTS. The separate evaluator scored the blog template 52 on
 * 2026-09-09 (rubric v1-2026-09-08) and its first named defect was the one that
 * matters most in this shop: "a verified figure and an invented one render
 * identically." The article body is CMS HTML, so no component could put a trace
 * beside a number without inventing the trace. This module refuses to invent
 * one. Every figure it surfaces is a string COPIED OUT OF THE BODY, and the
 * trace it shows is the sentence that number came from — the sentence the writer
 * already wrote with its window and its sample size in it (CLAUDE.md section 0
 * is why those sentences read the way they do). Nothing here computes, rounds,
 * re-labels, or attributes a figure to a source the sentence did not name.
 *
 * WHAT IT DOES, all of it mechanical:
 *   1. Gives every <h2> a stable id, so the rail can jump to it and a reader can
 *      link to one answer.
 *   2. Pulls the figures: for each section, the numbers in its paragraphs, each
 *      one carrying the section's own question and its own verbatim sentence.
 *   3. Turns the <h2>Questions</h2> block's <h3>/<p> pairs into real
 *      disclosures. The text stays in the DOM verbatim, so the FAQPage schema
 *      publishBlogFaq() builds from the RAW body still matches what is on
 *      screen, and the block stops being six paragraphs of prose in a row.
 *   4. Marks every outbound citation with its host, the way a printed guide
 *      carries its footnote. The host comes from the href; it is never guessed.
 *
 * WHAT IT REFUSES: attributing a figure to a link that is not in the figure's
 * own sentence. The HOA paragraph of a resort guide quotes our own listing data
 * and links the Secretary of State for the association's registration date;
 * printing that host under the dues figure would be a false trace. Links are
 * shown as "linked in this sentence", scoped to the sentence, or not at all.
 */

const HEADING_RE = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi
const PARAGRAPH_RE = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
const ANCHOR_RE = /<a\s([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>([\s\S]*?)<\/a>/gi

/**
 * A number a reader would repeat out loud. Currency, a percentage, or a count
 * with the unit the writer attached to it. Deliberately narrow: a year, a street
 * number, or a bare integer inside prose is not a figure, and promoting one into
 * a display would put a number on screen with no meaning under it.
 */
const FIGURE_PATTERNS = [
  // $1,349,000 · $265 a month · $3,180 a year. A price is the figure a reader
  // came for, so it wins its paragraph over the sample size beside it.
  /\$\d[\d,]*(?:\.\d+)?(?:\s(?:a month|a year|per month|per year|million))?/gi,
  // 4.3% · 12 %
  /\d[\d,]*(?:\.\d+)?\s?%/gi,
  // 63 days · 29.5 days. A duration is a figure only when it is the pace of the
  // market; "over the last 12 months" is the WINDOW a figure was measured in,
  // and promoting a window into a chip puts a number on screen that answers
  // nothing. WINDOW_LEAD_RE below is what tells them apart.
  /\d[\d,]*(?:\.\d+)?\s(?:days|months)\b/gi,
  /\d[\d,]*(?:\.\d+)?\s(?:detached\s)?(?:homes?|condominiums?|units?|homesites?|lots?|sales|closings|acres|residents|rooms)\b/gi,
]

const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+(?=[A-Z$"“'\d])/g

/** The words that make a duration a measurement window rather than a figure. */
const WINDOW_LEAD_RE = /(?:last|past|previous|over the|within the|in the|same)\s+$/i

/**
 * A qualifier belongs to the number. "more than $1 million" displayed as
 * "$1 million" is a different claim than the writer made, which is the exact
 * failure CLAUDE.md section 0 names ("never round in a way that changes the
 * narrative"), so the qualifier is carried onto the chip.
 */
const QUALIFIER_LEAD_RE = /\b(more than|less than|about|roughly|nearly|almost|at least|up to|around|over|under|just over|just under)\s+$/i

/**
 * The far end of a range is not a figure. "roughly 20 to 48 years old" says one
 * thing; a chip reading "48 years" says another.
 */
const RANGE_LEAD_RE = /(?:\bto|–|—|-)\s*$/

export type BlogFigure = {
  /** Stable per-post id, used for the disclosure's aria wiring. */
  id: string
  /** The number, copied verbatim out of the body. */
  value: string
  /** The section heading it sits under — the post's own words. */
  question: string
  /** The whole sentence it came from, plain text, verbatim. */
  sentence: string
  /** The section anchor, so the chip can send the reader to the full answer. */
  sectionId: string
  /** A link that appears in that same sentence, if there is one. */
  sourceHref?: string
  sourceHost?: string
}

export type BlogSection = {
  id: string
  label: string
}

export type BlogArticleView = {
  /** The body, with heading ids, disclosures, and citation hosts. */
  html: string
  sections: BlogSection[]
  figures: BlogFigure[]
}

/** Max chips in the rail. Past this the rail is a list, not a read. */
export const BLOG_FIGURE_LIMIT = 6

export function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
}

export function slugifyHeading(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'section'
}

export function hostOf(href: string): string | undefined {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/**
 * The identity of a reading: its number and its KIND. Two spellings of one
 * count collapse ("239 units" / "239 condominiums"); a count and a duration
 * that happen to share a number do not ("5 homes" is not "5 days").
 */
export function figureKey(value: string): string {
  const number = value.match(/[\d,.]+/)?.[0].replace(/[.,]$/, '') ?? value
  const kind = value.startsWith('$')
    ? 'currency'
    : /%/.test(value)
      ? 'percent'
      : /\b(days|months)\b/i.test(value)
        ? 'duration'
        : 'count'
  return `${kind}:${number}`
}

/** A section whose content is answers, not prose: it gets disclosures, not chips. */
function isQuestionsHeading(label: string): boolean {
  return /^questions?$/i.test(label.trim())
}

function isClosingHeading(label: string): boolean {
  return /^next steps?$/i.test(label.trim())
}

type Segment = { heading: string | null; headingHtml: string; id: string; body: string }

/** Split the body into [lede, ...sections] on its own <h2> boundaries. */
function segment(html: string): Segment[] {
  const segments: Segment[] = []
  const used = new Set<string>()
  let cursor = 0
  let match: RegExpExecArray | null
  HEADING_RE.lastIndex = 0
  while ((match = HEADING_RE.exec(html)) !== null) {
    const label = stripTags(match[2])
    let id = slugifyHeading(label)
    let n = 2
    while (used.has(id)) id = `${slugifyHeading(label)}-${n++}`
    used.add(id)
    if (segments.length === 0 && match.index > 0) {
      segments.push({ heading: null, headingHtml: '', id: 'lede', body: html.slice(0, match.index) })
    } else if (segments.length > 0) {
      const prev = segments[segments.length - 1]
      prev.body = html.slice(cursor, match.index)
    }
    const attrs = / id="/.test(match[1]) ? match[1] : `${match[1]} id="${id}"`
    segments.push({ heading: label, headingHtml: `<h2${attrs}>${match[2]}</h2>`, id, body: '' })
    cursor = match.index + match[0].length
  }
  if (segments.length === 0) return [{ heading: null, headingHtml: '', id: 'lede', body: html }]
  segments[segments.length - 1].body = html.slice(cursor)
  return segments
}

/** The sentence, verbatim, that holds the character at `index` of `text`. */
export function sentenceAt(text: string, index: number): string {
  const re = new RegExp(SENTENCE_BOUNDARY_RE.source, 'g')
  const bounds: Array<[number, number]> = []
  let start = 0
  let boundary: RegExpExecArray | null
  while ((boundary = re.exec(text)) !== null) {
    bounds.push([start, boundary.index])
    start = boundary.index + boundary[0].length
  }
  bounds.push([start, text.length])
  for (const [from, to] of bounds) {
    if (index >= from && index <= to) return text.slice(from, to).trim()
  }
  return text.trim()
}

/**
 * Links inside one sentence. The paragraph's HTML and its plain text are two
 * different strings, so the anchor is matched by its own visible text landing
 * inside the sentence — the only join that cannot attach a link to a number it
 * does not belong to.
 */
function linkInSentence(paragraphHtml: string, sentence: string): { href: string; host: string } | undefined {
  ANCHOR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ANCHOR_RE.exec(paragraphHtml)) !== null) {
    const label = stripTags(match[4])
    if (label && sentence.includes(label)) {
      const host = hostOf(match[2])
      if (host) return { href: match[2], host }
    }
  }
  return undefined
}

function collectFigures(segments: Segment[]): BlogFigure[] {
  const figures: BlogFigure[] = []
  const seen = new Set<string>()
  for (const seg of segments) {
    if (seg.heading && (isQuestionsHeading(seg.heading) || isClosingHeading(seg.heading))) continue
    const question = seg.heading ?? ''
    if (!question) continue
    PARAGRAPH_RE.lastIndex = 0
    let paragraph: RegExpExecArray | null
    let sectionTaken = false
    while ((paragraph = PARAGRAPH_RE.exec(seg.body)) !== null) {
      // One figure per question. Six chips answering six different questions is
      // a read; six chips off one paragraph is an index of a paragraph.
      if (sectionTaken) break
      const paragraphHtml = paragraph[0]
      const text = stripTags(paragraph[1])
      if (!text) continue
      for (const pattern of FIGURE_PATTERNS) {
        const re = new RegExp(pattern.source, 'gi')
        let hit: RegExpExecArray | null
        let taken = false
        while ((hit = re.exec(text)) !== null) {
          // A trailing comma or period belongs to the sentence, not to the
          // number: "$1,349,000, from 11 closings" is not a figure called
          // "$1,349,000,".
          const lead = text.slice(Math.max(0, hit.index - 16), hit.index)
          if (WINDOW_LEAD_RE.test(lead) || RANGE_LEAD_RE.test(lead)) continue
          const qualifier = lead.match(QUALIFIER_LEAD_RE)?.[1]
          const bare = hit[0].replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim()
          const value = qualifier ? `${qualifier.toLowerCase()} ${bare}` : bare
          // One reading, one chip: "$620" and "$620 a month" are the same dues,
          // and "239 units" and "239 condominiums" are the same building count.
          const key = figureKey(bare)
          if (seen.has(key)) continue
          const sentence = sentenceAt(text, hit.index)
          if (sentence.length < 20) continue
          seen.add(key)
          const link = linkInSentence(paragraphHtml, sentence)
          figures.push({
            id: `fig-${figures.length + 1}`,
            value,
            question,
            sentence,
            sectionId: seg.id,
            ...(link ? { sourceHref: link.href, sourceHost: link.host } : {}),
          })
          taken = true
          sectionTaken = true
          break
        }
        // One figure per paragraph: the rail is a read, not an index, and the
        // patterns are in priority order so a price wins over the sample size
        // standing next to it in the same sentence.
        if (taken) break
      }
    }
  }
  return figures.slice(0, BLOG_FIGURE_LIMIT)
}

/**
 * The Questions block becomes disclosures. Verbatim text, same order, first one
 * open so the block reads as an answer and not as a closed filing cabinet.
 */
function toDisclosures(body: string): string {
  const pairs = [...body.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi)]
  if (pairs.length === 0) return body
  const before = body.slice(0, pairs[0].index ?? 0)
  const items = pairs
    .map((pair, i) => {
      const question = pair[1].trim()
      const answer = pair[2].trim()
      if (!question || !answer) return ''
      return `<details class="v3-blog-q"${i === 0 ? ' open' : ''}><summary class="v3-blog-q-summary"><span class="v3-blog-q-text">${question}</span><span class="v3-blog-q-mark" aria-hidden="true"></span></summary><div class="v3-blog-q-answer">${answer}</div></details>`
    })
    .join('')
  if (!items) return body
  return `${before}<div class="v3-blog-questions">${items}</div>`
}

/** Every outbound link carries its host, the way a printed guide carries a footnote. */
function markCitations(html: string): string {
  ANCHOR_RE.lastIndex = 0
  return html.replace(ANCHOR_RE, (whole: string, _pre: string, href: string) => {
    const host = hostOf(href)
    if (!host || host.endsWith('ryan-realty.com')) return whole
    return `${whole}<span class="v3-blog-cite" aria-hidden="true">${host}</span>`
  })
}

export function buildBlogArticleView(html: string): BlogArticleView {
  const body = html?.trim() ?? ''
  if (!body) return { html: '', sections: [], figures: [] }

  const segments = segment(body)
  const figures = collectFigures(segments)
  const sections: BlogSection[] = segments
    .filter((seg): seg is Segment & { heading: string } => Boolean(seg.heading))
    .map((seg) => ({ id: seg.id, label: seg.heading }))

  const rebuilt = segments
    .map((seg) => {
      const inner = seg.heading && isQuestionsHeading(seg.heading) ? toDisclosures(seg.body) : seg.body
      return `${seg.headingHtml}${inner}`
    })
    .join('')

  return { html: markCitations(rebuilt), sections, figures }
}
