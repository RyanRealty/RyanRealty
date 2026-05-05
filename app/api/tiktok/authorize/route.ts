import { NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/tiktok'

export async function GET() {
  try {
    const { url } = await getAuthorizationUrl()
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('TikTok authorize error:', error)
    return NextResponse.json(
      { error: 'Failed to start TikTok authorization' },
      { status: 500 }
    )
  }
}
