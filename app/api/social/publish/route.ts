import { NextRequest, NextResponse } from 'next/server'
import {
  publishImage,
  publishReel,
  publishFacebookPost,
  publishFacebookPhoto,
  publishFacebookReel,
} from '@/lib/meta-graph'
import { directPostVideo } from '@/lib/tiktok'
import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken } from '@/lib/tiktok'
import { getYouTubeAccessToken, uploadYouTubeVideoFromUrl } from '@/lib/youtube'
import {
  getLinkedInAccessToken,
  getLinkedInPersonId,
  publishLinkedInVideoFromUrl,
} from '@/lib/linkedin'
import {
  getOrRefreshGoogleBusinessProfileAccessToken,
  publishGoogleBusinessLocalPost,
} from '@/lib/google-business-profile'
import { getXAccessToken, uploadVideoToX, postXTweet } from '@/lib/x'
import {
  getPinterestAccessToken,
  getDefaultPinterestBoardId,
  createPinterestVideoPin,
} from '@/lib/pinterest'
import { getThreadsAccessToken, publishThreadsVideo } from '@/lib/threads'
import { publishNextdoorPost } from '@/lib/nextdoor'

type Platform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'google_business_profile'
  | 'x'
  | 'pinterest'
  | 'threads'
  | 'nextdoor'
type MediaType = 'image' | 'video' | 'reel'

/**
 * Gate artifacts required for any publish call. Every field MUST be present and humanApprovedAt
 * MUST be ≤ 7 days old. The gate exists so an agent cannot bypass the QA + approval pipeline by
 * calling this route directly. See automation_skills/automation/publish/SKILL.md.
 */
interface GateArtifacts {
  /** Path to scorecard.json (VIRAL_GUARDRAILS scorecard, must score ≥ format minimum) */
  scorecardPath: string
  /** Path to citations.json (every figure traced to primary source) */
  citationsPath: string
  /** Path to qa_report.md (qa_pass output, all hard refuse conditions checked) */
  qaReportPath: string
  /** Path to postflight.json (ffprobe + blackdetect + frame checks) */
  postflightPath: string
  /** Path to ANTI_SLOP_MANIFESTO.md the asset was checked against */
  manifestoPath: string
  /** ISO timestamp of Matt's explicit chat approval. Must be ≤ 7 days old. */
  humanApprovedAt: string
  /** Format skill that produced the asset (e.g. "data_viz_video", "listing_reveal") */
  formatSkillName: string
  /** Optional: git SHA / version of the format skill at render time */
  formatSkillVersion?: string
}

interface PublishRequest {
  approved: boolean
  contentType?: string
  platforms: Platform[]
  mediaType: MediaType
  mediaUrl: string
  caption?: string
  captionDefault?: string
  captionPerPlatform?: Partial<Record<Platform, string>>
  hashtagsPerPlatform?: Partial<Record<Platform, string[]>>
  coverUrl?: string
  gate: GateArtifacts
  metadata?: {
    tiktok?: {
      title?: string
      privacyLevel?: string
    }
    youtube?: {
      title?: string
      description?: string
      tags?: string[]
      privacyStatus?: 'public' | 'private' | 'unlisted'
    }
    linkedin?: {
      visibility?: 'PUBLIC' | 'CONNECTIONS'
    }
    google_business_profile?: {
      summary?: string
      callToActionUrl?: string
    }
    pinterest?: {
      title?: string
      boardId?: string
    }
    nextdoor?: {
      ctaText?: string
      ctaUrl?: string
    }
  }
}

interface PlatformResult {
  success: boolean
  status: 'published' | 'submitted' | 'failed'
  externalPostId?: string
  url?: string | null
  error?: string
}

interface AuthToken {
  access_token: string
  refresh_token: string
  expires_at: string
}

const cronSecret = process.env.CRON_SECRET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function validateApiKey(key: string | null): boolean {
  if (!cronSecret) return false
  return key === cronSecret
}

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function resolveCaption(body: PublishRequest, platform: Platform): string {
  const perPlatform = body.captionPerPlatform?.[platform]
  const hashtags = body.hashtagsPerPlatform?.[platform] ?? []
  const base = perPlatform ?? body.captionDefault ?? body.caption ?? ''
  const hashtagSuffix = hashtags.length ? `\n\n${hashtags.join(' ')}` : ''
  return `${base}${hashtagSuffix}`.trim()
}

const GATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function validateGate(gate: GateArtifacts | undefined): { valid: true } | { valid: false; error: string } {
  if (!gate) return { valid: false, error: 'gate object is required (see automation_skills/automation/publish/SKILL.md)' }

  const required: (keyof GateArtifacts)[] = [
    'scorecardPath',
    'citationsPath',
    'qaReportPath',
    'postflightPath',
    'manifestoPath',
    'humanApprovedAt',
    'formatSkillName',
  ]
  for (const field of required) {
    const value = gate[field]
    if (typeof value !== 'string' || !value.trim()) {
      return { valid: false, error: `gate.${field} is required and must be a non-empty string` }
    }
  }

  const approvedAt = new Date(gate.humanApprovedAt)
  if (Number.isNaN(approvedAt.getTime())) {
    return { valid: false, error: 'gate.humanApprovedAt must be a valid ISO 8601 timestamp' }
  }
  const ageMs = Date.now() - approvedAt.getTime()
  if (ageMs < 0) {
    return { valid: false, error: 'gate.humanApprovedAt is in the future — clock skew or invalid timestamp' }
  }
  if (ageMs > GATE_MAX_AGE_MS) {
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000))
    return {
      valid: false,
      error: `gate.humanApprovedAt is ${days} days old (max 7). Re-run qa_pass + obtain fresh Matt approval before publishing.`,
    }
  }

  return { valid: true }
}

async function getTikTokAccessToken(): Promise<string> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('tiktok_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error || !data) {
    throw new Error('TikTok token not found in database')
  }

  const authData = data as AuthToken
  const expiresAt = new Date(authData.expires_at)

  if (Date.now() >= expiresAt.getTime()) {
    const refreshed = await refreshAccessToken(authData.refresh_token)

    await supabase
      .from('tiktok_auth')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('id', 'default')

    return refreshed.access_token
  }

  return authData.access_token
}

async function publishToInstagram(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string,
  coverUrl?: string
): Promise<PlatformResult> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const igUserId = process.env.META_IG_BUSINESS_ACCOUNT_ID

  if (!accessToken || !igUserId) {
    return {
      success: false,
      status: 'failed',
      error: 'Meta Instagram credentials not configured',
    }
  }

  try {
    let mediaId: string

    if (mediaType === 'image') {
      mediaId = await publishImage(accessToken, igUserId, mediaUrl, caption)
    } else {
      // video and reel both go via publishReel
      mediaId = await publishReel(accessToken, igUserId, mediaUrl, caption, { coverUrl })
    }

    return { success: true, status: 'published', externalPostId: mediaId, url: null }
  } catch (error) {
    console.error('Instagram publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Instagram publish failed',
    }
  }
}

async function publishToFacebook(
  mediaType: MediaType,
  mediaUrl: string,
  message: string
): Promise<PlatformResult> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  const pageId = process.env.META_FB_PAGE_ID

  if (!accessToken || !pageId) {
    return {
      success: false,
      status: 'failed',
      error: 'Meta Facebook credentials not configured',
    }
  }

  try {
    let postId: string

    if (mediaType === 'image') {
      postId = await publishFacebookPhoto(accessToken, pageId, mediaUrl, message)
    } else if (mediaType === 'reel') {
      postId = await publishFacebookReel(accessToken, pageId, mediaUrl, message)
    } else {
      // video — use feed post with link as fallback for URL-based videos
      postId = await publishFacebookPost(accessToken, pageId, message, mediaUrl)
    }

    return { success: true, status: 'published', externalPostId: postId, url: null }
  } catch (error) {
    console.error('Facebook publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Facebook publish failed',
    }
  }
}

async function publishToTikTok(
  mediaType: MediaType,
  mediaUrl: string,
  title: string
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return {
      success: false,
      status: 'failed',
      error: 'TikTok does not support image-only posts via this API',
    }
  }

  try {
    const accessToken = await getTikTokAccessToken()
    const result = await directPostVideo(accessToken, mediaUrl, {
      title,
      privacyLevel: 'PUBLIC_TO_EVERYONE',
    })
    return { success: true, status: 'submitted', externalPostId: result.publishId, url: null }
  } catch (error) {
    console.error('TikTok publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'TikTok publish failed',
    }
  }
}

async function publishToYouTube(
  mediaType: MediaType,
  mediaUrl: string,
  title: string,
  description: string,
  tags?: string[],
  privacyStatus?: 'public' | 'private' | 'unlisted'
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return {
      success: false,
      status: 'failed',
      error: 'YouTube requires video media',
    }
  }

  try {
    const accessToken = await getYouTubeAccessToken()
    const videoId = await uploadYouTubeVideoFromUrl({
      accessToken,
      videoUrl: mediaUrl,
      snippet: {
        title,
        description,
        tags,
      },
      status: {
        privacyStatus,
      },
    })

    return {
      success: true,
      status: 'published',
      externalPostId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }
  } catch (error) {
    console.error('YouTube publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'YouTube publish failed',
    }
  }
}

async function publishToLinkedIn(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string,
  visibility?: 'PUBLIC' | 'CONNECTIONS'
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return {
      success: false,
      status: 'failed',
      error: 'LinkedIn route currently supports video publish only',
    }
  }

  try {
    const accessToken = await getLinkedInAccessToken()
    const personId = getLinkedInPersonId()
    const postId = await publishLinkedInVideoFromUrl({
      accessToken,
      personId,
      mediaUrl,
      caption,
      visibility,
    })
    return {
      success: true,
      status: 'published',
      externalPostId: postId,
      url: null,
    }
  } catch (error) {
    console.error('LinkedIn publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'LinkedIn publish failed',
    }
  }
}

async function publishToX(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string
): Promise<PlatformResult> {
  try {
    const accessToken = await getXAccessToken()
    let mediaId: string | undefined

    if (mediaType !== 'image') {
      mediaId = await uploadVideoToX(accessToken, mediaUrl)
    }

    const tweetId = await postXTweet(accessToken, caption.slice(0, 280), mediaId)
    return {
      success: true,
      status: 'published',
      externalPostId: tweetId,
      url: `https://x.com/i/web/status/${tweetId}`,
    }
  } catch (error) {
    console.error('X publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'X publish failed',
    }
  }
}

async function publishToPinterest(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string,
  title?: string,
  boardId?: string
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return { success: false, status: 'failed', error: 'Pinterest video pin requires video media' }
  }

  try {
    const accessToken = await getPinterestAccessToken()
    const resolvedBoardId = boardId || (await getDefaultPinterestBoardId(accessToken))
    const pinId = await createPinterestVideoPin(
      accessToken,
      mediaUrl,
      title ?? caption.slice(0, 100),
      caption,
      resolvedBoardId
    )
    return { success: true, status: 'published', externalPostId: pinId, url: null }
  } catch (error) {
    console.error('Pinterest publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Pinterest publish failed',
    }
  }
}

async function publishToThreads(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string
): Promise<PlatformResult> {
  if (mediaType === 'image') {
    return { success: false, status: 'failed', error: 'Threads video post requires video media' }
  }

  try {
    const { accessToken, userId } = await getThreadsAccessToken()
    const postId = await publishThreadsVideo(accessToken, userId, mediaUrl, caption)
    return { success: true, status: 'published', externalPostId: postId, url: null }
  } catch (error) {
    console.error('Threads publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Threads publish failed',
    }
  }
}

async function publishToNextdoor(
  mediaType: MediaType,
  mediaUrl: string,
  caption: string,
  ctaText?: string,
  ctaUrl?: string
): Promise<PlatformResult> {
  try {
    const postId = await publishNextdoorPost({
      body: caption,
      imageUrl: mediaType === 'image' ? mediaUrl : undefined,
      videoUrl: mediaType !== 'image' ? mediaUrl : undefined,
      ctaText,
      ctaUrl,
    })
    return { success: true, status: 'published', externalPostId: postId, url: null }
  } catch (error) {
    console.error('Nextdoor publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Nextdoor publish failed',
    }
  }
}

async function publishToGoogleBusinessProfile(
  caption: string,
  mediaUrl: string,
  summary?: string,
  callToActionUrl?: string
): Promise<PlatformResult> {
  try {
    const accessToken = await getOrRefreshGoogleBusinessProfileAccessToken()
    const localPostName = await publishGoogleBusinessLocalPost({
      accessToken,
      summary: summary?.trim() || caption.slice(0, 1500),
      mediaUrl,
      callToActionUrl,
    })
    return {
      success: true,
      status: 'published',
      externalPostId: localPostName,
      url: null,
    }
  } catch (error) {
    console.error('Google Business Profile publish error:', error)
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Google Business Profile publish failed',
    }
  }
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-cron-secret')

  if (!validateApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body: PublishRequest = await request.json()
    const {
      approved,
      platforms,
      mediaType,
      mediaUrl,
      coverUrl,
    } = body

    if (!approved) {
      return NextResponse.json(
        { error: 'Publish blocked: approved must be true' },
        { status: 400 }
      )
    }

    const gateCheck = validateGate(body.gate)
    if (!gateCheck.valid) {
      return NextResponse.json(
        { error: `Publish blocked (gate): ${gateCheck.error}` },
        { status: 400 }
      )
    }

    if (!platforms?.length || !mediaType || !mediaUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: platforms, mediaType, mediaUrl' },
        { status: 400 }
      )
    }

    const validPlatforms: Platform[] = [
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
    ]
    const invalidPlatforms = platforms.filter((p) => !validPlatforms.includes(p))
    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { error: `Invalid platforms: ${invalidPlatforms.join(', ')}` },
        { status: 400 }
      )
    }

    // Fan out to all requested platforms in parallel
    const publishTasks: Promise<[Platform, PlatformResult]>[] = platforms.map(
      async (platform) => {
        let result: PlatformResult
        const caption = resolveCaption(body, platform)

        switch (platform) {
          case 'instagram':
            result = await publishToInstagram(mediaType, mediaUrl, caption, coverUrl)
            break
          case 'facebook':
            result = await publishToFacebook(mediaType, mediaUrl, caption)
            break
          case 'tiktok':
            result = await publishToTikTok(
              mediaType,
              mediaUrl,
              body.metadata?.tiktok?.title ?? caption.slice(0, 100)
            )
            break
          case 'youtube':
            result = await publishToYouTube(
              mediaType,
              mediaUrl,
              body.metadata?.youtube?.title ?? caption.slice(0, 100),
              body.metadata?.youtube?.description ?? caption,
              body.metadata?.youtube?.tags,
              body.metadata?.youtube?.privacyStatus
            )
            break
          case 'linkedin':
            result = await publishToLinkedIn(
              mediaType,
              mediaUrl,
              caption,
              body.metadata?.linkedin?.visibility
            )
            break
          case 'google_business_profile':
            result = await publishToGoogleBusinessProfile(
              caption,
              mediaUrl,
              body.metadata?.google_business_profile?.summary,
              body.metadata?.google_business_profile?.callToActionUrl
            )
            break
          case 'x':
            result = await publishToX(mediaType, mediaUrl, caption)
            break
          case 'pinterest':
            result = await publishToPinterest(
              mediaType,
              mediaUrl,
              caption,
              body.metadata?.pinterest?.title,
              body.metadata?.pinterest?.boardId
            )
            break
          case 'threads':
            result = await publishToThreads(mediaType, mediaUrl, caption)
            break
          case 'nextdoor':
            result = await publishToNextdoor(
              mediaType,
              mediaUrl,
              caption,
              body.metadata?.nextdoor?.ctaText,
              body.metadata?.nextdoor?.ctaUrl
            )
            break
          default:
            result = {
              success: false,
              status: 'failed',
              error: `Unknown platform: ${platform as string}`,
            }
        }

        return [platform, result] as [Platform, PlatformResult]
      }
    )

    const settled = await Promise.all(publishTasks)
    const results = Object.fromEntries(settled) as Record<Platform, PlatformResult>

    const allSucceeded = Object.values(results).every((r) => r.success)
    const anySucceeded = Object.values(results).some((r) => r.success)

    return NextResponse.json(
      {
        success: allSucceeded,
        partialSuccess: !allSucceeded && anySucceeded,
        results,
        summary: {
          publishedCount: Object.values(results).filter((r) => r.success).length,
          attemptedCount: platforms.length,
        },
      },
      { status: allSucceeded || anySucceeded ? 200 : 500 }
    )
  } catch (error) {
    console.error('Unified publish error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to publish content',
      },
      { status: 500 }
    )
  }
}
