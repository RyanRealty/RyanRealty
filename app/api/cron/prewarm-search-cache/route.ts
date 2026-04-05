import { NextResponse } from 'next/server'
import { getBrowseCities } from '@/app/actions/listings'
import { prewarmSearchCache } from '@/app/actions/search-cache'
import { SEARCH_PRESETS } from '@/lib/search-presets'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cities = (await getBrowseCities()).slice(0, 12).map((row) => row.City)
    const targets: Array<{ city: string; preset: string }> = []
    for (const city of cities) {
      for (const preset of SEARCH_PRESETS) {
        targets.push({ city, preset: preset.slug })
      }
    }

    let warmed = 0
    for (const target of targets) {
      const preset = SEARCH_PRESETS.find((p) => p.slug === target.preset)
      if (!preset) continue
      const filters: Record<string, unknown> = {
        city: target.city,
        ...preset.params,
      }
      await prewarmSearchCache(filters, 24)
      warmed += 1
    }

    return NextResponse.json({
      ok: true,
      cities: cities.length,
      presetsPerCity: SEARCH_PRESETS.length,
      warmed,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prewarm search cache' },
      { status: 500 }
    )
  }
}
