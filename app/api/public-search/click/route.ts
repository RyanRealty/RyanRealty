import { NextRequest, NextResponse } from 'next/server'
import { trackPublicSearchClick } from '@/app/actions/saved-searches'
import { listingsBrowsePath } from '@/lib/slug'

function safeInternalPath(input: string | null): string {
  const fallback = listingsBrowsePath()
  if (!input) return fallback
  try {
    const decoded = decodeURIComponent(input).trim()
    if (!decoded.startsWith('/')) return fallback
    if (decoded.startsWith('//')) return fallback
    return decoded
  } catch {
    return fallback
  }
}

export async function GET(request: NextRequest) {
  const searchId = request.nextUrl.searchParams.get('searchId') ?? ''
  const to = request.nextUrl.searchParams.get('to')
  await trackPublicSearchClick(searchId)
  return NextResponse.redirect(new URL(safeInternalPath(to), request.url), { status: 307 })
}
