/**
 * HTML sanitization for user- or API-sourced content before dangerouslySetInnerHTML.
 *
 * Uses isomorphic-dompurify (works in both Node/serverless and browser environments)
 * for real DOM-based sanitization instead of regex pattern removal.
 */

import DOMPurify from 'isomorphic-dompurify'

/** Safe tags for prose/content areas */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code', 'img', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'figure', 'figcaption', 'sup', 'sub', 'hr',
]

/** Safe attributes */
const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
  'width', 'height', 'colspan', 'rowspan', 'style',
]

/**
 * Sanitize HTML for display in prose/content areas.
 * Strips dangerous tags and attributes while preserving safe formatting.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })

  // DOMPurify allows data:image/* by default. We treat ALL data: URIs as
  // untrusted (SVG data URIs can carry script payloads). Strip them from
  // src/href post-purify to preserve the previous regex-based contract.
  return stripDataUris(cleaned)
}

/**
 * Sanitize HTML that may contain iframes (e.g. video embeds).
 * Allows iframe tags but still strips scripts and event handlers.
 */
export function sanitizeHtmlWithEmbeds(html: string): string {
  if (!html || typeof html !== 'string') return ''

  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS, 'iframe'],
    ALLOWED_ATTR: [...ALLOWED_ATTR, 'allow', 'allowfullscreen', 'frameborder', 'loading'],
    ALLOW_DATA_ATTR: false,
  })

  return stripDataUris(cleaned)
}

function stripDataUris(html: string): string {
  return html.replace(/(?:src|href)\s*=\s*["']data:[^"']*["']/gi, '')
}
