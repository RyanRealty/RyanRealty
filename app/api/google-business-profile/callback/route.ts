import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeGoogleCodeForToken,
  upsertGoogleBusinessProfileToken,
  validateGoogleBusinessProfileState,
} from '@/lib/google-business-profile'

function redirectUrl(request: NextRequest, path: string): string {
  const origin = new URL(request.url).origin
  return `${origin}${path}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim()
  const state = searchParams.get('state')?.trim()
  const error = searchParams.get('error')?.trim()
  const errorDescription = searchParams.get('error_description')?.trim()

  if (error) {
    const reason = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(redirectUrl(request, `/admin/social?gbp=error&reason=${reason}`))
  }

  if (!code || !state) {
    return NextResponse.redirect(
      redirectUrl(request, '/admin/social?gbp=error&reason=Missing+code+or+state')
    )
  }

  try {
    const isValidState = await validateGoogleBusinessProfileState(state)
    if (!isValidState) {
      return NextResponse.redirect(
        redirectUrl(request, '/admin/social?gbp=error&reason=Invalid+state')
      )
    }

    const tokenData = await exchangeGoogleCodeForToken(code)
    await upsertGoogleBusinessProfileToken(tokenData)
    return NextResponse.redirect(redirectUrl(request, '/admin/social?gbp=connected'))
  } catch (err) {
    console.error('Google Business Profile callback error:', err)
    const reason = encodeURIComponent(err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.redirect(redirectUrl(request, `/admin/social?gbp=error&reason=${reason}`))
  }
}
