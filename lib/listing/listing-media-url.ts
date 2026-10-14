/**
 * A listing's video / virtual-tour URL, cleaned before anything stores,
 * renders, serializes, or publishes it.
 *
 * WHY (2026-10-14). Listing brokers paste their video and tour links into the
 * MLS from their own email. When the broker's mail system had rewritten the
 * link for click scanning, the MLS keeps the rewritten one. A Microsoft
 * SafeLinks URL looks like
 *
 *   https://nam12.safelinks.protection.outlook.com/?url=<the real link>
 *     &data=05|02|<recipient email>|<tenant>|...&sdata=...&reserved=0
 *
 * and its `data` parameter carries the RECIPIENT's email address: another
 * brokerage's agent. The listing page passed that string to the browser as a
 * watch link, so it sat in the public page payload. It is also a dead end for
 * a visitor (SafeLinks checks the click against the recipient's tenant).
 *
 * Measured by a row read on 2026-10-14 over listings with has_virtual_tour or
 * a virtual_tour_url: 112 listings carry a wrapper or an email address in
 * those fields. 53 SafeLinks (6 Active), 24 Proofpoint urldefense, 33
 * Mimecast, 1 Google redirect; 30 carry an email address (7 Active).
 *
 * THE RULE, applied at every read boundary that hands out a listing media URL
 * (lib/video-embed, lib/pick-video-from-details, the tile and card readers,
 * the sync mapper that stores virtual_tour_url):
 *
 *   1. A known wrapper is unwrapped to the real target. Wrappers nest, so this
 *      repeats, up to MAX_UNWRAP_DEPTH.
 *   2. A wrapper whose target cannot be read without asking the wrapper's own
 *      server (Mimecast, Cisco, Sophos, a SafeLinks with no url param, a
 *      Proofpoint v3 link with byte substitutions) is dropped. We never fetch a
 *      third-party page at render time, and a link we cannot read is not one we
 *      may publish.
 *   3. The unwrapped URL still never carries an email address: a query
 *      parameter or userinfo that holds one is removed, and a URL whose path
 *      still holds one is dropped.
 *
 * A URL with no wrapper and no email address comes back exactly as given, so
 * this never re-serializes (and never subtly changes) a clean link.
 *
 * The raw MLS payload in listings.details is the listing broker's record and
 * is stored as received; it is not served raw to the public. Pure and
 * client-safe (no Node APIs): VideoListingCard runs normalizeEmbed in the
 * browser.
 */

const MAX_UNWRAP_DEPTH = 5

/**
 * An email address. The top-level label may not be a file extension, so a
 * retina asset name like `logo@2x.png` or `reel@1080p.mp4` is not read as an
 * address.
 */
const EMAIL_RE =
  /[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?!(?:png|jpe?g|gif|webp|avif|svg|mp4|m4v|mov|webm|html?|php|aspx?|json|xml)(?![a-z0-9-]))[a-z]{2,}(?![a-z0-9-])/i

/** Percent-decode until stable (a SafeLinks `data` param is often double-encoded). */
function fullyDecode(value: string): string {
  let current = value
  for (let i = 0; i < 3; i++) {
    let next: string
    try {
      next = decodeURIComponent(current.replace(/\+/g, ' '))
    } catch {
      next = current.replace(/%25/gi, '%').replace(/%40/gi, '@')
    }
    if (next === current) break
    current = next
  }
  return current
}

/** True when the value, decoded, holds an email address anywhere. Pure. */
export function containsEmailAddress(value: string | null | undefined): boolean {
  if (!value) return false
  return EMAIL_RE.test(value) || EMAIL_RE.test(fullyDecode(value))
}

function parseHttpUrl(value: string): URL | null {
  const candidate = value.startsWith('//') ? `https:${value}` : value
  if (!/^https?:\/\//i.test(candidate)) return null
  try {
    return new URL(candidate)
  } catch {
    return null
  }
}

const SAFELINKS_HOST = /(?:^|\.)safelinks\.protection\.(?:outlook\.com|office365\.us|outlook\.de|partner\.outlook\.cn)$/i
const GOOGLE_HOST = /^(?:www\.)?google\.[a-z.]{2,6}$/i
/** Opaque click-scanning hosts: the target is a server-side token. */
const OPAQUE_WRAPPER_HOST = /(?:^|\.)(?:mimecast\.com|mimecastprotect\.com|secure-web\.cisco\.com|protection\.sophos\.com)$/i
const PROOFPOINT_V3 = /^https?:\/\/urldefense(?:\.proofpoint)?\.com\/v3\/__(.+?)__;/i

type UnwrapResult = { kind: 'target'; url: string } | { kind: 'opaque' } | { kind: 'none' }

/** One layer of a known wrapper, read from the URL alone (no network). */
function unwrapOnce(raw: string, u: URL): UnwrapResult {
  const host = u.hostname.toLowerCase()
  const path = u.pathname

  if (SAFELINKS_HOST.test(host)) {
    const target = u.searchParams.get('url')
    return target ? { kind: 'target', url: target } : { kind: 'opaque' }
  }

  if (host === 'urldefense.proofpoint.com' || host === 'urldefense.com') {
    const v3 = PROOFPOINT_V3.exec(raw)
    if (v3) {
      // A `*` marks bytes Proofpoint moved into the encoded tail; reading them
      // back is a byte-substitution decode we do not trust ourselves with.
      return v3[1].includes('*') ? { kind: 'opaque' } : { kind: 'target', url: v3[1] }
    }
    const encoded = u.searchParams.get('u')
    if (!encoded) return { kind: 'opaque' }
    if (path.startsWith('/v1/')) return { kind: 'target', url: encoded }
    if (path.startsWith('/v2/')) {
      try {
        return { kind: 'target', url: decodeURIComponent(encoded.replace(/-/g, '%').replace(/_/g, '/')) }
      } catch {
        return { kind: 'opaque' }
      }
    }
    return { kind: 'opaque' }
  }

  if (GOOGLE_HOST.test(host) && path === '/url') {
    const target = u.searchParams.get('q') ?? u.searchParams.get('url')
    return target ? { kind: 'target', url: target } : { kind: 'opaque' }
  }

  if ((host === 'l.facebook.com' || host === 'lm.facebook.com') && path === '/l.php') {
    const target = u.searchParams.get('u')
    return target ? { kind: 'target', url: target } : { kind: 'opaque' }
  }

  if (host === 'linkprotect.cudasvc.com' && path === '/url') {
    const target = u.searchParams.get('a')
    return target ? { kind: 'target', url: target } : { kind: 'opaque' }
  }

  if (host.endsWith('.trendmicro.com') && path.includes('/clicktime/')) {
    const target = u.searchParams.get('url')
    return target ? { kind: 'target', url: target } : { kind: 'opaque' }
  }

  if (OPAQUE_WRAPPER_HOST.test(host)) return { kind: 'opaque' }

  return { kind: 'none' }
}

/** Remove every email-bearing part of an unwrapped URL; null when one remains. */
function scrubEmail(original: string, u: URL): string | null {
  if (!containsEmailAddress(original)) return original
  const out = new URL(u.href)
  out.username = ''
  out.password = ''
  for (const key of [...new Set(out.searchParams.keys())]) {
    const values = out.searchParams.getAll(key)
    if (containsEmailAddress(key) || values.some((v) => containsEmailAddress(v))) {
      out.searchParams.delete(key)
    }
  }
  if (containsEmailAddress(out.hash)) out.hash = ''
  const serialized = out.toString()
  return containsEmailAddress(serialized) ? null : serialized
}

function cleanPlainUrl(input: string): string | null {
  let current = input
  for (let depth = 0; depth <= MAX_UNWRAP_DEPTH; depth++) {
    const parsed = parseHttpUrl(current)
    // Not an http(s) URL. Nothing here can play it; it still never leaves
    // carrying an address.
    if (!parsed) return containsEmailAddress(current) ? null : current
    const step = unwrapOnce(current, parsed)
    if (step.kind === 'opaque') return null
    if (step.kind === 'none') return scrubEmail(current, parsed)
    current = step.url.trim()
    if (!current) return null
  }
  return null
}

/** `src` / `href` values inside MLS ObjectHtml (`<iframe src=...>`, `<a href=...>`). */
const MARKUP_URL_ATTR = /\b(src|href)\s*=\s*(["'])(.*?)\2/gi

function cleanMarkup(html: string): string | null {
  const cleaned = html.replace(MARKUP_URL_ATTR, (_m, attr: string, quote: string, value: string) => {
    const next = cleanPlainUrl(value.replace(/&amp;/g, '&').trim())
    return `${attr}=${quote}${next ? next.replace(/&/g, '&amp;') : ''}${quote}`
  })
  return containsEmailAddress(cleaned) ? null : cleaned
}

/**
 * The URL a listing's video or tour may be stored, rendered, serialized, or
 * published as, or null when no safe form exists. Accepts a bare URL, a
 * protocol-relative `//host` URL, or MLS ObjectHtml markup. Pure.
 */
export function cleanListingMediaUrl(raw: string | null | undefined): string | null {
  const input = typeof raw === 'string' ? raw.trim() : ''
  if (!input) return null
  if (input.includes('<')) return cleanMarkup(input)
  return cleanPlainUrl(input)
}
