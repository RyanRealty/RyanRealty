import { NextResponse } from 'next/server'
import { getSearchSuggestions } from '@/app/actions/listings'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({
      addresses: [],
      cities: [],
      subdivisions: [],
      neighborhoods: [],
      zips: [],
      brokers: [],
      reports: [],
    })
  }

  try {
    const suggestions = await getSearchSuggestions(q)
    return NextResponse.json(suggestions)
  } catch (err) {
    console.error('[api/search/suggestions]', err)
    return NextResponse.json(
      {
        addresses: [],
        cities: [],
        subdivisions: [],
        neighborhoods: [],
        zips: [],
        brokers: [],
        reports: [],
      },
      { status: 200 }
    )
  }
}
