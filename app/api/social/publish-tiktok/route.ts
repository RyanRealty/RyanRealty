import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { directPostVideo, refreshAccessToken } from '@/lib/tiktok'

interface PublishRequest {
  videoUrl: string
  title: string
  privacyLevel?: string
}

interface AuthToken {
  access_token: string
  refresh_token: string
  expires_at: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const cronSecret = process.env.CRON_SECRET

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function validateApiKey(key: string | null): boolean {
  if (!cronSecret) return false
  return key === cronSecret
}

async function getOrRefreshAccessToken(): Promise<string> {
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
  const now = new Date()

  if (now >= expiresAt) {
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
    const { videoUrl, title, privacyLevel = 'PUBLIC' } = body

    if (!videoUrl || !title) {
      return NextResponse.json(
        { error: 'Missing videoUrl or title' },
        { status: 400 }
      )
    }

    const accessToken = await getOrRefreshAccessToken()

    const result = await directPostVideo(accessToken, videoUrl, {
      title,
      privacyLevel,
    })

    return NextResponse.json({
      success: true,
      publishId: result.publishId,
      status: 'submitted',
    })
  } catch (error) {
    console.error('TikTok publish error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to publish video',
      },
      { status: 500 }
    )
  }
}
