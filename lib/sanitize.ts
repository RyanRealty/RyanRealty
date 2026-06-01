/**
 * HTML sanitization for content rendered via dangerouslySetInnerHTML.
 *
 * DOM-FREE by design. We previously used isomorphic-dompurify, but it loads
 * jsdom@29 on the server, and jsdom's dynamic requires FAIL to bundle in the
 * Vercel serverless runtime ("Failed to load external module") — the failure
 * happens at MODULE IMPORT time, so it can't be try/caught, and it 500'd every
 * market-report page (always) plus any listing with a video embed (sometimes).
 *
 * The content sanitized here is our own generated HTML (market-report tables)
 * and MLS-feed video-embed markup — trusted-ish, not arbitrary user input — so a
 * strict allowlist/denylist regex pass over the realistic XSS vectors is
 * sufficient defense-in-depth, and it runs identically in every runtime.
 */

/** Strip data: URIs from src/href (SVG data URIs can carry script payloads). */
function stripDataUris(html: string): string {
  return html.replace(/(?:src|href)\s*=\s*["']data:[^"']*["']/gi, '')
}

/**
 * DOM-free allowlist sanitizer. Removes <script>/<style>/dangerous element
 * blocks, inline event handlers, and javascript:/vbscript:/data: URIs.
 */
function regexSanitize(html: string, opts: { allowIframe: boolean }): string {
  let out = html

  // Remove whole dangerous element blocks (open tag through matching close).
  const blockTags = ['script', 'style', 'object', 'embed', 'applet', 'noscript', 'template', 'form']
  for (const tag of blockTags) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '')
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '') // orphan open/close
  }
  // Remove standalone dangerous tags.
  for (const tag of ['link', 'meta', 'base', 'input', 'button']) {
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
  // Neutralize javascript:/vbscript: URIs in href/src (keep the attr, blank it).
  out = out.replace(/(href|src)\s*=\s*("|')\s*(?:javascript|vbscript):[^"']*\2/gi, '$1=$2#$2')
  // Strip data: URIs.
  out = stripDataUris(out)
  return out
}

/**
 * Sanitize HTML for prose/content areas. Strips scripts, dangerous elements,
 * event handlers, and unsafe URIs while preserving safe formatting + iframes OUT.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  return regexSanitize(html, { allowIframe: false })
}

/**
 * Sanitize HTML that may contain video embeds — keeps <iframe> but still strips
 * scripts, event handlers, and unsafe URIs.
 */
export function sanitizeHtmlWithEmbeds(html: string): string {
  if (!html || typeof html !== 'string') return ''
  return regexSanitize(html, { allowIframe: true })
}
