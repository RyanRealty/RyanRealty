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
  'linkedin',
  'google_business_profile',
  'x',
  'pinterest',
  'threads',
  'nextdoor',
] as const

export type PublishDoorPlatform = (typeof PUBLISH_DOOR_PLATFORMS)[number]

export function isPublishDoorPlatform(platform: string): platform is PublishDoorPlatform {
  return (PUBLISH_DOOR_PLATFORMS as readonly string[]).includes(platform)
}
