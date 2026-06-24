/**
 * Canonical FollowUpBoss credentials accessor (audit p1.2).
 *
 * The FUB API key is read under TWO env names across the repo
 * (FOLLOWUPBOSS_API_KEY and FUB_API_KEY). A key set under only one name silently
 * disabled half the system. This is the single accessor: it reads BOTH
 * (preferring FOLLOWUPBOSS_API_KEY), so either env name works everywhere. It also
 * provides the Basic-auth header (key as username, blank password) that was
 * otherwise hand-built `Buffer.from(...)` in 8+ files.
 */
/**
 * FUB DECOMMISSIONED (cutover 2026-06-24). Returns undefined so every FollowUp
 * Boss API path no-ops — each FUB client function guards `if (!apiKey) return`
 * (the codebase's supported keyless state from before the key was ever
 * provisioned), so this single switch stops ALL outbound FUB traffic. Lead
 * capture is native (see lib/followupboss.sendEvent → ensureNativeLead and
 * lib/crm/lead-router). Re-enabling FUB is intentionally not a config flip.
 */
export function getFubApiKey(): string | undefined {
  return undefined
}

/** Basic-auth header value for FollowUpBoss (key as username, blank password). */
export function fubAuthHeader(): string {
  const key = getFubApiKey()
  if (!key) {
    throw new Error('FollowUpBoss API key not configured (set FOLLOWUPBOSS_API_KEY or FUB_API_KEY)')
  }
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}

/**
 * Basic-auth header that TRIMS the key first — byte-for-byte identical to what
 * the three hand-rolled FUB clients build today (lib/followupboss.ts, lib/fub.ts,
 * lib/fub-snapshot.ts all do `getFubApiKey()?.trim()` then base64(key + ':')).
 *
 * This exists to give the deferred FUB 3-client merge (audit) a byte-identity
 * landing pad: those clients can later swap to this helper with NO change on the
 * wire. fubAuthHeader() (no trim) and this DIFFER whenever the env value carries
 * surrounding whitespace — that discrepancy is the reason the merge can't just
 * point everything at fubAuthHeader(); the characterization test in
 * fub-env.test.ts locks both behaviors so the swap can't silently change auth.
 */
export function fubAuthHeaderTrimmed(): string {
  const key = getFubApiKey()?.trim()
  if (!key) {
    throw new Error('FollowUpBoss API key not configured (set FOLLOWUPBOSS_API_KEY or FUB_API_KEY)')
  }
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}
