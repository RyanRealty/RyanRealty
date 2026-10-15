/**
 * Host local images in one-off HTML and rewrite their src before send.
 * Absolute, cid:, data:, and protocol-relative URLs stay untouched.
 */

const SRC_RE = /\bsrc=(["'])([^"']+)\1/gi

function isRemoteOrEmbedded(src: string): boolean {
  return /^(https?:|cid:|data:|\/\/)/i.test(src.trim())
}

export function localImageFilenames(html: string): string[] {
  const names = new Set<string>()
  if (typeof html !== 'string' || !html) return []
  for (const match of html.matchAll(SRC_RE)) {
    const src = match[2].trim()
    if (!src || isRemoteOrEmbedded(src)) continue
    const filename = src.split(/[\\/]/).pop()
    if (filename) names.add(filename)
  }
  return [...names]
}

export function rewriteLocalImageSrcs(
  html: string,
  urlByFilename: Record<string, string>,
): string {
  if (typeof html !== 'string' || !html) return html
  return html.replace(SRC_RE, (full, quote: string, src: string) => {
    const trimmed = src.trim()
    if (isRemoteOrEmbedded(trimmed)) return full
    const filename = trimmed.split(/[\\/]/).pop() ?? trimmed
    const url = urlByFilename[filename]
    if (!url) return full
    return `src=${quote}${url}${quote}`
  })
}

export function missingLocalImageSrcs(
  html: string,
  urlByFilename: Record<string, string>,
): string[] {
  return localImageFilenames(html).filter((name) => !urlByFilename[name])
}

/**
 * One-off HTML often ships with a per-send campaign slug. The UTM vocab only
 * allows stable program slugs (AGENTS.md rule 25). Rewrite to crm-outbound
 * and source=crm so attributeOutbound / buildTrackedUrl can stamp the rest.
 */
export function normalizeOneOffUtms(html: string): string {
  if (typeof html !== 'string' || !html) return html
  return html
    .replace(/([?&]utm_source=)email\b/gi, '$1crm')
    .replace(/([?&]utm_campaign=)tetherow-elize\b/gi, '$1crm-outbound')
}
