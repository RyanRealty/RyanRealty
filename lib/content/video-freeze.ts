/**
 * lib/content/video-freeze.ts: the video publishing freeze (Matt 2026-10-14,
 * "Freeze it now").
 *
 * WHY. An audit found that /admin/studio -> lib/studio/produce.ts ->
 * approveStudioDraft -> publisher-sweep -> /api/social/publish could carry a
 * VIDEO into Matt's approval queue and out to the channels without any of the
 * new checks (video:check, the voiceover, the captions, the locked end card).
 * The publish route's validateGate only checks that five path strings are
 * non-empty and that humanApprovedAt is under seven days old. A new content
 * process with a server-signed certificate is being built; until it is live,
 * no video reaches the queue or a channel by this path.
 *
 * WHAT. One question, "is this video?", asked at every choke point on that
 * path: producing a draft (lib/studio/produce.ts, lib/social/imagine-produce.ts),
 * approving one (approveStudioDraft, approveAction, the approval-queue routes),
 * the publisher sweep, and the publish route (423 Locked); and at the scripts
 * that post video to a platform directly (scripts/upload-youtube.mjs,
 * scripts/create-fb-ad.mjs, lib/meta-marketing-api.mjs uploadVideo and
 * createAdCreative), which import this file as '../lib/content/video-freeze.ts'
 * (plain Node strips the types, so keep this file free of imports and of
 * syntax that needs a compile step). Image and text posts are not frozen.
 *
 * FAIL CLOSED. When nothing says what the media is, it is video.
 *
 * RETIRED WHEN the server-signed certificate check replaces it at these same
 * choke points. This module, its calls, and scripts/check-video-freeze.mjs
 * (ci:video-freeze, which keeps the calls from being quietly removed) go
 * together.
 */

/** The switch. ci:video-freeze fails if this is anything but `true`. */
export const VIDEO_PUBLISH_FROZEN: boolean = true

export const VIDEO_FREEZE_MESSAGE =
  'Video publishing is frozen until the content process is live (Matt 2026-10-14). Videos go through the content process (docs/plans/STUDIO_ONE_FACTORY.md) and need a server-signed certificate.'

/**
 * What the codebase records about a piece of media. Every field is optional
 * and may be a string or a list of strings; pass what the call site has.
 */
export type MediaFacts = {
  /** PublishRequest.mediaType and executor_response.publish_payload.mediaType: 'image' | 'video' | 'reel'. */
  mediaType?: unknown
  /**
   * executor_response.media.kind, executor_response.media_type (Imagine drafts),
   * StudioDraftRow.mediaKind, StudioFormat.media: 'image' | 'video'.
   */
  kind?: unknown
  /** The media URL(s): publish mediaUrl, executor_response.media.url. A video file extension is video. */
  url?: unknown
  /** MIME type of the stored bytes ('video/mp4', 'image/jpeg'). */
  mimeType?: unknown
  /**
   * Names for the format: StudioFormat.id, marketing_brain_actions.action_type
   * and format, publish contentType. A name can only ADD a video signal
   * ('content:listing_video', 'listing_film'); it never makes media an image.
   */
  format?: unknown
}

const VIDEO_KINDS = new Set(['video', 'videos', 'reel', 'reels', 'shorts', 'story_video', 'clip', 'film'])
const NOT_VIDEO_KINDS = new Set(['image', 'photo', 'still', 'text'])
const VIDEO_EXTENSION = /\.(mp4|m4v|mov|qt|webm|mkv|avi|wmv|flv|mpe?g|3gp|m3u8|mpd)$/i
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i
const VIDEO_MIME = /^(video\/|application\/(x-mpegurl|vnd\.apple\.mpegurl|dash\+xml)$)/i
const VIDEO_FORMAT_WORD = /(^|[^a-z])(video|videos|reel|reels|shorts|film|films|clip|clips|motion|tiktok)([^a-z]|$)/i

function strings(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value]
  return list.flatMap((v) => (typeof v === 'string' && v.trim() ? [v.trim()] : []))
}

/** The path of a URL, without query or fragment, so `clip.mp4?token=x` reads as .mp4. */
function urlPath(raw: string): string {
  try {
    return decodeURIComponent(new URL(raw).pathname)
  } catch {
    return raw.split(/[?#]/)[0] ?? raw
  }
}

/**
 * True when the media is video, or when nothing says what it is (fail closed).
 * Any video signal wins over any image signal: an "image" whose URL is an
 * .mp4 is video.
 */
export function isVideoMedia(facts: MediaFacts): boolean {
  const kinds = [...strings(facts.mediaType), ...strings(facts.kind)].map((k) => k.toLowerCase())
  const paths = strings(facts.url).map(urlPath)
  const mimes = strings(facts.mimeType).map((m) => m.toLowerCase())
  const formats = strings(facts.format)

  const saysVideo =
    kinds.some((k) => VIDEO_KINDS.has(k)) ||
    paths.some((p) => VIDEO_EXTENSION.test(p)) ||
    mimes.some((m) => VIDEO_MIME.test(m)) ||
    formats.some((f) => VIDEO_FORMAT_WORD.test(f))
  if (saysVideo) return true

  const saysNotVideo =
    kinds.some((k) => NOT_VIDEO_KINDS.has(k)) ||
    paths.some((p) => IMAGE_EXTENSION.test(p)) ||
    mimes.some((m) => m.startsWith('image/'))
  return !saysNotVideo
}

/** The refusal at a choke point: the message when this is video and the freeze is on, else null. */
export function videoFreezeRefusal(facts: MediaFacts): string | null {
  if (!VIDEO_PUBLISH_FROZEN) return null
  return isVideoMedia(facts) ? VIDEO_FREEZE_MESSAGE : null
}

/** The columns of a marketing_brain_actions row that say what it would post. */
export type PublishRowFacts = {
  action_type?: unknown
  format?: unknown
  executor_response?: unknown
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** The media facts of a marketing_brain_actions row: its publish payload, its media record, its names. */
export function rowMediaFacts(row: PublishRowFacts): MediaFacts {
  const executor = record(row.executor_response)
  const publish = record(executor.publish_payload)
  const media = record(executor.media)
  return {
    mediaType: publish.mediaType,
    kind: [media.kind, executor.media_type],
    url: [publish.mediaUrl, media.url],
    format: [row.action_type, row.format, publish.contentType],
  }
}

/**
 * The refusal for APPROVING a marketing_brain_actions row. A row that carries
 * nothing to post (no publish media, no media record: a CMA, a blog post, an
 * ops row) is not media, so it is not frozen unless its name says video.
 * Every row that does carry media is judged by isVideoMedia, failing closed.
 */
export function rowVideoFreezeRefusal(row: PublishRowFacts): string | null {
  if (!VIDEO_PUBLISH_FROZEN) return null
  const facts = rowMediaFacts(row)
  const carriesMedia = [facts.mediaType, facts.kind, facts.url].some((v) => strings(v).length > 0)
  if (!carriesMedia) {
    return strings(facts.format).some((f) => VIDEO_FORMAT_WORD.test(f)) ? VIDEO_FREEZE_MESSAGE : null
  }
  return isVideoMedia(facts) ? VIDEO_FREEZE_MESSAGE : null
}

/** Split rows for a bulk approve: the ones that may be approved, and the frozen video ones. */
export function splitVideoFrozen<T extends PublishRowFacts>(rows: T[]): { allowed: T[]; frozen: T[] } {
  const allowed: T[] = []
  const frozen: T[] = []
  for (const row of rows) {
    if (rowVideoFreezeRefusal(row)) frozen.push(row)
    else allowed.push(row)
  }
  return { allowed, frozen }
}
