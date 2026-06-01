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

  try {
    const cleaned = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    })
    // DOMPurify allows data:image/* by default. We treat ALL data: URIs as
    // untrusted (SVG data URIs can carry script payloads). Strip them from
    // src/href post-purify to preserve the previous regex-based contract.
    return stripDataUris(cleaned)
  } catch {
    // isomorphic-dompurify loads jsdom on the server; jsdom's dynamic requires
    // FAIL to bundle in the Vercel serverless runtime ("Failed to load external
    // module"), which 500'd every market-report page (always) and any listing
    // with a video embed (sometimes). Fall back to a DOM-free allowlist
    // sanitizer. The content sanitized here is our own generated HTML +
    // MLS-feed embed markup (trusted), so this is sufficient defense-in-depth.
    return regexSanitize(html, { allowIframe: false })
  }
}

/**
 * Sanitize HTML that may contain iframes (e.g. video embeds).
 * Allows iframe tags but still strips scripts and event handlers.
 */
export function sanitizeHtmlWithEmbeds(html: string): string {
  if (!html || typeof html !== 'string') return ''

  try {
    const cleaned = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [...ALLOWED_TAGS, 'iframe'],
      ALLOWED_ATTR: [...ALLOWED_ATTR, 'allow', 'allowfullscreen', 'frameborder', 'loading'],
      ALLOW_DATA_ATTR: false,
    })
    return stripDataUris(cleaned)
  } catch {
    // See sanitizeHtml — jsdom can fail to load in serverless. DOM-free fallback,
    // here keeping iframes (for video embeds) but still stripping scripts/handlers.
    return regexSanitize(html, { allowIframe: true })
  }
}

function stripDataUris(html: string): string {
  return html.replace(/(?:src|href)\s*=\s*["']data:[^"']*["']/gi, '')
}

/**
 * DOM-free allowlist sanitizer — the fallback when isomorphic-dompurify's jsdom
 * backend fails to load in the serverless runtime. Strips the realistic XSS
 * vectors from trusted-ish HTML: <script>/<style> blocks, dangerous elements,
 * inline event handlers, and javascript:/data: URIs. Not a full DOM sanitizer,
 * but sufficient for our own generated content + MLS embed markup.
 */
function regexSanitize(html: string, opts: { allowIframe: boolean }): string {
  let out = html
  // Remove whole dangerous element blocks (open tag through close tag).
  const blockTags = ['script', 'style', 'object', 'embed', 'applet', 'noscript', 'template', 'form']
  for (const tag of blockTags) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '')
    // also strip any orphan open/close tags of these
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '')
  }
  // Remove void/standalone dangerous tags.
  for (const tag of ['link', 'meta', 'base']) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '')
  }
  // iframes: drop entirely unless this is the embed-allowing variant.
  if (!opts.allowIframe) {
    out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    out = out.replace(/<\/?iframe\b[^>]*>/gi, '')
  }
  // Strip inline event-handler attributes (on*=...), quoted or unquoted.
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
  // Neutralize javascript: and vbscript: URIs in href/src.
  out = out.replace(/(href|src)\s*=\s*("|')\s*(?:javascript|vbscript):[^"']*\2/gi, '$1=$2#$2')
  // Strip data: URIs (matches stripDataUris contract).
  out = stripDataUris(out)
  return out
}
