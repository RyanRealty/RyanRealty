import { EMAIL_FONT_STACK } from '@/lib/email/brand'

/**
 * How the composer body should be interpreted:
 *  - 'auto': detect via looksLikeHtml (templates + legacy callers)
 *  - 'html': treat the body as raw HTML even if the heuristic misses
 *  - 'text': treat the body as plain text even if it contains tag-like text
 * The composer posts an explicit format; every other caller defaults to 'auto'.
 */
export type EmailBodyFormat = 'auto' | 'text' | 'html'

/** Detect CRM-style HTML email templates vs plain-text composer bodies. */
export function looksLikeHtml(body: string): boolean {
  const t = body.trim()
  return /<\s*(html|div|p|br|table|!doctype|a)\b/i.test(t)
}

function isHtmlBody(body: string, format: EmailBodyFormat): boolean {
  if (format === 'html') return true
  if (format === 'text') return false
  return looksLikeHtml(body)
}

/** Plain text for CRM timeline + multipart/alternative text part. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function timelineEmailBody(body: string): string {
  return looksLikeHtml(body) ? htmlToPlainText(body) : body
}

export function prepareOutboundEmailBody(
  body: string,
  format: EmailBodyFormat = 'auto',
): { html: string | null; plain: string } {
  if (isHtmlBody(body, format)) {
    return { html: body, plain: htmlToPlainText(body) }
  }
  return { html: null, plain: body }
}

/**
 * Bare http(s) URLs in a typed body, as anchors.
 *
 * Runs AFTER escaping, so it only ever sees `&amp;` where the author typed `&`
 * — the href is rebuilt from the escaped text, which is what an HTML attribute
 * wants anyway. The trailing-punctuation trim keeps "see https://x.com/a." from
 * swallowing the sentence's full stop, and the closing-paren rule keeps a URL
 * inside parentheses intact.
 *
 * This is not cosmetic. Click tracking wraps `<a href>`, so a URL that never
 * becomes an anchor is a link the CRM cannot measure and the reader cannot
 * click — which is exactly what a plain-text batch send used to produce.
 */
function linkifyEscaped(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (raw) => {
    const trimmed = raw.replace(/[.,;:!?]+$/, '')
    const url = trimmed.endsWith(')') && !trimmed.includes('(') ? trimmed.slice(0, -1) : trimmed
    const tail = raw.slice(url.length)
    return `<a href="${url}" style="color:#102742">${url}</a>${tail}`
  })
}

/** Plain composer text → the exact HTML wrapper the send path uses. Pure — safe in client bundles. */
export function wrapPlainTextHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<div style="font-family:${EMAIL_FONT_STACK};font-size:14px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap">${linkifyEscaped(escaped)}</div>`
}

/**
 * The exact HTML an outbound CRM email will carry — shared by sendCrmEmail and
 * the composer preview so "what you see" is byte-equal to "what sends".
 */
export function composeOutboundHtml(
  body: string,
  signatureHtml: string | null,
  format: EmailBodyFormat = 'auto',
): string {
  const base = isHtmlBody(body, format) ? body : wrapPlainTextHtml(body)
  return base + (signatureHtml ?? '')
}

/** Full srcDoc document for the composer's sandboxed preview iframe. */
export function buildEmailPreviewDoc(
  body: string,
  signatureHtml: string | null,
  format: EmailBodyFormat = 'auto',
): string {
  const inner = body.trim()
    ? composeOutboundHtml(body, signatureHtml, format)
    : (signatureHtml ?? '<p style="color:#8a93a0;font-family:sans-serif;font-size:13px">Start typing to see the email.</p>')
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#ffffff">${inner}</body></html>`
}
