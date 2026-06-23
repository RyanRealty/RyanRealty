/**
 * Canonical Meta (Facebook/Instagram) Graph credentials accessor (audit p3.3).
 *
 * The Meta page access token is read under TWO env names across the repo
 * (META_PAGE_ACCESS_TOKEN and META_PAGE_TOKEN), and the read is inconsistent:
 * the live publishers (publish / publish-instagram / publish-facebook /
 * token-heartbeat) read ONLY META_PAGE_ACCESS_TOKEN, so a token set under only
 * META_PAGE_TOKEN silently disables publishing while the dual-reading diagnostics
 * still work (a confusing half-broken state). This is the single accessor: it
 * reads BOTH (preferring META_PAGE_ACCESS_TOKEN), so either env name works
 * everywhere. Mirrors lib/crm/fub-env.ts (the FOLLOWUPBOSS/FUB collapse).
 *
 * The `ci:meta-token` ratchet gate bans NEW direct env reads outside this file;
 * existing readers are a baselined backlog that may only shrink.
 */
export function getMetaPageToken(): string | undefined {
  return process.env.META_PAGE_ACCESS_TOKEN ?? process.env.META_PAGE_TOKEN
}

/**
 * Trimmed variant for readers that did `A?.trim() || B?.trim()` (per-value trim,
 * truthy fallback). Byte-equivalent to that form; returns undefined when neither
 * name holds a non-blank value.
 */
export function getMetaPageTokenTrimmed(): string | undefined {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || process.env.META_PAGE_TOKEN?.trim() || undefined
}

/**
 * System-User access token for Meta Marketing API writes (Custom Audiences,
 * offline conversions) -- distinct from the Page token used for publishing.
 * This token carries `ads_management` on the ad account. Read it ONLY through
 * this accessor so every META_* read stays in this canonical file (mirrors the
 * page-token policy the `ci:meta-token` gate enforces). The historical user
 * names (`META_USER_ACCESS_TOKEN_USER`) are accepted as a fallback so a token
 * set under either name works everywhere.
 *
 * Returns undefined when neither name holds a non-blank value.
 */
export function getMetaUserAccessToken(): string | undefined {
  return (
    process.env.META_USER_ACCESS_TOKEN?.trim() ||
    process.env.META_USER_ACCESS_TOKEN_USER?.trim() ||
    undefined
  )
}

/**
 * The Meta ad-account id, always normalized to the `act_<digits>` form Graph
 * API path segments require. Returns undefined when unset/blank.
 */
export function getMetaAdAccountId(): string | undefined {
  const raw = process.env.META_AD_ACCOUNT_ID?.trim()
  if (!raw) return undefined
  return raw.startsWith('act_') ? raw : `act_${raw}`
}

/**
 * The live-push safety flag. The audience uploader pushes real hashed PII to
 * Meta ONLY when this is the exact string 'true' AND the caller passes
 * dryRun:false. Any other value (unset, '1', 'yes', 'TRUE') keeps the uploader
 * in dry-run -- the first live push is an explicit, deliberate decision.
 */
export function isMetaAudiencePushEnabled(): boolean {
  return process.env.META_AUDIENCE_PUSH_ENABLED?.trim() === 'true'
}

/**
 * The CRM→CAPI "qualified lead" loop (Conversion Leads Optimization) fires a
 * Meta CAPI quality event when a lead reaches a qualifying CRM stage, so Meta
 * learns which leads convert. OFF by default — it sends hashed PII to Meta, and
 * at low lead volume it has no optimization effect (needs ~50 events/ad-set/wk),
 * so it stays dry-run until META_CAPI_QUALIFIED_ENABLED === 'true'. Mirrors the
 * audience-push double-gate posture: no surprise sends to Meta.
 */
export function isMetaCapiQualifiedEnabled(): boolean {
  return process.env.META_CAPI_QUALIFIED_ENABLED?.trim() === 'true'
}
