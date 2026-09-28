/**
 * Find ryan-realty.com links in a message and hand each one to `fn`.
 *
 * HTML (an `<a` or `href=`) is decorated only inside href values, so a URL
 * sitting in the visible sentence is not a second link and cannot swallow
 * the full stop. Plain text and SMS still decorate every URL. Trailing
 * sentence punctuation is never part of the URL; in plain text it is put
 * back after the replacement, the way linkifyHttp does.
 */

const OWN_LINK_RE = /https:\/\/(?:www\.)?ryan-realty\.com[^\s"'<)\]]*/g
const HREF_OWN_RE = /href\s*=\s*(["'])(https:\/\/(?:www\.)?ryan-realty\.com[^"']*)\1/gi
const TRAILING_PUNCT_RE = /[.,;:!?]+$/

export function peelTrailingUrlPunctuation(url: string): { url: string; trailing: string } {
  const m = TRAILING_PUNCT_RE.exec(url)
  if (!m || m.index === 0) return { url, trailing: '' }
  return { url: url.slice(0, m.index), trailing: m[0] }
}

export function textLooksLikeHtml(text: string): boolean {
  return /<a\b/i.test(text) || /\bhref\s*=/i.test(text)
}

export function replaceOwnSiteLinks(text: string, fn: (url: string) => string): string {
  if (typeof text !== 'string' || text.length === 0) return text
  if (textLooksLikeHtml(text)) {
    return text.replace(HREF_OWN_RE, (_full, quote: string, href: string) => {
      const { url } = peelTrailingUrlPunctuation(href)
      return `href=${quote}${fn(url)}${quote}`
    })
  }
  return text.replace(OWN_LINK_RE, (raw) => {
    const { url, trailing } = peelTrailingUrlPunctuation(raw)
    return fn(url) + trailing
  })
}
