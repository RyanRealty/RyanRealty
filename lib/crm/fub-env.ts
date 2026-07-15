/**
 * Canonical FollowUpBoss credentials accessor (audit p1.2).
 *
 * The FUB API key is read under TWO env names across the repo
 * (FOLLOWUPBOSS_API_KEY and FUB_API_KEY). A key set under only one name silently
 * disabled half the system. This is the single accessor: it reads BOTH
 * (preferring FOLLOWUPBOSS_API_KEY), so either env name works everywhere.
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

// fubAuthHeader() / fubAuthHeaderTrimmed() were deleted 2026-07-14 — both
// threw unconditionally post-decommission and had zero non-test callers (the
// deferred FUB 3-client merge they existed for is moot with FUB off).
