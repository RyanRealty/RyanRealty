/**
 * platformFetchCode — map the publish-pipeline platform vocabulary to the short
 * fetch code the performance-pull crons dispatch on.
 *
 * THE bug this kills: `/api/social/publish` emits long platform names
 * ('instagram', 'facebook', 'google_business_profile', 'tiktok', 'youtube'),
 * publisher-sweep writes them verbatim into
 * `executor_response.published_to[].platform`, but the 48h/7d/30d performance
 * pulls switch on SHORT codes ('ig', 'fb', 'gbp', 'tt'). So every Instagram and
 * Facebook post — the only two platforms with a live token — fell through to the
 * `default` arm and stored `{ error: 'unknown_platform:instagram' }` as its
 * metrics while the cron still returned `ok: true`. Silently dead.
 *
 * Keep this in sync with the publish endpoint's `Platform` union
 * (app/api/social/publish/route.ts) and the measurement-loop `PLATFORM_ALIASES`
 * (lib/marketing-brain/measurement-loop.ts). The check-measurement-loop gate
 * asserts the three pulls route through here and that the token-live mappings
 * (instagram -> ig, facebook -> fb) hold.
 */

export type PlatformFetchCode =
  | 'ig'
  | 'fb'
  | 'linkedin'
  | 'x'
  | 'gbp'
  | 'tt'
  | 'youtube'
  | 'pinterest'
  | 'threads'
  | 'nextdoor'

/** Every spelling a published_to row can carry -> the fetch code. Idempotent: a
 *  caller may pass either the long publish name or the already-short code. */
const PLATFORM_FETCH_CODE: Record<string, PlatformFetchCode> = {
  // long publish-endpoint vocabulary (what publisher-sweep actually writes)
  instagram: 'ig',
  facebook: 'fb',
  google_business_profile: 'gbp',
  tiktok: 'tt',
  youtube: 'youtube',
  linkedin: 'linkedin',
  x: 'x',
  pinterest: 'pinterest',
  threads: 'threads',
  nextdoor: 'nextdoor',
  // already-short codes (so re-normalizing is a no-op)
  ig: 'ig',
  fb: 'fb',
  gbp: 'gbp',
  tt: 'tt',
}

/**
 * Normalize any platform spelling to the short fetch code. An unrecognized
 * platform returns its trimmed lowercased self, so the caller's switch still
 * throws `unknown_platform:<x>` for a genuinely new platform instead of silently
 * passing.
 */
export function platformFetchCode(platform: string): string {
  const key = String(platform ?? '').trim().toLowerCase()
  return PLATFORM_FETCH_CODE[key] ?? key
}
