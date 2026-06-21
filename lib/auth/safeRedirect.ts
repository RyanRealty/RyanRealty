/**
 * safeRedirectPath — sanitize a post-auth `next` redirect to a same-origin PATH.
 *
 * Audit p0.2 fix. Server actions previously accepted any value starting with '/'
 * (`next.startsWith('/') ? next : `/${next}``), so `//evil.com` (protocol-relative)
 * passed straight through and became an open redirect after sign-in. This helper
 * is the single sanitizer for every auth redirect: it strips control chars,
 * normalizes backslashes (browsers treat `\` as `/`), rejects anything that
 * isn't a relative path (scheme://host, javascript:, bare host), and collapses
 * leading slashes so `//host` can never survive.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/'): string {
  if (typeof next !== 'string') return fallback
  // Drop C0 control chars + DEL (defeats header-injection / weird targets) using a
  // codepoint filter — no raw control bytes or fragile regex escapes in source.
  let p = ''
  for (const ch of next) {
    const code = ch.charCodeAt(0)
    if (code > 31 && code !== 127) p += ch
  }
  p = p.trim()
  if (p === '') return fallback
  // Browsers normalize backslashes to slashes — treat them the same so they
  // can't smuggle an authority, e.g. `/\evil.com` or `\\evil.com`.
  p = p.split('\\').join('/')
  // Must be a relative path. Rejects `https://evil.com`, `javascript:...`, bare hosts.
  if (!p.startsWith('/')) return fallback
  // Collapse a leading run of slashes to exactly one → kills `//host`
  // protocol-relative redirects while preserving the rest of the path/query/hash.
  while (p.length > 1 && p[1] === '/') p = p.slice(1)
  return p
}
