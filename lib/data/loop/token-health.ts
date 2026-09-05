/**
 * Token health classifier for loop-brief / scoreboard.
 *
 * A stored refresh_token is not proof the grant still works. X has returned
 * 400 on refresh since 2026-08-29 while still looking like auto-refresh.
 * Three consecutive token-heartbeat 5xx/4xx rows mean needs-reauth.
 */

export type TokenHealthStatus = 'valid' | 'auto-refresh' | 'needs-reauth' | 'empty' | 'unreadable'

export const HEARTBEAT_FAIL_STREAK = 3

export const AUTH_TABLE_TO_HEARTBEAT: Record<string, string> = {
  tiktok_auth: 'token_heartbeat:tiktok',
  youtube_auth: 'token_heartbeat:youtube',
  linkedin_auth: 'token_heartbeat:linkedin',
  x_auth: 'token_heartbeat:x',
  google_business_profile_auth: 'token_heartbeat:google_business_profile',
  threads_auth: 'token_heartbeat:threads',
  pinterest_auth: 'token_heartbeat:pinterest',
  nextdoor_auth: 'token_heartbeat:nextdoor',
}

/** Newest-first heartbeat rows for one platform. Count consecutive failures from the front. */
export function consecutiveHeartbeatFailures(
  rows: Array<{ response_status: number | null }>,
): number {
  let n = 0
  for (const row of rows) {
    const status = row.response_status ?? 0
    if (status >= 400) n += 1
    else break
  }
  return n
}

export function classifyTokenHealth(input: {
  rows: number
  expiresAt: string | null
  refreshTokenPresent: boolean
  nowMs: number
  consecutiveHeartbeatFailures: number
}): TokenHealthStatus {
  if (input.rows === 0) return 'empty'
  const pastExpiry = input.expiresAt ? Date.parse(input.expiresAt) < input.nowMs : false
  if (!pastExpiry) return 'valid'
  if (input.consecutiveHeartbeatFailures >= HEARTBEAT_FAIL_STREAK) return 'needs-reauth'
  if (input.refreshTokenPresent) return 'auto-refresh'
  return 'needs-reauth'
}
