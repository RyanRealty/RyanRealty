import { EMAIL_FONT_STACK } from '@/lib/email/brand'

/**
 * How the composer body should be interpreted:
 *  - 'auto': detect via looksLikeHtml (templates + legacy callers)
 *  - 'html': treat the body as raw HTML even if the heuristic misses
 *  - 'text': treat the body as plain text even if it contains tag-like text
 * The composer posts an explicit format; every other caller defaults to 'auto'.
 */
export type EmailBodyFormat = 'auto' | 'text' | 'html'

/** Detect FUB-style HTML email templates vs plain-text composer bodies. */
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

/** Plain composer text → the exact HTML wrapper the send path uses. Pure — safe in client bundles. */
export function wrapPlainTextHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<div style="font-family:${EMAIL_FONT_STACK};font-size:14px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap">${escaped}</div>`
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
