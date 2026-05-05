import { NextResponse } from 'next/server'
import { getGoogleBusinessProfileAuthorizationUrl } from '@/lib/google-business-profile'

export async function GET() {
  try {
    const url = await getGoogleBusinessProfileAuthorizationUrl()
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Google Business Profile authorize error:', error)
    return NextResponse.json(
      { error: 'Failed to start Google Business Profile authorization' },
      { status: 500 }
    )
  }
}
