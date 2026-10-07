/**
 * The ONE origin every outward URL is built on: https://ryan-realty.com.
 *
 * Matt 2026-10-07: "why were we using ryanrealty.vercel.app, I don't ever want
 * to do that again, all coding agents need to know this." The Vercel
 * production alias is an implementation detail of hosting. It never appears in
 * a link, an image, an email, an SMS, a lead-source label, a conversion URL, a
 * redirect, a PDF, a document, a canonical or structured data.
 *
 * Production's NEXT_PUBLIC_SITE_URL holds the alias (2026-10-07), and 90 files (104 reads)
 * read the variable directly, so canonicals, sitemaps, email links, CRM lead
 * sources and CAPI event URLs all went out on the alias host. This module is
 * now the only reader of that variable (held by ci:site-origin,
 * scripts/check-site-origin.mjs): whatever the variable says, a production
 * host resolves to the canonical origin. Any other host (a preview, localhost)
 * is kept, so a preview or a local run never points at production with a
 * secret production does not hold. Unset resolves to the canonical origin.
 *
 * Client-safe: no Node imports. `process.env.NEXT_PUBLIC_SITE_URL` is written
 * out literally so Next inlines it into client bundles at build time.
 */

export const CANONICAL_SITE_ORIGIN = 'https://ryan-realty.com'

/** The canonical host, for labels that carry a bare host (a lead `source`). */
export const CANONICAL_SITE_HOST = 'ryan-realty.com'

/**
 * Hosts that ARE production. The alias serves /api/* and files but 308s every
 * page to the apex (middleware.ts NON_CANONICAL_HOSTS), and www folds into the
 * apex the same way.
 */
const PRODUCTION_HOSTS: ReadonlySet<string> = new Set([
  'ryan-realty.com',
  'www.ryan-realty.com',
  'ryanrealty.vercel.app', // staging-host-ok: the production alias being mapped AWAY from
])

/** True for a hostname that is production (the apex, www, the Vercel alias). */
export function isProductionSiteHost(hostname: string | null | undefined): boolean {
  return PRODUCTION_HOSTS.has(String(hostname ?? '').trim().toLowerCase())
}

function parseOrigin(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return isProductionSiteHost(u.hostname) ? CANONICAL_SITE_ORIGIN : u.origin
  } catch {
    return null
  }
}

/**
 * The origin for every outward URL: no trailing slash, no path.
 * Production hosts → https://ryan-realty.com; a preview or local host is kept;
 * unset or unparseable → https://ryan-realty.com.
 */
export function siteOrigin(raw: string | null | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return parseOrigin(raw) ?? CANONICAL_SITE_ORIGIN
}

/**
 * The configured origin with the same production mapping, or null when
 * NEXT_PUBLIC_SITE_URL is unset or unparseable. For the few callers whose
 * fallback is NOT production: a self-call that should hit the running
 * deployment, or a client form that wants a relative URL in that case.
 */
export function configuredSiteOrigin(raw: string | null | undefined = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  return parseOrigin(raw)
}

/**
 * The bare host of siteOrigin() (port kept for localhost), for labels such as
 * the CRM lead `source`: 'ryan-realty.com' in production.
 */
export function siteHost(raw: string | null | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return new URL(siteOrigin(raw)).host
}

/** An absolute URL on the site origin for a root-relative path. */
export function siteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${siteOrigin()}${p}`
}

/**
 * Point every production-alias URL in a block of text or HTML (a synced Gmail
 * signature, a stored template) at the canonical origin. Changes only the
 * host, never a path or a word, and leaves other vercel.app hosts alone.
 */
export function canonicalizeSiteHosts(text: string): string {
  return text.replace(/https?:\/\/ryanrealty\.vercel\.app(?=[/"'\s?#)]|$)/gi, CANONICAL_SITE_ORIGIN)
}
