const META_GRAPH_BASE = 'https://graph.facebook.com/v25.0'
// Marketing API version pinned separately (v18.0 in the .mjs ad-creation client;
// insights endpoint is stable on v25.0 which we use here).
const META_ADS_GRAPH_BASE = 'https://graph.facebook.com/v25.0'
// Instagram Business publishing endpoints are under graph.facebook.com,
// not graph.instagram.com (which is for Basic Display tokens).
const META_IG_BASE = 'https://graph.facebook.com/v25.0'

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MetaGraphError extends Error {
  code: number | undefined
  type: string | undefined
  fbTraceId: string | undefined

  constructor(message: string, code?: number, type?: string, fbTraceId?: string) {
    super(message)
    this.name = 'MetaGraphError'
    this.code = code
    this.type = type
    this.fbTraceId = fbTraceId
  }
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface MetaErrorBody {
  error?: {
    message: string
    type?: string
    code?: number
    fbtrace_id?: string
  }
}

interface MediaContainerResponse extends MetaErrorBody {
  id?: string
}

interface MediaPublishResponse extends MetaErrorBody {
  id?: string
}

interface ContainerStatusResponse extends MetaErrorBody {
  status_code?: string
  id?: string
}

interface ContentPublishingLimitResponse extends MetaErrorBody {
  data?: Array<{
    config?: { quota_total: number; quota_duration: number }
    quota_usage?: number
  }>
}

interface FBFeedResponse extends MetaErrorBody {
  id?: string
}

interface FBPhotoResponse extends MetaErrorBody {
  id?: string
  post_id?: string
}

interface FBVideoResponse extends MetaErrorBody {
  id?: string
  post_id?: string
  video_id?: string
}

interface FBReelUploadResponse extends MetaErrorBody {
  video_id?: string
  upload_url?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function throwIfError(response: Response): Promise<void> {
  if (!response.ok) {
    let body: MetaErrorBody = {}
    try {
      body = (await response.json()) as MetaErrorBody
    } catch {
      // ignore parse errors — fall through to generic message
    }
    const err = body.error
    throw new MetaGraphError(
      err?.message ?? `Meta API HTTP ${response.status}: ${response.statusText}`,
      err?.code,
      err?.type,
      err?.fbtrace_id
    )
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  await throwIfError(response)
  return (await response.json()) as T
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await throwIfError(response)
  return (await response.json()) as T
}

// ---------------------------------------------------------------------------
// Instagram — container polling
// ---------------------------------------------------------------------------

/**
 * Fetch the current processing status of a media container.
 * Possible status_code values: IN_PROGRESS, FINISHED, ERROR, EXPIRED, PUBLISHED
 */
export async function checkContainerStatus(
  accessToken: string,
  containerId: string
): Promise<string> {
  const url = `${META_IG_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
  const data = await getJson<ContainerStatusResponse>(url)
  if (!data.status_code) {
    throw new MetaGraphError('No status_code in container status response')
  }
  return data.status_code
}

/**
 * Poll a media container until it reaches FINISHED or ERROR, or until the
 * timeout expires. Resolves when FINISHED; throws on ERROR or timeout.
 */
export async function waitForContainer(
  accessToken: string,
  containerId: string,
  maxWaitMs = 60_000
): Promise<void> {
  const interval = 3_000
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const status = await checkContainerStatus(accessToken, containerId)

    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new MetaGraphError(`Media container ${containerId} entered status: ${status}`)
    }

    // IN_PROGRESS — wait and retry
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new MetaGraphError(
    `Timed out waiting for container ${containerId} after ${maxWaitMs}ms`
  )
}

// ---------------------------------------------------------------------------
// Instagram — publishing limit
// ---------------------------------------------------------------------------

/**
 * Returns the content publishing quota for the IG user.
 * Useful for checking remaining posts before hitting the 25/24h ceiling.
 */
export async function getPublishingLimit(
  accessToken: string,
  igUserId: string
): Promise<ContentPublishingLimitResponse['data']> {
  const url =
    `${META_IG_BASE}/${igUserId}/content_publishing_limit` +
    `?fields=config,quota_usage&access_token=${encodeURIComponent(accessToken)}`
  const data = await getJson<ContentPublishingLimitResponse>(url)
  return data.data ?? []
}

// ---------------------------------------------------------------------------
// Instagram — image post
// ---------------------------------------------------------------------------

/**
 * Publish a single image to an Instagram Business account.
 * Two-step: create container → publish container.
 * Returns the published media ID.
 */
export async function publishImage(
  accessToken: string,
  igUserId: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  // Step 1 — create media container
  const container = await postJson<MediaContainerResponse>(
    `${META_IG_BASE}/${igUserId}/media`,
    {
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }
  )

  if (!container.id) {
    throw new MetaGraphError('No container ID returned when creating image container')
  }

  // Step 2 — publish
  const published = await postJson<MediaPublishResponse>(
    `${META_IG_BASE}/${igUserId}/media_publish`,
    {
      creation_id: container.id,
      access_token: accessToken,
    }
  )

  if (!published.id) {
    throw new MetaGraphError('No media ID returned when publishing image')
  }

  return published.id
}

// ---------------------------------------------------------------------------
// Instagram — reel
// ---------------------------------------------------------------------------

interface ReelOptions {
  /** Thumbnail image URL */
  coverUrl?: string
  /** Whether to also share to the main feed (default true) */
  shareToFeed?: boolean
  /** Array of IG user IDs to invite as collaborators */
  collaborators?: string[]
}

/**
 * Publish a Reel to an Instagram Business account.
 * Polls container status until processing is complete before publishing.
 * Returns the published media ID.
 */
export async function publishReel(
  accessToken: string,
  igUserId: string,
  videoUrl: string,
  caption: string,
  options: ReelOptions = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: options.shareToFeed ?? true,
    access_token: accessToken,
  }

  if (options.coverUrl) body.cover_url = options.coverUrl
  if (options.collaborators?.length) body.collaborators = options.collaborators

  // Step 1 — create container
  const container = await postJson<MediaContainerResponse>(
    `${META_IG_BASE}/${igUserId}/media`,
    body
  )

  if (!container.id) {
    throw new MetaGraphError('No container ID returned when creating reel container')
  }

  // Step 2 — wait for processing
  await waitForContainer(accessToken, container.id)

  // Step 3 — publish
  const published = await postJson<MediaPublishResponse>(
    `${META_IG_BASE}/${igUserId}/media_publish`,
    {
      creation_id: container.id,
      access_token: accessToken,
    }
  )

  if (!published.id) {
    throw new MetaGraphError('No media ID returned when publishing reel')
  }

  return published.id
}

// ---------------------------------------------------------------------------
// Instagram — story
// ---------------------------------------------------------------------------

/**
 * Publish an image or video Story to an Instagram Business account.
 * For video stories, polls container status before publishing.
 * Returns the published media ID.
 */
export async function publishStory(
  accessToken: string,
  igUserId: string,
  mediaUrl: string,
  mediaType: 'image' | 'video'
): Promise<string> {
  const body: Record<string, unknown> = {
    media_type: 'STORIES',
    access_token: accessToken,
  }

  if (mediaType === 'image') {
    body.image_url = mediaUrl
  } else {
    body.video_url = mediaUrl
  }

  // Step 1 — create container
  const container = await postJson<MediaContainerResponse>(
    `${META_IG_BASE}/${igUserId}/media`,
    body
  )

  if (!container.id) {
    throw new MetaGraphError('No container ID returned when creating story container')
  }

  // Step 2 — for video, wait for processing
  if (mediaType === 'video') {
    await waitForContainer(accessToken, container.id)
  }

  // Step 3 — publish
  const published = await postJson<MediaPublishResponse>(
    `${META_IG_BASE}/${igUserId}/media_publish`,
    {
      creation_id: container.id,
      access_token: accessToken,
    }
  )

  if (!published.id) {
    throw new MetaGraphError('No media ID returned when publishing story')
  }

  return published.id
}

// ---------------------------------------------------------------------------
// Instagram — carousel
// ---------------------------------------------------------------------------

interface CarouselChild {
  mediaUrl: string
  mediaType: 'image' | 'video'
}

/**
 * Publish a carousel post (up to 10 items) to an Instagram Business account.
 * Creates child containers for each item, then a carousel container, then publishes.
 * Returns the published media ID.
 */
export async function publishCarousel(
  accessToken: string,
  igUserId: string,
  children: CarouselChild[],
  caption: string
): Promise<string> {
  if (children.length < 2 || children.length > 10) {
    throw new MetaGraphError('Carousel must have between 2 and 10 items')
  }

  // Step 1 — create child containers in parallel
  const childContainerPromises = children.map((child) => {
    const body: Record<string, unknown> = {
      is_carousel_item: true,
      access_token: accessToken,
    }
    if (child.mediaType === 'image') {
      body.image_url = child.mediaUrl
    } else {
      body.media_type = 'VIDEO'
      body.video_url = child.mediaUrl
    }
    return postJson<MediaContainerResponse>(`${META_IG_BASE}/${igUserId}/media`, body)
  })

  const childContainers = await Promise.all(childContainerPromises)
  const childIds = childContainers.map((c, i) => {
    if (!c.id) throw new MetaGraphError(`No container ID for carousel child ${i}`)
    return c.id
  })

  // Step 2 — wait for any video children to finish processing
  const videoIndices = children.reduce<number[]>((acc, child, i) => {
    if (child.mediaType === 'video') acc.push(i)
    return acc
  }, [])

  if (videoIndices.length > 0) {
    await Promise.all(videoIndices.map((i) => waitForContainer(accessToken, childIds[i])))
  }

  // Step 3 — create carousel container
  const carousel = await postJson<MediaContainerResponse>(
    `${META_IG_BASE}/${igUserId}/media`,
    {
      media_type: 'CAROUSEL',
      children: childIds,
      caption,
      access_token: accessToken,
    }
  )

  if (!carousel.id) {
    throw new MetaGraphError('No container ID returned when creating carousel container')
  }

  // Step 4 — publish
  const published = await postJson<MediaPublishResponse>(
    `${META_IG_BASE}/${igUserId}/media_publish`,
    {
      creation_id: carousel.id,
      access_token: accessToken,
    }
  )

  if (!published.id) {
    throw new MetaGraphError('No media ID returned when publishing carousel')
  }

  return published.id
}

// ---------------------------------------------------------------------------
// Facebook — text / link post
// ---------------------------------------------------------------------------

/**
 * Publish a text post (optionally with a link) to a Facebook Page feed.
 * Returns the post ID.
 */
export async function publishFacebookPost(
  accessToken: string,
  pageId: string,
  message: string,
  linkUrl?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    access_token: accessToken,
  }
  if (linkUrl) body.link = linkUrl

  const data = await postJson<FBFeedResponse>(`${META_GRAPH_BASE}/${pageId}/feed`, body)

  if (!data.id) {
    throw new MetaGraphError('No post ID returned when publishing Facebook post')
  }

  return data.id
}

// ---------------------------------------------------------------------------
// Facebook — photo
// ---------------------------------------------------------------------------

/**
 * Publish a photo to a Facebook Page.
 * Returns the photo ID.
 */
export async function publishFacebookPhoto(
  accessToken: string,
  pageId: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const data = await postJson<FBPhotoResponse>(`${META_GRAPH_BASE}/${pageId}/photos`, {
    url: imageUrl,
    caption,
    access_token: accessToken,
  })

  if (!data.id) {
    throw new MetaGraphError('No photo ID returned when publishing Facebook photo')
  }

  return data.id
}

// ---------------------------------------------------------------------------
// Facebook — video (standard upload)
// ---------------------------------------------------------------------------

/**
 * Publish a video to a Facebook Page via URL pull.
 * Returns the video ID.
 */
export async function publishFacebookVideo(
  accessToken: string,
  pageId: string,
  videoUrl: string,
  title: string,
  description: string
): Promise<string> {
  const data = await postJson<FBVideoResponse>(`${META_GRAPH_BASE}/${pageId}/videos`, {
    file_url: videoUrl,
    title,
    description,
    access_token: accessToken,
  })

  if (!data.id && !data.video_id) {
    throw new MetaGraphError('No video ID returned when publishing Facebook video')
  }

  return data.video_id ?? data.id ?? ''
}

// ---------------------------------------------------------------------------
// Facebook — reel
// ---------------------------------------------------------------------------

/**
 * Publish a Reel to a Facebook Page using the upload_phase flow.
 * Phase 1: start upload session → get video_id + upload_url
 * Phase 2: transfer video bytes from URL (server-side pull via upload_url)
 * Phase 3: finish upload and publish
 * Returns the video ID.
 */
export async function publishFacebookReel(
  accessToken: string,
  pageId: string,
  videoUrl: string,
  description: string
): Promise<string> {
  // Phase 1 — start
  const startData = await postJson<FBReelUploadResponse>(
    `${META_GRAPH_BASE}/${pageId}/video_reels`,
    {
      upload_phase: 'start',
      access_token: accessToken,
    }
  )

  if (!startData.video_id || !startData.upload_url) {
    throw new MetaGraphError('No video_id or upload_url returned when starting reel upload')
  }

  const { video_id, upload_url } = startData

  // Phase 2 — transfer: pull full bytes then POST (buffered). Streaming the
  // response body with duplex can fail tsc on RequestInit and has seen Graph
  // "Bad Request" when Content-Length on the source URL is missing or stale.
  const videoResponse = await fetch(videoUrl)
  if (!videoResponse.ok) {
    throw new MetaGraphError(`Failed to fetch video from URL: ${videoResponse.statusText}`)
  }

  const videoBytes = await videoResponse.arrayBuffer()
  const fileSize = String(videoBytes.byteLength)

  const uploadResponse = await fetch(upload_url, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: '0',
      file_size: fileSize,
    },
    body: videoBytes,
  })

  if (!uploadResponse.ok) {
    throw new MetaGraphError(`Reel upload transfer failed: ${uploadResponse.statusText}`)
  }

  // Phase 3 — finish and publish
  const finishData = await postJson<FBVideoResponse>(
    `${META_GRAPH_BASE}/${pageId}/video_reels`,
    {
      upload_phase: 'finish',
      video_id,
      video_state: 'PUBLISHED',
      description,
      access_token: accessToken,
    }
  )

  return finishData.video_id ?? finishData.id ?? video_id
}

// ---------------------------------------------------------------------------
// Page / IG organic insights — shared internal types
// ---------------------------------------------------------------------------

interface InsightsResponse extends MetaErrorBody {
  data?: Array<{
    name: string
    period: string
    values: Array<{ value: number | Record<string, number>; end_time: string }>
    id: string
  }>
}

interface PagePostsResponse extends MetaErrorBody {
  data?: Array<{
    id: string
    created_time: string
    permalink_url: string
    message?: string
  }>
}

interface PostInsightsResponse extends MetaErrorBody {
  data?: Array<{
    name: string
    values: Array<{ value: number | Record<string, number> }>
    id: string
  }>
}

interface IGMediaListResponse extends MetaErrorBody {
  data?: Array<{
    id: string
    timestamp: string
    media_type: string
    media_url?: string
    permalink: string
    caption?: string
  }>
}

interface IGMediaInsightsResponse extends MetaErrorBody {
  data?: Array<{
    name: string
    values: Array<{ value: number }>
    id: string
  }>
}

// ---------------------------------------------------------------------------
// Facebook Page insights — account-level
// ---------------------------------------------------------------------------

export interface PageInsightsDay {
  date: string
  page_impressions: number
  page_impressions_unique: number
  page_engaged_users: number
  page_post_engagements: number
  /** Snapshot: fan count as of end of the day window */
  page_fans: number
  page_fan_adds: number
  page_video_views: number
}

/**
 * Fetch Facebook Page account-level insights for a single calendar day.
 * `page_fans` is a "snapshot" / lifetime metric — value is the current fan
 * count at the end of the day, not a delta.
 */
export async function getPageInsights(
  accessToken: string,
  pageId: string,
  date: string
): Promise<PageInsightsDay> {
  const dayMetrics = [
    'page_impressions',
    'page_impressions_unique',
    'page_engaged_users',
    'page_post_engagements',
    'page_fan_adds',
    'page_video_views',
  ]
  const snapshotMetrics = ['page_fans']

  const sinceDate = new Date(`${date}T00:00:00Z`)
  const untilDate = new Date(sinceDate)
  untilDate.setUTCDate(untilDate.getUTCDate() + 1)
  const since = Math.floor(sinceDate.getTime() / 1000)
  const until = Math.floor(untilDate.getTime() / 1000)

  const [dayData, snapshotData] = await Promise.all([
    getJson<InsightsResponse>(
      `${META_GRAPH_BASE}/${pageId}/insights` +
        `?metric=${dayMetrics.join(',')}` +
        `&period=day&since=${since}&until=${until}` +
        `&access_token=${encodeURIComponent(accessToken)}`
    ),
    getJson<InsightsResponse>(
      `${META_GRAPH_BASE}/${pageId}/insights` +
        `?metric=${snapshotMetrics.join(',')}` +
        `&period=day&since=${since}&until=${until}` +
        `&access_token=${encodeURIComponent(accessToken)}`
    ),
  ])

  const values: Record<string, number> = {}
  for (const item of [...(dayData.data ?? []), ...(snapshotData.data ?? [])]) {
    const v = item.values?.[0]
    if (v !== undefined && typeof v.value === 'number') {
      values[item.name] = v.value
    }
  }

  return {
    date,
    page_impressions: values['page_impressions'] ?? 0,
    page_impressions_unique: values['page_impressions_unique'] ?? 0,
    page_engaged_users: values['page_engaged_users'] ?? 0,
    page_post_engagements: values['page_post_engagements'] ?? 0,
    page_fans: values['page_fans'] ?? 0,
    page_fan_adds: values['page_fan_adds'] ?? 0,
    page_video_views: values['page_video_views'] ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Facebook Page posts — with per-post insights
// ---------------------------------------------------------------------------

export interface PagePost {
  id: string
  created_time: string
  permalink_url: string
  message: string
  post_impressions: number
  post_engaged_users: number
  post_reactions_by_type_total: number
  post_clicks: number
}

/**
 * Fetch top N Facebook Page posts published in the last `lookbackDays` days
 * along with per-post insight metrics.
 */
export async function getPagePostsWithInsights(
  accessToken: string,
  pageId: string,
  lookbackDays = 30,
  topN = 10
): Promise<PagePost[]> {
  const since = Math.floor((Date.now() - lookbackDays * 86400 * 1000) / 1000)

  const postsData = await getJson<PagePostsResponse>(
    `${META_GRAPH_BASE}/${pageId}/posts` +
      `?fields=id,created_time,permalink_url,message` +
      `&since=${since}&limit=50` +
      `&access_token=${encodeURIComponent(accessToken)}`
  )

  const posts = (postsData.data ?? []).slice(0, topN)
  if (posts.length === 0) return []

  const postMetrics = [
    'post_impressions',
    'post_engaged_users',
    'post_reactions_by_type_total',
    'post_clicks',
  ]

  return Promise.all(
    posts.map(async (post): Promise<PagePost> => {
      try {
        const insightsData = await getJson<PostInsightsResponse>(
          `${META_GRAPH_BASE}/${post.id}/insights` +
            `?metric=${postMetrics.join(',')}&period=lifetime` +
            `&access_token=${encodeURIComponent(accessToken)}`
        )
        const insightMap: Record<string, number> = {}
        for (const item of insightsData.data ?? []) {
          const raw = item.values?.[0]?.value
          if (typeof raw === 'number') {
            insightMap[item.name] = raw
          } else if (typeof raw === 'object' && raw !== null) {
            insightMap[item.name] = Object.values(raw as Record<string, number>).reduce(
              (a, b) => a + b,
              0
            )
          }
        }
        return {
          id: post.id,
          created_time: post.created_time,
          permalink_url: post.permalink_url,
          message: (post.message ?? '').slice(0, 200),
          post_impressions: insightMap['post_impressions'] ?? 0,
          post_engaged_users: insightMap['post_engaged_users'] ?? 0,
          post_reactions_by_type_total: insightMap['post_reactions_by_type_total'] ?? 0,
          post_clicks: insightMap['post_clicks'] ?? 0,
        }
      } catch {
        return {
          id: post.id,
          created_time: post.created_time,
          permalink_url: post.permalink_url,
          message: (post.message ?? '').slice(0, 200),
          post_impressions: 0,
          post_engaged_users: 0,
          post_reactions_by_type_total: 0,
          post_clicks: 0,
        }
      }
    })
  )
}

// ---------------------------------------------------------------------------
// Instagram account-level insights
// ---------------------------------------------------------------------------

export interface IGAccountInsightsDay {
  date: string
  impressions: number
  reach: number
  profile_views: number
  /** Snapshot: follower count as of end of day */
  follower_count: number
  website_clicks: number
}

/**
 * Fetch Instagram Business account-level insights for a single calendar day.
 * `follower_count` is a snapshot metric queried at period=lifetime.
 */
export async function getIGAccountInsights(
  accessToken: string,
  igUserId: string,
  date: string
): Promise<IGAccountInsightsDay> {
  const sinceDate = new Date(`${date}T00:00:00Z`)
  const untilDate = new Date(sinceDate)
  untilDate.setUTCDate(untilDate.getUTCDate() + 1)
  const since = Math.floor(sinceDate.getTime() / 1000)
  const until = Math.floor(untilDate.getTime() / 1000)

  const dayMetrics = ['impressions', 'reach', 'profile_views', 'website_clicks']
  const snapshotMetrics = ['follower_count']

  const [dayData, snapshotData] = await Promise.all([
    getJson<InsightsResponse>(
      `${META_GRAPH_BASE}/${igUserId}/insights` +
        `?metric=${dayMetrics.join(',')}&period=day` +
        `&since=${since}&until=${until}` +
        `&access_token=${encodeURIComponent(accessToken)}`
    ),
    getJson<InsightsResponse>(
      `${META_GRAPH_BASE}/${igUserId}/insights` +
        `?metric=${snapshotMetrics.join(',')}&period=lifetime` +
        `&access_token=${encodeURIComponent(accessToken)}`
    ),
  ])

  const values: Record<string, number> = {}
  for (const item of [...(dayData.data ?? []), ...(snapshotData.data ?? [])]) {
    const v = item.values?.[0]
    if (v !== undefined && typeof v.value === 'number') {
      values[item.name] = v.value
    }
  }

  return {
    date,
    impressions: values['impressions'] ?? 0,
    reach: values['reach'] ?? 0,
    profile_views: values['profile_views'] ?? 0,
    follower_count: values['follower_count'] ?? 0,
    website_clicks: values['website_clicks'] ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Instagram media — top posts with per-media insights
// ---------------------------------------------------------------------------

export interface IGMedia {
  id: string
  timestamp: string
  media_type: string
  media_url: string
  permalink: string
  caption: string
  impressions: number
  reach: number
  engagement: number
  saved: number
}

/**
 * Fetch top N Instagram media items published in the last `lookbackDays` days
 * along with per-media insight metrics.
 */
export async function getIGMediaWithInsights(
  accessToken: string,
  igUserId: string,
  lookbackDays = 30,
  topN = 10
): Promise<IGMedia[]> {
  const mediaData = await getJson<IGMediaListResponse>(
    `${META_GRAPH_BASE}/${igUserId}/media` +
      `?fields=id,timestamp,media_type,media_url,permalink,caption` +
      `&limit=50&access_token=${encodeURIComponent(accessToken)}`
  )

  const cutoff = Date.now() - lookbackDays * 86400 * 1000
  const recentMedia = (mediaData.data ?? [])
    .filter((m) => new Date(m.timestamp).getTime() >= cutoff)
    .slice(0, topN)

  if (recentMedia.length === 0) return []

  const insightMetrics = ['impressions', 'reach', 'engagement', 'saved']

  return Promise.all(
    recentMedia.map(async (media): Promise<IGMedia> => {
      try {
        const insightsData = await getJson<IGMediaInsightsResponse>(
          `${META_GRAPH_BASE}/${media.id}/insights` +
            `?metric=${insightMetrics.join(',')}&period=lifetime` +
            `&access_token=${encodeURIComponent(accessToken)}`
        )
        const insightMap: Record<string, number> = {}
        for (const item of insightsData.data ?? []) {
          const raw = item.values?.[0]?.value
          if (typeof raw === 'number') insightMap[item.name] = raw
        }
        return {
          id: media.id,
          timestamp: media.timestamp,
          media_type: media.media_type,
          media_url: media.media_url ?? '',
          permalink: media.permalink,
          caption: (media.caption ?? '').slice(0, 200),
          impressions: insightMap['impressions'] ?? 0,
          reach: insightMap['reach'] ?? 0,
          engagement: insightMap['engagement'] ?? 0,
          saved: insightMap['saved'] ?? 0,
        }
      } catch {
        return {
          id: media.id,
          timestamp: media.timestamp,
          media_type: media.media_type,
          media_url: media.media_url ?? '',
          permalink: media.permalink,
          caption: (media.caption ?? '').slice(0, 200),
          impressions: 0,
          reach: 0,
          engagement: 0,
          saved: 0,
        }
      }
    })
  )
}

// ---------------------------------------------------------------------------
// Meta Ads Insights — daily metrics ingestor
// ---------------------------------------------------------------------------

/**
 * A single action entry returned by the Insights API's `actions` array.
 * Each entry has a type (e.g. "lead", "offsite_conversion.fb_pixel_purchase")
 * and a string value that represents the count.
 */
interface MetaActionEntry {
  action_type: string
  value: string
}

/**
 * One row from the Ads Insights API: could be at account level (no campaign_*
 * fields) or campaign level (campaign_id, campaign_name, etc. populated).
 */
export interface MetaAdsInsightRow {
  date_start: string
  date_stop: string
  impressions: string
  reach: string
  spend: string
  clicks: string
  cpm: string
  cpc: string
  ctr: string
  actions?: MetaActionEntry[]
  campaign_id?: string
  campaign_name?: string
  objective?: string
}

interface MetaInsightsApiResponse extends MetaErrorBody {
  data?: MetaAdsInsightRow[]
  paging?: {
    cursors?: { before?: string; after?: string }
    next?: string
  }
}

const INSIGHTS_FIELDS = [
  'impressions',
  'reach',
  'spend',
  'clicks',
  'cpm',
  'cpc',
  'ctr',
  'actions',
].join(',')

const CAMPAIGN_INSIGHTS_FIELDS = [
  'campaign_id',
  'campaign_name',
  'objective',
  ...INSIGHTS_FIELDS.split(','),
].join(',')

/**
 * Fetch Meta Ads Insights for a single day at both account and campaign scope.
 *
 * Uses `META_PAGE_ACCESS_TOKEN` (fallback: `META_PAGE_TOKEN`) and
 * `META_AD_ACCOUNT_ID` from the environment — consistent with the existing
 * lib/meta-marketing-api.mjs conventions.
 *
 * @param date - ISO date string `YYYY-MM-DD` for the day to pull.
 * @returns Object with `accountRow` (account-level totals) and `campaignRows`
 *          (one row per campaign). Both arrays may be empty if the API returns
 *          no data for that day.
 */
export async function getMetaAdsInsights(date: string): Promise<{
  accountRow: MetaAdsInsightRow | null
  campaignRows: MetaAdsInsightRow[]
}> {
  const token =
    process.env.META_PAGE_ACCESS_TOKEN?.trim() ||
    process.env.META_PAGE_TOKEN?.trim()
  if (!token) {
    throw new MetaGraphError(
      'META_PAGE_ACCESS_TOKEN (or META_PAGE_TOKEN) is not set in the environment'
    )
  }

  const rawAccountId = process.env.META_AD_ACCOUNT_ID?.trim()
  if (!rawAccountId) {
    throw new MetaGraphError('META_AD_ACCOUNT_ID is not set in the environment')
  }
  // Normalise: accept "act_123" or bare "123"
  const adAccountId = /^\d+$/.test(rawAccountId) ? `act_${rawAccountId}` : rawAccountId

  const buildUrl = (level: 'account' | 'campaign', fields: string): string => {
    const params = new URLSearchParams({
      access_token: token,
      level,
      fields,
      time_range: JSON.stringify({ since: date, until: date }),
      time_increment: '1',
      limit: '500',
    })
    return `${META_ADS_GRAPH_BASE}/${adAccountId}/insights?${params.toString()}`
  }

  // Account-level totals
  const accountUrl = buildUrl('account', INSIGHTS_FIELDS)
  const accountResp = await getJson<MetaInsightsApiResponse>(accountUrl)
  const accountRow = accountResp.data?.[0] ?? null

  // Campaign-level breakdown
  const campaignUrl = buildUrl('campaign', CAMPAIGN_INSIGHTS_FIELDS)
  const campaignResp = await getJson<MetaInsightsApiResponse>(campaignUrl)
  const campaignRows = campaignResp.data ?? []

  return { accountRow, campaignRows }
}

/**
 * Stub for the performance-pull cron — full per-post Meta (IG+FB)
 * metrics fetcher was scaffolded but not implemented. Returns a
 * "skipped" sentinel.
 */
export async function fetchMetaPostMetrics(_postId: string): Promise<Record<string, unknown>> {
  throw new Error('platform_skipped:meta:fetcher_not_implemented')
}
