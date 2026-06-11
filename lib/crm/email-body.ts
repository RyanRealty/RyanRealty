/** Detect FUB-style HTML email templates vs plain-text composer bodies. */
export function looksLikeHtml(body: string): boolean {
  const t = body.trim()
  return /<\s*(html|div|p|br|table|!doctype|a)\b/i.test(t)
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

export function prepareOutboundEmailBody(body: string): { html: string | null; plain: string } {
  if (looksLikeHtml(body)) {
    return { html: body, plain: htmlToPlainText(body) }
  }
  return { html: null, plain: body }
}
