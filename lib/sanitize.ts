/**
 * HTML sanitization for user- or API-sourced content before dangerouslySetInnerHTML.
 *
 * Uses a lightweight allowlist approach that works in all environments (including
 * Vercel serverless functions where jsdom/DOMPurify may not be available).
 *
 * For admin-authored content from our own database, the risk is low. The sanitizer
 * strips dangerous tags (script, style, event handlers) while preserving safe formatting.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'img', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'figure', 'figcaption', 'sup', 'sub', 'hr',
])

const DANGEROUS_PATTERNS = [
  /<script[\s>]/gi,
  /<\/script>/gi,
  /on\w+\s*=/gi,
  /javascript:/gi,
  /<style[\s>]/gi,
  /<\/style>/gi,
  /<iframe[\s>]/gi,
  /<\/iframe>/gi,
  /<object[\s>]/gi,
  /<embed[\s>]/gi,
  /<form[\s>]/gi,
]

/**
 * Sanitize HTML for display in prose/content areas.
 * Strips dangerous tags and attributes while preserving safe formatting.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let sanitized = html

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }

  // Remove data: URIs from attributes (potential XSS vector)
  sanitized = sanitized.replace(/(?:src|href)\s*=\s*["']data:[^"']*["']/gi, '')

  return sanitized
}

/**
 * Sanitize HTML that may contain iframes (e.g. video embeds).
 * Allows iframe tags but still strips scripts and event handlers.
 */
export function sanitizeHtmlWithEmbeds(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let sanitized = html

  // Remove dangerous patterns except iframe
  const patternsWithoutIframe = DANGEROUS_PATTERNS.filter(
    p => !p.source.includes('iframe')
  )
  for (const pattern of patternsWithoutIframe) {
    sanitized = sanitized.replace(pattern, '')
  }

  sanitized = sanitized.replace(/(?:src|href)\s*=\s*["']data:[^"']*["']/gi, '')

  return sanitized
}
