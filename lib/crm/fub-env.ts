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
export function getFubApiKey(): string | undefined {
  return process.env.FOLLOWUPBOSS_API_KEY ?? process.env.FUB_API_KEY
}

/** Basic-auth header value for FollowUpBoss (key as username, blank password). */
export function fubAuthHeader(): string {
  const key = getFubApiKey()
  if (!key) {
    throw new Error('FollowUpBoss API key not configured (set FOLLOWUPBOSS_API_KEY or FUB_API_KEY)')
  }
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}
