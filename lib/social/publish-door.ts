/**
 * The publish door: every platform /api/social/publish accepts as a target.
 *
 * One list, read by the door itself (app/api/social/publish/route.ts) and by the
 * token heartbeat (app/api/cron/token-heartbeat/route.ts). The heartbeat treats a
 * platform the door will post to as a failure when it has no token row, so a
 * target can no longer sit unconnected for months while the heartbeat reports
 * "skipped" (LinkedIn, 2026-07-09 to 2026-10-14).
 */
export const PUBLISH_DOOR_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'google_business_profile',
  'x',
  'pinterest',
  'nextdoor',
] as const

export type PublishDoorPlatform = (typeof PUBLISH_DOOR_PLATFORMS)[number]

export function isPublishDoorPlatform(platform: string): platform is PublishDoorPlatform {
  return (PUBLISH_DOOR_PLATFORMS as readonly string[]).includes(platform)
}

/**
 * Platforms Matt removed. The door refuses them by name with
 * REMOVED_PLATFORMS_MESSAGE, and the token heartbeat never checks, refreshes or
 * alerts on them, even when a token row exists. Their libs, authorize routes and
 * token tables stay in place (no deletes).
 */
export const REMOVED_PLATFORMS = [
  { platform: 'linkedin', label: 'LinkedIn', reason: 'Matt 2026-10-14: "Just remove LinkedIn and Threads."' },
  { platform: 'threads', label: 'Threads', reason: 'Matt 2026-10-14: "Just remove LinkedIn and Threads."' },
] as const

export type RemovedPlatform = (typeof REMOVED_PLATFORMS)[number]['platform']

export const REMOVED_PLATFORMS_MESSAGE = 'LinkedIn and Threads were removed as platforms (Matt 2026-10-14)'

export function isRemovedPlatform(platform: string): platform is RemovedPlatform {
  return REMOVED_PLATFORMS.some((r) => r.platform === platform)
}
