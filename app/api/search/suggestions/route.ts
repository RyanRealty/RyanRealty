import { NextResponse } from 'next/server'
import { getSearchSuggestions, type SearchSuggestionsResult } from '@/app/actions/listings'

const EMPTY: SearchSuggestionsResult = {
  addresses: [],
  cities: [],
  subdivisions: [],
  neighborhoods: [],
  zips: [],
  brokers: [],
  reports: [],
  pages: [],
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json(EMPTY, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    })
  }

  try {
    const suggestions = await getSearchSuggestions(q)
    // A degraded result (a backing read failed) must never be pinned by the
    // CDN — s-maxage on an empty-on-error body served an empty dropdown to
    // every user for up to s-maxage + swr (the cached-empty-fallback class).
    const cacheControl = suggestions.degraded
      ? 'no-store'
      : 'public, s-maxage=120, stale-while-revalidate=600'
    return NextResponse.json(suggestions, { headers: { 'Cache-Control': cacheControl } })
  } catch (err) {
    console.error('[api/search/suggestions]', err)
    return NextResponse.json(
      { ...EMPTY, degraded: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
