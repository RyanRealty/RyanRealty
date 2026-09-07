/**
 * Pure HTML -> chapter-list mapper for the look-pass review tool
 * (`scripts/cma-lookpass.ts`). No DOM, no puppeteer, no data access — a
 * lightweight depth-aware scan for the top-level `<section>` blocks the
 * renderers emit (`.page` in the letter from `lib/cma/render.ts`, `.sc[id]`
 * in the immersive from `lib/cma/immersive.ts` / `opinion-scenes.ts`), so the
 * chapter list the tool prints can be asserted in a fast unit test
 * independent of a real browser render.
 *
 * This does not decide layout or copy — it only reads back the structure the
 * renderers already produced, exactly like a reviewer scanning the HTML.
 */

export interface LookpassChapter {
  /** DOM `id` when the renderer sets one (every immersive `.sc`); a derived slug otherwise (letter `.page`s carry no id). */
  id: string
  /** First `<h1>`/`<h2>` text inside the chapter, stripped of tags. Empty when the chapter has neither (e.g. a bare flyer page). */
  heading: string
  svgCount: number
  imgCount: number
  tableCount: number
}

function localSlug(text: string): string {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || ''
}

/**
 * Returns each top-level `<section>...</section>` block (including the tags)
 * at nesting depth 0. A section nested inside another `<section>` — none of
 * the current CMA renderers emit one, but the scan does not assume it — is
 * folded into its parent's block rather than returned separately.
 */
function topLevelSections(html: string): string[] {
  const blocks: string[] = []
  const re = /<section\b[^>]*>|<\/section\s*>/gi
  let depth = 0
  let start = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const isOpen = m[0][1] !== '/'
    if (isOpen) {
      if (depth === 0) start = m.index
      depth++
    } else {
      depth = Math.max(0, depth - 1)
      if (depth === 0 && start >= 0) {
        blocks.push(html.slice(start, re.lastIndex))
        start = -1
      }
    }
  }
  return blocks
}

function attr(openTag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(openTag)
  return m ? m[1] : null
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstHeading(block: string): string {
  const h = /<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i.exec(block)
  return h ? stripTags(h[1]) : ''
}

function countTag(block: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b`, 'gi')
  return (block.match(re) ?? []).length
}

/**
 * Extracts the chapter list from either document. Each top-level `<section>`
 * is one chapter (the letter's cover, print pages, and closing page; the
 * immersive's hero and every scroll scene).
 */
export function extractChapters(html: string): LookpassChapter[] {
  return topLevelSections(html).map((block, i) => {
    const openTag = /^<section\b[^>]*>/i.exec(block)?.[0] ?? '<section>'
    const domId = attr(openTag, 'id')
    const classAttr = attr(openTag, 'class') ?? ''
    const heading = firstHeading(block)
    // Cover is a fixed, single, class-marked chapter — label it 'cover' even
    // though it carries a heading (the subject's street address). Everything
    // else prefers its own heading, which is more specific than a shared
    // class label (e.g. `page-flyer` appears on more than one page shape).
    const fallbackId = classAttr.includes('page-cover')
      ? 'cover'
      : heading
        ? localSlug(heading)
        : classAttr.includes('page-flyer')
          ? 'flyer'
          : ''
    const id = domId ?? fallbackId
    return {
      id: id || `chapter-${i + 1}`,
      heading,
      svgCount: countTag(block, 'svg'),
      imgCount: countTag(block, 'img'),
      tableCount: countTag(block, 'table'),
    }
  })
}
