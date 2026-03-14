/**
 * HTML sanitization for user- or API-sourced content before dangerouslySetInnerHTML.
 * Uses DOMPurify to prevent XSS while allowing safe prose/embed markup.
 */

import DOMPurify from 'isomorphic-dompurify'

const DEFAULT_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'img', 'span', 'div', 'iframe', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

/**
 * Sanitize HTML for display in prose/content areas. Allows common formatting and safe embeds.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: DEFAULT_ALLOWED_TAGS, ALLOW_DATA_ATTR: false })
}

/**
 * Sanitize HTML that may contain iframes (e.g. video embeds). Stricter; use only where embeds are required.
 */
export function sanitizeHtmlWithEmbeds(html: string): string {
  if (!html || typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src'],
    ADD_TAGS: ['iframe'],
    ALLOW_DATA_ATTR: false,
  })
}
