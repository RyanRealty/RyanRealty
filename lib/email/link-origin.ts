/**
 * The origin every link and image inside an outbound email points at.
 *
 * Email was the first surface moved off the Vercel alias (Matt 2026-10-07, the
 * Keats email: a sender domain and a link domain that do not match is a
 * phishing signal to Outlook and Gmail). The rule then became site-wide, so
 * the one implementation lives in lib/site-origin.ts; these names stay so the
 * email modules keep their imports.
 */

export {
  CANONICAL_SITE_ORIGIN as CANONICAL_EMAIL_ORIGIN,
  siteOrigin as emailLinkOrigin,
  canonicalizeSiteHosts as canonicalizeEmailHosts,
} from '@/lib/site-origin'
