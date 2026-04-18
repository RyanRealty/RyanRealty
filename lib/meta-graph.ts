const META_GRAPH_BASE = 'https://graph.facebook.com/v22.0'
const META_IG_BASE = 'https://graph.instagram.com/v22.0'

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

  // Phase 2 — transfer: download the video and pipe it to the upload URL
  const videoResponse = await fetch(videoUrl)
  if (!videoResponse.ok) {
    throw new MetaGraphError(`Failed to fetch video from URL: ${videoResponse.statusText}`)
  }

  const uploadResponse = await fetch(upload_url, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: '0',
      file_size: videoResponse.headers.get('content-length') ?? '0',
    },
    body: videoResponse.body,
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
